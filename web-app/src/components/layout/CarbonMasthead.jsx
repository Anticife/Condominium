import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  SlidersHorizontal, 
  Clock, 
  Activity, 
  Package, 
  CalendarDays,
  LogOut,
  KeyRound
} from 'lucide-react';

export default function CarbonMasthead({ 
  currentRole, 
  onRoleChange, 
  state, 
  backendStatus,
  currentUser,
  onOpenLogin,
  onLogout
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingPackagesCount = state.packages.filter(p => p.status === 'Pendiente').length;
  const overduePackagesCount = state.packages.filter(p => {
    if (p.status !== 'Pendiente') return false;
    const days = (new Date() - new Date(p.receivedAt)) / (1000 * 60 * 60 * 24);
    return days >= 15;
  }).length;
  const pendingReservationsCount = state.reservations.filter(r => r.status === 'Pendiente').length;

  const statusLabel = backendStatus ? backendStatus.message : 'FIREBASE SPARK ENGINE: CONNECTED';
  const statusColor = backendStatus && backendStatus.isFirestoreLive ? '#42be65' : '#78a9ff';

  return (
    <header style={{
      backgroundColor: '#161616',
      borderBottom: '1px solid #393939',
      color: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      fontFamily: 'var(--cds-font-sans)'
    }}>
      {/* Top Banner Telemetry Line */}
      <div style={{
        backgroundColor: '#001141',
        borderBottom: '1px solid #1f2a44',
        padding: '4px 20px',
        fontSize: '11px',
        fontFamily: 'var(--cds-font-mono)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#c6c6c6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: statusColor }}>
            <Activity size={12} />
            {statusLabel.toUpperCase()}
          </span>
          <span style={{ color: '#8d8d8d' }}>|</span>
          <span>COPROPIEDAD: ALTOS DEL PARQUE (3 TORRES // 240 UNIDADES)</span>
          <span style={{ color: '#8d8d8d' }}>|</span>
          <span style={{ color: '#78a9ff' }}>RN-B1 A RN-B7 ACTIVAS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} color="#4589ff" />
            BOGOTÁ (UTC-5): <strong>{timeStr}</strong>
          </span>
          {overduePackagesCount > 0 && (
            <span style={{ 
              backgroundColor: '#da1e28', 
              color: '#ffffff', 
              padding: '1px 6px', 
              fontWeight: 600,
              fontSize: '10px'
            }}>
              RN-B5: {overduePackagesCount} EN BODEGAJE &gt;15D
            </span>
          )}
        </div>
      </div>

      {/* Main Carbon Masthead Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        height: '56px'
      }}>
        {/* Brand Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            backgroundColor: '#0f62fe',
            color: '#ffffff',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              letterSpacing: '0.2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Mi Conjunto en Línea
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--cds-font-mono)',
                backgroundColor: '#393939',
                color: '#f4f4f4',
                padding: '1px 5px',
                fontWeight: 500
              }}>
                IBM CARBON
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#c6c6c6' }}>
              Sistema de Gestión y Control de Acceso — Altos del Parque
            </div>
          </div>
        </div>

        {/* Global Operational Quick Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Package size={16} color="#78a9ff" />
            <span style={{ color: '#c6c6c6' }}>Custodia:</span>
            <span style={{ 
              fontFamily: 'var(--cds-font-mono)', 
              fontWeight: 600, 
              color: pendingPackagesCount > 0 ? '#4589ff' : '#8d8d8d' 
            }}>
              {pendingPackagesCount} paquetes
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <CalendarDays size={16} color="#a7f0ba" />
            <span style={{ color: '#c6c6c6' }}>Reservas:</span>
            <span style={{ 
              fontFamily: 'var(--cds-font-mono)', 
              fontWeight: 600, 
              color: pendingReservationsCount > 0 ? '#f1c21b' : '#8d8d8d' 
            }}>
              {pendingReservationsCount} por resolver
            </span>
          </div>
        </div>

        {/* Role Switcher Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#8d8d8d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Terminal Activa:
          </span>

          <div style={{ display: 'flex', border: '1px solid #393939' }}>
            <button
              onClick={() => onRoleChange('portero')}
              style={{
                backgroundColor: currentRole === 'portero' ? '#0f62fe' : '#262626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 110ms'
              }}
            >
              <ShieldCheck size={14} />
              Portería (Tableta)
            </button>

            <button
              onClick={() => onRoleChange('residente')}
              style={{
                backgroundColor: currentRole === 'residente' ? '#0f62fe' : '#262626',
                color: '#ffffff',
                border: 'none',
                borderLeft: '1px solid #393939',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 110ms'
              }}
            >
              <UserCheck size={14} />
              Portal Residente
            </button>

            <button
              onClick={() => onRoleChange('admin')}
              style={{
                backgroundColor: currentRole === 'admin' ? '#0f62fe' : '#262626',
                color: '#ffffff',
                border: 'none',
                borderLeft: '1px solid #393939',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 110ms'
              }}
            >
              <SlidersHorizontal size={14} />
              Administración & Consejo
            </button>
          </div>

          {/* User Session Chip & Switcher (SCRUM-7, SCRUM-8) */}
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #393939', paddingLeft: '12px' }}>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#0f62fe',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--cds-font-mono)'
                }}>
                  {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'US'}
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                    {currentUser.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8d8d8d', fontFamily: 'var(--cds-font-mono)' }}>
                    {currentUser.unitId ? `Apto ${currentUser.unitId}` : currentUser.roleLabel || currentUser.role}
                  </div>
                </div>
                <button
                  type="button"
                  title="Cambiar de Sesión o Perfil"
                  onClick={onLogout || onOpenLogin}
                  style={{
                    backgroundColor: '#262626',
                    border: '1px solid #393939',
                    color: '#c6c6c6',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    marginLeft: '4px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = '#393939'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#c6c6c6'; e.currentTarget.style.backgroundColor = '#262626'; }}
                >
                  <LogOut size={12} />
                  <span>Salir</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="cds-btn cds-btn-primary"
                style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}
              >
                <KeyRound size={13} />
                <span>Iniciar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
