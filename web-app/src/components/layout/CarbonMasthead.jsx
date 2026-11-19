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
  MessageSquareText,
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
  condominium,
  towersCount,
  apartmentsCount,
  packages,
  reservations,
  pqrs = [],
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
  const openPqrsCount = pqrs.filter((p) => p.status !== 'Resuelta').length;

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
    <header className="cds-masthead-header">
      {/* Top Banner Telemetry Line */}
      <div className="cds-masthead-telemetry">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#42be65' }}>
            <Activity size={12} />
            FIRESTORE ACTIVO
          </span>
          <span className="cds-masthead-hide-mobile" style={{ color: '#8d8d8d' }}>|</span>
          <span>{unitScopeText}</span>
          <span className="cds-masthead-hide-mobile" style={{ color: '#8d8d8d' }}>|</span>
          <span className="cds-masthead-hide-mobile" style={{ color: '#78a9ff' }}>RN-B1..RN-B7 VERIFICADAS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="cds-masthead-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
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
              RN-B5: {overduePackagesCount} &gt;15D
            </span>
          )}
        </div>
      </div>

      {/* Main Carbon Masthead Bar */}
      <div className="cds-masthead-main">
        {/* Brand Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            backgroundColor: '#0f62fe',
            color: '#ffffff',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Building2 size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>Mi Conjunto en Línea</span>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--cds-font-mono)',
                backgroundColor: roleInfo.badgeColor,
                color: '#ffffff',
                padding: '2px 6px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <RoleIcon size={11} />
                {roleInfo.label.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#c6c6c6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {condominium?.name || 'Mi Conjunto en Línea'}
            </div>
          </div>
        </div>

        {/* Live Telemetry Counters + Session */}
        <div className="cds-masthead-right">
          <div className="cds-masthead-counters">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <Package size={15} color="#78a9ff" />
              <span className="cds-masthead-hide-mobile" style={{ color: '#c6c6c6' }}>Pendientes:</span>
              <span style={{
                fontFamily: 'var(--cds-font-mono)',
                fontWeight: 600,
                color: pendingPackagesCount > 0 ? '#4589ff' : '#8d8d8d',
              }}>
                {pendingPackagesCount} paq.
              </span>
            </div>

            {userProfile?.role !== 'portero' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <CalendarDays size={15} color="#a7f0ba" />
                <span className="cds-masthead-hide-mobile" style={{ color: '#c6c6c6' }}>Reservas:</span>
                <span style={{
                  fontFamily: 'var(--cds-font-mono)',
                  fontWeight: 600,
                  color: pendingReservationsCount > 0 ? '#f1c21b' : '#8d8d8d',
                }}>
                  {pendingReservationsCount} res.
                </span>
              </div>
            )}

            {userProfile?.role !== 'portero' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <MessageSquareText size={15} color="#d4bbff" />
                <span className="cds-masthead-hide-mobile" style={{ color: '#c6c6c6' }}>PQRS:</span>
                <span style={{
                  fontFamily: 'var(--cds-font-mono)',
                  fontWeight: 600,
                  color: openPqrsCount > 0 ? '#d4bbff' : '#8d8d8d',
                }}>
                  {openPqrsCount} PQRS
                </span>
              </div>
            )}
          </div>

          {/* Authenticated User Session */}
          <div className="cds-masthead-session">
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
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div className="cds-masthead-hide-mobile" style={{ lineHeight: 1.2 }}>
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
                padding: '8px 10px',
                minHeight: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
              }}
            >
              <LogOut size={13} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
