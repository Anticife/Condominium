import React, { useEffect, useState } from 'react';
import {
  applyActionCode,
  confirmPasswordReset,
  reload,
  verifyPasswordResetCode,
} from 'firebase/auth';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { auth } from '../../config/firebase';

function mapActionCodeError(error) {
  const code = error?.code || '';
  switch (code) {
    case 'auth/expired-action-code':
      return 'El enlace ha expirado. Solicite uno nuevo desde la pantalla de acceso.';
    case 'auth/invalid-action-code':
      return 'El enlace no es válido o ya fue utilizado anteriormente.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido desactivada por la Administración.';
    case 'auth/user-not-found':
      return 'No se encontró una cuenta asociada a este enlace.';
    case 'auth/weak-password':
      return 'La nueva contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
    default:
      return error?.message || 'No se pudo completar la acción solicitada.';
  }
}

export default function AuthActionHandler({ action, onDone }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function processAction() {
      setStatus('loading');
      setMessage('');

      try {
        if (action.mode === 'verifyEmail') {
          await applyActionCode(auth, action.oobCode);
          if (auth.currentUser) {
            try {
              await reload(auth.currentUser);
            } catch (reloadErr) {
              console.warn('Auth reload warning after verifyEmail:', reloadErr);
            }
          }
          if (!cancelled) {
            setStatus('success');
            setMessage('Su correo electrónico fue verificado correctamente. Ya puede continuar en la plataforma.');
          }
        } else if (action.mode === 'resetPassword') {
          const accountEmail = await verifyPasswordResetCode(auth, action.oobCode);
          if (!cancelled) {
            setResetEmail(accountEmail);
            setStatus('ready');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(mapActionCodeError(err));
        }
      }
    }

    processAction();
    return () => {
      cancelled = true;
    };
  }, [action.mode, action.oobCode]);

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await confirmPasswordReset(auth, action.oobCode, newPassword);
      setStatus('success');
      setMessage('Contraseña restablecida correctamente. Ya puede iniciar sesión con su nueva clave.');
    } catch (err) {
      setMessage(mapActionCodeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    action.mode === 'verifyEmail'
      ? 'Verificación de Correo Electrónico'
      : 'Restablecer Contraseña';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#161616',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      fontFamily: 'var(--cds-font-sans)',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid #393939',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
      }}>
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '20px 24px',
          borderBottom: '2px solid #0f62fe',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ backgroundColor: '#0f62fe', padding: '10px', display: 'flex' }}>
            <Building2 size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff', letterSpacing: '0.6px' }}>
              MI CONJUNTO EN LÍNEA // AUTH ACTION HANDLER
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{title}</h1>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {status === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#393939', fontSize: '13px' }}>
              <Mail size={18} color="#0f62fe" />
              <span>Validando código de seguridad con Firebase Authentication...</span>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div style={{
                backgroundColor: '#fff1f1',
                border: '1px solid #ffb3b8',
                color: '#a2191f',
                padding: '12px 14px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{message}</div>
              </div>
              <button type="button" className="cds-btn cds-btn-primary" style={{ width: '100%' }} onClick={onDone}>
                <span>Volver al Inicio</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div style={{
                backgroundColor: '#defbe6',
                border: '1px solid #42be65',
                color: '#0e6027',
                padding: '12px 14px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{message}</div>
              </div>
              <button type="button" className="cds-btn cds-btn-primary" style={{ width: '100%' }} onClick={onDone}>
                <span>Continuar a la Plataforma</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {status === 'ready' && action.mode === 'resetPassword' && (
            <form onSubmit={handleConfirmReset}>
              <p style={{ fontSize: '13px', color: '#393939', marginBottom: '16px' }}>
                Cuenta verificada: <strong className="font-mono">{resetEmail}</strong>. Ingrese su nueva contraseña.
              </p>

              {message && (
                <div style={{
                  backgroundColor: '#fff1f1',
                  border: '1px solid #ffb3b8',
                  color: '#a2191f',
                  padding: '10px 12px',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}>
                  {message}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label className="cds-input-label">NUEVA CONTRASEÑA (MÍN. 6)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="password"
                    className="cds-input"
                    style={{ paddingLeft: '36px' }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="cds-input-label">CONFIRMAR NUEVA CONTRASEÑA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="password"
                    className="cds-input"
                    style={{ paddingLeft: '36px' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submitting}>
                <span>{submitting ? 'ACTUALIZANDO CONTRASEÑA...' : 'GUARDAR NUEVA CONTRASEÑA'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
