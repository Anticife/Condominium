/**
 * Paquetería (SCRUM-14, SCRUM-17, SCRUM-21).
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { findActiveAuthorizedByDocument } from './censusService'
import { BusinessRuleError, requireNonEmpty } from './errors'

export type PackageStatus = 'Pendiente' | 'Entregado'

export interface Package {
  id: string
  trackingNumber?: string
  courier: string
  towerId: string
  apartmentId: string
  recipientName: string
  status: PackageStatus
  notes?: string
  receivedByPorteroId: string
  receivedAt: Timestamp | null
  createdAt: Timestamp | null
  deliveredAt?: Timestamp | null
  deliveredByPorteroId?: string
  deliveredToAuthId?: string
  deliveredToPerson?: string
  deliveredToDocument?: string
  deliveryNotes?: string
}

export interface IncomingPackageInput {
  apartmentId: string
  courier: string
  recipientName: string
  trackingNumber?: string
  notes?: string
}

// ---------- SCRUM-14: registro de llegada ----------

/** Registra un paquete en portería; queda 'Pendiente' con hora del servidor. */
export async function registerIncomingPackage(
  db: Firestore,
  porteroId: string,
  input: IncomingPackageInput,
): Promise<string> {
  const apartmentId = requireNonEmpty(input.apartmentId, 'Apartamento')
  const courier = requireNonEmpty(input.courier, 'Transportadora')
  const recipientName = requireNonEmpty(input.recipientName, 'Destinatario')

  const apt = await getDoc(doc(db, 'apartments', apartmentId))
  if (!apt.exists()) {
    throw new BusinessRuleError('not-found', 'El apartamento no existe. Revise torre y número.')
  }

  const data: Record<string, unknown> = {
    courier,
    towerId: apt.get('towerId'),
    apartmentId,
    recipientName,
    status: 'Pendiente',
    receivedByPorteroId: porteroId,
    receivedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }
  if (input.trackingNumber?.trim()) data.trackingNumber = input.trackingNumber.trim()
  if (input.notes?.trim()) data.notes = input.notes.trim()

  const ref = await addDoc(collection(db, 'packages'), data)
  return ref.id
}

// ---------- SCRUM-17: suscripciones en tiempo real (RNF-11) ----------

function toPackages(docs: { id: string; data: (o?: object) => unknown }[]): Package[] {
  // estimate: el turno que registra ve su paquete al instante, antes de que
  // el servidor confirme la hora.
  return docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Package)
}

/** Portería y administración: todos los paquetes pendientes, más recientes primero. */
export function subscribeToPendingPackages(
  db: Firestore,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'packages'),
    where('status', '==', 'Pendiente'),
    orderBy('receivedAt', 'desc'),
  )
  return onSnapshot(q, (snap) => onChange(toPackages(snap.docs)), onError)
}

/**
 * Residente: pendientes de su apartamento. El filtro por apartmentId es
 * obligatorio: sin él, firestore.rules rechaza la consulta.
 */
export function subscribeToApartmentPackages(
  db: Firestore,
  apartmentId: string,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'packages'),
    where('apartmentId', '==', apartmentId),
    where('status', '==', 'Pendiente'),
    orderBy('receivedAt', 'desc'),
  )
  return onSnapshot(q, (snap) => onChange(toPackages(snap.docs)), onError)
}

// ---------- SCRUM-21: entrega ----------

/**
 * Entrega un paquete a quien presenta `receiverDocumentId`. Solo se entrega
 * a un residente o autorizado activo del apartamento (RN-B4); la transacción
 * evita que dos turnos entreguen el mismo paquete a la vez.
 */
export async function deliverPackageTransaction(
  db: Firestore,
  porteroId: string,
  packageId: string,
  receiverDocumentId: string,
  notes?: string,
): Promise<void> {
  const documentId = requireNonEmpty(receiverDocumentId, 'Documento de quien recibe')
  const pkgRef = doc(db, 'packages', packageId)

  const pkgSnap = await getDoc(pkgRef)
  if (!pkgSnap.exists()) throw new BusinessRuleError('not-found', 'El paquete no existe.')
  const apartmentId = pkgSnap.get('apartmentId') as string

  const person = await findActiveAuthorizedByDocument(db, apartmentId, documentId)
  if (!person) {
    throw new BusinessRuleError(
      'permission-denied',
      'Esa persona no es residente ni está autorizada para recibir paquetes de este apartamento.',
    )
  }

  await runTransaction(db, async (tx) => {
    const current = await tx.get(pkgRef)
    if (current.get('status') !== 'Pendiente') {
      throw new BusinessRuleError('failed-precondition', 'Este paquete ya fue entregado.')
    }
    const authRef = doc(db, 'apartments', apartmentId, 'authorized', person.id)
    const auth = await tx.get(authRef)
    if (!auth.exists() || auth.get('isActive') !== true) {
      throw new BusinessRuleError('permission-denied', 'La autorización de esa persona ya no está activa.')
    }
    const update: Record<string, unknown> = {
      status: 'Entregado',
      deliveredAt: serverTimestamp(),
      deliveredByPorteroId: porteroId,
      deliveredToAuthId: person.id,
      deliveredToPerson: auth.get('fullName'),
      deliveredToDocument: auth.get('documentId'),
    }
    if (notes?.trim()) update.deliveryNotes = notes.trim()
    tx.update(pkgRef, update)
  })
}
