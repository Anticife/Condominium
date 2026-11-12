import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  SlidersHorizontal, 
  Clock, 
  Activity, 
  Package, 
  CalendarDays
} from 'lucide-react';

export default function CarbonMasthead({ currentRole, onRoleChange, state, backendStatus }) {
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
        </div>
      </div>
    </header>
  );
}
