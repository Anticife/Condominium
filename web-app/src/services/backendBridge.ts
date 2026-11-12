/**
 * BACKEND BRIDGE & FIRESTORE ADAPTER
 * Conecta los componentes de interfaz IBM Carbon con los servicios reales
 * de Cloud Firestore (plan Spark) definidos en packageService, reservationService,
 * censusService y userService.
 */

import { auth, db } from '../config/firebase'
import {
  registerIncomingPackage,
  subscribeToPendingPackages,
  subscribeToApartmentPackages,
  deliverPackageTransaction,
  type Package as FirestorePackage,
} from './packageService'
import {
  requestReservation,
  validateReservationRequest,
  getTakenSlots,
  SLOTS,
  type ReservationRequest,
} from './reservationService'
import {
  AREA_LABELS,
} from './reservationSlots'
import {
  createTower,
  createApartment,
  addAuthorizedPerson,
  removeAuthorizedPerson,
} from './censusService'
import { BusinessRuleError } from './errors'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  limit,
} from 'firebase/firestore'
import { TOWERS, APARTMENTS } from '../data/condominiumData'

export interface BackendStatus {
  isFirestoreLive: boolean
  isAuthLive: boolean
  mode: 'cloud_firestore' | 'local_reactive'
  message: string
}

/** Comprueba el estado de conexión con Firebase */
export async function probeBackendStatus(): Promise<BackendStatus> {
  try {
    // Intentar leer la colección 'towers' para verificar Firestore
    const q = query(collection(db, 'towers'), limit(1))
    await getDocs(q)
    return {
      isFirestoreLive: true,
      isAuthLive: Boolean(auth.currentUser),
      mode: 'cloud_firestore',
      message: 'Cloud Firestore Activo (Plan Spark)',
    }
  } catch (err: unknown) {
    const errorMsg = (err as { code?: string; message?: string })?.message || ''
    const errorCode = (err as { code?: string })?.code || ''
    
    // Si da permission-denied significa que Firestore está activo pero las reglas exigen autenticación
    if (errorCode === 'permission-denied') {
      return {
        isFirestoreLive: true,
        isAuthLive: false,
        mode: 'cloud_firestore',
        message: 'Cloud Firestore Protegido (firestore.rules activas)',
      }
    }
    
    return {
      isFirestoreLive: false,
      isAuthLive: false,
      mode: 'local_reactive',
      message: errorMsg.includes('offline') ? 'Modo Local / Desconectado' : 'Modo Reactivo Sincronizado',
    }
  }
}

/**
 * Registra un paquete nuevo usando la función real packageService.registerIncomingPackage.
 * Si Firestore está disponible, escribe directamente en la colección 'packages'.
 */
export async function bridgeRegisterPackage(
  input: {
    apartmentId: string
    courier: string
    recipientName: string
    trackingNumber?: string
    notes?: string
  },
  porteroId: string = 'portero-turno-1',
): Promise<string> {
  try {
    const pkgId = await registerIncomingPackage(db, porteroId, input)
    return pkgId
  } catch (err) {
    // Si falla por permisos de Auth en cliente no autenticado, propagar error o retornar id generado
    if (err instanceof BusinessRuleError) {
      throw err
    }
    throw err
  }
}

/**
 * Entrega un paquete usando la transacción real deliverPackageTransaction.
 * Valida de forma atómica bajo RN-B4 que el documento pertenezca a un residente/autorizado.
 */
export async function bridgeDeliverPackage(
  packageId: string,
  receiverDocumentId: string,
  porteroId: string = 'portero-turno-1',
  notes?: string,
): Promise<void> {
  await deliverPackageTransaction(db, porteroId, packageId, receiverDocumentId, notes)
}

/**
 * Solicita una reserva aplicando las reglas RN-B1, RN-B2 y RN-B3
 * a través de reservationService.requestReservation.
 */
export async function bridgeRequestReservation(req: ReservationRequest): Promise<string> {
  // 1. Prevalidación con mensajes claros en español (RN-B2: anticipación 48h)
  validateReservationRequest(req)
  
  // 2. Ejecución de la solicitud en Firestore con bloqueo de franja y cupo mensual
  return await requestReservation(db, req)
}

/**
 * Agrega una persona autorizada a un apartamento (RN-B4, RN-B7)
 */
export async function bridgeAddAuthorized(
  apartmentId: string,
  person: { fullName: string; documentId: string; phone?: string; relation: string },
): Promise<string> {
  return await addAuthorizedPerson(db, apartmentId, person)
}

/**
 * Elimina una persona autorizada de un apartamento
 */
export async function bridgeRemoveAuthorized(
  apartmentId: string,
  authId: string,
): Promise<void> {
  await removeAuthorizedPerson(db, apartmentId, authId)
}

/**
 * Suscripción reactiva en tiempo real a paquetes pendientes para Portería y Admin
 */
export function bridgeSubscribePendingPackages(
  onUpdate: (packages: FirestorePackage[]) => void,
  onError?: (err: Error) => void,
) {
  return subscribeToPendingPackages(db, onUpdate, onError)
}

/**
 * Suscripción reactiva en tiempo real a paquetes de un apartamento para Residentes
 */
export function bridgeSubscribeApartmentPackages(
  apartmentId: string,
  onUpdate: (packages: FirestorePackage[]) => void,
  onError?: (err: Error) => void,
) {
  return subscribeToApartmentPackages(db, apartmentId, onUpdate, onError)
}

/**
 * Sembrador de censo en Cloud Firestore:
 * Escribe las 3 Torres y los apartamentos iniciales en Firestore si no existen aún.
 */
export async function seedCondominiumToFirestore(): Promise<{ towersCreated: number; apartmentsCreated: number }> {
  let towersCreated = 0
  let apartmentsCreated = 0

  // 1. Sembrar Torres
  for (const tower of TOWERS) {
    try {
      const towerRef = doc(db, 'towers', tower.id)
      const snap = await getDoc(towerRef)
      if (!snap.exists()) {
        await createTower(db, {
          id: tower.id,
          name: tower.name,
          totalApartments: tower.totalApartments,
        })
        towersCreated++
      }
    } catch (e) {
      console.warn(`Error al verificar o crear torre ${tower.id}:`, e)
    }
  }

  // 2. Sembrar Apartamentos (Muestra de las 3 torres)
  const sampleApts = APARTMENTS.slice(0, 30) // Sembrar primeras 30 unidades representativas
  for (const apt of sampleApts) {
    try {
      const aptRef = doc(db, 'apartments', apt.id)
      const snap = await getDoc(aptRef)
      if (!snap.exists()) {
        await createApartment(db, {
          towerId: apt.towerId,
          number: apt.number,
          ownerName: apt.ownerName,
        })
        apartmentsCreated++

        // Sembrar personas autorizadas
        if (apt.authorized && apt.authorized.length > 0) {
          for (const authPerson of apt.authorized) {
            await addAuthorizedPerson(db, apt.id, {
              fullName: authPerson.name,
              documentId: authPerson.doc.replace('CC ', ''),
              phone: authPerson.phone,
              relation: authPerson.relation,
            })
          }
        }
      }
    } catch (e) {
      console.warn(`Error al verificar o crear apartamento ${apt.id}:`, e)
    }
  }

  return { towersCreated, apartmentsCreated }
}

export { SLOTS, AREA_LABELS, BusinessRuleError, getTakenSlots }
