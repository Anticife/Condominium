import React from 'react';
import { Printer, X, Building2 } from 'lucide-react';
import { formatDateCO, getElapsedHours, toDate } from '../../services/dateUtils';

export default function BoardReportModal({
  isOpen,
  onClose,
  currentUser,
  condominium,
  towers,
  apartments,
  packages,
  reservations,
  nowMs,
}) {
  if (!isOpen) return null;

  const totalPackages = packages.length;
  const pendingPackages = packages.filter((p) => p.status === 'Pendiente');
  const deliveredPackages = packages.filter((p) => p.status === 'Entregado');

  const overduePackages = pendingPackages.filter((p) => getElapsedHours(p.receivedAt, nowMs) >= 15 * 24);

  const totalOverdueFines = overduePackages.reduce((acc, p) => {
    const days = Math.floor(getElapsedHours(p.receivedAt, nowMs) / 24);
    return acc + (days - 15) * 5000;
  }, 0);

  const totalReservations = reservations.length;
  const approvedReservations = reservations.filter((r) => r.status === 'Aprobada');
  const rejectedReservations = reservations.filter((r) => r.status === 'Rechazada');

  const currentDateStr = formatDateCO(new Date(nowMs));

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(22, 22, 22, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      fontFamily: 'var(--cds-font-sans)',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        border: '1px solid #161616',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f62fe',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="#0f62fe" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              RESUMEN OPERATIVO PARA EL CONSEJO DE ADMINISTRACIÓN
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => window.print()}
              className="cds-btn cds-btn-primary"
              style={{ height: '32px', minHeight: '32px', fontSize: '12px' }}
            >
              <Printer size={14} />
              <span>Imprimir / Exportar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#c6c6c6', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '36px', overflowY: 'auto' }}>
          <div style={{ borderBottom: '2px solid #161616', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#161616' }}>
                  {(condominium?.name || 'CONJUNTO RESIDENCIAL').toUpperCase()}
                </h1>
                <div style={{ fontSize: '12px', color: '#525252', marginTop: '4px' }}>
                  Datos en vivo desde Cloud Firestore • Ley 675 de 2001
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--cds-font-mono)' }}>
                <div style={{ fontSize: '10px', color: '#0f62fe', fontWeight: 600 }}>INFORME OPERATIVO</div>
                <div style={{ fontSize: '12px', color: '#161616', marginTop: '2px' }}>Fecha: {currentDateStr}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#161616', marginBottom: '12px', textTransform: 'uppercase' }}>
              1. Resumen Consolidado de Operación
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #0f62fe' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Censo Registrado</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
                  {apartments.length} Unidades
                </div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>
                  Distribuidas en {towers.length} {towers.length === 1 ? 'torre' : 'torres'}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #24a148' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Paquetería Gestionada</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>{totalPackages} Envíos</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>
                  {deliveredPackages.length} entregados ({totalPackages > 0 ? Math.round((deliveredPackages.length / totalPackages) * 100) : 0}%)
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #8a3ffc' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Reservas de Áreas</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>{totalReservations} Solicitudes</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>
                  {approvedReservations.length} aprobadas • {rejectedReservations.length} rechazadas
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#161616', textTransform: 'uppercase' }}>
                2. Auditoría de Encomiendas en Bodegaje &gt;15 Días (RN-B5)
              </h2>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: '#da1e28' }}>
                Mora Estimada: ${totalOverdueFines.toLocaleString('es-CO')} COP
              </span>
            </div>

            {overduePackages.length === 0 ? (
              <div style={{ padding: '12px', backgroundColor: '#defbe6', fontSize: '12px', color: '#0e6027' }}>
                No se registran paquetes en mora superiores a 15 días calendario en portería.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '1px solid #161616', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Unidad</th>
                    <th style={{ padding: '8px' }}>Destinatario</th>
                    <th style={{ padding: '8px' }}>Courier</th>
                    <th style={{ padding: '8px' }}>Ingreso</th>
                    <th style={{ padding: '8px' }}>Días</th>
                    <th style={{ padding: '8px' }}>Mora (RN-B5)</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePackages.map((pkg) => {
                    const days = Math.floor(getElapsedHours(pkg.receivedAt, nowMs) / 24);
                    const fee = (days - 15) * 5000;
                    const receivedDate = toDate(pkg.receivedAt);
                    return (
                      <tr key={pkg.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{pkg.apartmentId}</td>
                        <td style={{ padding: '8px' }}>{pkg.recipientName}</td>
                        <td style={{ padding: '8px' }}>{pkg.courier}</td>
                        <td style={{ padding: '8px', fontFamily: 'var(--cds-font-mono)' }}>
                          {receivedDate ? receivedDate.toISOString().slice(0, 10) : '—'}
                        </td>
                        <td style={{ padding: '8px', color: '#da1e28', fontWeight: 600 }}>{days} días</td>
                        <td style={{ padding: '8px', fontFamily: 'var(--cds-font-mono)', fontWeight: 600, color: '#da1e28' }}>
                          ${fee.toLocaleString('es-CO')} COP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #8d8d8d' }}>
            <div style={{ fontWeight: 600, fontSize: '12px' }}>
              Generado por: {currentUser?.displayName || currentUser?.email || 'Administración'}
            </div>
            <div style={{ fontSize: '11px', color: '#525252' }}>Administración — {condominium?.name || 'Mi Conjunto en Línea'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
