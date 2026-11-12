import React, { useState } from 'react';
import { 
  CalendarCheck, 
  FileCheck, 
  Users, 
  BarChart3, 
  Check, 
  X, 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  TrendingUp,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import BoardReportModal from './BoardReportModal';
import CensusUploadModal from './CensusUploadModal';

export default function AdminConsole({ 
  state, 
  onResolveReservation, 
  onTransitionPqrs, 
  onImportCensusBatch 
}) {
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard' | 'reservations' | 'pqrs' | 'census'

  // Rejection Modal State
  const [rejectingReservation, setRejectingReservation] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState(null);

  // Resolve PQRS Modal State
  const [resolvingPqrs, setResolvingPqrs] = useState(null);
  const [officialResponse, setOfficialResponse] = useState('');
  const [pqrsResolutionError, setPqrsResolutionError] = useState(null);

  // Census Search & Filters
  const [censusTowerFilter, setCensusTowerFilter] = useState('ALL');
  const [censusSearch, setCensusSearch] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState(null);

  // Executive Modals State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // ==========================================================================
  // METRICS COMPUTATION FOR THE BOARD OF DIRECTORS (CONSEJO DE ADMINISTRACIÓN)
  // ==========================================================================
  const totalPackages = state.packages.length;
  const pendingPackages = state.packages.filter(p => p.status === 'Pendiente');
  const deliveredPackages = state.packages.filter(p => p.status === 'Entregado');
  
  // Overdue packages > 15 days (Rule RN-B5: Alerta cobro bodegaje)
  const overduePackages = pendingPackages.filter(p => {
    const days = (new Date() - new Date(p.receivedAt)) / (1000 * 60 * 60 * 24);
    return days >= 15;
  });

  // Average package pickup time in hours (RF-18)
  let totalPickupHours = 0;
  deliveredPackages.forEach(p => {
    if (p.receivedAt && p.deliveredAt) {
      const diff = (new Date(p.deliveredAt) - new Date(p.receivedAt)) / (1000 * 60 * 60);
      totalPickupHours += diff;
    }
  });
  const avgPickupHours = deliveredPackages.length > 0 ? (totalPickupHours / deliveredPackages.length).toFixed(1) : 0;

  // PQRS stats
  const resolvedPqrs = state.pqrs.filter(p => p.status === 'Resuelta');
  const pqrsResolutionRate = state.pqrs.length > 0 ? Math.round((resolvedPqrs.length / state.pqrs.length) * 100) : 100;

  // Handle Reservation Rejection (Rule RN-B6 / Validation in firestore.rules)
  const handleConfirmRejection = () => {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      setRejectionError('REGLA OBLIGATORIA: El motivo de rechazo debe contener mínimo 5 caracteres.');
      return;
    }
    onResolveReservation(
      rejectingReservation.id, 
      'Rechazada', 
      rejectionReason.trim(), 
      'Dra. Patricia Gómez (Administradora)'
    );
    setRejectingReservation(null);
    setRejectionReason('');
    setRejectionError(null);
  };

  // Handle PQRS Official Resolution (Rule RN-B6)
  const handleConfirmPqrsResolution = () => {
    if (!officialResponse || officialResponse.trim().length < 10) {
      setPqrsResolutionError('REGLA RN-B6: La respuesta oficial de administración debe contener mínimo 10 caracteres.');
      return;
    }
    onTransitionPqrs(
      resolvingPqrs.id,
      'Resuelta',
      officialResponse.trim(),
      'Dra. Patricia Gómez (Administradora)'
    );
    setResolvingPqrs(null);
    setOfficialResponse('');
    setPqrsResolutionError(null);
  };

  // Census Filter
  const filteredApartments = state.apartments.filter(a => {
    if (censusTowerFilter !== 'ALL' && a.towerId !== censusTowerFilter) return false;
    if (censusSearch) {
      const q = censusSearch.toLowerCase();
      return (
        a.id.toLowerCase().includes(q) ||
        a.ownerName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Batch Import Simulation & Firestore Seeding
  const handleSimulateBatchImport = async () => {
    setImportStatusMsg('Sincronizando censo y sembrando en Cloud Firestore...');
    if (onImportCensusBatch) {
      await onImportCensusBatch();
    }
    setImportStatusMsg('✔ 240 Apartamentos y 3 Torres sincronizados con Cloud Firestore (CON-13 / RF-04).');
    setTimeout(() => setImportStatusMsg(null), 5000);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Console Header */}
      <div style={{ 
        borderBottom: '1px solid #e0e0e0', 
        paddingBottom: '16px', 
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe', fontWeight: 600 }}>
            PANEL DIRECTIVO // CONDOMINIUM-F6236 // CONSEJO DE ADMINISTRACIÓN
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>
            Consola de Gestión Administrativa & Gobierno
          </h1>
          <p style={{ fontSize: '13px', color: '#525252', marginTop: '2px' }}>
            Aprobación justificada de reservas, resolución legal de PQRS (RN-B6), auditoría de censo y analítica para el consejo.
          </p>
        </div>

        {/* Console Subnavigation Tabs */}
        <div style={{ display: 'flex', border: '1px solid #8d8d8d' }}>
          {[
            { id: 'dashboard', label: 'Métricas del Consejo', icon: BarChart3 },
            { id: 'reservations', label: 'Bandeja Reservas', icon: CalendarCheck, badge: state.reservations.filter(r => r.status === 'Pendiente').length },
            { id: 'pqrs', label: 'Gestión PQRS', icon: FileCheck, badge: state.pqrs.filter(p => p.status !== 'Resuelta').length },
            { id: 'census', label: 'Censo 240 Aptos', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontFamily: 'var(--cds-font-sans)',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? '#161616' : '#ffffff',
                  color: isActive ? '#ffffff' : '#161616',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{ 
                    backgroundColor: isActive ? '#0f62fe' : '#f1c21b', 
                    color: isActive ? '#ffffff' : '#161616',
                    padding: '0 5px',
                    fontSize: '10px',
                    fontFamily: 'var(--cds-font-mono)',
                    fontWeight: 600
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==========================================================================
          TAB 1: DASHBOARD DE MÉTRICAS DEL CONSEJO (RF-18, RN-B5, AUDITORÍA)
          ========================================================================== */}
      {adminTab === 'dashboard' && (
        <div>
          {/* Executive Action Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#161616' }}>
                Métricas de Rendimiento & Cumplimiento Normativo
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Auditoría en tiempo real para el Consejo de Administración según Ley 675 y reglas RN-B1..RN-B7.
              </div>
            </div>

            <button
              type="button"
              className="cds-btn cds-btn-primary"
              style={{ height: '36px', fontSize: '12px' }}
              onClick={() => setIsReportModalOpen(true)}
            >
              <Printer size={15} />
              <span>Generar Informe Ejecutivo para el Consejo (SCRUM-41)</span>
            </button>
          </div>

          {/* Executive KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            
            {/* KPI 1: Encomiendas Totales */}
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #0f62fe' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Flujo Mensual Encomiendas
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#161616', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {totalPackages}
              </div>
              <div style={{ fontSize: '12px', color: '#0e6027', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={14} />
                <span>{deliveredPackages.length} entregados ({Math.round((deliveredPackages.length/totalPackages)*100)}%)</span>
              </div>
            </div>

            {/* KPI 2: Tiempo Medio de Retiro (RF-18) */}
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #0043ce' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Tiempo Medio Retiro (RF-18)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#0043ce', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {avgPickupHours} <span style={{ fontSize: '16px', fontWeight: 400 }}>horas</span>
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Recepción hasta entrega en ventanilla
              </div>
            </div>

            {/* KPI 3: Alerta Bodegaje >15d (RN-B5) */}
            <div className="cds-tile" style={{ 
              backgroundColor: overduePackages.length > 0 ? '#fff1f1' : '#ffffff', 
              borderTop: '4px solid #da1e28' 
            }}>
              <div style={{ fontSize: '11px', color: '#a2191f', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)', fontWeight: 600 }}>
                Alerta Bodegaje &gt;15D (RN-B5)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#da1e28', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {overduePackages.length}
              </div>
              <div style={{ fontSize: '12px', color: '#a2191f' }}>
                {overduePackages.length > 0 ? 'Aplica cobro de custodia de $5.000/día' : 'Sin paquetes vencidos'}
              </div>
            </div>

            {/* KPI 4: Tasa de Resolución PQRS */}
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #24a148' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Efectividad PQRS (RN-B6)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#24a148', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {pqrsResolutionRate}%
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                {resolvedPqrs.length} resueltas con acto oficial
              </div>
            </div>
          </div>

          {/* CRITICAL ALERT SECTION: Overdue Packages Table (RN-B5) */}
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle color="#da1e28" size={18} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#161616' }}>
                  Auditoría de Paquetería Vencida en Portería (Regla RN-B5: &gt;15 Días)
                </h3>
              </div>
              <span className="cds-tag cds-tag-red">SANCIÓN / BODEGAJE APLICABLE</span>
            </div>

            {overduePackages.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#0e6027', backgroundColor: '#defbe6', fontSize: '13px' }}>
                ✔ No hay encomiendas que superen los 15 días reglamentarios en este periodo.
              </div>
            ) : (
              <div className="cds-table-container">
                <table className="cds-table">
                  <thead>
                    <tr>
                      <th>Código Paquete</th>
                      <th>Apartamento</th>
                      <th>Destinatario</th>
                      <th>Días en Portería</th>
                      <th>Transportadora / Guía</th>
                      <th>Tarifa de Bodegaje Acumulada</th>
                      <th>Acción Administrativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overduePackages.map(pkg => {
                      const days = Math.floor((new Date() - new Date(pkg.receivedAt)) / (1000 * 60 * 60 * 24));
                      const fee = (days - 15) * 5000;

                      return (
                        <tr key={pkg.id}>
                          <td className="font-mono" style={{ fontWeight: 600, color: '#da1e28' }}>{pkg.id}</td>
                          <td><span className="cds-tag cds-tag-dark">{pkg.apartmentId}</span></td>
                          <td><strong>{pkg.recipientName}</strong></td>
                          <td>
                            <span className="cds-tag cds-tag-red font-mono">{days} DÍAS</span>
                          </td>
                          <td style={{ fontSize: '12px' }}>{pkg.courier} ({pkg.trackingNumber})</td>
                          <td className="font-mono" style={{ fontWeight: 600, color: '#a2191f' }}>
                            ${fee.toLocaleString('es-CO')} COP
                          </td>
                          <td>
                            <button
                              type="button"
                              className="cds-btn cds-btn-danger"
                              style={{ height: '30px', padding: '0 10px', fontSize: '11px' }}
                              onClick={() => alert(`Notificación formal enviada al email del apartamento ${pkg.apartmentId} para cobro en cuenta de cobro de administración.`)}
                            >
                              Facturar a Expensas
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 2: BANDEJA DE APROBACIÓN DE RESERVAS (JUSTIFICACIÓN OBLIGATORIA)
          ========================================================================== */}
      {adminTab === 'reservations' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
                Bandeja de Aprobación de Zonas Comunes
              </h2>
              <p style={{ fontSize: '13px', color: '#525252' }}>
                Control de disponibilidad, verificación de depósitos y rechazo con justificación obligatoria.
              </p>
            </div>
            <span className="cds-tag cds-tag-blue">RN-B1: BLOQUEO DE CRUCES</span>
          </div>

          <div className="cds-table-container">
            <table className="cds-table">
              <thead>
                <tr>
                  <th>Código Solicitud</th>
                  <th>Apartamento / Residente</th>
                  <th>Zona Común</th>
                  <th>Fecha y Horario</th>
                  <th>Depósito</th>
                  <th>Estado Actual</th>
                  <th>Decisión Administrativa</th>
                </tr>
              </thead>
              <tbody>
                {state.reservations.map(res => (
                  <tr key={res.id}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>{res.id}</td>
                    <td>
                      <div><strong>{res.apartmentId}</strong></div>
                      <div style={{ fontSize: '11px', color: '#525252' }}>{res.residentName}</div>
                    </td>
                    <td>{res.commonAreaName} (Cap: {res.capacity})</td>
                    <td>
                      <div>{new Date(res.startTime).toLocaleDateString('es-CO')}</div>
                      <div style={{ fontSize: '11px', color: '#525252' }}>
                        {new Date(res.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(res.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="font-mono">${res.depositAmount.toLocaleString('es-CO')}</td>
                    <td>
                      {res.status === 'Pendiente' && <span className="cds-tag cds-tag-yellow">POR RESOLVER</span>}
                      {res.status === 'Aprobada' && <span className="cds-tag cds-tag-green">APROBADA</span>}
                      {res.status === 'Rechazada' && (
                        <div>
                          <span className="cds-tag cds-tag-red">RECHAZADA</span>
                          <div style={{ fontSize: '11px', color: '#a2191f', marginTop: '2px' }}>
                            {res.rejectionReason}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {res.status === 'Pendiente' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="cds-btn cds-btn-primary"
                            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                            onClick={() => onResolveReservation(res.id, 'Aprobada', null, 'Dra. Patricia Gómez')}
                          >
                            <Check size={14} />
                            <span>Aprobar</span>
                          </button>

                          <button
                            type="button"
                            className="cds-btn cds-btn-danger"
                            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                            onClick={() => {
                              setRejectingReservation(res);
                              setRejectionReason('');
                              setRejectionError(null);
                            }}
                          >
                            <X size={14} />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#8d8d8d' }}>
                          Resuelto por {res.resolvedBy || 'Administración'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 3: GESTIÓN DE PQRS (RESPUESTA OFICIAL OBLIGATORIA RN-B6)
          ========================================================================== */}
      {adminTab === 'pqrs' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
                Bandeja de PQRS y Radicados Oficiales
              </h2>
              <p style={{ fontSize: '13px', color: '#525252' }}>
                Cumplimiento de la regla RN-B6: resolución obligatoria motivada e historial inmutable de auditoría.
              </p>
            </div>
            <span className="cds-tag cds-tag-green">RN-B6: RESPUESTA FORMAL VINCULANTE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {state.pqrs.map(ticket => (
              <div key={ticket.id} className="cds-tile" style={{ backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span className="cds-tag cds-tag-dark font-mono">{ticket.ticketNumber}</span>
                    <span className="cds-tag cds-tag-blue" style={{ marginLeft: '6px' }}>{ticket.category}</span>
                    <span className="cds-tag cds-tag-gray" style={{ marginLeft: '6px' }}>Apto: {ticket.apartmentId}</span>
                    <h3 style={{ fontSize: '17px', fontWeight: 600, marginTop: '8px' }}>{ticket.subject}</h3>
                    <div style={{ fontSize: '12px', color: '#525252' }}>
                      Radicado por: <strong>{ticket.residentName}</strong> el {new Date(ticket.createdAt).toLocaleString('es-CO')}
                    </div>
                  </div>

                  <div>
                    {ticket.status === 'Radicada' && <span className="cds-tag cds-tag-yellow">RADICADA</span>}
                    {ticket.status === 'En gestión' && <span className="cds-tag cds-tag-blue">EN GESTIÓN</span>}
                    {ticket.status === 'Resuelta' && <span className="cds-tag cds-tag-green">RESUELTA</span>}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f4f4f4', padding: '12px 14px', fontSize: '13px', marginBottom: '16px' }}>
                  {ticket.description}
                </div>

                {/* Official Response */}
                {ticket.officialResponse && (
                  <div style={{
                    backgroundColor: '#defbe6',
                    borderLeft: '4px solid #24a148',
                    padding: '12px 14px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0e6027', marginBottom: '4px' }}>
                      RESPUESTA OFICIAL DE ADMINISTRACIÓN (RN-B6):
                    </div>
                    <div style={{ fontSize: '13px', color: '#161616' }}>
                      {ticket.officialResponse}
                    </div>
                  </div>
                )}

                {/* Audit Timeline */}
                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '10px', fontSize: '11px', color: '#8d8d8d', marginBottom: '16px' }}>
                  <strong>Línea de tiempo inmutable:</strong>
                  {ticket.history.map((h, i) => (
                    <div key={i} style={{ marginTop: '2px' }}>
                      • {new Date(h.changedAt).toLocaleString('es-CO')}: {h.comment} (Operador: {h.changedBy})
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                {ticket.status !== 'Resuelta' && (
                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                    {ticket.status === 'Radicada' && (
                      <button
                        type="button"
                        className="cds-btn cds-btn-secondary"
                        style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
                        onClick={() => onTransitionPqrs(ticket.id, 'En gestión', null, 'Dra. Patricia Gómez')}
                      >
                        Pasar a 'En Gestión'
                      </button>
                    )}

                    <button
                      type="button"
                      className="cds-btn cds-btn-primary"
                      style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
                      onClick={() => {
                        setResolvingPqrs(ticket);
                        setOfficialResponse('');
                        setPqrsResolutionError(null);
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Emitir Respuesta Oficial y Resolver (RN-B6)</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 4: CENSO DE 240 APARTAMENTOS (3 TORRES // CON-13 BATCH)
          ========================================================================== */}
      {adminTab === 'census' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
                Censo de Copropiedad: 240 Unidades
              </h2>
              <p style={{ fontSize: '13px', color: '#525252' }}>
                Torres 1, 2 y 3 (80 apartamentos por torre). Base de datos unificada de residentes y autorizados.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="cds-btn cds-btn-primary"
                style={{ height: '36px', fontSize: '12px' }}
                onClick={() => setIsUploadModalOpen(true)}
              >
                <FileSpreadsheet size={15} />
                <span>Carga Masiva Excel & Previsualización (SCRUM-44)</span>
              </button>
            </div>
          </div>

          {importStatusMsg && (
            <div style={{
              backgroundColor: '#defbe6',
              border: '1px solid #6fdc8c',
              color: '#0e6027',
              padding: '10px 14px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500
            }}>
              <CheckCircle2 size={16} />
              {importStatusMsg}
            </div>
          )}

          {/* Census Filter Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderBottom: 'none',
            padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', border: '1px solid #8d8d8d' }}>
              {['ALL', 'T1', 'T2', 'T3'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setCensusTowerFilter(tf)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontFamily: 'var(--cds-font-mono)',
                    fontWeight: 600,
                    backgroundColor: censusTowerFilter === tf ? '#161616' : '#ffffff',
                    color: censusTowerFilter === tf ? '#ffffff' : '#525252',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {tf === 'ALL' ? '3 Torres (240 Aptos)' : `Torre ${tf.replace('T', '')} (80 Aptos)`}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8d8d8d' }} />
              <input
                type="text"
                className="cds-input"
                placeholder="Buscar por apto, nombre o email..."
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                value={censusSearch}
                onChange={(e) => setCensusSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Census Table */}
          <div className="cds-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="cds-table">
              <thead>
                <tr>
                  <th>Unidad / Apto</th>
                  <th>Torre</th>
                  <th>Propietario Titular</th>
                  <th>Correo Institucional</th>
                  <th>Teléfono</th>
                  <th>Autorizados Registrados</th>
                </tr>
              </thead>
              <tbody>
                {filteredApartments.slice(0, 50).map(apt => (
                  <tr key={apt.id}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>{apt.id}</td>
                    <td>{apt.towerName}</td>
                    <td><strong>{apt.ownerName}</strong></td>
                    <td className="font-mono" style={{ fontSize: '12px' }}>{apt.email}</td>
                    <td className="font-mono">{apt.phone}</td>
                    <td>
                      <span className="cds-tag cds-tag-blue">
                        {apt.authorized ? apt.authorized.length : 0} personas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredApartments.length > 50 && (
            <div style={{ fontSize: '11px', color: '#8d8d8d', marginTop: '8px', textAlign: 'right' }}>
              Mostrando primeros 50 de {filteredApartments.length} apartamentos para rendimiento de tabla.
            </div>
          )}
        </div>
      )}

      {/* ==========================================================================
          MODAL DE RECHAZO DE RESERVA (JUSTIFICACIÓN OBLIGATORIA)
          ========================================================================== */}
      {rejectingReservation && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content">
            <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#ff8389', fontFamily: 'var(--cds-font-mono)' }}>RECHAZO FUNDADO // CONTROL LEGAL</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Rechazar Solicitud {rejectingReservation.id}</div>
              </div>
              <button onClick={() => setRejectingReservation(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: '#525252', marginBottom: '12px' }}>
                Apartamento solicitante: <strong>{rejectingReservation.apartmentId}</strong> ({rejectingReservation.commonAreaName}).
              </p>

              {rejectionError && (
                <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
                  {rejectionError}
                </div>
              )}

              <label className="cds-input-label">MOTIVO DEL RECHAZO (OBLIGATORIO MÍNIMO 5 CARACTERES):</label>
              <textarea
                className="cds-input"
                style={{ height: '90px', paddingTop: '8px' }}
                placeholder="Ej. Mantenimiento programado de tuberías en la zona, deuda pendiente en expensas comunes, etc."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              ></textarea>
            </div>

            <div style={{ backgroundColor: '#f4f4f4', borderTop: '1px solid #e0e0e0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="cds-btn cds-btn-secondary" onClick={() => setRejectingReservation(null)}>
                Cancelar
              </button>
              <button type="button" className="cds-btn cds-btn-danger" onClick={handleConfirmRejection}>
                <X size={16} />
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL DE RESOLUCIÓN OFICIAL DE PQRS (RN-B6 OBLIGATORIA)
          ========================================================================== */}
      {resolvingPqrs && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content">
            <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#42be65', fontFamily: 'var(--cds-font-mono)' }}>RESPUESTA DE FONDO // RN-B6</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Emitir Respuesta Oficial a {resolvingPqrs.ticketNumber}</div>
              </div>
              <button onClick={() => setResolvingPqrs(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ backgroundColor: '#f4f4f4', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
                <div><strong>Asunto:</strong> {resolvingPqrs.subject}</div>
                <div><strong>Apto:</strong> {resolvingPqrs.apartmentId} // {resolvingPqrs.residentName}</div>
              </div>

              {pqrsResolutionError && (
                <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
                  {pqrsResolutionError}
                </div>
              )}

              <label className="cds-input-label">TEXTO DE RESPUESTA OFICIAL MOTIVADA (MÍNIMO 10 CARACTERES - RN-B6):</label>
              <textarea
                className="cds-input"
                style={{ height: '110px', paddingTop: '8px' }}
                placeholder="Escriba aquí la respuesta formal que será notificada al residente y quedará fijada en la pista de auditoría inmutable..."
                value={officialResponse}
                onChange={(e) => setOfficialResponse(e.target.value)}
                required
              ></textarea>
            </div>

            <div style={{ backgroundColor: '#f4f4f4', borderTop: '1px solid #e0e0e0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="cds-btn cds-btn-secondary" onClick={() => setResolvingPqrs(null)}>
                Cancelar
              </button>
              <button type="button" className="cds-btn cds-btn-primary" onClick={handleConfirmPqrsResolution}>
                <CheckCircle2 size={16} />
                <span>Firmar y Resolver PQRS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Executive Board Report Modal (SCRUM-41) */}
      <BoardReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        state={state}
      />

      {/* Batch Census Upload & Validation Modal (SCRUM-44) */}
      <CensusUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onConfirmSeed={handleSimulateBatchImport}
      />
    </div>
  );
}
