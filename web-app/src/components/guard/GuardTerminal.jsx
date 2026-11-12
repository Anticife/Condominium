import React, { useState } from 'react';
import { 
  PackagePlus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  X,
  FileCheck2,
  Box
} from 'lucide-react';

const COURIERS = [
  'MercadoLibre',
  'Amazon',
  'Servientrega',
  'InterRapidísimo',
  'Envía',
  'Coordinadora',
  'Domicilio Local'
];

export default function GuardTerminal({ state, onAddPackage, onDeliverPackage }) {
  // Fast Intake State
  const [selectedTower, setSelectedTower] = useState('T1');
  const [apartmentInput, setApartmentInput] = useState('101');
  const [selectedCourier, setSelectedCourier] = useState('MercadoLibre');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [intakeSuccessMsg, setIntakeSuccessMsg] = useState(null);

  // Search & Filters in Custody Table
  const [filterTower, setFilterTower] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Delivery Modal State
  const [deliveryTarget, setDeliveryTarget] = useState(null);
  const [selectedReceiver, setSelectedReceiver] = useState(null);
  const [customReceiverDoc, setCustomReceiverDoc] = useState('');

  // Find apartment details based on selection
  const currentAptId = `${selectedTower}-${apartmentInput}`;
  const matchedApt = state.apartments.find(a => a.id === currentAptId);

  // Auto-fill recipient if matched
  const activeRecipientName = customRecipient || (matchedApt ? matchedApt.ownerName : '');

  // Handle fast package registration (<10s)
  const handleRegisterPackage = (e) => {
    e.preventDefault();
    if (!apartmentInput) return;

    const newPkg = {
      id: `PKG-${Date.now().toString().slice(-6)}`,
      trackingNumber: trackingNumber || `GUIA-${Math.floor(100000 + Math.random() * 900000)}`,
      courier: selectedCourier,
      towerId: selectedTower,
      apartmentId: currentAptId,
      recipientName: activeRecipientName || 'Residente Registrado',
      status: 'Pendiente',
      notes: packageNotes || 'Recibido en portería',
      receivedByPorteroId: 'guard_guardia1',
      receivedByPorteroName: 'Vigilante Néstor Beltrán (Portería Principal)',
      receivedAt: new Date().toISOString(),
      deliveredAt: null,
      deliveredByPorteroId: null,
      deliveredToPerson: null,
      receiverDocumentId: null
    };

    onAddPackage(newPkg);

    // Show instant visual confirmation
    setIntakeSuccessMsg(`¡Paquete ${newPkg.id} registrado para Apto ${newPkg.apartmentId} en <5s!`);
    setTimeout(() => setIntakeSuccessMsg(null), 4000);

    // Reset fields for next package
    setTrackingNumber('');
    setPackageNotes('');
    setCustomRecipient('');
  };

  // Open delivery modal
  const handleOpenDelivery = (pkg) => {
    const apt = state.apartments.find(a => a.id === pkg.apartmentId);
    setDeliveryTarget({ pkg, apt });
    if (apt && apt.authorized && apt.authorized.length > 0) {
      setSelectedReceiver(apt.authorized[0].name);
      setCustomReceiverDoc(apt.authorized[0].doc);
    } else if (apt && apt.residents && apt.residents.length > 0) {
      setSelectedReceiver(apt.residents[0].name);
      setCustomReceiverDoc(apt.residents[0].doc);
    } else {
      setSelectedReceiver(pkg.recipientName);
      setCustomReceiverDoc('CC Verificada');
    }
  };

  // Confirm delivery
  const handleConfirmDelivery = () => {
    if (!deliveryTarget || !selectedReceiver) return;
    onDeliverPackage(
      deliveryTarget.pkg.id,
      selectedReceiver,
      customReceiverDoc || 'CC Verificada en Minuta',
      'Vigilante Néstor Beltrán'
    );
    setDeliveryTarget(null);
  };

  // Filter custody packages
  const custodyPackages = state.packages.filter(p => {
    if (p.status !== 'Pendiente') return false;
    if (filterTower !== 'ALL' && p.towerId !== filterTower) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.apartmentId.toLowerCase().includes(q) ||
        p.trackingNumber.toLowerCase().includes(q) ||
        p.recipientName.toLowerCase().includes(q) ||
        p.courier.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* View Title */}
      <div style={{ 
        borderBottom: '1px solid #e0e0e0', 
        paddingBottom: '16px', 
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
      }}>
        <div>
          <div style={{ 
            fontSize: '11px', 
            fontFamily: 'var(--cds-font-mono)', 
            color: '#0f62fe', 
            fontWeight: 600, 
            letterSpacing: '1px' 
          }}>
            TERMINAL DE CONTROL DE ACCESO // RNF-10 COMPLIANT
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>
            Consola Operativa de Portería & Encomiendas
          </h1>
          <p style={{ fontSize: '13px', color: '#525252', marginTop: '2px' }}>
            Recepción rápida táctil para tableta (&lt;10s), verificación obligatoria de autorizados (RN-B4) y custodia en tiempo real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="cds-tag cds-tag-blue">RNF-10: ALTA VELOCIDAD</span>
          <span className="cds-tag cds-tag-green">RN-B4: RECEPTOR VERIFICADO</span>
        </div>
      </div>

      {/* Main Grid: Fast Intake Form + Custody Inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Fast Package Reception Keypad */}
        <div className="cds-tile" style={{ border: '2px solid #0f62fe', padding: '20px', background: '#ffffff' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: '1px solid #e0e0e0',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px' }}>
              <PackagePlus size={18} color="#0f62fe" />
              Recepción Inmediata (&lt;10 Segundos)
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe' }}>
              PUESTO PORTERÍA 1
            </span>
          </div>

          {intakeSuccessMsg && (
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
              {intakeSuccessMsg}
            </div>
          )}

          <form onSubmit={handleRegisterPackage}>
            {/* Step 1: Tower Selector Tabs */}
            <div style={{ marginBottom: '16px' }}>
              <label className="cds-input-label">1. SELECCIONAR TORRE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {['T1', 'T2', 'T3'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTower(t)}
                    style={{
                      padding: '10px',
                      fontSize: '13px',
                      fontFamily: 'var(--cds-font-mono)',
                      fontWeight: 600,
                      backgroundColor: selectedTower === t ? '#0f62fe' : '#f4f4f4',
                      color: selectedTower === t ? '#ffffff' : '#161616',
                      border: '1px solid',
                      borderColor: selectedTower === t ? '#0f62fe' : '#e0e0e0',
                      cursor: 'pointer'
                    }}
                  >
                    Torre {t.replace('T', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Apartment Number */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="cds-input-label">2. NÚMERO DE APARTAMENTO</label>
                {matchedApt && (
                  <span style={{ fontSize: '11px', color: '#0f62fe', fontWeight: 500 }}>
                    {matchedApt.ownerName}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="cds-input font-mono"
                style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}
                placeholder="Ej. 101, 204, 508"
                value={apartmentInput}
                onChange={(e) => setApartmentInput(e.target.value)}
                required
              />
              {/* Quick floor buttons */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['101', '102', '201', '204', '302', '405', '508', '810'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setApartmentInput(num)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontFamily: 'var(--cds-font-mono)',
                      backgroundColor: apartmentInput === num ? '#161616' : '#f4f4f4',
                      color: apartmentInput === num ? '#ffffff' : '#525252',
                      border: '1px solid #e0e0e0',
                      cursor: 'pointer'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Courier Quick Chips */}
            <div style={{ marginBottom: '16px' }}>
              <label className="cds-input-label">3. TRANSPORTADORA (1 TOQUE)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {COURIERS.map(c => (
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
                      fontWeight: selectedCourier === c ? 600 : 400
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
                <label className="cds-input-label">N° DE GUÍA / CÓDIGO</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  placeholder="Últimos dígitos"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="cds-input-label">NOMBRE EN ETIQUETA</label>
                <input
                  type="text"
                  className="cds-input"
                  placeholder={matchedApt ? matchedApt.ownerName : 'Destinatario'}
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
                placeholder="Ej. Caja mediana sellada, sobre acolchado, etc."
                value={packageNotes}
                onChange={(e) => setPackageNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="cds-btn cds-btn-primary"
              style={{ width: '100%', height: '48px', fontSize: '15px' }}
            >
              <span>REGISTRAR ENTRADA DE PAQUETE</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Real-Time Custody Table */}
        <div>
          {/* Table Header Filter Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderBottom: 'none',
            padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#161616' }}>
                Encomiendas en Custodia ({custodyPackages.length})
              </span>

              {/* Tower Filter */}
              <div style={{ display: 'flex', border: '1px solid #8d8d8d' }}>
                {['ALL', 'T1', 'T2', 'T3'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setFilterTower(tf)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--cds-font-mono)',
                      fontWeight: 600,
                      backgroundColor: filterTower === tf ? '#161616' : '#ffffff',
                      color: filterTower === tf ? '#ffffff' : '#525252',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tf === 'ALL' ? 'TODAS' : `Torre ${tf.replace('T', '')}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Search Input */}
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

          {/* Table Container */}
          <div className="cds-table-container">
            <table className="cds-table">
              <thead>
                <tr>
                  <th>Código / Guía</th>
                  <th>Ubicación</th>
                  <th>Destinatario</th>
                  <th>Transportadora</th>
                  <th>Tiempo en Portería</th>
                  <th>Acción Operativa</th>
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
                  custodyPackages.map(pkg => {
                    const receivedDate = new Date(pkg.receivedAt);
                    const hoursAgo = Math.floor((new Date() - receivedDate) / (1000 * 60 * 60));
                    const daysAgo = Math.floor(hoursAgo / 24);
                    const isOverdue = daysAgo >= 15; // RN-B5 rule!

                    return (
                      <tr key={pkg.id} style={{ backgroundColor: isOverdue ? '#fff8e1' : undefined }}>
                        <td className="font-mono">
                          <div style={{ fontWeight: 600, color: '#161616' }}>{pkg.id}</div>
                          <div style={{ fontSize: '11px', color: '#525252' }}>{pkg.trackingNumber}</div>
                        </td>

                        <td>
                          <span className="cds-tag cds-tag-dark">
                            {pkg.apartmentId}
                          </span>
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
                            {receivedDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
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

      {/* ==========================================================================
          MODAL DE ENTREGA ATÓMICA DE PAQUETES (CUMPLIMIENTO ESTRICTO RN-B4)
          ========================================================================== */}
      {deliveryTarget && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content">
            {/* Modal Header */}
            <div style={{
              backgroundColor: '#161616',
              color: '#ffffff',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#4589ff' }}>
                  REGISTRO DE SALIDA DE CUSTODIA // RN-B4
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>
                  Confirmar Entrega: {deliveryTarget.pkg.id} ({deliveryTarget.pkg.apartmentId})
                </div>
              </div>
              <button
                onClick={() => setDeliveryTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              <div style={{ 
                backgroundColor: '#f4f4f4', 
                border: '1px solid #e0e0e0', 
                padding: '12px 14px', 
                marginBottom: '16px',
                fontSize: '13px'
              }}>
                <div><strong>Transportadora:</strong> {deliveryTarget.pkg.courier} | <strong>Guía:</strong> {deliveryTarget.pkg.trackingNumber}</div>
                <div><strong>Destinatario Rotulado:</strong> {deliveryTarget.pkg.recipientName}</div>
                {deliveryTarget.pkg.notes && <div><strong>Detalle:</strong> {deliveryTarget.pkg.notes}</div>}
              </div>

              {/* RN-B4 Rule Warning */}
              <div style={{
                backgroundColor: '#edf5ff',
                borderLeft: '4px solid #0f62fe',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#002d9c',
                marginBottom: '16px'
              }}>
                <strong>Regla de Negocio RN-B4:</strong> Solo se puede entregar este paquete al residente titular o a una persona autorizada registrada en el sistema de la copropiedad.
              </div>

              {/* Selector of Authorized Persons */}
              <label className="cds-input-label" style={{ fontWeight: 600 }}>
                SELECCIONAR PERSONA AUTORIZADA QUE RETIRA:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {/* Option: Residents */}
                {deliveryTarget.apt && deliveryTarget.apt.residents && deliveryTarget.apt.residents.map(r => (
                  <label
                    key={r.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      backgroundColor: selectedReceiver === r.name ? '#edf5ff' : '#ffffff',
                      border: '1px solid',
                      borderColor: selectedReceiver === r.name ? '#0f62fe' : '#e0e0e0',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="receiver"
                      checked={selectedReceiver === r.name}
                      onChange={() => {
                        setSelectedReceiver(r.name);
                        setCustomReceiverDoc(r.doc);
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: '#525252' }}>{r.relation} — Doc: {r.doc}</div>
                    </div>
                  </label>
                ))}

                {/* Option: Authorized */}
                {deliveryTarget.apt && deliveryTarget.apt.authorized && deliveryTarget.apt.authorized.map(a => (
                  <label
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      backgroundColor: selectedReceiver === a.name ? '#edf5ff' : '#ffffff',
                      border: '1px solid',
                      borderColor: selectedReceiver === a.name ? '#0f62fe' : '#e0e0e0',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="receiver"
                      checked={selectedReceiver === a.name}
                      onChange={() => {
                        setSelectedReceiver(a.name);
                        setCustomReceiverDoc(a.doc);
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: '#525252' }}>{a.relation} — Doc: {a.doc} (Tel: {a.phone})</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Document verification field */}
              <div style={{ marginBottom: '16px' }}>
                <label className="cds-input-label">NÚMERO DE DOCUMENTO VERIFICADO EN VENTANILLA</label>
                <input
                  type="text"
                  className="cds-input font-mono"
                  value={customReceiverDoc}
                  onChange={(e) => setCustomReceiverDoc(e.target.value)}
                  placeholder="Ej. CC 1020304050"
                  required
                />
              </div>

              {/* Porter signature stamp */}
              <div style={{ fontSize: '11px', color: '#525252', backgroundColor: '#f4f4f4', padding: '8px 12px' }}>
                Operador responsable de entrega: <strong>Vigilante Néstor Beltrán</strong> // Fecha y hora del servidor fijada automáticamente vía `request.time`.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              backgroundColor: '#f4f4f4',
              borderTop: '1px solid #e0e0e0',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                className="cds-btn cds-btn-secondary"
                onClick={() => setDeliveryTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cds-btn cds-btn-primary"
                onClick={handleConfirmDelivery}
              >
                <CheckCircle2 size={16} />
                <span>Confirmar Entrega Atómica</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
