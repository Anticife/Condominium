import React, { useState } from 'react';
import { 
  Package, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  UserPlus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2
} from 'lucide-react';

export default function ResidentPortal({ 
  state, 
  currentUser,
  onAddReservation, 
  onAddPqrs, 
  onAddAuthorized, 
  onRemoveAuthorized 
}) {
  // Current logged in resident context (default: Carlos Rodríguez, T1-101)
  const [activeAptId, setActiveAptId] = useState(() => currentUser?.unitId || 'T1-101');
  const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'reservations' | 'authorized' | 'pqrs'

  // Booking Form State
  const [selectedArea, setSelectedArea] = useState('salon_social');
  const [selectedSlot, setSelectedSlot] = useState('PM'); // 'AM' | 'PM' (según reservationSlots.ts)
  const [bookingDate, setBookingDate] = useState('');
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Authorized Person Form State
  const [newAuthName, setNewAuthName] = useState('');
  const [newAuthDoc, setNewAuthDoc] = useState('');
  const [newAuthPhone, setNewAuthPhone] = useState('');
  const [newAuthRelation, setNewAuthRelation] = useState('Familiar');

  // PQRS Form State
  const [pqrsCategory, setPqrsCategory] = useState('Peticion');
  const [pqrsSubject, setPqrsSubject] = useState('');
  const [pqrsDescription, setPqrsDescription] = useState('');
  const [pqrsSuccess, setPqrsSuccess] = useState(null);

  // Get active apartment details
  const myApartment = state.apartments.find(a => a.id === activeAptId) || state.apartments[0];

  // Filter packages for this resident (RN-B7 compliance)
  const myPackages = state.packages.filter(p => p.apartmentId === myApartment.id);

  // Filter reservations for this resident
  const myReservations = state.reservations.filter(r => r.apartmentId === myApartment.id);

  // Filter PQRS for this resident
  const myPqrs = state.pqrs.filter(p => p.apartmentId === myApartment.id);

  // Calculate 48h minimum date string for datepicker (RN-B2)
  const min48hDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const minDateStr = min48hDate.toISOString().split('T')[0];

  // Submit Reservation Request (Enforces RN-B1, RN-B2, RN-B3)
  const handleBookingSubmit = (e) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    if (!bookingDate) {
      setBookingError('Debe seleccionar una fecha para la reserva.');
      return;
    }

    const slotTimesConfig = selectedArea === 'salon_social'
      ? (selectedSlot === 'AM' ? { start: '08:00', end: '14:00' } : { start: '15:00', end: '22:00' })
      : (selectedSlot === 'AM' ? { start: '10:00', end: '16:00' } : { start: '17:00', end: '22:00' });

    const startDateTime = new Date(`${bookingDate}T${slotTimesConfig.start}:00`);
    const endDateTime = new Date(`${bookingDate}T${slotTimesConfig.end}:00`);
    const now = new Date();

    // 1. Validate RN-B2: At least 48 hours in advance
    const diffHours = (startDateTime - now) / (1000 * 60 * 60);
    if (diffHours < 48) {
      setBookingError('REGLA RN-B2 VIOLADA: Toda reserva debe solicitarse con mínimo 48 horas de anticipación.');
      return;
    }

    // 2. Validate RN-B3: Max 1 active reservation per month per apartment
    const bookingMonth = startDateTime.getMonth();
    const bookingYear = startDateTime.getFullYear();
    const existingActiveInMonth = myReservations.find(r => {
      if (r.status === 'Rechazada') return false;
      const d = new Date(r.startTime);
      return d.getMonth() === bookingMonth && d.getFullYear() === bookingYear;
    });

    if (existingActiveInMonth) {
      setBookingError(`REGLA RN-B3 VIOLADA: Su apartamento ya cuenta con una reserva activa (${existingActiveInMonth.id}) para este mes.`);
      return;
    }

    // 3. Validate RN-B1: Check for overlaps in the same common area
    const hasOverlap = state.reservations.some(r => {
      if (r.commonArea !== selectedArea || r.status === 'Rechazada') return false;
      const existingStart = new Date(r.startTime);
      const existingEnd = new Date(r.endTime);
      return (startDateTime < existingEnd && endDateTime > existingStart);
    });

    if (hasOverlap) {
      setBookingError('REGLA RN-B1 VIOLADA: Ya existe una reserva programada para esa zona común en la franja horaria seleccionada.');
      return;
    }

    const newRes = {
      id: `RES-2026-${Date.now().toString().slice(-4)}`,
      commonArea: selectedArea,
      slot: selectedSlot,
      commonAreaName: selectedArea === 'salon_social' ? 'Salón Social Comunitario' : 'Zona BBQ & Terraza',
      capacity: selectedArea === 'salon_social' ? 80 : 30,
      depositAmount: selectedArea === 'salon_social' ? 200000 : 80000,
      apartmentId: myApartment.id,
      residentName: myApartment.ownerName,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      status: 'Pendiente',
      requestedAt: new Date().toISOString(),
      rejectionReason: null,
      resolvedBy: null,
      resolvedAt: null
    };

    onAddReservation(newRes);
    setBookingSuccess(`¡Reserva ${newRes.id} radicada exitosamente! Se encuentra en estado 'Pendiente' en espera del visto bueno de Administración.`);
    setBookingDate('');
  };

  // Submit Authorized Person
  const handleAddAuthorized = (e) => {
    e.preventDefault();
    if (!newAuthName || !newAuthDoc) return;

    const newPerson = {
      id: `auth-${Date.now()}`,
      name: newAuthName,
      doc: newAuthDoc,
      phone: newAuthPhone || 'No registrado',
      relation: newAuthRelation
    };

    onAddAuthorized(myApartment.id, newPerson);
    setNewAuthName('');
    setNewAuthDoc('');
    setNewAuthPhone('');
  };

  // Submit PQRS
  const handlePqrsSubmit = (e) => {
    e.preventDefault();
    if (!pqrsSubject || !pqrsDescription) return;

    const seq = state.nextPqrsSeq || 42;
    const ticketId = `PQ-2026-${seq.toString().padStart(4, '0')}`;

    const newTicket = {
      id: ticketId,
      ticketNumber: ticketId,
      apartmentId: myApartment.id,
      residentName: myApartment.ownerName,
      category: pqrsCategory,
      subject: pqrsSubject,
      description: pqrsDescription,
      status: 'Radicada',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      officialResponse: null,
      history: [
        {
          previousStatus: 'Inicio',
          newStatus: 'Radicada',
          changedBy: `${myApartment.ownerName} (Residente)`,
          changedAt: new Date().toISOString(),
          comment: 'Radicación electrónica formal desde el portal del residente.'
        }
      ]
    };

    onAddPqrs(newTicket);
    setPqrsSuccess(`¡PQRS radicada exitosamente con consecutivo oficial ${ticketId}!`);
    setPqrsSubject('');
    setPqrsDescription('');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* Resident Identity Header Card */}
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
              alignItems: 'center'
            }}>
              <span>{myApartment.id}</span>
              <span style={{ fontSize: '10px', color: '#8d8d8d' }}>{myApartment.towerName}</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#161616' }}>
                {myApartment.ownerName}
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Residente Titular // {myApartment.email} // Tel: {myApartment.phone}
              </div>
            </div>
          </div>

          {/* Quick Apartment Context Switcher for Demonstration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#8d8d8d', textTransform: 'uppercase' }}>
              Simular Apto:
            </span>
            <select
              className="cds-select font-mono"
              style={{ width: '150px', height: '36px', fontSize: '12px' }}
              value={activeAptId}
              onChange={(e) => setActiveAptId(e.target.value)}
            >
              <option value="T1-101">T1-101 (C. Rodríguez)</option>
              <option value="T2-304">T2-304 (C. Morales)</option>
              <option value="T3-502">T3-502 (F. Vargas)</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginTop: '20px' }}>
          {[
            { id: 'packages', label: 'Mis Paquetes', icon: Package, badge: myPackages.filter(p => p.status === 'Pendiente').length },
            { id: 'reservations', label: 'Zonas Comunes (Reservas)', icon: Calendar, badge: myReservations.length },
            { id: 'authorized', label: 'Personas Autorizadas', icon: ShieldCheck, badge: myApartment.authorized.length },
            { id: 'pqrs', label: 'Mis PQRS Radicadas', icon: FileText, badge: myPqrs.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  fontFamily: 'var(--cds-font-sans)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#0f62fe' : '#525252',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #0f62fe' : '3px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-1px'
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

      {/* ==========================================================================
          TAB 1: MIS PAQUETES (FEED PRIVADO RESIDENTE // RN-B7)
          ========================================================================== */}
      {activeTab === 'packages' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>Paquetería en Portería</h2>
              <p style={{ fontSize: '13px', color: '#525252' }}>
                Historial de encomiendas recibidas en portería bajo custodia oficial (RN-B7: privacidad por apartamento).
              </p>
            </div>
            <span className="cds-tag cds-tag-blue">RN-B7: HABEAS DATA ACTIVO</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {myPackages.length === 0 ? (
              <div className="cds-tile" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#8d8d8d' }}>
                <Package size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                No tiene paquetes registrados en portería en este momento.
              </div>
            ) : (
              myPackages.map(pkg => {
                const isPending = pkg.status === 'Pendiente';
                const days = Math.floor((new Date() - new Date(pkg.receivedAt)) / (1000 * 60 * 60 * 24));
                const isOverdue = isPending && days >= 15;

                return (
                  <div 
                    key={pkg.id} 
                    className="cds-tile" 
                    style={{ 
                      backgroundColor: '#ffffff',
                      borderLeft: isOverdue ? '4px solid #da1e28' : isPending ? '4px solid #0f62fe' : '4px solid #24a148' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span className="cds-tag cds-tag-dark font-mono">{pkg.id}</span>
                        <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>{pkg.courier}</div>
                        <div style={{ fontSize: '11px', color: '#525252', fontFamily: 'var(--cds-font-mono)' }}>Guía: {pkg.trackingNumber}</div>
                      </div>

                      {isPending ? (
                        <span className={`cds-tag ${isOverdue ? 'cds-tag-red' : 'cds-tag-blue'}`}>
                          {isOverdue ? 'BODEGAJE >15D (RN-B5)' : 'EN CUSTODIA'}
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
                      <div>Recibido: {new Date(pkg.receivedAt).toLocaleString('es-CO')}</div>
                      <div>Por: {pkg.receivedByPorteroName}</div>
                      {!isPending && (
                        <div style={{ marginTop: '4px', color: '#0e6027', fontWeight: 500 }}>
                          Retirado por: {pkg.deliveredToPerson} ({new Date(pkg.deliveredAt).toLocaleDateString('es-CO')})
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

      {/* ==========================================================================
          TAB 2: ZONAS COMUNES (MOTOR DE RESERVAS CON VALIDACIÓN RN-B1, B2, B3)
          ========================================================================== */}
      {activeTab === 'reservations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Reservation Form */}
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', border: '2px solid #0f62fe' }}>
            <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '10px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#161616' }}>
                Solicitar Zona Común
              </h2>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Validación estricta de antelación mínima de 48h (RN-B2) y 1 cupo mensual (RN-B3).
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
                alignItems: 'flex-start'
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
                alignItems: 'center'
              }}>
                <CheckCircle2 size={16} />
                <div>{bookingSuccess}</div>
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              {/* Common Area Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">ZONA COMÚN A RESERVAR</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedArea('salon_social')}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedArea === 'salon_social' ? '#0f62fe' : '#f4f4f4',
                      color: selectedArea === 'salon_social' ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedArea === 'salon_social' ? '#0f62fe' : '#e0e0e0',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Salón Social</div>
                    <div style={{ fontSize: '11px', opacity: 0.85 }}>Cap. 80 personas</div>
                    <div style={{ fontSize: '11px', opacity: 0.85 }}>Depósito: $200.000</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedArea('bbq')}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedArea === 'bbq' ? '#0f62fe' : '#f4f4f4',
                      color: selectedArea === 'bbq' ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedArea === 'bbq' ? '#0f62fe' : '#e0e0e0',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Zona BBQ & Terraza</div>
                    <div style={{ fontSize: '11px', opacity: 0.85 }}>Cap. 30 personas</div>
                    <div style={{ fontSize: '11px', opacity: 0.85 }}>Depósito: $80.000</div>
                  </button>
                </div>
              </div>

              {/* Date Input with 48h limit */}
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
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>

              {/* Official Time Slot Buttons according to reservationSlots.ts & RN-B1 */}
              <div style={{ marginBottom: '20px' }}>
                <label className="cds-input-label">FRANJA HORARIA NORMATIVA (RN-B1)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('AM')}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: selectedSlot === 'AM' ? '#161616' : '#ffffff',
                      color: selectedSlot === 'AM' ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedSlot === 'AM' ? '#161616' : '#8d8d8d',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>Franja Diurna (AM)</div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', opacity: 0.85 }}>
                      {selectedArea === 'salon_social' ? '08:00 - 14:00 (6 hrs)' : '10:00 - 16:00 (6 hrs)'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSlot('PM')}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: selectedSlot === 'PM' ? '#161616' : '#ffffff',
                      color: selectedSlot === 'PM' ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedSlot === 'PM' ? '#161616' : '#8d8d8d',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>Franja Nocturna (PM)</div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', opacity: 0.85 }}>
                      {selectedArea === 'salon_social' ? '15:00 - 22:00 (7 hrs)' : '17:00 - 22:00 (5 hrs)'}
                    </div>
                  </button>
                </div>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }}>
                <span>RADICAR SOLICITUD DE RESERVA</span>
                <Calendar size={16} />
              </button>
            </form>
          </div>

          {/* Resident Bookings History Table */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#161616' }}>
                Historial de Reservas del Apartamento {myApartment.id}
              </h3>
            </div>

            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Zona Común</th>
                    <th>Fecha y Horario</th>
                    <th>Depósito</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {myReservations.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#8d8d8d' }}>
                        No hay solicitudes de reserva registradas para este apartamento.
                      </td>
                    </tr>
                  ) : (
                    myReservations.map(res => (
                      <tr key={res.id}>
                        <td className="font-mono" style={{ fontWeight: 600 }}>{res.id}</td>
                        <td>{res.commonAreaName}</td>
                        <td>
                          <div>{new Date(res.startTime).toLocaleDateString('es-CO')}</div>
                          <div style={{ fontSize: '11px', color: '#525252' }}>
                            {new Date(res.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(res.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="font-mono">${res.depositAmount.toLocaleString('es-CO')}</td>
                        <td>
                          {res.status === 'Pendiente' && <span className="cds-tag cds-tag-yellow">PENDIENTE APROBACIÓN</span>}
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

      {/* ==========================================================================
          TAB 3: PERSONAS AUTORIZADAS (LEY 1581 HABEAS DATA // RN-B4)
          ========================================================================== */}
      {activeTab === 'authorized' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Add Authorized Person Form */}
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Registrar Persona Autorizada
            </h3>
            <p style={{ fontSize: '12px', color: '#525252', marginBottom: '16px' }}>
              Solo las personas registradas aquí podrán retirar paquetes en portería sin el titular presente (RN-B4).
            </p>

            <form onSubmit={handleAddAuthorized}>
              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">NOMBRE COMPLETO</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Ej. Juan Pérez"
                  value={newAuthName}
                  onChange={(e) => setNewAuthName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">N° DE DOCUMENTO DE IDENTIDAD</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Ej. CC 1020304050"
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
                  <option value="Conductor / Mensajero">Conductor / Asistente Particular</option>
                </select>
              </div>

              <div style={{ fontSize: '11px', color: '#525252', backgroundColor: '#f4f4f4', padding: '8px 10px', marginBottom: '16px' }}>
                <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: '#0f62fe' }} />
                Cumplimiento Ley 1581 de 2012 (Habeas Data): El titular autoriza el tratamiento de estos datos exclusivamente para la recepción y control de correspondencia.
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }}>
                <span>GUARDAR PERSONA AUTORIZADA</span>
                <UserPlus size={16} />
              </button>
            </form>
          </div>

          {/* Authorized Persons List */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Personas Habilitadas para Recibir Paquetería ({myApartment.authorized.length})
            </h3>

            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Documento</th>
                    <th>Teléfono</th>
                    <th>Relación</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {myApartment.authorized.map(person => (
                    <tr key={person.id}>
                      <td style={{ fontWeight: 600 }}>{person.name}</td>
                      <td className="font-mono">{person.doc}</td>
                      <td className="font-mono">{person.phone}</td>
                      <td>
                        <span className="cds-tag cds-tag-blue">{person.relation}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cds-btn cds-btn-ghost"
                          style={{ padding: '4px 8px', height: '28px', color: '#da1e28' }}
                          onClick={() => onRemoveAuthorized(myApartment.id, person.id)}
                        >
                          <Trash2 size={14} />
                          <span>Revocar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 4: PQRS RADICADAS (CONSECUTIVO ATÓMICO + HISTORIAL RN-B6)
          ========================================================================== */}
      {activeTab === 'pqrs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Radicación PQRS Form */}
          <div className="cds-tile" style={{ backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              Radicar Nueva PQRS
            </h3>
            <p style={{ fontSize: '12px', color: '#525252', marginBottom: '16px' }}>
              Genera consecutivo oficial irreversible con fecha y hora del servidor.
            </p>

            {pqrsSuccess && (
              <div style={{
                backgroundColor: '#defbe6',
                border: '1px solid #6fdc8c',
                color: '#0e6027',
                padding: '10px 12px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <CheckCircle2 size={16} />
                <div>{pqrsSuccess}</div>
              </div>
            )}

            <form onSubmit={handlePqrsSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">TIPO DE SOLICITUD</label>
                <select
                  className="cds-select"
                  value={pqrsCategory}
                  onChange={(e) => setPqrsCategory(e.target.value)}
                >
                  <option value="Peticion">Petición (Información, certificados, copias)</option>
                  <option value="Queja">Queja (Conducta de vecinos, ruidos, vigilantes)</option>
                  <option value="Reclamo">Reclamo (Fallas en zonas comunes, cobros, aseo)</option>
                  <option value="Sugerencia">Sugerencia (Mejoras comunitarias o ambientales)</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">ASUNTO</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Resumen concreto de la solicitud"
                  value={pqrsSubject}
                  onChange={(e) => setPqrsSubject(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">DESCRIPCIÓN DETALLADA</label>
                <textarea
                  className="cds-input"
                  style={{ height: '110px', paddingTop: '8px', resize: 'vertical' }}
                  placeholder="Escriba aquí los hechos, fechas y peticiones claras..."
                  value={pqrsDescription}
                  onChange={(e) => setPqrsDescription(e.target.value)}
                  required
                ></textarea>
              </div>

              <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }}>
                <span>RADICAR SOLICITUD FORMAL</span>
                <FileText size={16} />
              </button>
            </form>
          </div>

          {/* Radicados List */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Mis PQRS Radicadas ({myPqrs.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myPqrs.length === 0 ? (
                <div className="cds-tile" style={{ textAlign: 'center', padding: '30px', color: '#8d8d8d' }}>
                  No tiene solicitudes radicadas en este momento.
                </div>
              ) : (
                myPqrs.map(ticket => (
                  <div key={ticket.id} className="cds-tile" style={{ backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span className="cds-tag cds-tag-dark font-mono">{ticket.ticketNumber}</span>
                        <span className="cds-tag cds-tag-blue" style={{ marginLeft: '6px' }}>{ticket.category}</span>
                        <h4 style={{ fontSize: '16px', fontWeight: 600, marginTop: '6px' }}>{ticket.subject}</h4>
                      </div>

                      {ticket.status === 'Radicada' && <span className="cds-tag cds-tag-yellow">RADICADA</span>}
                      {ticket.status === 'En gestión' && <span className="cds-tag cds-tag-blue">EN GESTIÓN</span>}
                      {ticket.status === 'Resuelta' && <span className="cds-tag cds-tag-green">RESUELTA</span>}
                    </div>

                    <p style={{ fontSize: '13px', color: '#525252', marginBottom: '12px' }}>
                      {ticket.description}
                    </p>

                    {/* Official Response Box (RN-B6) */}
                    {ticket.officialResponse && (
                      <div style={{
                        backgroundColor: '#defbe6',
                        borderLeft: '4px solid #24a148',
                        padding: '12px 14px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#0e6027', marginBottom: '4px' }}>
                          RESPUESTA OFICIAL DE ADMINISTRACIÓN (RN-B6):
                        </div>
                        <div style={{ fontSize: '13px', color: '#161616' }}>
                          {ticket.officialResponse}
                        </div>
                      </div>
                    )}

                    {/* Timeline of States */}
                    <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '8px', fontSize: '11px', color: '#8d8d8d' }}>
                      <strong>Línea de tiempo:</strong>
                      {ticket.history.map((h, i) => (
                        <div key={i} style={{ marginTop: '2px' }}>
                          • {new Date(h.changedAt).toLocaleString('es-CO')}: Estado '{h.newStatus}' por {h.changedBy}.
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
