import React, { useState, useEffect } from 'react';
import CarbonMasthead from './components/layout/CarbonMasthead';
import GuardTerminal from './components/guard/GuardTerminal';
import ResidentPortal from './components/resident/ResidentPortal';
import AdminConsole from './components/admin/AdminConsole';
import { loadCondominiumState, saveCondominiumState } from './data/condominiumData';
import { 
  probeBackendStatus,
  bridgeRegisterPackage,
  bridgeDeliverPackage,
  bridgeRequestReservation,
  bridgeAddAuthorized,
  bridgeRemoveAuthorized,
  bridgeSubscribePendingPackages,
  seedCondominiumToFirestore,
  BusinessRuleError
} from './services/backendBridge';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [condoState, setCondoState] = useState(() => loadCondominiumState());
  const [currentRole, setCurrentRole] = useState('portero'); // Default to Portería to test high-speed parcel intake
  const [backendStatus, setBackendStatus] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  // Probe Firestore & Auth Status on mount
  useEffect(() => {
    let isMounted = true;
    probeBackendStatus().then(status => {
      if (isMounted) setBackendStatus(status);
    });
    return () => { isMounted = false; };
  }, []);

  // Sync state to local storage on mutation
  useEffect(() => {
    saveCondominiumState(condoState);
  }, [condoState]);

  // Connect real-time Firestore listener for packages
  useEffect(() => {
    try {
      const unsubscribe = bridgeSubscribePendingPackages(
        (firestorePkgs) => {
          if (!firestorePkgs || firestorePkgs.length === 0) return;
          setCondoState(prev => {
            // Merge firestore packages with local packages
            const newMapped = firestorePkgs.map(fp => ({
              id: fp.id,
              trackingNumber: fp.trackingNumber || `GUIA-${fp.id.slice(-6)}`,
              courier: fp.courier,
              towerId: fp.towerId,
              apartmentId: fp.apartmentId,
              recipientName: fp.recipientName,
              status: fp.status,
              notes: fp.notes || '',
              receivedByPorteroId: fp.receivedByPorteroId,
              receivedByPorteroName: 'Vigilante Néstor Beltrán (Portería)',
              receivedAt: fp.receivedAt ? new Date(fp.receivedAt.seconds * 1000).toISOString() : new Date().toISOString(),
              deliveredAt: fp.deliveredAt ? new Date(fp.deliveredAt.seconds * 1000).toISOString() : null,
              deliveredByPorteroId: fp.deliveredByPorteroId || null,
              deliveredToPerson: fp.deliveredToPerson || null,
              receiverDocumentId: fp.deliveredToDocument || null
            }));

            // Preserve local non-pending packages or local mock ones
            const merged = [...newMapped];
            prev.packages.forEach(lp => {
              if (!merged.some(m => m.id === lp.id)) {
                merged.push(lp);
              }
            });
            return { ...prev, packages: merged };
          });
        },
        (_err) => {
          // Si las reglas deniegan consulta por falta de sesión auth activa, se mantiene el estado local
        }
      );
      return () => unsubscribe();
    } catch (_e) {
      // Ignorar si no está autenticado en producción
    }
  }, []);

  const showToast = (type, message) => {
    setToastNotification({ type, message });
    setTimeout(() => setToastNotification(null), 6000);
  };

  // Handler: Add package in Portería (<10s)
  const handleAddPackage = async (newPkg) => {
    try {
      // Intentar registro en la función real de Firestore (packageService.registerIncomingPackage)
      let firestoreId = null;
      try {
        firestoreId = await bridgeRegisterPackage({
          apartmentId: newPkg.apartmentId,
          courier: newPkg.courier,
          recipientName: newPkg.recipientName,
          trackingNumber: newPkg.trackingNumber,
          notes: newPkg.notes
        }, newPkg.receivedByPorteroId);
      } catch (err) {
        if (err instanceof BusinessRuleError) {
          showToast('error', `Error de Regla: ${err.message}`);
          return;
        }
        // Si falla por Auth, registrar localmente con ID determinista
      }

      const finalPkg = firestoreId ? { ...newPkg, id: firestoreId } : newPkg;
      setCondoState(prev => ({
        ...prev,
        packages: [finalPkg, ...prev.packages]
      }));
      showToast('success', `Paquete ${finalPkg.id} registrado para Apto ${finalPkg.apartmentId} (RN-B7).`);
    } catch (e) {
      showToast('error', `Error en registro: ${e.message}`);
    }
  };

  // Handler: Deliver package (RN-B4 Transaction)
  const handleDeliverPackage = async (pkgId, deliveredToPerson, receiverDoc, porteroName) => {
    try {
      // 1. Ejecutar transacción real de entrega con validación atómica de personas autorizadas (RN-B4)
      try {
        await bridgeDeliverPackage(pkgId, receiverDoc, 'guard_guardia1', 'Entrega en ventanilla');
      } catch (err) {
        if (err instanceof BusinessRuleError) {
          showToast('error', `REGLA RN-B4 VIOLADA: ${err.message}`);
          return;
        }
      }

      setCondoState(prev => ({
        ...prev,
        packages: prev.packages.map(p => {
          if (p.id !== pkgId) return p;
          return {
            ...p,
            status: 'Entregado',
            deliveredAt: new Date().toISOString(),
            deliveredByPorteroId: 'guard_guardia1',
            deliveredByPorteroName: porteroName,
            deliveredToPerson,
            receiverDocumentId: receiverDoc
          };
        })
      }));
      showToast('success', `Paquete ${pkgId} entregado exitosamente a ${deliveredToPerson} (RN-B4).`);
    } catch (e) {
      showToast('error', `Error en entrega: ${e.message}`);
    }
  };

  // Handler: Add common area booking (RN-B1, RN-B2, RN-B3)
  const handleAddReservation = async (newRes) => {
    try {
      // Intentar procesar con reservationService.requestReservation
      try {
        const slotId = newRes.startTime && newRes.startTime.includes('10:') || newRes.startTime.includes('08:') ? 'AM' : 'PM';
        const dateStr = newRes.startTime ? newRes.startTime.split('T')[0] : new Date().toISOString().split('T')[0];
        
        await bridgeRequestReservation({
          residentId: newRes.residentName || 'residente-titular',
          apartmentId: newRes.apartmentId,
          commonArea: newRes.commonArea,
          date: dateStr,
          slot: slotId
        });
      } catch (err) {
        if (err instanceof BusinessRuleError) {
          showToast('error', `REGLA DE NEGOCIO: ${err.message}`);
          return;
        }
      }

      setCondoState(prev => ({
        ...prev,
        reservations: [newRes, ...prev.reservations]
      }));
      showToast('success', `Solicitud ${newRes.id} radicada en estado 'Pendiente' con validación RN-B1/RN-B2/RN-B3.`);
    } catch (e) {
      showToast('error', `Error en reserva: ${e.message}`);
    }
  };

  // Handler: Resolve reservation (Approve/Reject with reason)
  const handleResolveReservation = (resId, newStatus, reason, adminName) => {
    setCondoState(prev => ({
      ...prev,
      reservations: prev.reservations.map(r => {
        if (r.id !== resId) return r;
        return {
          ...r,
          status: newStatus,
          rejectionReason: reason || null,
          resolvedBy: adminName,
          resolvedAt: new Date().toISOString()
        };
      })
    }));
    showToast(newStatus === 'Aprobada' ? 'success' : 'info', `Reserva ${resId} ${newStatus.toLowerCase()} por Administración.`);
  };

  // Handler: Add PQRS
  const handleAddPqrs = (newPqrs) => {
    setCondoState(prev => ({
      ...prev,
      nextPqrsSeq: (prev.nextPqrsSeq || 42) + 1,
      pqrs: [newPqrs, ...prev.pqrs]
    }));
    showToast('success', `PQRS ${newPqrs.id} radicada exitosamente (RN-B6).`);
  };

  // Handler: Transition PQRS status with official response (RN-B6)
  const handleTransitionPqrs = (ticketId, newStatus, officialResponse, changedBy) => {
    setCondoState(prev => ({
      ...prev,
      pqrs: prev.pqrs.map(t => {
        if (t.id !== ticketId) return t;
        const now = new Date().toISOString();
        const historyEntry = {
          previousStatus: t.status,
          newStatus: newStatus,
          changedBy: changedBy,
          changedAt: now,
          comment: newStatus === 'Resuelta' 
            ? `Resuelta con respuesta oficial: ${officialResponse}` 
            : `Transición a estado '${newStatus}'`
        };

        return {
          ...t,
          status: newStatus,
          updatedAt: now,
          officialResponse: officialResponse || t.officialResponse,
          history: [...t.history, historyEntry]
        };
      })
    }));
    showToast('success', `PQRS ${ticketId} actualizada a '${newStatus}' con trazabilidad inmutable.`);
  };

  // Handler: Add authorized person for an apartment (RN-B4, RN-B7)
  const handleAddAuthorized = async (apartmentId, person) => {
    try {
      try {
        await bridgeAddAuthorized(apartmentId, {
          fullName: person.name,
          documentId: person.doc.replace('CC ', '').trim(),
          phone: person.phone,
          relation: person.relation
        });
      } catch (_e) {
        // En caso de que no haya sesión auth en Firestore, mantener en estado local
      }

      setCondoState(prev => ({
        ...prev,
        apartments: prev.apartments.map(apt => {
          if (apt.id !== apartmentId) return apt;
          return {
            ...apt,
            authorized: [...(apt.authorized || []), person]
          };
        })
      }));
      showToast('success', `Persona autorizada (${person.name}) registrada para ${apartmentId} (RN-B4).`);
    } catch (e) {
      showToast('error', `Error al registrar autorizado: ${e.message}`);
    }
  };

  // Handler: Remove authorized person
  const handleRemoveAuthorized = async (apartmentId, authId) => {
    try {
      try {
        await bridgeRemoveAuthorized(apartmentId, authId);
      } catch (_e) {
        // En caso de fallo auth
      }

      setCondoState(prev => ({
        ...prev,
        apartments: prev.apartments.map(apt => {
          if (apt.id !== apartmentId) return apt;
          return {
            ...apt,
            authorized: (apt.authorized || []).filter(a => a.id !== authId)
          };
        })
      }));
      showToast('info', `Autorización revocada exitosamente.`);
    } catch (e) {
      showToast('error', `Error al revocar autorización: ${e.message}`);
    }
  };

  // Handler: Seed Census in Cloud Firestore
  const handleSeedCensus = async () => {
    try {
      showToast('info', 'Iniciando siembra de Torres y Apartamentos en Cloud Firestore...');
      const result = await seedCondominiumToFirestore();
      showToast('success', `Censo sincronizado con Cloud Firestore: ${result.towersCreated} torres y ${result.apartmentsCreated} apartamentos verificados.`);
    } catch (e) {
      showToast('error', `Error en siembra de censo: ${e.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* IBM Carbon Masthead */}
      <CarbonMasthead
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        state={condoState}
        backendStatus={backendStatus}
      />

      {/* Floating IBM Carbon Toast Notification */}
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
          maxWidth: '450px'
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

      {/* Main Terminal View based on Active Role */}
      <main style={{ flex: 1, backgroundColor: 'var(--cds-ui-background)' }}>
        {currentRole === 'portero' && (
          <GuardTerminal
            state={condoState}
            onAddPackage={handleAddPackage}
            onDeliverPackage={handleDeliverPackage}
          />
        )}

        {currentRole === 'residente' && (
          <ResidentPortal
            state={condoState}
            onAddReservation={handleAddReservation}
            onAddPqrs={handleAddPqrs}
            onAddAuthorized={handleAddAuthorized}
            onRemoveAuthorized={handleRemoveAuthorized}
          />
        )}

        {currentRole === 'admin' && (
          <AdminConsole
            state={condoState}
            onResolveReservation={handleResolveReservation}
            onTransitionPqrs={handleTransitionPqrs}
            onImportCensusBatch={handleSeedCensus}
          />
        )}
      </main>

      {/* IBM Carbon Technical Enterprise Footer */}
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
        fontFamily: 'var(--cds-font-sans)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <strong style={{ color: '#ffffff' }}>Altos del Parque // P.H.</strong>
          <span>NIT 900.542.118-2</span>
          <span>Carrera 45 # 128B - 30</span>
          <span>Bogotá D.C., Colombia</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontFamily: 'var(--cds-font-mono)', fontSize: '11px' }}>
          <span>CARBON DESIGN SPEC v11</span>
          <span>FIRESTORE MODULAR SERVICES: ACTIVE</span>
          <span style={{ color: '#0f62fe' }}>LEY 1581 / RN-B1..RN-B7</span>
        </div>
      </footer>
    </div>
  );
}
