/**
 * CONDOMINIUM DATA & REACTIVE STORE
 * Conjunto Residencial Altos del Parque (3 Torres, 240 Apartamentos)
 * Emulates Cloud Firestore state with localStorage synchronization.
 */

const STORAGE_KEY = 'altos_del_parque_store_v1';

// Seed generator for 3 towers and 240 apartments
function generateInitialApartments() {
  const towers = [
    { id: 'T1', name: 'Torre 1 (Pisos 1-8)', floors: 8, perFloor: 10 },
    { id: 'T2', name: 'Torre 2 (Pisos 1-8)', floors: 8, perFloor: 10 },
    { id: 'T3', name: 'Torre 3 (Pisos 1-8)', floors: 8, perFloor: 10 },
  ];

  const apartments = [];
  const sampleSurnames = ['Rodríguez', 'Gómez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Castro', 'Morales', 'Herrera', 'Ríos'];
  const sampleNames = ['Carlos', 'María', 'Andrés', 'Laura', 'Felipe', 'Valentina', 'Juan', 'Camila', 'Santiago', 'Daniela', 'Alejandro', 'Paula'];

  towers.forEach(t => {
    for (let f = 1; f <= t.floors; f++) {
      for (let n = 1; n <= t.perFloor; n++) {
        const aptNumber = `${f}${n < 10 ? '0' + n : n}`;
        const aptId = `${t.id}-${aptNumber}`;
        const surname = sampleSurnames[(f * 10 + n) % sampleSurnames.length];
        const name = sampleNames[(f * 7 + n) % sampleNames.length];
        const ownerName = `${name} ${surname}`;

        apartments.push({
          id: aptId,
          towerId: t.id,
          towerName: t.name.split(' ')[0] + ' ' + t.name.split(' ')[1],
          number: aptNumber,
          ownerName: ownerName,
          email: `${name.toLowerCase()}.${surname.toLowerCase()}@altosparque.com`,
          phone: `310${(1000000 + f * 10000 + n).toString().slice(1)}`,
          residents: [
            { name: ownerName, doc: `CC ${1020000000 + f * 1000 + n}`, relation: 'Titular' }
          ],
          authorized: [
            {
              id: `auth-${aptId}-1`,
              name: `Familiar de ${surname}`,
              doc: `CC ${1015000000 + f * 1000 + n}`,
              phone: '3157891234',
              relation: 'Familiar Autorizado'
            },
            {
              id: `auth-${aptId}-2`,
              name: 'Luz Marina Díaz',
              doc: 'CC 52418902',
              phone: '3204567890',
              relation: 'Personal de Servicio Doméstico'
            }
          ]
        });
      }
    }
  });

  return apartments;
}

// Generate realistic packages
function generateInitialPackages() {
  const now = new Date();
  
  // Package 1: Recent, today
  const p1Time = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  // Package 2: 3 days ago
  const p2Time = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  // Package 3: Overdue (>15 days, triggers RN-B5 Bodegaje fee alert!)
  const p3Time = new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000);
  // Package 4: Delivered
  const p4Received = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const p4Delivered = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'PKG-2026-0891',
      trackingNumber: 'ML-982144720CO',
      courier: 'MercadoLibre',
      towerId: 'T1',
      apartmentId: 'T1-101',
      recipientName: 'Carlos Rodríguez',
      status: 'Pendiente',
      notes: 'Caja mediana sellada electrónica',
      receivedByPorteroId: 'guard_guardia1',
      receivedByPorteroName: 'Vigilante Néstor Beltrán (Turno Mañana)',
      receivedAt: p1Time.toISOString(),
      deliveredAt: null,
      deliveredByPorteroId: null,
      deliveredToPerson: null,
      receiverDocumentId: null
    },
    {
      id: 'PKG-2026-0890',
      trackingNumber: 'AMZ-CO-55129',
      courier: 'Amazon',
      towerId: 'T2',
      apartmentId: 'T2-304',
      recipientName: 'Camila Morales',
      status: 'Pendiente',
      notes: 'Sobre acolchado documentos',
      receivedByPorteroId: 'guard_guardia2',
      receivedByPorteroName: 'Vigilante Jorge Useche (Turno Tarde)',
      receivedAt: p2Time.toISOString(),
      deliveredAt: null,
      deliveredByPorteroId: null,
      deliveredToPerson: null,
      receiverDocumentId: null
    },
    {
      id: 'PKG-2026-0782',
      trackingNumber: 'SER-44120938',
      courier: 'Servientrega',
      towerId: 'T1',
      apartmentId: 'T1-101',
      recipientName: 'Carlos Rodríguez',
      status: 'Pendiente',
      notes: 'Repuesto importado - SIN RECLAMAR (>15 días)',
      receivedByPorteroId: 'guard_guardia1',
      receivedByPorteroName: 'Vigilante Néstor Beltrán',
      receivedAt: p3Time.toISOString(),
      deliveredAt: null,
      deliveredByPorteroId: null,
      deliveredToPerson: null,
      receiverDocumentId: null
    },
    {
      id: 'PKG-2026-0885',
      trackingNumber: 'INT-99214710',
      courier: 'InterRapidísimo',
      towerId: 'T3',
      apartmentId: 'T3-502',
      recipientName: 'Felipe Vargas',
      status: 'Entregado',
      notes: 'Paquete de ropa',
      receivedByPorteroId: 'guard_guardia1',
      receivedByPorteroName: 'Vigilante Néstor Beltrán',
      receivedAt: p4Received.toISOString(),
      deliveredAt: p4Delivered.toISOString(),
      deliveredByPorteroId: 'guard_guardia2',
      deliveredByPorteroName: 'Vigilante Jorge Useche',
      deliveredToPerson: 'Luz Marina Díaz (Autorizada)',
      receiverDocumentId: 'CC 52418902'
    }
  ];
}

