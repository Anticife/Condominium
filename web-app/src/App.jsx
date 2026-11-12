import React, { useState, useEffect } from 'react';
import CarbonMasthead from './components/layout/CarbonMasthead';
import GuardTerminal from './components/guard/GuardTerminal';
import ResidentPortal from './components/resident/ResidentPortal';
import AdminConsole from './components/admin/AdminConsole';
import { loadCondominiumState, saveCondominiumState } from './data/condominiumData';

export default function App() {
  const [condoState, setCondoState] = useState(() => loadCondominiumState());
  const [currentRole, setCurrentRole] = useState('portero'); // Default to Portería to test high-speed parcel intake

  // Sync state to local storage on mutation
  useEffect(() => {
    saveCondominiumState(condoState);
  }, [condoState]);

  // Handler: Add package in Portería
  const handleAddPackage = (newPkg) => {
    setCondoState(prev => ({
      ...prev,
      packages: [newPkg, ...prev.packages]
    }));
  };

  // Handler: Deliver package (RN-B4)
  const handleDeliverPackage = (pkgId, deliveredToPerson, receiverDoc, porteroName) => {
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
  };

  // Handler: Add common area booking (RN-B1, RN-B2, RN-B3)
  const handleAddReservation = (newRes) => {
    setCondoState(prev => ({
      ...prev,
      reservations: [newRes, ...prev.reservations]
    }));
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
  };

  // Handler: Add PQRS
  const handleAddPqrs = (newPqrs) => {
    setCondoState(prev => ({
      ...prev,
      nextPqrsSeq: (prev.nextPqrsSeq || 42) + 1,
      pqrs: [newPqrs, ...prev.pqrs]
    }));
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
  };

  // Handler: Add authorized person for an apartment
  const handleAddAuthorized = (apartmentId, person) => {
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
  };

  // Handler: Remove authorized person
  const handleRemoveAuthorized = (apartmentId, authId) => {
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
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* IBM Carbon Masthead */}
      <CarbonMasthead
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        state={condoState}
      />

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
            onImportCensusBatch={() => {}}
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
          <span>SPARK TIER: ACTIVE</span>
          <span style={{ color: '#0f62fe' }}>LEY 1581 / RN-B1..RN-B7</span>
        </div>
      </footer>
    </div>
  );
}
