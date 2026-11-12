import React from 'react';
import { Printer, X, Building2 } from 'lucide-react';

export default function BoardReportModal({ isOpen, onClose, state }) {
  if (!isOpen) return null;

  const totalPackages = state.packages.length;
  const pendingPackages = state.packages.filter(p => p.status === 'Pendiente');
  const deliveredPackages = state.packages.filter(p => p.status === 'Entregado');

  // Overdue packages (>15 days under RN-B5)
  const overduePackages = pendingPackages.filter(p => {
    const days = (new Date() - new Date(p.receivedAt)) / (1000 * 60 * 60 * 24);
    return days >= 15;
  });

  const totalOverdueFines = overduePackages.reduce((acc, p) => {
    const days = Math.floor((new Date() - new Date(p.receivedAt)) / (1000 * 60 * 60 * 24));
    return acc + (days - 15) * 5000;
  }, 0);

  // Reservations
  const totalReservations = state.reservations.length;
  const approvedReservations = state.reservations.filter(r => r.status === 'Aprobada');
  const rejectedReservations = state.reservations.filter(r => r.status === 'Rechazada');
  const pendingReservations = state.reservations.filter(r => r.status === 'Pendiente');

  // PQRS
  const totalPqrs = state.pqrs.length;
  const resolvedPqrs = state.pqrs.filter(p => p.status === 'Resuelta');
  const inProgressPqrs = state.pqrs.filter(p => p.status === 'En gestión');
  const pendingPqrs = state.pqrs.filter(p => p.status === 'Radicada');

  const currentDateStr = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
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
      padding: '20px',
      fontFamily: 'var(--cds-font-sans)'
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
        overflow: 'hidden'
      }}>
        {/* Header Action Bar (Hidden in Print) */}
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f62fe'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="#0f62fe" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              INFORME OFICIAL PARA EL CONSEJO DE ADMINISTRACIÓN (SCRUM-41)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              className="cds-btn cds-btn-primary"
              style={{ height: '32px', fontSize: '12px' }}
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

        {/* Printable Report Document Body */}
        <div style={{ padding: '36px', overflowY: 'auto' }}>
          {/* Institutional Document Header */}
          <div style={{ borderBottom: '2px solid #161616', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#161616' }}>
                  CONJUNTO RESIDENCIAL ALTOS DEL PARQUE P.H.
                </h1>
                <div style={{ fontSize: '12px', color: '#525252', marginTop: '4px' }}>
                  NIT 900.542.118-2 • Carrera 45 # 128B - 30 • Bogotá D.C., Colombia
                </div>
                <div style={{ fontSize: '12px', color: '#525252' }}>
                  Personería Jurídica bajo Ley 675 de 2001
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--cds-font-mono)' }}>
                <div style={{ fontSize: '10px', color: '#0f62fe', fontWeight: 600 }}>
                  INFORME EJECUTIVO MENSUAL
                </div>
                <div style={{ fontSize: '12px', color: '#161616', marginTop: '2px' }}>
                  Fecha: {currentDateStr}
                </div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>
                  REF: CONSEJO-2026-M11
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Executive KPI Grid */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#161616', marginBottom: '12px', textTransform: 'uppercase' }}>
              1. Resumen Consolidado de Operación
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #0f62fe' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Censo de Copropiedad</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>240 Unidades</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>Torres 1, 2 y 3 (80 c/u)</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #24a148' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Paquetería Gestionada</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>{totalPackages} Envíos</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>{deliveredPackages.length} entregados ({totalPackages > 0 ? Math.round((deliveredPackages.length / totalPackages) * 100) : 0}%)</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #8a3ffc' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>Reservas de Áreas</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>{totalReservations} Solicitudes</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>{approvedReservations.length} aprobadas • {rejectedReservations.length} rechazadas</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f4f4f4', borderLeft: '3px solid #ff832b' }}>
                <div style={{ fontSize: '11px', color: '#525252' }}>PQRS Ciudadanos</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>{totalPqrs} Casos</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d' }}>{resolvedPqrs.length} resueltos con soporte legal</div>
              </div>
            </div>
          </div>

          {/* Section 2: Overdue Packages & Warehouse Fines (RN-B5) */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#161616', textTransform: 'uppercase' }}>
                2. Auditoría de Encomiendas en Bodegaje y Tarifas de Mora (Regla RN-B5)
              </h2>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: '#da1e28' }}>
                Total Fines Liquidables: ${totalOverdueFines.toLocaleString('es-CO')} COP
              </span>
            </div>

            {overduePackages.length === 0 ? (
              <div style={{ padding: '12px', backgroundColor: '#defbe6', fontSize: '12px', color: '#0e6027' }}>
                ✔ No se registran paquetes en mora superiores a 15 días calendario en el casillero de portería.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '1px solid #161616', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Código</th>
                    <th style={{ padding: '8px' }}>Unidad</th>
                    <th style={{ padding: '8px' }}>Destinatario</th>
                    <th style={{ padding: '8px' }}>Courier</th>
                    <th style={{ padding: '8px' }}>Fecha Ingreso</th>
                    <th style={{ padding: '8px' }}>Días Custodia</th>
                    <th style={{ padding: '8px' }}>Mora Cobrable (RN-B5)</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePackages.map(pkg => {
                    const days = Math.floor((new Date() - new Date(pkg.receivedAt)) / (1000 * 60 * 60 * 24));
                    const fee = (days - 15) * 5000;
                    return (
                      <tr key={pkg.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '8px', fontFamily: 'var(--cds-font-mono)' }}>{pkg.id}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{pkg.apartmentId}</td>
                        <td style={{ padding: '8px' }}>{pkg.recipientName}</td>
                        <td style={{ padding: '8px' }}>{pkg.courier}</td>
                        <td style={{ padding: '8px', fontFamily: 'var(--cds-font-mono)' }}>{pkg.receivedAt.split('T')[0]}</td>
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

          {/* Section 3: Legal & Regulatory Signatures */}
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #8d8d8d' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div>
                <div style={{ borderBottom: '1px solid #161616', height: '40px', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>Dra. Patricia Gómez</div>
                <div style={{ fontSize: '11px', color: '#525252' }}>Administradora y Representante Legal</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d', fontFamily: 'var(--cds-font-mono)' }}>CC 52.334.901 de Bogotá</div>
              </div>

              <div>
                <div style={{ borderBottom: '1px solid #161616', height: '40px', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>Presidente del Consejo de Administración</div>
                <div style={{ fontSize: '11px', color: '#525252' }}>Comité de Convivencia y Vigilancia</div>
                <div style={{ fontSize: '10px', color: '#8d8d8d', fontFamily: 'var(--cds-font-mono)' }}>Copropiedad Altos del Parque</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
