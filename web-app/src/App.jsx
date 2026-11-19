import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { auth, db } from './config/firebase';
import {
  subscribeToCondominium,
} from './services/condominiumService';
import {
  subscribeToOwnProfile,
  subscribeToUsers,
  assignResidentToApartment,
  setStaffRole,
  setUserActive,
  updateOwnContact,
} from './services/userService';
import {
  subscribeToTowers,
  createTower,
  updateTower,
  deleteTower,
  subscribeToAllApartments,
  subscribeToApartment,
  createApartment,
  updateApartmentOwner,
  deleteApartment,
  subscribeToAuthorized,
  addAuthorizedPerson,
  setAuthorizedActive,
  removeAuthorizedPerson,
} from './services/censusService';
import {
  registerIncomingPackage,
  deliverPackageTransaction,
  subscribeToPendingPackages,
  subscribeToAllPackages,
  subscribeToAllApartmentPackages,
} from './services/packageService';
import {
  requestReservation,
  subscribeToApartmentReservations,
  subscribeToAllReservations,
} from './services/reservationService';
import { parseAuthActionParams } from './services/authActionUtils';
import AuthActionHandler from './components/auth/AuthActionHandler';
import AuthScreen from './components/auth/AuthScreen';
import CondominiumOnboarding from './components/auth/CondominiumOnboarding';
import CarbonMasthead from './components/layout/CarbonMasthead';
import GuardTerminal from './components/guard/GuardTerminal';
import ResidentPortal from './components/resident/ResidentPortal';
import AdminConsole from './components/admin/AdminConsole';

