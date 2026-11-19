import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Users,
  BarChart3,
  AlertTriangle,
  Search,
  TrendingUp,
  Printer,
  Plus,
  Trash2,
  Building,
  Home,
  UserCog,
  ShieldCheck,
  Edit3,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import BoardReportModal from './BoardReportModal';
import { db } from '../../config/firebase';
import { listActiveAuthorized, addAuthorizedPerson, setAuthorizedActive } from '../../services/censusService';
import { AREA_LABELS } from '../../services/reservationSlots';
import { formatDateCO, formatTimeCO, getElapsedHours, toDate } from '../../services/dateUtils';

export default function AdminConsole({
  condoId,
  condominium,
  currentUser,
  towers,
  apartments,
  users,
  packages,
  reservations,
  onCreateTower,
  onUpdateTower,
  onDeleteTower,
  onCreateApartment,
  onUpdateApartmentOwner,
  onDeleteApartment,
  onAssignResident,
  onSetStaffRole,
  onToggleUserActive,
  onApproveReservation,
  onRejectReservation,
  onNotify,
}) {
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard' | 'census' | 'users' | 'reservations'
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Reservations management state (CON-07)
  const [resStatusFilter, setResStatusFilter] = useState('ALL');
  const [resActionId, setResActionId] = useState(null);
  const [rejectingRes, setRejectingRes] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Tower Form State
  const [towerIdInput, setTowerIdInput] = useState('');
  const [towerNameInput, setTowerNameInput] = useState('');
  const [towerCapacityInput, setTowerCapacityInput] = useState('40');
  const [editingTower, setEditingTower] = useState(null);

  // Apartment Form State
  const [aptTowerId, setAptTowerId] = useState('');
  const [aptNumberInput, setAptNumberInput] = useState('');
  const [aptOwnerInput, setAptOwnerInput] = useState('');
  const [editingApt, setEditingApt] = useState(null);
  const [editingAptOwner, setEditingAptOwner] = useState('');

  // Census Filter
  const [censusTowerFilter, setCensusTowerFilter] = useState('ALL');
  const [censusSearch, setCensusSearch] = useState('');

  // Apartment Authorized Drawer/Modal
  const [aptAuthModal, setAptAuthModal] = useState(null); // { apartment, list, loading }
  const [newAuthName, setNewAuthName] = useState('');
  const [newAuthDoc, setNewAuthDoc] = useState('');
  const [newAuthRelation, setNewAuthRelation] = useState('Familiar');

  // User Assignment Modal State
  const [assigningUser, setAssigningUser] = useState(null);
  const [assignAptId, setAssignAptId] = useState('');
  const [assignFullName, setAssignFullName] = useState('');
  const [assignDocumentId, setAssignDocumentId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const effectiveAptTowerId =
    aptTowerId && towers.some((t) => t.id === aptTowerId) ? aptTowerId : towers[0]?.id || '';

  // Metrics
  const totalPackages = packages.length;
  const pendingPackages = packages.filter((p) => p.status === 'Pendiente');
  const deliveredPackages = packages.filter((p) => p.status === 'Entregado');
  const deliveryRate = totalPackages > 0 ? Math.round((deliveredPackages.length / totalPackages) * 100) : 0;

  const overduePackages = pendingPackages.filter((p) => getElapsedHours(p.receivedAt, nowMs) >= 15 * 24);

  let totalPickupHours = 0;
  let countedDelivered = 0;
  deliveredPackages.forEach((p) => {
    const rec = toDate(p.receivedAt);
    const del = toDate(p.deliveredAt);
    if (rec && del) {
      totalPickupHours += Math.max(0, (del.getTime() - rec.getTime()) / (1000 * 60 * 60));
      countedDelivered++;
    }
  });
  const avgPickupHours = countedDelivered > 0 ? (totalPickupHours / countedDelivered).toFixed(1) : '0.0';

  const handleTowerSubmit = async (e) => {
    e.preventDefault();
    try {
      await onCreateTower({
        id: towerIdInput.trim(),
        name: towerNameInput.trim(),
        totalApartments: Number.parseInt(towerCapacityInput, 10),
      });
      setTowerIdInput('');
      setTowerNameInput('');
      setTowerCapacityInput('40');
    } catch (err) {
      onNotify('error', err?.message || 'Error al crear la torre.');
    }
  };

  const handleSaveTowerEdit = async (e) => {
    e.preventDefault();
    if (!editingTower) return;
    try {
      await onUpdateTower(editingTower.id, {
        name: editingTower.name,
        totalApartments: Number.parseInt(String(editingTower.totalApartments), 10),
      });
      setEditingTower(null);
    } catch (err) {
      onNotify('error', err?.message || 'Error al actualizar torre.');
    }
  };

  const handleApartmentSubmit = async (e) => {
    e.preventDefault();
    try {
      await onCreateApartment({
        towerId: effectiveAptTowerId,
        number: aptNumberInput.trim(),
        ownerName: aptOwnerInput.trim(),
      });
      setAptNumberInput('');
      setAptOwnerInput('');
    } catch (err) {
      onNotify('error', err?.message || 'Error al crear el apartamento.');
    }
  };

  const handleOpenAptAuth = async (apt) => {
    setAptAuthModal({ apartment: apt, list: [], loading: true });
    try {
      const list = await listActiveAuthorized(db, condoId, apt.id);
      setAptAuthModal({ apartment: apt, list, loading: false });
    } catch (err) {
      setAptAuthModal({ apartment: apt, list: [], loading: false });
      onNotify('error', err?.message || 'Error consultando autorizados.');
    }
  };

  const handleAdminAddAuthorized = async (e) => {
    e.preventDefault();
    if (!aptAuthModal) return;
    try {
      await addAuthorizedPerson(db, condoId, aptAuthModal.apartment.id, {
        fullName: newAuthName,
        documentId: newAuthDoc,
        relation: newAuthRelation,
      });
      const updated = await listActiveAuthorized(db, condoId, aptAuthModal.apartment.id);
      setAptAuthModal((prev) => ({ ...prev, list: updated }));
      setNewAuthName('');
      setNewAuthDoc('');
      onNotify('success', `Persona autorizada agregada a ${aptAuthModal.apartment.id}.`);
    } catch (err) {
      onNotify('error', err?.message || 'Error al registrar autorizado.');
    }
  };

  const handleAdminDeactivateAuth = async (authId) => {
    if (!aptAuthModal) return;
    try {
      await setAuthorizedActive(db, condoId, aptAuthModal.apartment.id, authId, false);
      const updated = await listActiveAuthorized(db, condoId, aptAuthModal.apartment.id);
      setAptAuthModal((prev) => ({ ...prev, list: updated }));
      onNotify('info', 'Autorización desactivada.');
    } catch (err) {
      onNotify('error', err?.message || 'No se pudo desactivar.');
    }
  };

  const handleConfirmAssignResident = async (e) => {
    e.preventDefault();
    if (!assigningUser) return;
    try {
      await onAssignResident({
        userId: assigningUser.uid,
        apartmentId: assignAptId,
        fullName: assignFullName,
        documentId: assignDocumentId,
      });
      setAssigningUser(null);
      setAssignDocumentId('');
    } catch (err) {
      onNotify('error', err?.message || 'Error al asignar unidad al residente.');
    }
  };

  const filteredApartments = apartments.filter((a) => {
    if (censusTowerFilter !== 'ALL' && a.towerId !== censusTowerFilter) return false;
    if (censusSearch.trim()) {
      const q = censusSearch.trim().toLowerCase();
      return (
        a.id.toLowerCase().includes(q) ||
        (a.ownerName || '').toLowerCase().includes(q) ||
        a.towerId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.unitId || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

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
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe', fontWeight: 600 }}>
            PANEL DE ADMINISTRACIÓN // {condominium?.name ? condominium.name.toUpperCase() : 'MULTI-TENANT'}
            {condominium?.joinCode ? ` // CÓDIGO DE INVITACIÓN: ${condominium.joinCode}` : ''}
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>
            Gestión Operativa, Censo y Control de Acceso
          </h1>
          <p style={{ fontSize: '13px', color: '#525252', marginTop: '2px' }}>
            Administración real en Cloud Firestore: torres, apartamentos, cuentas, roles (CON-01 / CON-02) y telemetría operativa.
            {condominium?.joinCode && (
              <>
                {' '}Comparte el código <strong className="font-mono" style={{ color: '#0f62fe' }}>{condominium.joinCode}</strong> con tus residentes y porteros para vincularlos.
              </>
            )}
          </p>
        </div>

        {/* Subnavigation Tabs */}
        <div style={{ display: 'flex', border: '1px solid #8d8d8d', flexWrap: 'wrap' }}>
          {[
            { id: 'dashboard', label: 'Métricas', icon: BarChart3 },
            { id: 'census', label: `Censo (${apartments.length} Aptos)`, icon: Building },
            { id: 'users', label: `Usuarios y Roles (${users.length})`, icon: UserCog },
            { id: 'reservations', label: 'Reservas', icon: CalendarCheck, badge: reservations.filter((r) => r.status === 'Pendiente').length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
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
                  cursor: 'pointer',
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
                    fontWeight: 600,
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DASHBOARD */}
      {adminTab === 'dashboard' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            padding: '12px 16px',
            marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#161616' }}>
                Indicadores Operativos en Tiempo Real
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Cálculos directos sobre colecciones activas en Cloud Firestore.
              </div>
            </div>

            <button
              type="button"
              className="cds-btn cds-btn-primary"
              style={{ height: '36px', minHeight: '36px', fontSize: '12px' }}
              onClick={() => setIsReportModalOpen(true)}
            >
              <Printer size={15} />
              <span>Imprimir Resumen Ejecutivo</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #0f62fe' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Estructura Activa
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#161616', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {apartments.length}
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Apartamentos en {towers.length} {towers.length === 1 ? 'torre' : 'torres'}
              </div>
            </div>

            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #24a148' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Flujo de Paquetería
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#161616', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {totalPackages}
              </div>
              <div style={{ fontSize: '12px', color: '#0e6027', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={14} />
                <span>{deliveredPackages.length} entregados ({deliveryRate}%)</span>
              </div>
            </div>

            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '4px solid #0043ce' }}>
              <div style={{ fontSize: '11px', color: '#525252', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)' }}>
                Tiempo Medio Retiro
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#0043ce', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {avgPickupHours} <span style={{ fontSize: '16px', fontWeight: 400 }}>hrs</span>
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Desde llegada en portería hasta entrega
              </div>
            </div>

            <div className="cds-tile" style={{ backgroundColor: overduePackages.length > 0 ? '#fff1f1' : '#ffffff', borderTop: '4px solid #da1e28' }}>
              <div style={{ fontSize: '11px', color: '#a2191f', textTransform: 'uppercase', fontFamily: 'var(--cds-font-mono)', fontWeight: 600 }}>
                Alerta Bodegaje &gt;15D (RN-B5)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#da1e28', margin: '8px 0 4px', fontFamily: 'var(--cds-font-mono)' }}>
                {overduePackages.length}
              </div>
              <div style={{ fontSize: '12px', color: '#a2191f' }}>
                {overduePackages.length > 0 ? 'Paquetes superan 15 días en portería' : 'Sin paquetes vencidos'}
              </div>
            </div>
          </div>

          <div className="cds-tile" style={{ backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle color="#da1e28" size={18} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#161616' }}>
                  Auditoría de Paquetería Vencida (Regla RN-B5: &gt;15 Días)
                </h3>
              </div>
              <span className="cds-tag cds-tag-red">BODEGAJE</span>
            </div>

            {overduePackages.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#0e6027', backgroundColor: '#defbe6', fontSize: '13px' }}>
                No hay encomiendas que superen los 15 días reglamentarios en este momento.
              </div>
            ) : (
              <div className="cds-table-container">
                <table className="cds-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Unidad</th>
                      <th>Destinatario</th>
                      <th>Días en Portería</th>
                      <th>Transportadora / Guía</th>
                      <th>Tarifa Estimada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overduePackages.map((pkg) => {
                      const days = Math.floor(getElapsedHours(pkg.receivedAt, nowMs) / 24);
                      const fee = (days - 15) * 5000;
                      return (
                        <tr key={pkg.id}>
                          <td className="font-mono">{pkg.id.slice(0, 10)}</td>
                          <td><span className="cds-tag cds-tag-dark">{pkg.apartmentId}</span></td>
                          <td><strong>{pkg.recipientName}</strong></td>
                          <td><span className="cds-tag cds-tag-red font-mono">{days} DÍAS</span></td>
                          <td style={{ fontSize: '12px' }}>{pkg.courier} ({pkg.trackingNumber || 'Sin guía'})</td>
                          <td className="font-mono" style={{ fontWeight: 600, color: '#a2191f' }}>
                            ${fee.toLocaleString('es-CO')} COP
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

      {/* TAB 2: CENSO REAL (CRUD TORRES Y APARTAMENTOS - CON-02) */}
      {adminTab === 'census' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Forms Row: Create Tower + Create Apartment */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {/* Create Tower */}
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '3px solid #0f62fe' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="#0f62fe" />
                Registrar Torre / Bloque
              </h3>
              <p style={{ fontSize: '12px', color: '#525252', marginBottom: '14px' }}>
                Cree dinámicamente las torres o bloques reales de la copropiedad en Firestore.
              </p>

              <form onSubmit={handleTowerSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="cds-input-label">CÓDIGO (EJ. T1, BLOQUEA)</label>
                    <input
                      type="text"
                      className="cds-input font-mono"
                      placeholder="T1"
                      value={towerIdInput}
                      onChange={(e) => setTowerIdInput(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="cds-input-label">CAPACIDAD ESTIMADA</label>
                    <input
                      type="number"
                      min="1"
                      className="cds-input font-mono"
                      value={towerCapacityInput}
                      onChange={(e) => setTowerCapacityInput(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="cds-input-label">NOMBRE VISIBLE</label>
                  <input
                    type="text"
                    className="cds-input"
                    placeholder="Ej. Torre Norte / Bloque A"
                    value={towerNameInput}
                    onChange={(e) => setTowerNameInput(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="cds-btn cds-btn-primary" style={{ width: '100%' }}>
                  <span>Guardar Torre en Firestore</span>
                  <Plus size={16} />
                </button>
              </form>
            </div>

            {/* Create Apartment */}
            <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderTop: '3px solid #24a148' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Home size={16} color="#24a148" />
                Registrar Apartamento / Unidad
              </h3>
              <p style={{ fontSize: '12px', color: '#525252', marginBottom: '14px' }}>
                El ID determinista (`{'{torre}-{número}'}`) impide unidades duplicadas en la misma torre (CON-02).
              </p>

              <form onSubmit={handleApartmentSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="cds-input-label">TORRE</label>
                    <select
                      className="cds-select"
                      value={effectiveAptTowerId}
                      onChange={(e) => setAptTowerId(e.target.value)}
                      required
                    >
                      {towers.length === 0 ? (
                        <option value="">Cree primero una torre</option>
                      ) : (
                        towers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id} — {t.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="cds-input-label">NÚMERO (EJ. 101, 204)</label>
                    <input
                      type="text"
                      className="cds-input font-mono"
                      placeholder="101"
                      value={aptNumberInput}
                      onChange={(e) => setAptNumberInput(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="cds-input-label">PROPIETARIO / TITULAR</label>
                  <input
                    type="text"
                    className="cds-input"
                    placeholder="Nombre completo del propietario o titular"
                    value={aptOwnerInput}
                    onChange={(e) => setAptOwnerInput(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="cds-btn cds-btn-primary"
                  style={{ width: '100%' }}
                  disabled={towers.length === 0}
                >
                  <span>Registrar Unidad</span>
                  <Plus size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* Existing Towers List */}
          <div className="cds-tile" style={{ backgroundColor: '#ffffff' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
              Torres Registradas en Firestore ({towers.length})
            </h3>
            {towers.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#f4f4f4', fontSize: '13px', color: '#525252' }}>
                No hay torres registradas aún. Use el formulario superior para crear la primera torre o bloque.
              </div>
            ) : (
              <div className="cds-table-container">
                <table className="cds-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Capacidad Declarada</th>
                      <th>Aptos Registrados</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {towers.map((t) => {
                      const count = apartments.filter((a) => a.towerId === t.id).length;
                      const isEditing = editingTower?.id === t.id;
                      return (
                        <tr key={t.id}>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{t.id}</td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="cds-input"
                                style={{ height: '32px' }}
                                value={editingTower.name}
                                onChange={(e) => setEditingTower({ ...editingTower, name: e.target.value })}
                              />
                            ) : (
                              t.name
                            )}
                          </td>
                          <td className="font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                className="cds-input font-mono"
                                style={{ height: '32px', width: '90px' }}
                                value={editingTower.totalApartments}
                                onChange={(e) => setEditingTower({ ...editingTower, totalApartments: e.target.value })}
                              />
                            ) : (
                              t.totalApartments
                            )}
                          </td>
                          <td className="font-mono">{count}</td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-primary"
                                  style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                                  onClick={handleSaveTowerEdit}
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-secondary"
                                  style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                                  onClick={() => setEditingTower(null)}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
                                  onClick={() => setEditingTower({ ...t })}
                                >
                                  <Edit3 size={13} />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '12px', color: '#da1e28' }}
                                  onClick={() => onDeleteTower(t.id).catch((err) => onNotify('error', err?.message || 'Error al eliminar torre.'))}
                                >
                                  <Trash2 size={13} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Apartments Table */}
          <div>
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
              <div style={{ display: 'flex', border: '1px solid #8d8d8d', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCensusTowerFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontFamily: 'var(--cds-font-mono)',
                    fontWeight: 600,
                    backgroundColor: censusTowerFilter === 'ALL' ? '#161616' : '#ffffff',
                    color: censusTowerFilter === 'ALL' ? '#ffffff' : '#525252',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  TODAS ({apartments.length})
                </button>
                {towers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCensusTowerFilter(t.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontFamily: 'var(--cds-font-mono)',
                      fontWeight: 600,
                      backgroundColor: censusTowerFilter === t.id ? '#161616' : '#ffffff',
                      color: censusTowerFilter === t.id ? '#ffffff' : '#525252',
                      border: 'none',
                      borderLeft: '1px solid #e0e0e0',
                      cursor: 'pointer',
                    }}
                  >
                    {t.id} ({apartments.filter((a) => a.towerId === t.id).length})
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8d8d8d' }} />
                <input
                  type="text"
                  className="cds-input"
                  placeholder="Buscar por unidad o propietario..."
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                  value={censusSearch}
                  onChange={(e) => setCensusSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>ID Unidad</th>
                    <th>Torre</th>
                    <th>Número</th>
                    <th>Propietario / Titular</th>
                    <th>Residentes Ligados</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApartments.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#8d8d8d' }}>
                        No hay apartamentos registrados con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredApartments.map((apt) => {
                      const isEditing = editingApt === apt.id;
                      return (
                        <tr key={apt.id}>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{apt.id}</td>
                          <td className="font-mono">{apt.towerId}</td>
                          <td className="font-mono">{apt.number}</td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="cds-input"
                                style={{ height: '32px' }}
                                value={editingAptOwner}
                                onChange={(e) => setEditingAptOwner(e.target.value)}
                              />
                            ) : apt.ownerName ? (
                              <strong>{apt.ownerName}</strong>
                            ) : (
                              <span style={{ color: '#8d8d8d', fontStyle: 'italic' }}>Sin titular asignado</span>
                            )}
                          </td>
                          <td className="font-mono">
                            <span className={`cds-tag ${apt.residentUids?.length ? 'cds-tag-blue' : 'cds-tag-gray'}`}>
                              {apt.residentUids?.length || 0} cuentas
                            </span>
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-primary"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                  onClick={() => {
                                    onUpdateApartmentOwner(apt.id, editingAptOwner)
                                      .then(() => setEditingApt(null))
                                      .catch((err) => onNotify('error', err?.message || 'Error al actualizar.'));
                                  }}
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-secondary"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                  onClick={() => setEditingApt(null)}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
                                  onClick={() => handleOpenAptAuth(apt)}
                                >
                                  <ShieldCheck size={13} />
                                  <span>Autorizados</span>
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
                                  onClick={() => {
                                    setEditingApt(apt.id);
                                    setEditingAptOwner(apt.ownerName || '');
                                  }}
                                >
                                  <Edit3 size={13} />
                                  <span>Titular</span>
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '12px', color: '#da1e28' }}
                                  onClick={() => onDeleteApartment(apt.id).catch((err) => onNotify('error', err?.message || 'No se pudo eliminar.'))}
                                >
                                  <Trash2 size={13} />
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

      {/* TAB 3: USUARIOS, ROLES Y ASIGNACIÓN DE UNIDADES (CON-01, CON-02, RF-02) */}
      {adminTab === 'users' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderBottom: 'none',
            padding: '14px 16px',
          }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600 }}>Cuentas Registradas en Firebase Auth &amp; Firestore</h2>
              <p style={{ fontSize: '12px', color: '#525252' }}>
                Asigne apartamentos a residentes (habilitándolos en `RN-B4`), designe porteros o active/desactive cuentas (`RF-02`).
              </p>
            </div>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8d8d8d' }} />
              <input
                type="text"
                className="cds-input"
                placeholder="Buscar por nombre, correo, rol o unidad..."
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="cds-table-container">
            <table className="cds-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol Actual</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                  <th>Gestión</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#8d8d8d' }}>
                      No hay usuarios que coincidan con el filtro.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.uid === currentUser.uid;
                    return (
                      <tr key={u.uid}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.displayName || 'Sin nombre'}</div>
                          <div className="font-mono" style={{ fontSize: '10px', color: '#8d8d8d' }}>{u.uid}</div>
                        </td>
                        <td className="font-mono" style={{ fontSize: '12px' }}>{u.email}</td>
                        <td>
                          <span className={`cds-tag ${u.role === 'administradora' ? 'cds-tag-blue' : u.role === 'portero' ? 'cds-tag-dark' : 'cds-tag-green'}`}>
                            {u.role === 'administradora' ? 'ADMINISTRADOR' : u.role}
                          </span>
                        </td>
                        <td className="font-mono">{u.unitId || '—'}</td>
                        <td>
                          <span className={`cds-tag ${u.isActive ? 'cds-tag-green' : 'cds-tag-red'}`}>
                            {u.isActive ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td>
                          {isSelf ? (
                            <span style={{ fontSize: '11px', color: '#8d8d8d' }}>Sesión actual (protegida)</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="cds-btn cds-btn-primary"
                                style={{ height: '28px', minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                disabled={apartments.length === 0}
                                onClick={() => {
                                  setAssigningUser(u);
                                  setAssignAptId(u.unitId || apartments[0]?.id || '');
                                  setAssignFullName(u.displayName || '');
                                  setAssignDocumentId('');
                                }}
                              >
                                <Users size={12} />
                                <span>Asignar Apto</span>
                              </button>

                              {u.role !== 'portero' && (
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-secondary"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                  onClick={() => onSetStaffRole(u.uid, 'portero').catch((err) => onNotify('error', err?.message || 'Error cambiando rol.'))}
                                >
                                  Hacer Portero
                                </button>
                              )}

                              {u.role !== 'administradora' && (
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-ghost"
                                  style={{ height: '28px', minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                                  onClick={() => onSetStaffRole(u.uid, 'administradora').catch((err) => onNotify('error', err?.message || 'Error cambiando rol.'))}
                                >
                                  Hacer Admin
                                </button>
                              )}

                              <button
                                type="button"
                                className={`cds-btn ${u.isActive ? 'cds-btn-danger' : 'cds-btn-ghost'}`}
                                style={{ height: '28px', minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                onClick={() => onToggleUserActive(u.uid, !u.isActive).catch((err) => onNotify('error', err?.message || 'Error cambiando estado.'))}
                              >
                                {u.isActive ? 'Desactivar' : 'Reactivar'}
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
      )}

      {/* TAB 4: RESERVAS DE ESPACIOS COMUNES (CON-07: Aprobación RN-B1 y Rechazo con motivo RN-B3) */}
      {adminTab === 'reservations' && (() => {
        const pendingCount = reservations.filter((r) => r.status === 'Pendiente').length;
        const approvedCount = reservations.filter((r) => r.status === 'Aprobada').length;
        const rejectedCount = reservations.filter((r) => r.status === 'Rechazada').length;
        const filteredReservations = resStatusFilter === 'ALL'
          ? reservations
          : reservations.filter((r) => r.status === resStatusFilter);

        const handleApproveClick = async (resId) => {
          setResActionId(resId);
          try {
            await onApproveReservation(resId);
          } catch (err) {
            onNotify('error', err?.message || 'No se pudo aprobar la reserva.');
          } finally {
            setResActionId(null);
          }
        };

        const handleConfirmReject = async (e) => {
          e.preventDefault();
          if (!rejectingRes) return;
          if (rejectionReason.trim().length < 5) {
            onNotify('error', 'El motivo de rechazo debe tener al menos 5 caracteres.');
            return;
          }
          setResActionId(rejectingRes.id);
          try {
            await onRejectReservation(rejectingRes.id, rejectionReason.trim());
            setRejectingRes(null);
            setRejectionReason('');
          } catch (err) {
            onNotify('error', err?.message || 'No se pudo rechazar la reserva.');
          } finally {
            setResActionId(null);
          }
        };

        return (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
                  Reservas de Espacios Comunes ({reservations.length})
                </h2>
                <p style={{ fontSize: '13px', color: '#525252' }}>
                  Aprueba solicitudes (bloquea la franja atómicamente bajo RN-B1) o recházalas con motivo obligatorio liberando el cupo mensual (RN-B3).
                </p>
              </div>

              <div style={{ display: 'flex', border: '1px solid #8d8d8d' }}>
                {[
                  { id: 'ALL', label: `Todas (${reservations.length})` },
                  { id: 'Pendiente', label: `Pendientes (${pendingCount})` },
                  { id: 'Aprobada', label: `Aprobadas (${approvedCount})` },
                  { id: 'Rechazada', label: `Rechazadas (${rejectedCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setResStatusFilter(f.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: resStatusFilter === f.id ? 600 : 400,
                      backgroundColor: resStatusFilter === f.id ? '#161616' : '#ffffff',
                      color: resStatusFilter === f.id ? '#ffffff' : '#393939',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #f1c21b' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#525252' }}>PENDIENTES POR RESOLVER</div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>{pendingCount}</div>
              </div>
              <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #24a148' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#525252' }}>APROBADAS (FRANJA BLOQUEADA)</div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>{approvedCount}</div>
              </div>
              <div className="cds-tile" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #da1e28' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#525252' }}>RECHAZADAS (CUPO LIBERADO)</div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: '#161616', marginTop: '4px' }}>{rejectedCount}</div>
              </div>
            </div>

            <div className="cds-table-container">
              <table className="cds-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Unidad</th>
                    <th>Espacio Común</th>
                    <th>Fecha y Franja</th>
                    <th>Estado</th>
                    <th>Gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#8d8d8d' }}>
                        No hay solicitudes de reserva para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((res) => {
                      const busy = resActionId === res.id;
                      return (
                        <tr key={res.id}>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{res.id.slice(0, 10)}</td>
                          <td className="font-mono"><strong>{res.apartmentId}</strong></td>
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
                            {res.status === 'Rechazada' && <span className="cds-tag cds-tag-red">RECHAZADA</span>}
                            {res.rejectionReason && (
                              <div style={{ fontSize: '11px', color: '#a2191f', marginTop: '4px', maxWidth: '240px' }}>
                                Motivo: {res.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td>
                            {res.status === 'Pendiente' ? (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-primary"
                                  style={{ height: '30px', minHeight: '30px', padding: '0 12px', fontSize: '12px', backgroundColor: '#198038' }}
                                  disabled={busy}
                                  onClick={() => handleApproveClick(res.id)}
                                >
                                  <CheckCircle2 size={14} />
                                  <span>{busy ? 'Procesando...' : 'Aprobar'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="cds-btn cds-btn-danger"
                                  style={{ height: '30px', minHeight: '30px', padding: '0 12px', fontSize: '12px' }}
                                  disabled={busy}
                                  onClick={() => {
                                    setRejectingRes(res);
                                    setRejectionReason('');
                                  }}
                                >
                                  <XCircle size={14} />
                                  <span>Rechazar</span>
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#6f6f6f', fontFamily: 'var(--cds-font-mono)' }}>
                                Resuelta {res.resolvedAt ? formatDateCO(res.resolvedAt) : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: Rechazar Reserva con Motivo Obligatorio */}
            {rejectingRes && (
              <div className="cds-modal-overlay">
                <div className="cds-modal-content">
                  <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#ff8389', fontFamily: 'var(--cds-font-mono)' }}>RECHAZO DE RESERVA // CON-07 &amp; RN-B3</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>
                        Rechazar {AREA_LABELS[rejectingRes.commonArea] || rejectingRes.commonArea} — {rejectingRes.apartmentId}
                      </div>
                    </div>
                    <button type="button" onClick={() => setRejectingRes(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleConfirmReject}>
                    <div style={{ padding: '20px' }}>
                      <p style={{ fontSize: '13px', color: '#525252', marginBottom: '12px' }}>
                        Al rechazar esta solicitud del <strong>{rejectingRes.date} ({rejectingRes.slot})</strong>, se liberará automáticamente el cupo mensual del apartamento {rejectingRes.apartmentId}.
                      </p>
                      <label className="cds-input-label">MOTIVO DEL RECHAZO (OBLIGATORIO, MÍN. 5 CARACTERES)</label>
                      <textarea
                        className="cds-input"
                        rows={3}
                        style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
                        placeholder="Ej. Mantenimiento programado del salón social en esa fecha."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ backgroundColor: '#f4f4f4', borderTop: '1px solid #e0e0e0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" className="cds-btn cds-btn-secondary" onClick={() => setRejectingRes(null)}>Cancelar</button>
                      <button type="submit" className="cds-btn cds-btn-danger" disabled={resActionId === rejectingRes.id}>
                        {resActionId === rejectingRes.id ? 'Rechazando...' : 'Confirmar Rechazo'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal: Asignar Unidad a Residente */}
      {assigningUser && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content">
            <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#78a9ff', fontFamily: 'var(--cds-font-mono)' }}>ASIGNACIÓN DE UNIDAD // CON-02 &amp; RN-B4</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Asignar Apartamento a {assigningUser.email}</div>
              </div>
              <button type="button" onClick={() => setAssigningUser(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmAssignResident}>
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label className="cds-input-label">APARTAMENTO</label>
                  <select className="cds-select font-mono" value={assignAptId} onChange={(e) => setAssignAptId(e.target.value)} required>
                    {apartments.map((a) => (
                      <option key={a.id} value={a.id}>{a.id} {a.ownerName ? `— ${a.ownerName}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="cds-input-label">NOMBRE COMPLETO DEL RESIDENTE</label>
                  <input type="text" className="cds-input" value={assignFullName} onChange={(e) => setAssignFullName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="cds-input-label">N° DOCUMENTO DE IDENTIDAD (PARA ENTREGA RN-B4)</label>
                  <input type="text" className="cds-input font-mono" placeholder="Ej. 1020304050" value={assignDocumentId} onChange={(e) => setAssignDocumentId(e.target.value)} required />
                </div>
              </div>
              <div style={{ backgroundColor: '#f4f4f4', borderTop: '1px solid #e0e0e0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="cds-btn cds-btn-secondary" onClick={() => setAssigningUser(null)}>Cancelar</button>
                <button type="submit" className="cds-btn cds-btn-primary">Confirmar Asignación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Personas Autorizadas por Unidad */}
      {aptAuthModal && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content" style={{ maxWidth: '640px' }}>
            <div style={{ backgroundColor: '#161616', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#78a9ff', fontFamily: 'var(--cds-font-mono)' }}>AUTORIZADOS EN PORTERÍA // RN-B4</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Unidad {aptAuthModal.apartment.id}</div>
              </div>
              <button type="button" onClick={() => setAptAuthModal(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleAdminAddAuthorized} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', marginBottom: '16px', alignItems: 'end' }}>
                <div>
                  <label className="cds-input-label">NOMBRE</label>
                  <input type="text" className="cds-input" value={newAuthName} onChange={(e) => setNewAuthName(e.target.value)} required />
                </div>
                <div>
                  <label className="cds-input-label">DOCUMENTO</label>
                  <input type="text" className="cds-input font-mono" value={newAuthDoc} onChange={(e) => setNewAuthDoc(e.target.value)} required />
                </div>
                <div>
                  <label className="cds-input-label">PARENTESCO</label>
                  <input type="text" className="cds-input" value={newAuthRelation} onChange={(e) => setNewAuthRelation(e.target.value)} required />
                </div>
                <button type="submit" className="cds-btn cds-btn-primary" style={{ height: '40px', minHeight: '40px' }}>Agregar</button>
              </form>

              {aptAuthModal.loading ? (
                <div style={{ fontSize: '12px', color: '#525252' }}>Cargando autorizados...</div>
              ) : aptAuthModal.list.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#8d8d8d' }}>Sin personas activas registradas en esta unidad.</div>
              ) : (
                <div className="cds-table-container">
                  <table className="cds-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Relación</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aptAuthModal.list.map((p) => (
                        <tr key={p.id}>
                          <td>{p.fullName}</td>
                          <td className="font-mono">{p.documentId}</td>
                          <td><span className="cds-tag cds-tag-blue">{p.relation}</span></td>
                          <td>
                            <button
                              type="button"
                              className="cds-btn cds-btn-ghost"
                              style={{ height: '26px', minHeight: '26px', padding: '0 8px', color: '#da1e28', fontSize: '11px' }}
                              onClick={() => handleAdminDeactivateAuth(p.id)}
                            >
                              Desactivar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BoardReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentUser={currentUser}
        condominium={condominium}
        towers={towers}
        apartments={apartments}
        packages={packages}
        reservations={reservations}
        nowMs={nowMs}
      />
    </div>
  );
}
