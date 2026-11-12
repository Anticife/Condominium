/**
 * CONDOMINIUM DATA & REACTIVE STORE
 * Conjunto Residencial Altos del Parque (3 Torres, 240 Apartamentos)
 * Sincronizado con Cloud Firestore y almacenamiento local limpio (sin datos de prueba).
 */

const STORAGE_KEY = 'altos_del_parque_store_v2';

export const TOWERS = [
  { id: 'T1', name: 'Torre 1 (Pisos 1-8)', floors: 8, perFloor: 10, totalApartments: 80 },
  { id: 'T2', name: 'Torre 2 (Pisos 1-8)', floors: 8, perFloor: 10, totalApartments: 80 },
  { id: 'T3', name: 'Torre 3 (Pisos 1-8)', floors: 8, perFloor: 10, totalApartments: 80 },
];

/**
 * Genera el inventario estructural físico de las 3 torres y 240 apartamentos.
 * Sin datos ficticios: las unidades quedan limpias a la espera de carga de censo oficial.
 * Únicamente se asocia la unidad T1-101 a Carlos Rodríguez como perfil titular de residente.
 */
function generateInitialApartments() {
  const towers = TOWERS;
  const apartments = [];

  towers.forEach(t => {
    for (let f = 1; f <= t.floors; f++) {
      for (let n = 1; n <= t.perFloor; n++) {
        const aptNumber = `${f}${n < 10 ? '0' + n : n}`;
        const aptId = `${t.id}-${aptNumber}`;
        const isPresetResidentUnit = aptId === 'T1-101';

        apartments.push({
          id: aptId,
          towerId: t.id,
          towerName: t.name.split(' ')[0] + ' ' + t.name.split(' ')[1],
          number: aptNumber,
          ownerName: isPresetResidentUnit ? 'Carlos Rodríguez' : '',
          email: isPresetResidentUnit ? 'carlos.rodriguez@altosparque.com' : '',
          phone: isPresetResidentUnit ? '3101234567' : '',
          residents: isPresetResidentUnit ? [
            { name: 'Carlos Rodríguez', doc: 'CC 1.020.445.890', relation: 'Titular' }
          ] : [],
          authorized: []
        });
      }
    }
  });

  return apartments;
}

export const APARTMENTS = generateInitialApartments();
export const INITIAL_PACKAGES = [];
export const INITIAL_RESERVATIONS = [];
export const INITIAL_PQRS = [];

/**
 * Carga el estado del condominio purgando cualquier dato mock residual
 * de versiones previas en localStorage.
 */
export function loadCondominiumState() {
  try {
    if (typeof window !== 'undefined') {
      // Purgar versiones antiguas con datos de prueba
      localStorage.removeItem('altos_del_parque_store_v1');
    }

    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.apartments) && Array.isArray(parsed.packages) && Array.isArray(parsed.reservations)) {
        // Filtrar cualquier paquete mock antiguo
        const cleanPackages = parsed.packages.filter(p => !p.id?.startsWith('PKG-2026-'));
        const cleanReservations = parsed.reservations.filter(r => !r.id?.startsWith('RES-2026-'));
        const cleanPqrs = Array.isArray(parsed.pqrs) ? parsed.pqrs.filter(pq => !pq.id?.startsWith('PQ-2026-')) : [];

        // Limpiar autorizados o datos ficticios antiguos de los apartamentos
        const cleanApartments = (parsed.apartments || APARTMENTS).map(a => {
          if (a.id === 'T1-101') return a;
          const hasMockAuth = a.authorized && a.authorized.some(auth => auth.name?.includes('Familiar de') || auth.name === 'Luz Marina Díaz');
          if (hasMockAuth) {
            return {
              ...a,
              ownerName: '',
              email: '',
              phone: '',
              residents: [],
              authorized: []
            };
          }
          return a;
        });

        return {
          apartments: cleanApartments,
          packages: cleanPackages,
          reservations: cleanReservations,
          pqrs: cleanPqrs,
          nextPqrsSeq: parsed.nextPqrsSeq || 1
        };
      }
    }
  } catch (e) {
    console.warn('Error al leer almacenamiento local, restableciendo estado limpio:', e);
  }

  const initial = {
    apartments: APARTMENTS,
    packages: [],
    reservations: [],
    pqrs: [],
    nextPqrsSeq: 1
  };

  saveCondominiumState(initial);
  return initial;
}

export function saveCondominiumState(state) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (_) {}
}

/**
 * Restablece el estado completo a cero (elimina paquetes, reservas y PQRS).
 */
export function resetCondominiumState() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('altos_del_parque_store_v1');
    localStorage.removeItem(STORAGE_KEY);
  }
  const cleanState = {
    apartments: generateInitialApartments(),
    packages: [],
    reservations: [],
    pqrs: [],
    nextPqrsSeq: 1
  };
  saveCondominiumState(cleanState);
  return cleanState;
}