export default function App() {
  const [authAction, setAuthAction] = useState(() =>
    typeof window !== 'undefined' ? parseAuthActionParams(window.location.search) : null,
  );
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [condominium, setCondominium] = useState(null);

  // Live Firestore collections (strictly scoped by condominiumId and authenticated role)
  const [towers, setTowers] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [residentApartment, setResidentApartment] = useState(null);
  const [residentAuthorized, setResidentAuthorized] = useState([]);
  const [packages, setPackages] = useState([]);
  const [reservations, setReservations] = useState([]);

  const [toastNotification, setToastNotification] = useState(null);

  const showToast = useCallback((type, message) => {
    setToastNotification({ type, message });
    setTimeout(() => setToastNotification(null), 6000);
  }, []);

  // Dynamic page title per tenant
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = condominium?.name
        ? `${condominium.name} — Mi Conjunto en Línea`
        : 'Mi Conjunto en Línea — Plataforma Multi-Conjunto';
    }
  }, [condominium?.name]);

  // 1. Firebase Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setCondominium(null);
        setProfileLoading(false);
        setTowers([]);
        setApartments([]);
        setUsers([]);
        setResidentApartment(null);
        setResidentAuthorized([]);
        setPackages([]);
        setReservations([]);
      } else {
        setProfileLoading(true);
      }
    });
    return () => unsub();
  }, []);

  // 2. Real-time Firestore profile listener for authenticated user
  useEffect(() => {
    if (!authUser?.uid) return undefined;
    const unsub = subscribeToOwnProfile(
      db,
      authUser.uid,
      (profile) => {
        setUserProfile(profile);
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        showToast('error', `Error al leer perfil de usuario: ${err.message}`);
      },
    );
    return () => unsub();
  }, [authUser?.uid, showToast]);

  // 3. Tenant-scoped + role-scoped Firestore subscriptions (strictly compliant with firestore.rules)
  useEffect(() => {
    if (!userProfile || userProfile.isActive !== true || !userProfile.condominiumId) {
      return undefined;
    }
    const condoId = userProfile.condominiumId;
    const unsubscribers = [];
    const onSubError = (scope) => (err) => {
      console.error(`Firestore subscription error (${scope}):`, err);
    };

    unsubscribers.push(subscribeToCondominium(db, condoId, setCondominium, onSubError('condominium')));

    if (userProfile.role === 'portero') {
      unsubscribers.push(subscribeToTowers(db, condoId, setTowers, onSubError('towers')));
      unsubscribers.push(subscribeToAllApartments(db, condoId, setApartments, onSubError('apartments')));
      unsubscribers.push(subscribeToPendingPackages(db, condoId, setPackages, onSubError('packages')));
    } else if (userProfile.role === 'administradora') {
      unsubscribers.push(subscribeToTowers(db, condoId, setTowers, onSubError('towers')));
      unsubscribers.push(subscribeToAllApartments(db, condoId, setApartments, onSubError('apartments')));
      unsubscribers.push(subscribeToUsers(db, condoId, setUsers, onSubError('users')));
      unsubscribers.push(subscribeToAllPackages(db, condoId, setPackages, onSubError('packages')));
      unsubscribers.push(subscribeToAllReservations(db, condoId, setReservations, onSubError('reservations')));
    } else if (userProfile.role === 'residente' && userProfile.unitId) {
      const unitId = userProfile.unitId;
      unsubscribers.push(subscribeToApartment(db, condoId, unitId, setResidentApartment, onSubError('apartment')));
      unsubscribers.push(subscribeToAuthorized(db, condoId, unitId, setResidentAuthorized, onSubError('authorized')));
      unsubscribers.push(subscribeToAllApartmentPackages(db, condoId, unitId, setPackages, onSubError('packages')));
      unsubscribers.push(subscribeToApartmentReservations(db, condoId, unitId, setReservations, onSubError('reservations')));
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (err) {
          console.warn('Unsubscribe warning:', err);
        }
      });
    };
  }, [userProfile]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAuthActionDone = useCallback(() => {
    setAuthAction(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  if (authAction) {
    return <AuthActionHandler action={authAction} onDone={handleAuthActionDone} />;
  }

  // Loading Firebase Auth initialization
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#161616', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--cds-font-mono)', fontSize: '13px', color: '#78a9ff' }}>
          INICIALIZANDO SESIÓN SEGURA...
        </div>
      </div>
    );
  }

  // Multi-Tenant Onboarding Gate: authenticated active user without a condominium yet
  if (authUser && !profileLoading && userProfile && userProfile.isActive === true && !userProfile.condominiumId) {
    return <CondominiumOnboarding userProfile={userProfile} />;
  }

  // Auth Gate: unauthenticated, disabled, missing profile, or unassigned resident
  const isAuthorizedActiveSession =
    Boolean(authUser) &&
    !profileLoading &&
    Boolean(userProfile) &&
    userProfile.isActive === true &&
    Boolean(userProfile.condominiumId) &&
    (userProfile.role !== 'residente' || Boolean(userProfile.unitId));

  if (!isAuthorizedActiveSession) {
    return (
      <AuthScreen
        authUser={authUser}
        userProfile={userProfile}
        profileLoading={profileLoading}
      />
    );
  }

  const condoId = userProfile.condominiumId;

  // Real tenant-scoped Firestore action handlers
  const handleAddPackage = async (input) => {
    const pkgId = await registerIncomingPackage(db, condoId, userProfile.uid, input);
    showToast('success', `Paquete ${pkgId.slice(0, 10)} registrado en Firestore para ${input.apartmentId}.`);
    return pkgId;
  };

  const handleDeliverPackage = async (packageId, receiverDocumentId, notes) => {
    await deliverPackageTransaction(db, condoId, userProfile.uid, packageId, receiverDocumentId, notes);
    showToast('success', 'Entrega registrada atómicamente en Cloud Firestore (RN-B4).');
  };

  const handleRequestReservation = async (req) => {
    const id = await requestReservation(db, condoId, req);
    showToast('success', `Solicitud de reserva ${id.slice(0, 10)} radicada en Cloud Firestore.`);
    return id;
  };

  const handleAddAuthorized = async (apartmentId, person) => {
    await addAuthorizedPerson(db, condoId, apartmentId, person);
    showToast('success', `Persona autorizada (${person.fullName}) registrada en Firestore.`);
  };

  const handleToggleAuthorized = async (apartmentId, authId, isActive) => {
    await setAuthorizedActive(db, condoId, apartmentId, authId, isActive);
    showToast('info', isActive ? 'Autorización reactivada.' : 'Autorización desactivada.');
  };

  const handleRemoveAuthorized = async (apartmentId, authId) => {
    await removeAuthorizedPerson(db, condoId, apartmentId, authId);
    showToast('info', 'Persona autorizada eliminada.');
  };

  const handleUpdateContact = async (uid, data) => {
    await updateOwnContact(db, uid, data);
    showToast('success', 'Perfil actualizado.');
  };

  const handleCreateTower = async (tower) => {
    await createTower(db, condoId, tower);
    showToast('success', `Torre ${tower.id.toUpperCase()} creada en Cloud Firestore.`);
  };

  const handleUpdateTower = async (towerId, updates) => {
    await updateTower(db, condoId, towerId, updates);
    showToast('success', `Torre ${towerId} actualizada.`);
  };

  const handleDeleteTower = async (towerId) => {
    await deleteTower(db, condoId, towerId);
    showToast('info', `Torre ${towerId} eliminada.`);
  };

  const handleCreateApartment = async (input) => {
    const aptId = await createApartment(db, condoId, input);
    showToast('success', `Unidad ${aptId} creada en Cloud Firestore.`);
  };

  const handleUpdateApartmentOwner = async (apartmentId, ownerName) => {
    await updateApartmentOwner(db, condoId, apartmentId, ownerName);
    showToast('success', `Titular de ${apartmentId} actualizado.`);
  };

  const handleDeleteApartment = async (apartmentId) => {
    await deleteApartment(db, condoId, apartmentId);
    showToast('info', `Unidad ${apartmentId} eliminada.`);
  };

  const handleAssignResident = async (input) => {
    await assignResidentToApartment(db, condoId, input);
    showToast('success', `Residente asignado a la unidad ${input.apartmentId} y habilitado para RN-B4.`);
  };

  const handleSetStaffRole = async (userId, role) => {
    await setStaffRole(db, condoId, userId, role);
    showToast('success', `Rol actualizado a '${role === 'administradora' ? 'Administrador' : role}'.`);
  };

  const handleToggleUserActive = async (userId, isActive) => {
    await setUserActive(db, userId, isActive);
    showToast('info', isActive ? 'Cuenta reactivada.' : 'Cuenta desactivada (RF-02).');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CarbonMasthead
        userProfile={userProfile}
        condominium={condominium}
        towersCount={towers.length}
        apartmentsCount={apartments.length}
        packages={packages}
        reservations={reservations}
        onLogout={handleLogout}
      />

      {toastNotification && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: toastNotification.type === 'error' ? '#da1e28' : toastNotification.type === 'success' ? '#24a148' : '#0f62fe',
          color: '#ffffff',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontFamily: 'var(--cds-font-sans)',
          fontSize: '13px',
          maxWidth: '450px',
        }}>
          {toastNotification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <div style={{ flex: 1 }}>{toastNotification.message}</div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <main style={{ flex: 1, backgroundColor: 'var(--cds-ui-background)' }}>
        {userProfile.role === 'portero' && (
          <GuardTerminal
            condoId={condoId}
            currentUser={userProfile}
            towers={towers}
            apartments={apartments}
            packages={packages}
            onAddPackage={handleAddPackage}
            onDeliverPackage={handleDeliverPackage}
          />
        )}

        {userProfile.role === 'residente' && (
          <ResidentPortal
            condoId={condoId}
            currentUser={userProfile}
            apartment={residentApartment}
            authorizedPeople={residentAuthorized}
            packages={packages}
            reservations={reservations}
            onRequestReservation={handleRequestReservation}
            onAddAuthorized={handleAddAuthorized}
            onToggleAuthorized={handleToggleAuthorized}
            onRemoveAuthorized={handleRemoveAuthorized}
            onUpdateContact={handleUpdateContact}
          />
        )}

        {userProfile.role === 'administradora' && (
          <AdminConsole
            condoId={condoId}
            condominium={condominium}
            currentUser={userProfile}
            towers={towers}
            apartments={apartments}
            users={users}
            packages={packages}
            reservations={reservations}
            onCreateTower={handleCreateTower}
            onUpdateTower={handleUpdateTower}
            onDeleteTower={handleDeleteTower}
            onCreateApartment={handleCreateApartment}
            onUpdateApartmentOwner={handleUpdateApartmentOwner}
            onDeleteApartment={handleDeleteApartment}
            onAssignResident={handleAssignResident}
            onSetStaffRole={handleSetStaffRole}
            onToggleUserActive={handleToggleUserActive}
            onNotify={showToast}
          />
        )}
      </main>

      <footer style={{
        backgroundColor: '#161616',
        color: '#8d8d8d',
        borderTop: '1px solid #393939',
        padding: '16px 24px',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        fontFamily: 'var(--cds-font-sans)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <strong style={{ color: '#ffffff' }}>{condominium?.name || 'Mi Conjunto en Línea'}</strong>
          <span>Plataforma Multi-Conjunto</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontFamily: 'var(--cds-font-mono)', fontSize: '11px' }}>
          <span>FIREBASE AUTH + FIRESTORE SPARK</span>
          <span style={{ color: '#0f62fe' }}>MULTI-TENANT // LEY 1581</span>
        </div>
      </footer>
    </div>
  );
}
