/**
 * Paquetería multi-tenant (SCRUM-14, SCRUM-17, SCRUM-21).
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

export async function registerIncomingPackage(
  db: Firestore,
  condoId: string,
  porteroId: string,
  input: IncomingPackageInput,
): Promise<string> {
  const apartmentId = requireNonEmpty(input.apartmentId, 'Apartamento')
  const courier = requireNonEmpty(input.courier, 'Transportadora')
  const recipientName = requireNonEmpty(input.recipientName, 'Destinatario')

  const apt = await getDoc(doc(db, 'condominiums', condoId, 'apartments', apartmentId))
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

  const ref = await addDoc(collection(db, 'condominiums', condoId, 'packages'), data)
  return ref.id
}

function toPackages(docs: { id: string; data: (o?: object) => unknown }[]): Package[] {
  return docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Package)
}

export function subscribeToPendingPackages(
  db: Firestore,
  condoId: string,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'condominiums', condoId, 'packages'),
    where('status', '==', 'Pendiente'),
    orderBy('receivedAt', 'desc'),
  )
  return onSnapshot(q, (snap) => onChange(toPackages(snap.docs)), onError)
}

export function subscribeToApartmentPackages(
  db: Firestore,
  condoId: string,
  apartmentId: string,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'condominiums', condoId, 'packages'),
    where('apartmentId', '==', apartmentId),
    where('status', '==', 'Pendiente'),
    orderBy('receivedAt', 'desc'),
  )
  return onSnapshot(q, (snap) => onChange(toPackages(snap.docs)), onError)
}

export function subscribeToAllApartmentPackages(
  db: Firestore,
  condoId: string,
  apartmentId: string,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'condominiums', condoId, 'packages'),
    where('apartmentId', '==', apartmentId),
  )
  return onSnapshot(q, (snap) => {
    const items = toPackages(snap.docs).sort((a, b) => {
      const ta = a.receivedAt?.toMillis?.() ?? 0
      const tb = b.receivedAt?.toMillis?.() ?? 0
      return tb - ta
    })
    onChange(items)
  }, onError)
}

export function subscribeToAllPackages(
  db: Firestore,
  condoId: string,
  onChange: (packages: Package[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'condominiums', condoId, 'packages'), orderBy('receivedAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(toPackages(snap.docs)), onError)
}

export async function deliverPackageTransaction(
  db: Firestore,
  condoId: string,
  porteroId: string,
  packageId: string,
  receiverDocumentId: string,
  notes?: string,
): Promise<void> {
  const documentId = requireNonEmpty(receiverDocumentId, 'Documento de quien recibe')
  const pkgRef = doc(db, 'condominiums', condoId, 'packages', packageId)

  const pkgSnap = await getDoc(pkgRef)
  if (!pkgSnap.exists()) throw new BusinessRuleError('not-found', 'El paquete no existe.')
  const apartmentId = pkgSnap.get('apartmentId') as string

  const person = await findActiveAuthorizedByDocument(db, condoId, apartmentId, documentId)
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
    const authRef = doc(db, 'condominiums', condoId, 'apartments', apartmentId, 'authorized', person.id)
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