// Generate realistic common area reservations
function generateInitialReservations() {
  const now = new Date();
  
  // Future valid reservation 1 (Saturday in 5 days, >48h)
  const res1Start = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  res1Start.setHours(14, 0, 0, 0);
  const res1End = new Date(res1Start.getTime() + 6 * 60 * 60 * 1000);

  // Future valid reservation 2 (Sunday in 6 days, >48h)
  const res2Start = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  res2Start.setHours(11, 0, 0, 0);
  const res2End = new Date(res2Start.getTime() + 5 * 60 * 60 * 1000);

  return [
    {
      id: 'RES-2026-0012',
      commonArea: 'salon_social',
      commonAreaName: 'Salón Social Comunitario',
      capacity: 80,
      depositAmount: 200000,
      apartmentId: 'T1-101',
      residentName: 'Carlos Rodríguez',
      startTime: res1Start.toISOString(),
      endTime: res1End.toISOString(),
      status: 'Pendiente',
      requestedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
      rejectionReason: null,
      resolvedBy: null,
      resolvedAt: null
    },
    {
      id: 'RES-2026-0011',
      commonArea: 'bbq',
      commonAreaName: 'Zona BBQ & Terraza',
      capacity: 30,
      depositAmount: 80000,
      apartmentId: 'T2-402',
      residentName: 'Valentina Castro',
      startTime: res2Start.toISOString(),
      endTime: res2End.toISOString(),
      status: 'Aprobada',
      requestedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      rejectionReason: null,
      resolvedBy: 'admin_patricia',
      resolvedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

// Generate realistic PQRS tickets
function generateInitialPqrs() {
  const now = new Date();

  return [
    {
      id: 'PQ-2026-0041',
      ticketNumber: 'PQ-2026-0041',
      apartmentId: 'T1-101',
      residentName: 'Carlos Rodríguez',
      category: 'Peticion',
      subject: 'Solicitud de certificado de paz y salvo de administración',
      description: 'Requiero con urgencia el certificado de paz y salvo de la cuota de administración del apartamento T1-101 para trámite notarial de crédito.',
      status: 'Radicada',
      createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      officialResponse: null,
      history: [
        {
          previousStatus: 'Inicio',
          newStatus: 'Radicada',
          changedBy: 'Carlos Rodríguez (Residente)',
          changedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
          comment: 'Radicación oficial de petición vía Mi Conjunto en Línea.'
        }
      ]
    },
    {
      id: 'PQ-2026-0040',
      ticketNumber: 'PQ-2026-0040',
      apartmentId: 'T2-508',
      residentName: 'Andrés López',
      category: 'Queja',
      subject: 'Ruido excesivo en zona de parqueaderos nocturno',
      description: 'En reiteradas ocasiones se activan alarmas vehiculares de forma prolongada después de las 11:00 PM sin intervención del personal de vigilancia.',
      status: 'En gestión',
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
      officialResponse: null,
      history: [
        {
          previousStatus: 'Inicio',
          newStatus: 'Radicada',
          changedBy: 'Andrés López',
          changedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
          comment: 'Ticket radicado formalmente.'
        },
        {
          previousStatus: 'Radicada',
          newStatus: 'En gestión',
          changedBy: 'Dra. Patricia Gómez (Administradora)',
          changedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
          comment: 'Se solicitó informe a la empresa de seguridad privada Atlas sobre los eventos del fin de semana.'
        }
      ]
    },
    {
      id: 'PQ-2026-0039',
      ticketNumber: 'PQ-2026-0039',
      apartmentId: 'T3-201',
      residentName: 'Laura Morales',
      category: 'Sugerencia',
      subject: 'Instalación de dispensadores de bolsas para mascotas',
      description: 'Propuesta de ubicar 2 puntos de dispensadores de bolsas ecológicas en la zona verde trasera del conjunto para mejorar la higiene comunal.',
      status: 'Resuelta',
      createdAt: new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString(),
      officialResponse: 'Agradecemos la iniciativa. La propuesta fue aprobada en reunión del Consejo del 5 de noviembre y se incluyó en la orden de compra de dotación de zonas verdes con entrega programada para la próxima semana.',
      history: [
        {
          previousStatus: 'Inicio',
          newStatus: 'Radicada',
          changedBy: 'Laura Morales',
          changedAt: new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString(),
          comment: 'Radicación de sugerencia.'
        },
        {
          previousStatus: 'Radicada',
          newStatus: 'En gestión',
          changedBy: 'Dra. Patricia Gómez (Administradora)',
          changedAt: new Date(now.getTime() - 80 * 60 * 60 * 1000).toISOString(),
          comment: 'Llevado a consideración en comité de convivencia y consejo.'
        },
        {
          previousStatus: 'En gestión',
          newStatus: 'Resuelta',
          changedBy: 'Dra. Patricia Gómez (Administradora)',
          changedAt: new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString(),
          comment: 'Respuesta oficial expedida conforme a RN-B6.'
        }
      ]
    }
  ];
}

// Initial state loader
export function loadCondominiumState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse stored data, reloading seed:', e);
    }
  }

  const initial = {
    apartments: generateInitialApartments(),
    packages: generateInitialPackages(),
    reservations: generateInitialReservations(),
    pqrs: generateInitialPqrs(),
    nextPqrsSeq: 42
  };

  saveCondominiumState(initial);
  return initial;
}

export function saveCondominiumState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
