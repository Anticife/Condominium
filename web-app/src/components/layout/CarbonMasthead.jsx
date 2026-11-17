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
} from 'lucide-react';
import { getElapsedHours } from '../../services/dateUtils';

const ROLE_META = {
  portero: { label: 'Portería / Vigilancia', icon: ShieldCheck, badgeColor: '#393939' },
  residente: { label: 'Residente', icon: UserCheck, badgeColor: '#0e6027' },
  administradora: { label: 'Administración', icon: SlidersHorizontal, badgeColor: '#0f62fe' },
};

export default function CarbonMasthead({
  userProfile,
  towersCount,
  apartmentsCount,
  packages,
  reservations,
  onLogout,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMs(now.getTime());
      setTimeStr(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingPackagesCount = packages.filter((p) => p.status === 'Pendiente').length;
  const overduePackagesCount = packages.filter((p) => {
    if (p.status !== 'Pendiente') return false;
    return getElapsedHours(p.receivedAt, nowMs) >= 15 * 24;
  }).length;
  const pendingReservationsCount = reservations.filter((r) => r.status === 'Pendiente').length;

  const roleInfo = ROLE_META[userProfile?.role] || ROLE_META.residente;
  const RoleIcon = roleInfo.icon;
  const displayName = userProfile?.displayName || userProfile?.email || 'Usuario';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join('') || 'US';

  const unitScopeText =
    userProfile?.role === 'residente'
      ? `UNIDAD ASIGNADA: ${userProfile.unitId || 'PENDIENTE'}`
      : `ESTRUCTURA: ${towersCount} ${towersCount === 1 ? 'TORRE' : 'TORRES'} // ${apartmentsCount} ${apartmentsCount === 1 ? 'UNIDAD' : 'UNIDADES'}`;

  return (
    <header style={{
      backgroundColor: '#161616',
      borderBottom: '1px solid #393939',
      color: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      fontFamily: 'var(--cds-font-sans)',
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
        flexWrap: 'wrap',
        gap: '8px',
        color: '#c6c6c6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#42be65' }}>
            <Activity size={12} />
            CLOUD FIRESTORE ACTIVO (PLAN SPARK)
          </span>
          <span style={{ color: '#8d8d8d' }}>|</span>
          <span>{unitScopeText}</span>
          <span style={{ color: '#8d8d8d' }}>|</span>
          <span style={{ color: '#78a9ff' }}>RN-B1..RN-B7 VERIFICADAS</span>
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
              fontSize: '10px',
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
        minHeight: '56px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Brand Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            backgroundColor: '#0f62fe',
            color: '#ffffff',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Mi Conjunto en Línea
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--cds-font-mono)',
                backgroundColor: roleInfo.badgeColor,
                color: '#ffffff',
                padding: '2px 7px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <RoleIcon size={11} />
                {roleInfo.label.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#c6c6c6' }}>
              Altos del Parque P.H. — Operación Digital
            </div>
          </div>
        </div>

        {/* Live Telemetry Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Package size={16} color="#78a9ff" />
            <span style={{ color: '#c6c6c6' }}>Pendientes:</span>
            <span style={{
              fontFamily: 'var(--cds-font-mono)',
              fontWeight: 600,
              color: pendingPackagesCount > 0 ? '#4589ff' : '#8d8d8d',
            }}>
              {pendingPackagesCount} {pendingPackagesCount === 1 ? 'paquete' : 'paquetes'}
            </span>
          </div>

          {userProfile?.role !== 'portero' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <CalendarDays size={16} color="#a7f0ba" />
              <span style={{ color: '#c6c6c6' }}>Reservas:</span>
              <span style={{
                fontFamily: 'var(--cds-font-mono)',
                fontWeight: 600,
                color: pendingReservationsCount > 0 ? '#f1c21b' : '#8d8d8d',
              }}>
                {pendingReservationsCount} por resolver
              </span>
            </div>
          )}

          {/* Authenticated User Session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #393939', paddingLeft: '14px' }}>
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
              fontFamily: 'var(--cds-font-mono)',
            }}>
              {initials}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '10px', color: '#8d8d8d', fontFamily: 'var(--cds-font-mono)' }}>
                {userProfile?.unitId ? `Apto ${userProfile.unitId}` : userProfile?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              style={{
                backgroundColor: '#262626',
                border: '1px solid #393939',
                color: '#c6c6c6',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                marginLeft: '4px',
              }}
            >
              <LogOut size={12} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
