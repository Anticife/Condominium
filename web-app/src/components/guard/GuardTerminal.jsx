import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  FileCheck2,
  Box,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../../config/firebase';
import { listActiveAuthorized } from '../../services/censusService';
import { formatTimeCO, getElapsedHours } from '../../services/dateUtils';

const COURIERS = [
  'MercadoLibre',
  'Amazon',
  'Servientrega',
  'InterRapidísimo',
  'Envía',
  'Coordinadora',
  'Domicilio Local',
];

export default function GuardTerminal({
  currentUser,
  towers,
  apartments,
  packages,
  onAddPackage,
  onDeliverPackage,
}) {
  const [selectedTower, setSelectedTower] = useState('');
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [aptSearchQuery, setAptSearchQuery] = useState('');
  const [selectedCourier, setSelectedCourier] = useState(COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [intakeStatus, setIntakeStatus] = useState(null); // { type, message }
  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Custody Table Filters
  const [filterTower, setFilterTower] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Delivery Modal State
  const [deliveryTarget, setDeliveryTarget] = useState(null); // { pkg, authorizedList, loading, error }
  const [selectedAuthId, setSelectedAuthId] = useState('');
  const [receiverDocumentInput, setReceiverDocumentInput] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Sincronizar torre seleccionada cuando llegan las torres de Firestore
  const activeTowerId = useMemo(() => {
    if (selectedTower && towers.some((t) => t.id === selectedTower)) return selectedTower;
    return towers[0]?.id || '';
  }, [selectedTower, towers]);

  // Apartamentos filtrados de la torre seleccionada + búsqueda rápida (SCRUM-54)
  const towerApartments = useMemo(() => {
    const inTower = apartments.filter((a) => !activeTowerId || a.towerId === activeTowerId);
    if (!aptSearchQuery.trim()) return inTower;
    const q = aptSearchQuery.trim().toLowerCase();
    return inTower.filter(
      (a) =>
        a.number.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.ownerName || '').toLowerCase().includes(q)
    );
  }, [apartments, activeTowerId, aptSearchQuery]);

  const activeApartment = useMemo(() => {
    if (selectedApartmentId && towerApartments.some((a) => a.id === selectedApartmentId)) {
      return towerApartments.find((a) => a.id === selectedApartmentId);
    }
    return towerApartments[0] || null;
  }, [selectedApartmentId, towerApartments]);

  const handleRegisterPackage = async (e) => {
    e.preventDefault();
    if (!activeApartment) {
      setIntakeStatus({ type: 'error', message: 'Seleccione un apartamento registrado en Firestore.' });
      return;
    }

    const recipientName = customRecipient.trim() || activeApartment.ownerName || 'Residente';
    setSubmittingIntake(true);
    setIntakeStatus(null);
    try {
      const pkgId = await onAddPackage({
        apartmentId: activeApartment.id,
        courier: selectedCourier,
        recipientName,
        trackingNumber: trackingNumber.trim() || undefined,
        notes: packageNotes.trim() || undefined,
      });
      setIntakeStatus({
        type: 'success',
        message: `Paquete ${pkgId} registrado para ${activeApartment.id} en Cloud Firestore.`,
      });
      setTrackingNumber('');
      setCustomRecipient('');
      setPackageNotes('');
    } catch (err) {
      setIntakeStatus({ type: 'error', message: err?.message || 'Error al registrar el paquete.' });
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleOpenDelivery = async (pkg) => {
    setDeliveryTarget({ pkg, authorizedList: [], loading: true, error: null });
    setSelectedAuthId('');
    setReceiverDocumentInput('');
    setDeliveryNotes('');

    try {
      const authorizedList = await listActiveAuthorized(db, pkg.apartmentId);
      setDeliveryTarget({ pkg, authorizedList, loading: false, error: null });
      if (authorizedList.length > 0) {
        setSelectedAuthId(authorizedList[0].id);
      }
    } catch (err) {
      setDeliveryTarget({
        pkg,
        authorizedList: [],
        loading: false,
        error: err?.message || 'Error al consultar personas autorizadas en Firestore.',
      });
    }
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryTarget) return;
    if (!receiverDocumentInput.trim()) {
      setDeliveryTarget((prev) => ({
        ...prev,
        error: 'Ingrese el número de documento verificado en ventanilla (RN-B4).',
      }));
      return;
    }

    setSubmittingDelivery(true);
    try {
      await onDeliverPackage(
        deliveryTarget.pkg.id,
        receiverDocumentInput.trim(),
        deliveryNotes.trim() || undefined
      );
      setDeliveryTarget(null);
    } catch (err) {
      setDeliveryTarget((prev) => ({
        ...prev,
        error: err?.message || 'No se pudo completar la entrega.',
      }));
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const custodyPackages = packages.filter((p) => {
    if (p.status !== 'Pendiente') return false;
    if (filterTower !== 'ALL' && p.towerId !== filterTower) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        p.apartmentId.toLowerCase().includes(q) ||
        (p.trackingNumber || '').toLowerCase().includes(q) ||
        p.recipientName.toLowerCase().includes(q) ||
        p.courier.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const guardName = currentUser?.displayName || currentUser?.email || 'Operador de Portería';

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* View Title */}
      <div style={{
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '16px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe', fontWeight: 600, letterSpacing: '1px' }}>
            TERMINAL DE CONTROL DE ACCESO // RNF-10 &amp; RNF-11
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>
            Consola Operativa de Portería &amp; Encomiendas
          </h1>
          <p style={{ fontSize: '13px', color: '#525252', marginTop: '2px' }}>
            Recepción rápida para tableta (&lt;10s), sincronización multi-turno en tiempo real y entrega verificada (RN-B4).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="cds-tag cds-tag-blue">TURNO: {guardName}</span>
          <span className="cds-tag cds-tag-green">RN-B4: RECEPTOR VERIFICADO</span>
        </div>
      </div>

      {towers.length === 0 || apartments.length === 0 ? (
        <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #f1c21b', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#161616', marginBottom: '6px' }}>
            Censo pendiente de configuración
          </h2>
          <p style={{ fontSize: '13px', color: '#525252' }}>
            Aún no hay torres o apartamentos registrados en Cloud Firestore. Solicite a la Administración registrar las unidades del conjunto para habilitar la recepción de encomiendas.
          </p>
        </div>
      ) : null}

      {/* Main Grid: Fast Intake Form + Custody Inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Fast Package Reception */}
        <div className="cds-tile" style={{ border: '2px solid #0f62fe', padding: '20px', background: '#ffffff', maxWidth: '520px', width: '100%' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e0e0e0',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px' }}>
              <PackagePlus size={18} color="#0f62fe" />
              Recepción Inmediata (&lt;10 Segundos)
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe' }}>
              FIRESTORE EN VIVO
            </span>
          </div>

          {intakeStatus && (
            <div style={{
              backgroundColor: intakeStatus.type === 'error' ? '#fff1f1' : '#defbe6',
              border: `1px solid ${intakeStatus.type === 'error' ? '#ffb3b8' : '#6fdc8c'}`,
              color: intakeStatus.type === 'error' ? '#a2191f' : '#0e6027',
              padding: '10px 14px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500,
            }}>
              {intakeStatus.type === 'error' ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
              <span>{intakeStatus.message}</span>
            </div>
          )}

          <form onSubmit={handleRegisterPackage}>
            {/* Step 1: Dynamic Tower Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label className="cds-input-label">1. SELECCIONAR TORRE / BLOQUE</label>
              {towers.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#8d8d8d', padding: '10px', backgroundColor: '#f4f4f4', border: '1px solid #e0e0e0' }}>
                  Sin torres registradas.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(towers.length, 3)}, 1fr)`, gap: '6px' }}>
                  {towers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTower(t.id);
                        setSelectedApartmentId('');
                      }}
                      style={{
                        padding: '10px 8px',
                        fontSize: '12px',
                        fontFamily: 'var(--cds-font-mono)',
                        fontWeight: 600,
                        backgroundColor: activeTowerId === t.id ? '#0f62fe' : '#f4f4f4',
                        color: activeTowerId === t.id ? '#ffffff' : '#161616',
                        border: '1px solid',
                        borderColor: activeTowerId === t.id ? '#0f62fe' : '#e0e0e0',
                        cursor: 'pointer',
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Dynamic Apartment Selector & Predictive Search (SCRUM-54) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="cds-input-label">2. UNIDAD / APARTAMENTO</label>
                {activeApartment?.ownerName && (
                  <span style={{ fontSize: '11px', color: '#0f62fe', fontWeight: 500 }}>
                    {activeApartment.ownerName}
                  </span>
                )}
              </div>

              <input
                type="text"
                className="cds-input font-mono"
                style={{ marginBottom: '6px', height: '34px', fontSize: '12px' }}
                placeholder="Filtrar rápido por número o titular..."
                value={aptSearchQuery}
                onChange={(e) => setAptSearchQuery(e.target.value)}
              />

              <select
                className="cds-select font-mono"
                value={activeApartment?.id || ''}
                onChange={(e) => setSelectedApartmentId(e.target.value)}
                required
              >
                {towerApartments.length === 0 ? (
                  <option value="">No hay apartamentos registrados en esta torre</option>
                ) : (
                  towerApartments.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.id} {apt.ownerName ? `— ${apt.ownerName}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Step 3: Courier Quick Chips */}
            <div style={{ marginBottom: '16px' }}>
              <label className="cds-input-label">3. TRANSPORTADORA (1 TOQUE)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {COURIERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCourier(c)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      backgroundColor: selectedCourier === c ? '#0f62fe' : '#ffffff',
                      color: selectedCourier === c ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedCourier === c ? '#0f62fe' : '#8d8d8d',
                      cursor: 'pointer',
                      fontWeight: selectedCourier === c ? 600 : 400,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Tracking & Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label className="cds-input-label">N° DE GUÍA (OPCIONAL)</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Código o últimos dígitos"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="cds-input-label">DESTINATARIO</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder={activeApartment?.ownerName || 'Nombre en etiqueta'}
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="cds-input-label">OBSERVACIÓN / ESTADO FÍSICO</label>
              <input
                type="text"
                className="cds-input"
                placeholder="Ej. Caja mediana sellada, sobre acolchado..."
                value={packageNotes}
                onChange={(e) => setPackageNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="cds-btn cds-btn-primary"
              style={{ width: '100%', height: '48px', fontSize: '15px' }}
              disabled={!activeApartment || submittingIntake}
            >
              <span>{submittingIntake ? 'REGISTRANDO...' : 'REGISTRAR ENTRADA DE PAQUETE'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Real-Time Custody Table */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderBottom: 'none',
            padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#161616' }}>
                Encomiendas en Custodia ({custodyPackages.length})
              </span>

              <div style={{ display: 'flex', border: '1px solid #8d8d8d', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setFilterTower('ALL')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontFamily: 'var(--cds-font-mono)',
                    fontWeight: 600,
                    backgroundColor: filterTower === 'ALL' ? '#161616' : '#ffffff',
                    color: filterTower === 'ALL' ? '#ffffff' : '#525252',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  TODAS
                </button>
                {towers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterTower(t.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--cds-font-mono)',
                      fontWeight: 600,
                      backgroundColor: filterTower === t.id ? '#161616' : '#ffffff',
                      color: filterTower === t.id ? '#ffffff' : '#525252',
                      border: 'none',
                      borderLeft: '1px solid #e0e0e0',
                      cursor: 'pointer',
                    }}
                  >
                    {t.id}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8d8d8d' }} />
              <input
                type="text"
                className="cds-input"
                placeholder="Buscar apto, guía o persona..."
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="cds-table-container">
            <table className="cds-table">
              <thead>
                <tr>
                  <th>ID / Guía</th>
                  <th>Unidad</th>
                  <th>Destinatario</th>
                  <th>Transportadora</th>
                  <th>Tiempo en Portería</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {custodyPackages.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#8d8d8d' }}>
                      <Box size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                      No hay paquetes pendientes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  custodyPackages.map((pkg) => {
                    const hoursAgo = getElapsedHours(pkg.receivedAt, nowMs);
                    const daysAgo = Math.floor(hoursAgo / 24);
                    const isOverdue = daysAgo >= 15;

                    return (
                      <tr key={pkg.id} style={{ backgroundColor: isOverdue ? '#fff8e1' : undefined }}>
                        <td className="font-mono">
                          <div style={{ fontWeight: 600, color: '#161616' }}>{pkg.id.slice(0, 10)}</div>
                          <div style={{ fontSize: '11px', color: '#525252' }}>{pkg.trackingNumber || 'Sin guía'}</div>
                        </td>

                        <td>
                          <span className="cds-tag cds-tag-dark">{pkg.apartmentId}</span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 500 }}>{pkg.recipientName}</div>
                          {pkg.notes && <div style={{ fontSize: '11px', color: '#6f6f6f' }}>{pkg.notes}</div>}
                        </td>

                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#0f62fe' }}>
                            {pkg.courier}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isOverdue ? (
                              <span className="cds-tag cds-tag-red">
                                <AlertTriangle size={10} />
                                {daysAgo} DÍAS (RN-B5)
                              </span>
                            ) : (
                              <span className="cds-tag cds-tag-blue">
                                <Clock size={10} />
                                {daysAgo > 0 ? `${daysAgo}d ${hoursAgo % 24}h` : `${hoursAgo}h`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: '#8d8d8d', marginTop: '2px' }}>
                            {formatTimeCO(pkg.receivedAt)}
                          </div>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="cds-btn cds-btn-primary"
                            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                            onClick={() => handleOpenDelivery(pkg)}
                          >
                            <FileCheck2 size={14} />
                            <span>Entregar</span>
                          </button>
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

      {/* Modal de entrega atómica verificada (RN-B4) */}
      {deliveryTarget && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content">
            <div style={{
              backgroundColor: '#161616',
              color: '#ffffff',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#4589ff' }}>
                  ENTREGA ATÓMICA VERIFICADA // RN-B4
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>
                  Unidad {deliveryTarget.pkg.apartmentId} — {deliveryTarget.pkg.courier}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ backgroundColor: '#f4f4f4', border: '1px solid #e0e0e0', padding: '12px 14px', marginBottom: '16px', fontSize: '13px' }}>
                <div><strong>Destinatario:</strong> {deliveryTarget.pkg.recipientName}</div>
                <div><strong>Guía:</strong> {deliveryTarget.pkg.trackingNumber || 'Sin guía'}</div>
                {deliveryTarget.pkg.notes && <div><strong>Detalle:</strong> {deliveryTarget.pkg.notes}</div>}
              </div>

              <div style={{
                backgroundColor: '#edf5ff',
                borderLeft: '4px solid #0f62fe',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#002d9c',
                marginBottom: '16px',
              }}>
                <strong>Regla RN-B4:</strong> La entrega solo se autoriza contra el documento de un residente o persona autorizada activa registrada en Firestore para esta unidad.
              </div>

              {deliveryTarget.error && (
                <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
                  {deliveryTarget.error}
                </div>
              )}

              <label className="cds-input-label" style={{ fontWeight: 600 }}>
                PERSONAS HABILITADAS EN FIRESTORE ({deliveryTarget.authorizedList.length}):
              </label>

              {deliveryTarget.loading ? (
                <div style={{ padding: '16px', fontSize: '12px', color: '#525252' }}>
                  Consultando personas autorizadas en Cloud Firestore...
                </div>
              ) : deliveryTarget.authorizedList.length === 0 ? (
                <div style={{ backgroundColor: '#fff1f1', border: '1px solid #ffb3b8', color: '#a2191f', padding: '12px', fontSize: '12px', marginBottom: '16px' }}>
                  Esta unidad no tiene residentes ni autorizados activos en Firestore. La regla RN-B4 impedirá la entrega hasta que Administración o el Residente registre al receptor autorizado.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
                  {deliveryTarget.authorizedList.map((person) => (
                    <label
                      key={person.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        backgroundColor: selectedAuthId === person.id ? '#edf5ff' : '#ffffff',
                        border: '1px solid',
                        borderColor: selectedAuthId === person.id ? '#0f62fe' : '#e0e0e0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="receiver"
                        checked={selectedAuthId === person.id}
                        onChange={() => {
                          setSelectedAuthId(person.id);
                          setReceiverDocumentInput(person.documentId);
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{person.fullName}</div>
                        <div style={{ fontSize: '11px', color: '#525252' }}>
                          {person.relation} • Doc: <span className="font-mono">{person.documentId}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label className="cds-input-label">DOCUMENTO VERIFICADO EN PORTERÍA</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  value={receiverDocumentInput}
                  onChange={(e) => setReceiverDocumentInput(e.target.value)}
                  placeholder="Digite exactamente el documento presentado"
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="cds-input-label">NOTA DE ENTREGA (OPCIONAL)</label>
                <input
                  type="text"
                  className="cds-input"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Ej. Entregado en ventanilla"
                />
              </div>

              <div style={{ fontSize: '11px', color: '#525252', backgroundColor: '#f4f4f4', padding: '8px 12px' }}>
                Operador autenticado: <strong>{guardName}</strong> // Hora sellada por el servidor (`request.time`).
              </div>
            </div>

            <div style={{
              backgroundColor: '#f4f4f4',
              borderTop: '1px solid #e0e0e0',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}>
              <button
                type="button"
                className="cds-btn cds-btn-secondary"
                onClick={() => setDeliveryTarget(null)}
                disabled={submittingDelivery}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cds-btn cds-btn-primary"
                onClick={handleConfirmDelivery}
                disabled={submittingDelivery || deliveryTarget.loading}
              >
                <CheckCircle2 size={16} />
                <span>{submittingDelivery ? 'Procesando transacción...' : 'Confirmar Entrega Atómica'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
