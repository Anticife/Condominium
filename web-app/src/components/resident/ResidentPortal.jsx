import React, { useState, useEffect } from 'react';
import {
  Package,
  Calendar,
  ShieldCheck,
  FileText,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  AREA_LABELS,
  SLOTS,
  MIN_NOTICE_HOURS,
} from '../../services/reservationSlots';
import {
  getTakenSlots,
  validateReservationRequest,
} from '../../services/reservationService';
import {
  formatDateCO,
  formatDateTimeCO,
  formatTimeCO,
  getElapsedHours,
} from '../../services/dateUtils';

export default function ResidentPortal({
  condoId,
  currentUser,
  apartment,
  authorizedPeople,
  packages,
  reservations,
  onRequestReservation,
  onAddAuthorized,
  onToggleAuthorized,
  onRemoveAuthorized,
  onUpdateContact,
}) {
  const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'reservations' | 'authorized' | 'profile' | 'pqrs'
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Booking Form State
  const [selectedArea, setSelectedArea] = useState('salon_social');
  const [selectedSlot, setSelectedSlot] = useState('PM');
  const [bookingDate, setBookingDate] = useState('');
  const [takenSlots, setTakenSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Authorized Person Form State
  const [newAuthName, setNewAuthName] = useState('');
  const [newAuthDoc, setNewAuthDoc] = useState('');
  const [newAuthPhone, setNewAuthPhone] = useState('');
  const [newAuthRelation, setNewAuthRelation] = useState('Familiar');
  const [authFormError, setAuthFormError] = useState(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Own Contact State
  const [contactName, setContactName] = useState(currentUser?.displayName || '');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '');
  const [contactMsg, setContactMsg] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!bookingDate) return undefined;
    let cancelled = false;
    getTakenSlots(db, condoId, selectedArea, bookingDate)
      .then((slots) => {
        if (!cancelled) setTakenSlots(slots);
      })
      .catch(() => {
        if (!cancelled) setTakenSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [condoId, selectedArea, bookingDate]);

  const minDateStr = new Date(nowMs + MIN_NOTICE_HOURS * 60 * 60 * 1000).toISOString().split('T')[0];

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    if (!bookingDate) {
      setBookingError('Debe seleccionar una fecha para la reserva.');
      return;
    }

    const req = {
      residentId: currentUser.uid,
      apartmentId: currentUser.unitId,
      commonArea: selectedArea,
      date: bookingDate,
      slot: selectedSlot,
    };

    try {
      validateReservationRequest(req, new Date(nowMs));
    } catch (err) {
      setBookingError(err?.message || 'Datos de reserva inválidos.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const resId = await onRequestReservation(req);
      setBookingSuccess(
        `Solicitud ${resId} radicada en Cloud Firestore para ${AREA_LABELS[selectedArea]} (${bookingDate}, franja ${selectedSlot}).`
      );
      setBookingDate('');
      setTakenSlots([]);
    } catch (err) {
      setBookingError(err?.message || 'No se pudo radicar la solicitud de reserva.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleAddAuthorizedSubmit = async (e) => {
    e.preventDefault();
    setAuthFormError(null);
    setSubmittingAuth(true);
    try {
      await onAddAuthorized(currentUser.unitId, {
        fullName: newAuthName,
        documentId: newAuthDoc,
        phone: newAuthPhone,
        relation: newAuthRelation,
      });
      setNewAuthName('');
      setNewAuthDoc('');
      setNewAuthPhone('');
    } catch (err) {
      setAuthFormError(err?.message || 'No se pudo registrar la persona autorizada.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setContactMsg(null);
    try {
      await onUpdateContact(currentUser.uid, {
        displayName: contactName,
        phone: contactPhone,
      });
      setContactMsg({ type: 'success', text: 'Datos de contacto actualizados en Firestore.' });
    } catch (err) {
      setContactMsg({ type: 'error', text: err?.message || 'Error al actualizar datos.' });
    }
  };

  const pendingPackagesCount = packages.filter((p) => p.status === 'Pendiente').length;
  const nonResidentAuthorizedCount = authorizedPeople.filter((a) => a.relation !== 'residente' && a.isActive).length;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Resident Identity Header Card (Real Firestore Data) */}
      <div className="cds-tile" style={{ marginBottom: '24px', backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              backgroundColor: '#161616',
              color: '#ffffff',
              padding: '12px 18px',
              fontFamily: 'var(--cds-font-mono)',
              fontSize: '20px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <span>{currentUser.unitId}</span>
              <span style={{ fontSize: '10px', color: '#78a9ff' }}>TORRE {currentUser.towerId || apartment?.towerId || '—'}</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#161616' }}>
                {currentUser.displayName || currentUser.email}
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Residente // <span className="font-mono">{currentUser.email}</span>
                {currentUser.phone ? ` // Tel: ${currentUser.phone}` : ''}
              </div>
              {apartment?.ownerName && (
                <div style={{ fontSize: '11px', color: '#6f6f6f', marginTop: '2px' }}>
                  Titular registrado en unidad: <strong>{apartment.ownerName}</strong>
                </div>
              )}
            </div>
          </div>

          <span className="cds-tag cds-tag-blue">RN-B7: AISLAMIENTO POR UNIDAD</span>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginTop: '20px', overflowX: 'auto' }}>
          {[
            { id: 'packages', label: 'Mis Paquetes', icon: Package, badge: pendingPackagesCount },
            { id: 'reservations', label: 'Zonas Comunes (Reservas)', icon: Calendar, badge: reservations.length },
            { id: 'authorized', label: 'Personas Autorizadas', icon: ShieldCheck, badge: nonResidentAuthorizedCount },
            { id: 'profile', label: 'Mi Perfil (Ley 1581)', icon: UserCheck, badge: 0 },
            { id: 'pqrs', label: 'PQRS (Sprint 2)', icon: FileText, badge: 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  fontFamily: 'var(--cds-font-sans)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#0f62fe' : '#525252',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #0f62fe' : '3px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`cds-tag ${isActive ? 'cds-tag-blue' : 'cds-tag-gray'}`} style={{ padding: '1px 6px', fontSize: '10px' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: MIS PAQUETES (CON-04, RN-B7) */}
      {activeTab === 'packages' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>Paquetería en Portería</h2>
              <p style={{ fontSize: '13px', color: '#525252' }}>
                Consulta en tiempo real de encomiendas asignadas exclusivamente al apartamento {currentUser.unitId}.
              </p>
            </div>
            <span className="cds-tag cds-tag-blue">RN-B7: HABEAS DATA ACTIVO</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {packages.length === 0 ? (
              <div className="cds-tile" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#8d8d8d' }}>
                <Package size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                No hay paquetes registrados para la unidad {currentUser.unitId}.
              </div>
            ) : (
              packages.map((pkg) => {
                const isPending = pkg.status === 'Pendiente';
                const days = Math.floor(getElapsedHours(pkg.receivedAt, nowMs) / 24);
                const isOverdue = isPending && days >= 15;

                return (
                  <div
                    key={pkg.id}
                    className="cds-tile"
                    style={{
                      backgroundColor: '#ffffff',
                      borderLeft: isOverdue ? '4px solid #da1e28' : isPending ? '4px solid #0f62fe' : '4px solid #24a148',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span className="cds-tag cds-tag-dark font-mono">{pkg.id.slice(0, 10)}</span>
                        <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>{pkg.courier}</div>
                        <div style={{ fontSize: '11px', color: '#525252', fontFamily: 'var(--cds-font-mono)' }}>
                          Guía: {pkg.trackingNumber || 'Sin guía'}
                        </div>
                      </div>

                      {isPending ? (
                        <span className={`cds-tag ${isOverdue ? 'cds-tag-red' : 'cds-tag-blue'}`}>
                          {isOverdue ? 'BODEGAJE >15D (RN-B5)' : 'PENDIENTE POR RECLAMAR'}
                        </span>
                      ) : (
                        <span className="cds-tag cds-tag-green">ENTREGADO</span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#525252', marginBottom: '12px', backgroundColor: '#f4f4f4', padding: '8px 10px' }}>
                      <div><strong>Destinatario:</strong> {pkg.recipientName}</div>
                      {pkg.notes && <div><strong>Detalle:</strong> {pkg.notes}</div>}
                    </div>

                    <div style={{ fontSize: '11px', color: '#8d8d8d', borderTop: '1px solid #e0e0e0', paddingTop: '8px' }}>
                      <div>Recibido en portería: {formatDateTimeCO(pkg.receivedAt)}</div>
                      {!isPending && pkg.deliveredToPerson && (
                        <div style={{ marginTop: '4px', color: '#0e6027', fontWeight: 500 }}>
                          Retirado por: {pkg.deliveredToPerson} ({formatDateCO(pkg.deliveredAt)})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RESERVAS DE ZONAS COMUNES (CON-06: RN-B1, RN-B2, RN-B3) */}
      {activeTab === 'reservations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', border: '2px solid #0f62fe', maxWidth: '480px', width: '100%' }}>
            <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '10px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#161616' }}>Solicitar Zona Común</h2>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Validación atómica en Firestore: antelación 48h (RN-B2), 1 cupo mensual (RN-B3) y sin cruces (RN-B1).
              </div>
            </div>

            {bookingError && (
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
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{bookingError}</div>
              </div>
            )}

            {bookingSuccess && (
              <div style={{
                backgroundColor: '#defbe6',
                border: '1px solid #6fdc8c',
                color: '#0e6027',
                padding: '10px 12px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <CheckCircle2 size={16} />
                <div>{bookingSuccess}</div>
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">ZONA COMÚN A RESERVAR</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'salon_social', title: 'Salón Social', subtitle: '08:00-14:00 / 15:00-22:00' },
                    { id: 'bbq', title: 'Zona BBQ', subtitle: '10:00-16:00 / 17:00-22:00' },
                  ].map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => {
                        setSelectedArea(area.id);
                        if (bookingDate) setLoadingSlots(true);
                      }}
                      style={{
                        padding: '12px',
                        backgroundColor: selectedArea === area.id ? '#0f62fe' : '#f4f4f4',
                        color: selectedArea === area.id ? '#ffffff' : '#161616',
                        border: '1px solid',
                        borderColor: selectedArea === area.id ? '#0f62fe' : '#e0e0e0',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{area.title}</div>
                      <div style={{ fontSize: '11px', opacity: 0.85 }}>{area.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="cds-input-label">FECHA DEL EVENTO</label>
                  <span style={{ fontSize: '10px', color: '#0f62fe', fontFamily: 'var(--cds-font-mono)' }}>
                    MÍNIMO DESDE: {minDateStr}
                  </span>
                </div>
                <input
                  type="date"
                  className="cds-input font-mono"
                  min={minDateStr}
                  value={bookingDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBookingDate(val);
                    if (!val) {
                      setTakenSlots([]);
                      setLoadingSlots(false);
                    } else {
                      setLoadingSlots(true);
                    }
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="cds-input-label">FRANJA HORARIA (RN-B1)</label>
                  {loadingSlots && (
                    <span style={{ fontSize: '10px', color: '#525252' }}>Consultando disponibilidad...</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(['AM', 'PM']).map((slotKey) => {
                    const [startH, endH] = SLOTS[selectedArea][slotKey];
                    const isTaken = takenSlots.includes(slotKey);
                    const isSelected = selectedSlot === slotKey;
                    return (
                      <button
                        key={slotKey}
                        type="button"
                        disabled={isTaken}
                        onClick={() => setSelectedSlot(slotKey)}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: isTaken ? '#fff1f1' : isSelected ? '#161616' : '#ffffff',
                          color: isTaken ? '#a2191f' : isSelected ? '#ffffff' : '#161616',
                          border: '1px solid',
                          borderColor: isTaken ? '#ffb3b8' : isSelected ? '#161616' : '#8d8d8d',
                          textAlign: 'left',
                          cursor: isTaken ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '12px' }}>
                          Franja {slotKey} {isTaken ? '(OCUPADA)' : ''}
                        </div>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', opacity: 0.85 }}>
                          {String(startH).padStart(2, '0')}:00 - {String(endH).padStart(2, '0')}:00
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="cds-btn cds-btn-primary"
                style={{ width: '100%' }}
                disabled={submittingBooking || takenSlots.includes(selectedSlot)}
              >
                <span>{submittingBooking ? 'RADICANDO...' : 'RADICAR SOLICITUD DE RESERVA'}</span>
                <Calendar size={16} />
              </button>
            </form>
          </div>

          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#161616', marginBottom: '12px' }}>
              Historial de Reservas — Unidad {currentUser.unitId}
            </h3>
            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Zona Común</th>
                    <th>Fecha y Horario</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#8d8d8d' }}>
                        No hay solicitudes de reserva registradas para este apartamento.
                      </td>
                    </tr>
                  ) : (
                    reservations.map((res) => (
                      <tr key={res.id}>
                        <td className="font-mono" style={{ fontWeight: 600 }}>{res.id.slice(0, 10)}</td>
                        <td>{AREA_LABELS[res.commonArea] || res.commonArea} ({res.slot})</td>
                        <td>
                          <div>{res.date || formatDateCO(res.startTime)}</div>
                          <div style={{ fontSize: '11px', color: '#525252' }}>
                            {formatTimeCO(res.startTime)} - {formatTimeCO(res.endTime)}
                          </div>
                        </td>
                        <td>
                          {res.status === 'Pendiente' && <span className="cds-tag cds-tag-yellow">PENDIENTE</span>}
                          {res.status === 'Aprobada' && <span className="cds-tag cds-tag-green">APROBADA</span>}
                          {res.status === 'Rechazada' && (
                            <div>
                              <span className="cds-tag cds-tag-red">RECHAZADA</span>
                              {res.rejectionReason && (
                                <div style={{ fontSize: '11px', color: '#a2191f', marginTop: '4px' }}>
                                  Motivo: {res.rejectionReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERSONAS AUTORIZADAS (CON-02, RN-B4, RN-B7) */}
      {activeTab === 'authorized' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', border: '1px solid #e0e0e0', maxWidth: '460px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Registrar Persona Autorizada
            </h3>
            <p style={{ fontSize: '12px', color: '#525252', marginBottom: '16px' }}>
              Solo los residentes habilitados por Administración y las personas autorizadas aquí podrán retirar paquetes en portería (RN-B4).
            </p>

            {authFormError && (
              <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '10px 12px', fontSize: '12px', marginBottom: '12px' }}>
                {authFormError}
              </div>
            )}

            <form onSubmit={handleAddAuthorizedSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">NOMBRE COMPLETO</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Nombre de la persona autorizada"
                  value={newAuthName}
                  onChange={(e) => setNewAuthName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">N° DE DOCUMENTO</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Ej. 1020304050"
                  value={newAuthDoc}
                  onChange={(e) => setNewAuthDoc(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">TELÉFONO DE CONTACTO</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Ej. 3157891234"
                  value={newAuthPhone}
                  onChange={(e) => setNewAuthPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">PARENTESCO O VÍNCULO</label>
                <select
                  className="cds-select"
                  value={newAuthRelation}
                  onChange={(e) => setNewAuthRelation(e.target.value)}
                >
                  <option value="Familiar">Familiar (Hijo/a, Pareja, Hermano/a)</option>
                  <option value="Personal de Servicio">Personal de Servicio Doméstico</option>
                  <option value="Arrendatario">Arrendatario / Huésped Autorizado</option>
                  <option value="Asistente">Asistente / Conductor</option>
                </select>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }} disabled={submittingAuth}>
                <span>{submittingAuth ? 'GUARDANDO...' : 'GUARDAR PERSONA AUTORIZADA'}</span>
                <UserPlus size={16} />
              </button>
            </form>
          </div>

          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Personas Habilitadas en Portería ({authorizedPeople.length})
            </h3>
            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Documento</th>
                    <th>Relación</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizedPeople.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#8d8d8d' }}>
                        No hay personas habilitadas registradas aún para la unidad {currentUser.unitId}.
                      </td>
                    </tr>
                  ) : (
                    authorizedPeople.map((person) => {
                      const isResidentRecord = person.relation === 'residente';
                      return (
                        <tr key={person.id}>
                          <td style={{ fontWeight: 600 }}>{person.fullName}</td>
                          <td className="font-mono">{person.documentId}</td>
                          <td>
                            <span className={`cds-tag ${isResidentRecord ? 'cds-tag-dark' : 'cds-tag-blue'}`}>
                              {person.relation}
                            </span>
                          </td>
                          <td>
                            <span className={`cds-tag ${person.isActive ? 'cds-tag-green' : 'cds-tag-gray'}`}>
                              {person.isActive ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </td>
                          <td>
                            {isResidentRecord ? (
                              <span style={{ fontSize: '11px', color: '#8d8d8d' }}>Gestionado por Admin</span>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ padding: '4px 8px', height: '28px', minHeight: '28px', fontSize: '12px' }}
                                  onClick={() => onToggleAuthorized(currentUser.unitId, person.id, !person.isActive)}
                                >
                                  {person.isActive ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ padding: '4px 8px', height: '28px', minHeight: '28px', color: '#da1e28', fontSize: '12px' }}
                                  onClick={() => onRemoveAuthorized(currentUser.unitId, person.id)}
                                >
                                  <Trash2 size={14} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MI PERFIL (SCRUM-53 / LEY 1581) */}
      {activeTab === 'profile' && (
        <div className="cds-tile" style={{ backgroundColor: '#ffffff', maxWidth: '520px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            Mis Datos de Contacto (Ley 1581 de 2012)
          </h3>
          <p style={{ fontSize: '12px', color: '#525252', marginBottom: '16px' }}>
            El residente puede actualizar únicamente su nombre y teléfono; el rol y la unidad asignada son protegidos por las reglas de Firestore.
          </p>

          {contactMsg && (
            <div style={{
              backgroundColor: contactMsg.type === 'error' ? '#fff1f1' : '#defbe6',
              border: `1px solid ${contactMsg.type === 'error' ? '#ffb3b8' : '#6fdc8c'}`,
              color: contactMsg.type === 'error' ? '#a2191f' : '#0e6027',
              padding: '10px 12px',
              fontSize: '12px',
              marginBottom: '14px',
            }}>
              {contactMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveContact}>
            <div style={{ marginBottom: '12px' }}>
              <label className="cds-input-label">NOMBRE COMPLETO</label>
              <input
                type="text"
                className="cds-input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="cds-input-label">TELÉFONO</label>
              <input
                type="tel"
                className="cds-input font-mono"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <button type="submit" className="cds-btn cds-btn-primary">
              <span>Actualizar Datos</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: PQRS (Programado Sprint 2: CON-08) */}
      {activeTab === 'pqrs' && (
        <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #0f62fe', padding: '24px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#161616', marginBottom: '6px' }}>
            Módulo de PQRS con Radicado Consecutivo (CON-08 / CON-09)
          </h3>
          <p style={{ fontSize: '13px', color: '#525252' }}>
            Este módulo corresponde al <strong>Sprint 2</strong> del tablero SCRUM y se conectará con radicación atómica en Firestore e historial inmutable (`RN-B6`) al iniciar dicho sprint.
          </p>
        </div>
      )}
    </div>
  );
}
