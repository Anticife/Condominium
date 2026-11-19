import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  PlusSquare,
  ShieldAlert,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import {
  createCondominium,
  generateJoinCode,
  joinCondominiumByCode,
  normalizeJoinCode,
} from '../../services/condominiumService';

export default function CondominiumOnboarding({ userProfile }) {
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [condoName, setCondoName] = useState('');
  const [nit, setNit] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [customJoinCode, setCustomJoinCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleNameChange = (value) => {
    setCondoName(value);
    if (!customJoinCode && value.trim().length >= 3) {
      setCustomJoinCode(generateJoinCode(value));
    }
  };

  const handleCreateCondominium = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!condoName.trim()) {
      setErrorMsg('Ingrese el nombre del conjunto residencial.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCondominium(db, userProfile.uid, {
        name: condoName.trim(),
        nit: nit.trim(),
        city: city.trim(),
        address: address.trim(),
        joinCode: customJoinCode.trim() || undefined,
      });
      setSuccessMsg(`Conjunto «${created.name}» creado con código ${created.joinCode}. Redirigiendo al panel...`);
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo crear el conjunto residencial.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinCondominium = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!joinCodeInput.trim()) {
      setErrorMsg('Ingrese el código de invitación suministrado por la Administración.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await joinCondominiumByCode(db, userProfile.uid, joinCodeInput);
      setSuccessMsg(`Vinculado correctamente a «${record.condominiumName}».`);
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo vincular al conjunto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="cds-auth-shell"
      style={{
        backgroundColor: '#161616',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'var(--cds-font-sans)',
      }}
    >
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '580px',
        border: '1px solid #393939',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '20px 24px',
          borderBottom: '2px solid #0f62fe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ backgroundColor: '#0f62fe', padding: '10px', display: 'flex' }}>
              <Building2 size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff', letterSpacing: '0.6px' }}>
                MI CONJUNTO EN LÍNEA // ONBOARDING MULTI-TENANT
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>
                Configura o Únete a tu Conjunto
              </h1>
            </div>
          </div>

          <button
            type="button"
            className="cds-btn cds-btn-ghost"
            onClick={handleSignOut}
            style={{ color: '#c6c6c6', padding: '0 10px', minHeight: '32px', height: '32px', fontSize: '12px' }}
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
        </div>

        {/* Logged-in user strip */}
        <div style={{
          backgroundColor: '#f4f4f4',
          borderBottom: '1px solid #e0e0e0',
          padding: '10px 24px',
          fontSize: '12px',
          color: '#393939',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <span>Sesión activa: <strong>{userProfile.displayName || userProfile.email}</strong></span>
          <span className="font-mono" style={{ color: '#525252' }}>{userProfile.email}</span>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f4f4f4' }}>
          <button
            type="button"
            onClick={() => { setTab('create'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: tab === 'create' ? '#ffffff' : '#f4f4f4',
              color: tab === 'create' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: tab === 'create' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer',
            }}
          >
            <PlusSquare size={15} />
            <span>Registrar mi Conjunto</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('join'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: tab === 'join' ? '#ffffff' : '#f4f4f4',
              color: tab === 'join' ? '#0f62fe' : '#525252',
              border: 'none',
              borderBottom: tab === 'join' ? '2px solid #0f62fe' : 'none',
              cursor: 'pointer',
            }}
          >
            <KeyRound size={15} />
            <span>Unirme con Código</span>
          </button>
        </div>

        {/* Body */}
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

          {successMsg && (
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
              <div>{successMsg}</div>
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreateCondominium}>
              <p style={{ fontSize: '13px', color: '#525252', marginBottom: '16px', lineHeight: 1.45 }}>
                Crea un espacio aislado para tu copropiedad. Quedarás asignado como <strong>Administrador</strong> y obtendrás un código de invitación único para tus residentes y porteros.
              </p>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">NOMBRE DEL CONJUNTO RESIDENCIAL *</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Ej. Conjunto Residencial Reserva del Pinar P.H."
                  value={condoName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="cds-form-row-2" style={{ marginBottom: '12px' }}>
                <div>
                  <label className="cds-input-label">NIT (OPCIONAL)</label>
                  <input
                    type="text"
                    className="cds-input font-mono"
                    placeholder="900.123.456-7"
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                  />
                </div>
                <div>
                  <label className="cds-input-label">CIUDAD</label>
                  <input
                    type="text"
                    className="cds-input"
                    placeholder="Ej. Bogotá D.C."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">DIRECCIÓN (OPCIONAL)</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Ej. Calle 127 # 45-20"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label className="cds-input-label">CÓDIGO DE INVITACIÓN ÚNICO (4-24 CARACTERES)</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Ej. PINAR-2026"
                  value={customJoinCode}
                  onChange={(e) => setCustomJoinCode(normalizeJoinCode(e.target.value))}
                  required
                />
                <div style={{ fontSize: '11px', color: '#6f6f6f', marginTop: '4px' }}>
                  Compartirás este código con tus residentes y porteros para que se vinculen a tu conjunto.
                </div>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submitting}>
                <span>{submitting ? 'CREANDO CONJUNTO...' : 'CREAR CONJUNTO Y ENTRAR COMO ADMINISTRADOR'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinCondominium}>
              <p style={{ fontSize: '13px', color: '#525252', marginBottom: '16px', lineHeight: 1.45 }}>
                Ingresa el <strong>código de invitación</strong> entregado por la Administración de tu conjunto residencial. Tu cuenta se vinculará de forma segura y quedará lista para asignación de unidad o rol.
              </p>

              <div style={{ marginBottom: '18px' }}>
                <label className="cds-input-label">CÓDIGO DE INVITACIÓN DEL CONJUNTO</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Ej. PINAR-2026"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(normalizeJoinCode(e.target.value))}
                  required
                />
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submitting}>
                <span>{submitting ? 'VALIDANDO CÓDIGO...' : 'UNIRME AL CONJUNTO'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
