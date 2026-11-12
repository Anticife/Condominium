import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  Building2, 
  User, 
  ShieldAlert, 
  ArrowRight, 
  FileText, 
  X 
} from 'lucide-react';

export const PRESET_USERS = [
  {
    role: 'portero',
    name: 'Vigilante Néstor Beltrán',
    email: 'portero@altosparque.com',
    roleLabel: 'Vigilante / Portería Principal',
    badge: 'CONTROL DE ACCESO & CUSTODIA',
    unitId: null,
    doc: 'CC 79.845.120'
  },
  {
    role: 'residente',
    name: 'Carlos Rodríguez',
    email: 'carlos.rodriguez@altosparque.com',
    roleLabel: 'Residente Titular',
    badge: 'TORRE 1 - APTO 101',
    unitId: 'T1-101',
    doc: 'CC 1.020.445.890'
  },
  {
    role: 'admin',
    name: 'Dra. Patricia Gómez',
    email: 'admin@altosparque.com',
    roleLabel: 'Administradora General',
    badge: 'CONSEJO DE ADMINISTRACIÓN // P.H.',
    unitId: null,
    doc: 'CC 52.334.901'
  }
];

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'form' | 'privacy'
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (user) => {
    onLoginSuccess(user);
    if (onClose) onClose();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setAuthError(null);

    if (!emailInput || !passwordInput) {
      setAuthError('Por favor ingrese su correo institucional y contraseña.');
      return;
    }

    if (!emailInput.includes('@')) {
      setAuthError('Ingrese una dirección de correo válida.');
      return;
    }

    if (passwordInput.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    // Match or construct profile
    const lower = emailInput.toLowerCase();
    let matched = PRESET_USERS.find(p => p.email.toLowerCase() === lower);
    if (!matched) {
      if (lower.includes('portero') || lower.includes('guard')) {
        matched = {
          role: 'portero',
          name: emailInput.split('@')[0],
          email: emailInput,
          roleLabel: 'Personal de Seguridad',
          badge: 'PORTERÍA',
          unitId: null
        };
      } else if (lower.includes('admin')) {
        matched = {
          role: 'admin',
          name: emailInput.split('@')[0],
          email: emailInput,
          roleLabel: 'Administración',
          badge: 'CONSEJO',
          unitId: null
        };
      } else {
        matched = {
          role: 'residente',
          name: emailInput.split('@')[0],
          email: emailInput,
          roleLabel: 'Residente',
          badge: 'APARTAMENTO REGISTRADO',
          unitId: 'T1-101'
        };
      }
    }

    onLoginSuccess(matched);
    if (onClose) onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(22, 22, 22, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      fontFamily: 'var(--cds-font-sans)'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '520px',
        border: '1px solid #161616',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Masthead Header */}
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f62fe'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff', letterSpacing: '0.5px' }}>
              ALTOS DEL PARQUE // CONTROL DE ACCESO (SCRUM-7, SCRUM-8)
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>
              Autenticación & Identidad Institucional
            </h2>
          </div>
          {onClose && (
            <button 
              type="button" 
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#c6c6c6', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f4f4f4' }}>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeTab === 'presets' ? '#ffffff' : '#f4f4f4',
              color: activeTab === 'presets' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: activeTab === 'presets' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer'
            }}
          >
            Acceso Rápido por Perfil (1-Clic)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeTab === 'form' ? '#ffffff' : '#f4f4f4',
              color: activeTab === 'form' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: activeTab === 'form' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer'
            }}
          >
            Credenciales de Usuario
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {authError && (
            <div style={{
              backgroundColor: '#fff1f1',
              border: '1px solid #ffb3b8',
              color: '#ba1b23',
              padding: '10px 12px',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <ShieldAlert size={16} />
              <div>{authError}</div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div>
              <p style={{ fontSize: '13px', color: '#525252', marginBottom: '16px', lineHeight: 1.4 }}>
                Selecciona un perfil operativo para ingresar inmediatamente al entorno con los permisos correspondientes:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PRESET_USERS.map(user => (
                  <button
                    key={user.role}
                    type="button"
                    onClick={() => handleSelectPreset(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #8d8d8d',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0f62fe';
                      e.currentTarget.style.backgroundColor = '#f4f4f4';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#8d8d8d';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        backgroundColor: user.role === 'admin' ? '#0f62fe' : user.role === 'portero' ? '#161616' : '#24a148',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {user.role === 'admin' ? <Building2 size={18} /> : user.role === 'portero' ? <ShieldCheck size={18} /> : <User size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#161616' }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#525252' }}>
                          {user.roleLabel} • <span className="font-mono">{user.email}</span>
                        </div>
                        <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe', fontWeight: 600, marginTop: '2px' }}>
                          {user.badge}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={16} color="#0f62fe" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'form' && (
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">CORREO INSTITUCIONAL</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="email"
                    className="cds-input"
                    placeholder="usuario@altosparque.com"
                    style={{ paddingLeft: '36px' }}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="cds-input-label">CONTRASEÑA DE SEGURIDAD</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8d8d8d' }} />
                  <input
                    type="password"
                    className="cds-input"
                    placeholder="••••••••••••"
                    style={{ paddingLeft: '36px' }}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }}>
                <span>VALIDAR CREDENCIALES & ACCEDER</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Legal Habeas Data Compliance Notice (SCRUM-53) */}
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '11px',
            color: '#6f6f6f',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <FileText size={16} style={{ color: '#0f62fe', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Aviso Legal y Tratamiento de Datos (Ley 1581 de 2012):</strong> Al autenticarse, usted acepta que el Conjunto Residencial Altos del Parque almacene y trate sus datos personales exclusivamente para fines de seguridad, control de correspondencia y convivencia de la copropiedad.{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyNotice(!showPrivacyNotice)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0f62fe',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '11px'
                }}
              >
                {showPrivacyNotice ? 'Ocultar términos' : 'Ver política de privacidad completa'}
              </button>
            </div>
          </div>

          {showPrivacyNotice && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#f4f4f4',
              border: '1px solid #e0e0e0',
              fontSize: '11px',
              color: '#393939',
              lineHeight: 1.4,
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>POLÍTICA DE PRIVACIDAD — ALTOS DEL PARQUE P.H.</p>
              <p>1. Responsable: Administración de Altos del Parque, NIT 900.542.118-2.</p>
              <p>2. Finalidad: Registro de visitantes, recepción y entrega de paquetes por courier (RN-B4, RN-B7), radicación de PQRS y reservas de zonas comunes (Ley 675 de 2001).</p>
              <p>3. Derechos del titular: Conocer, actualizar, rectificar y revocar la autorización de personas habilitadas para recibir correspondencia.</p>
              <p>4. Seguridad: Los datos están protegidos bajo reglas criptográficas en Cloud Firestore sin almacenamiento de contraseñas en texto claro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
