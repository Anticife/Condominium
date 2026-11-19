import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  ShieldAlert,
  ArrowRight,
  FileText,
  LogOut,
  Building2,
  Clock,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { registerOwnProfile } from '../../services/userService';

function mapFirebaseAuthError(error) {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifique sus credenciales.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con ese correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espere unos minutos antes de reintentar.';
    case 'auth/network-request-failed':
      return 'Error de red al conectar con Firebase Authentication. Verifique su conexión.';
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'El proveedor Correo/Contraseña no está habilitado aún en Firebase Authentication (condominium-f6236).';
    default:
      return error?.message || 'Error inesperado de autenticación.';
  }
}

export default function AuthScreen({ authUser, userProfile, profileLoading, onProfileCreated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [emailVerifiedState, setEmailVerifiedState] = useState(Boolean(authUser?.emailVerified));

  const handleSendVerification = async () => {
    if (!authUser) return;
    setSendingVerification(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await sendEmailVerification(authUser);
      setInfoMsg(`Correo de verificación enviado a ${authUser.email}. Revise su bandeja de entrada o carpeta de Spam.`);
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (!authUser) return;
    setCheckingVerification(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await reload(authUser);
      const verified = Boolean(auth.currentUser?.emailVerified);
      setEmailVerifiedState(verified);
      if (verified) {
        setInfoMsg('Correo electrónico verificado correctamente.');
      } else {
        setInfoMsg('El correo aún aparece sin verificar. Abra el enlace enviado a su bandeja de entrada y vuelva a pulsar este botón.');
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setCheckingVerification(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Ingrese primero su correo electrónico en el campo de arriba para enviarle el enlace de recuperación.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg(`Se envió un enlace de recuperación de contraseña a ${email.trim()}. Revise su bandeja de entrada o Spam.`);
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    await signOut(auth);
  };

  // Estado intermedio mientras carga el perfil Firestore del usuario autenticado
  if (authUser && profileLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#161616', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="cds-tile" style={{ maxWidth: '460px', width: '100%', backgroundColor: '#262626', border: '1px solid #393939', color: '#ffffff' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff', marginBottom: '6px' }}>
            VERIFICANDO PERFIL Y PERMISOS // CLOUD FIRESTORE
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Cargando perfil operativo...</h2>
          <p style={{ fontSize: '13px', color: '#c6c6c6', marginTop: '8px' }}>
            Consultando credenciales y asignación de rol para <span className="font-mono">{authUser.email}</span>.
          </p>
        </div>
      </div>
    );
  }

  // Usuario autenticado en Auth pero sin documento en users/{uid} (p. ej. interrupción previa)
  if (authUser && !userProfile) {
    const handleCompleteProfile = async () => {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        await registerOwnProfile(db, {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Residente',
        });
        if (onProfileCreated) onProfileCreated();
      } catch (err) {
        setErrorMsg(err?.message || 'No se pudo inicializar el perfil en Firestore.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #161616', maxWidth: '520px', width: '100%' }}>
          <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', borderBottom: '2px solid #0f62fe' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff' }}>COMPLETAR REGISTRO // SCRUM-6</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>Inicializar Perfil de Usuario</h2>
          </div>
          <div style={{ padding: '24px' }}>
            {errorMsg && (
              <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '10px 12px', fontSize: '12px', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}
            <p style={{ fontSize: '13px', color: '#393939', marginBottom: '16px' }}>
              Su cuenta (<span className="font-mono">{authUser.email}</span>) está autenticada, pero aún no tiene perfil creado en Firestore. Pulse el botón para crear su perfil de residente.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="cds-btn cds-btn-primary" onClick={handleCompleteProfile} disabled={submitting} style={{ flex: 1 }}>
                <span>{submitting ? 'Creando perfil...' : 'Crear Perfil en Firestore'}</span>
                <ArrowRight size={16} />
              </button>
              <button type="button" className="cds-btn cds-btn-secondary" onClick={handleSignOut}>
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cuenta desactivada por Administración (RF-02)
  if (authUser && userProfile && userProfile.isActive === false) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #da1e28', maxWidth: '520px', width: '100%' }}>
          <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', borderBottom: '3px solid #da1e28', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Ban size={20} color="#fa4d56" />
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#ff8389' }}>CONTROL DE ACCESO // RF-02</div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Cuenta Desactivada</h2>
            </div>
          </div>
          <div style={{ padding: '24px' }}>
            <p style={{ fontSize: '13px', color: '#393939', lineHeight: 1.5, marginBottom: '16px' }}>
              La cuenta <strong>{userProfile.displayName || userProfile.email}</strong> ha sido desactivada por la Administración del conjunto y no tiene acceso operativo en este momento.
            </p>
            <p style={{ fontSize: '12px', color: '#525252', marginBottom: '20px' }}>
              Comuníquese con la Administración si considera que se trata de un error.
            </p>
            <button type="button" className="cds-btn cds-btn-secondary" onClick={handleSignOut} style={{ width: '100%' }}>
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Residente activo pero pendiente de asignación de apartamento (CON-01 / CON-02)
  if (authUser && userProfile && userProfile.role === 'residente' && !userProfile.unitId) {
    const isVerified = emailVerifiedState || Boolean(authUser.emailVerified);
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #161616', maxWidth: '560px', width: '100%' }}>
          <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', borderBottom: '2px solid #0f62fe', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color="#78a9ff" />
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff' }}>ASIGNACIÓN PENDIENTE // RN-B7 HABEAS DATA</div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Cuenta en Espera de Asignación de Unidad</h2>
            </div>
          </div>
          <div style={{ padding: '24px' }}>
            {errorMsg && (
              <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div style={{ backgroundColor: '#defbe6', border: '1px solid #42be65', color: '#0e6027', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
                {infoMsg}
              </div>
            )}

            <div style={{ backgroundColor: '#edf5ff', borderLeft: '4px solid #0f62fe', padding: '12px 14px', fontSize: '13px', color: '#002d9c', marginBottom: '16px' }}>
              <CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Su registro como residente se completó correctamente. Por seguridad y protección de datos (Ley 1581), la Administración debe asociar su cuenta a su apartamento antes de habilitar paquetes, reservas y autorizados.
            </div>

            {/* Estado de verificación de correo */}
            <div style={{
              backgroundColor: isVerified ? '#defbe6' : '#fcf4d6',
              borderLeft: `4px solid ${isVerified ? '#24a148' : '#f1c21b'}`,
              padding: '12px 14px',
              fontSize: '12px',
              color: '#161616',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                {isVerified ? 'Correo electrónico verificado' : 'Correo electrónico pendiente de verificación'}
              </div>
              {!isVerified && (
                <>
                  <p style={{ color: '#393939', marginBottom: '10px', lineHeight: 1.4 }}>
                    Verifique su correo (<span className="font-mono">{authUser.email}</span>) mediante el enlace enviado por Firebase Authentication. Si aún no lo recibió, pulse el botón para reenviarlo (revise también Spam).
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="cds-btn cds-btn-primary"
                      style={{ height: '32px', minHeight: '32px', fontSize: '12px', padding: '0 12px' }}
                      onClick={handleSendVerification}
                      disabled={sendingVerification}
                    >
                      <Mail size={14} />
                      <span>{sendingVerification ? 'Enviando...' : 'Enviar / Reenviar correo de verificación'}</span>
                    </button>
                    <button
                      type="button"
                      className="cds-btn cds-btn-secondary"
                      style={{ height: '32px', minHeight: '32px', fontSize: '12px', padding: '0 12px' }}
                      onClick={handleRefreshVerification}
                      disabled={checkingVerification}
                    >
                      <span>{checkingVerification ? 'Comprobando...' : 'Ya verifiqué mi correo'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ backgroundColor: '#f4f4f4', padding: '12px 14px', fontSize: '12px', marginBottom: '20px', fontFamily: 'var(--cds-font-mono)' }}>
              <div><strong>Usuario:</strong> {userProfile.displayName || '—'}</div>
              <div><strong>Correo:</strong> {userProfile.email}</div>
              <div><strong>Verificado:</strong> {isVerified ? 'Sí' : 'Pendiente'}</div>
              <div><strong>UID:</strong> {userProfile.uid}</div>
              <div><strong>Rol actual:</strong> {userProfile.role}</div>
            </div>
            <button type="button" className="cds-btn cds-btn-secondary" onClick={handleSignOut} style={{ width: '100%' }}>
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Formulario Login / Registro real con Firebase Authentication
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Ingrese su correo electrónico y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Ingrese un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    if (!acceptedPrivacy) {
      setErrorMsg('Debe aceptar la política de tratamiento de datos personales (Ley 1581 de 2012) para registrarse.');
      return;
    }

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await registerOwnProfile(db, {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: fullName.trim(),
        phone: phone.trim(),
      });
      try {
        await sendEmailVerification(cred.user);
        setInfoMsg(`Correo de verificación enviado a ${cred.user.email}. Revise su bandeja de entrada o Spam.`);
      } catch (verifyErr) {
        console.warn('sendEmailVerification warning:', verifyErr);
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#161616',
      display: 'flex',
      flexDirection: 'column',
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
        {/* Carbon Auth Header */}
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
              MI CONJUNTO EN LÍNEA // ALTOS DEL PARQUE P.H.
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>
              Acceso al Sistema Operativo
            </h1>
          </div>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f4f4f4' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: mode === 'login' ? '#ffffff' : '#f4f4f4',
              color: mode === 'login' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: mode === 'login' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); setInfoMsg(null); }}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: mode === 'register' ? '#ffffff' : '#f4f4f4',
              color: mode === 'register' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: mode === 'register' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer',
            }}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px' }}>
          {errorMsg && (
            <div style={{
              backgroundColor: '#fff1f1',
              border: '1px solid #ffb3b8',
              color: '#a2191f',
              padding: '10px 12px',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div style={{
              backgroundColor: '#defbe6',
              border: '1px solid #42be65',
              color: '#0e6027',
              padding: '10px 12px',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{infoMsg}</div>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">CORREO ELECTRÓNICO</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="email"
                    className="cds-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="usuario@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="cds-input-label">CONTRASEÑA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="password"
                    className="cds-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submitting}>
                <span>{submitting ? 'VERIFICANDO CREDENCIALES...' : 'INGRESAR AL SISTEMA'}</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ marginTop: '12px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={submitting}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0f62fe',
                    fontSize: '12px',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ¿Olvidaste tu contraseña? Enviar correo de recuperación
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">NOMBRE COMPLETO</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="text"
                    className="cds-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="Nombres y apellidos"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="cds-input-label">CORREO ELECTRÓNICO</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                    <input
                      type="email"
                      className="cds-input"
                      style={{ paddingLeft: '36px' }}
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="cds-input-label">TELÉFONO (OPCIONAL)</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                    <input
                      type="tel"
                      className="cds-input font-mono"
                      style={{ paddingLeft: '36px' }}
                      placeholder="3001234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="cds-input-label">CONTRASEÑA (MÍN. 6)</label>
                  <input
                    type="password"
                    className="cds-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="cds-input-label">CONFIRMAR CONTRASEÑA</label>
                  <input
                    type="password"
                    className="cds-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#393939', marginBottom: '16px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Acepto el tratamiento de mis datos personales conforme a la <strong>Ley 1581 de 2012 (Habeas Data)</strong>.
                </span>
              </label>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submitting}>
                <span>{submitting ? 'REGISTRANDO CUENTA...' : 'REGISTRARSE EN LA PLATAFORMA'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Ley 1581 Notice Footer */}
          <div style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '11px',
            color: '#6f6f6f',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <FileText size={16} style={{ color: '#0f62fe', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Protección de Datos (Ley 1581 de 2012):</strong> Las credenciales se gestionan mediante Firebase Authentication y las reglas de seguridad de Cloud Firestore garantizan aislamiento estricto por rol y unidad.{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}
                style={{ background: 'none', border: 'none', color: '#0f62fe', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '11px' }}
              >
                {showPrivacyPolicy ? 'Ocultar política' : 'Ver política completa'}
              </button>
            </div>
          </div>

          {showPrivacyPolicy && (
            <div style={{
              marginTop: '10px',
              padding: '12px',
              backgroundColor: '#f4f4f4',
              border: '1px solid #e0e0e0',
              fontSize: '11px',
              color: '#393939',
              lineHeight: 1.4,
            }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>POLÍTICA DE TRATAMIENTO DE DATOS — ALTOS DEL PARQUE P.H.</p>
              <p>1. Finalidad: Control de paquetería en portería (RN-B4), reservas de zonas comunes (RN-B1..B3) y gestión de PQRS (RN-B6).</p>
              <p>2. Aislamiento: Ningún residente puede consultar información ni autorizados de otro apartamento (RN-B7).</p>
              <p>3. Derechos: El titular puede actualizar su contacto o revocar personas autorizadas en cualquier momento desde su portal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
