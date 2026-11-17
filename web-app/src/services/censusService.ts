/**
 * Censo: torres, apartamentos y personas autorizadas (SCRUM-10).
 *
 *   towers/{towerId}
 *   apartments/{towerId}-{number}   (p. ej. T1-101)
 *   apartments/{apartmentId}/authorized/{authId}
 *
 * El id determinista del apartamento impide duplicados en la misma torre.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { BusinessRuleError, requireNonEmpty } from './errors'

export interface Tower {
  id: string
  name: string
  totalApartments: number
}

export interface Apartment {
  id: string
  towerId: string
  number: string
  ownerName: string
  residentUids: string[]
}

export interface AuthorizedPerson {
  id: string
  fullName: string
  documentId: string
  phone: string
  relation: string
  isActive: boolean
}

export function apartmentDocId(towerId: string, number: string): string {
  return `${towerId}-${number}`
}

export async function createTower(db: Firestore, tower: Tower): Promise<void> {
  const id = requireNonEmpty(tower.id, 'Id de torre').toUpperCase()
  const name = requireNonEmpty(tower.name, 'Nombre de torre')
  if (!/^[A-Z0-9_]{1,16}$/.test(id)) {
    throw new BusinessRuleError('invalid-argument', 'El código de torre solo admite letras, números o "_" (sin espacios ni guiones).')
  }
  if (!Number.isInteger(tower.totalApartments) || tower.totalApartments <= 0) {
    throw new BusinessRuleError('invalid-argument', 'El total de apartamentos debe ser un entero positivo.')
  }
  const ref = doc(db, 'towers', id)
  if ((await getDoc(ref)).exists()) {
    throw new BusinessRuleError('already-exists', `La torre ${id} ya existe.`)
  }
  await setDoc(ref, { id, name, totalApartments: tower.totalApartments })
}

export async function updateTower(
  db: Firestore,
  towerId: string,
  updates: { name: string; totalApartments: number },
): Promise<void> {
  const id = requireNonEmpty(towerId, 'Id de torre')
  const name = requireNonEmpty(updates.name, 'Nombre de torre')
  if (!Number.isInteger(updates.totalApartments) || updates.totalApartments <= 0) {
    throw new BusinessRuleError('invalid-argument', 'El total de apartamentos debe ser un entero positivo.')
  }
  await updateDoc(doc(db, 'towers', id), { id, name, totalApartments: updates.totalApartments })
}

export async function deleteTower(db: Firestore, towerId: string): Promise<void> {
  const id = requireNonEmpty(towerId, 'Id de torre')
  const existing = await getDocs(query(collection(db, 'apartments'), where('towerId', '==', id), limit(1)))
  if (!existing.empty) {
    throw new BusinessRuleError('failed-precondition', 'No se puede eliminar una torre que aún tiene apartamentos registrados.')
  }
  await deleteDoc(doc(db, 'towers', id))
}

export function subscribeToTowers(
  db: Firestore,
  onChange: (towers: Tower[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'towers'), orderBy('id', 'asc'))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as Tower))
  }, onError)
}

/** Crea un apartamento; falla con mensaje claro si ya existe en esa torre (CON-02). */
export async function createApartment(
  db: Firestore,
  input: { towerId: string; number: string; ownerName: string },
): Promise<string> {
  const towerId = requireNonEmpty(input.towerId, 'Torre')
  const number = requireNonEmpty(input.number, 'Número de apartamento').toUpperCase()
  if (!/^[A-Z0-9]{1,8}$/.test(number)) {
    throw new BusinessRuleError('invalid-argument', 'El número de apartamento debe tener entre 1 y 8 caracteres alfanuméricos (p. ej. 302 o 101A).')
  }
  const id = apartmentDocId(towerId, number)
  const ref = doc(db, 'apartments', id)

  await runTransaction(db, async (tx) => {
    const tower = await tx.get(doc(db, 'towers', towerId))
    if (!tower.exists()) throw new BusinessRuleError('not-found', 'La torre no existe.')
    if ((await tx.get(ref)).exists()) {
      throw new BusinessRuleError('already-exists', `El apartamento ${number} ya existe en esa torre.`)
    }
    tx.set(ref, {
      id,
      towerId,
      number,
      ownerName: input.ownerName.trim(),
      residentUids: [],
      createdAt: serverTimestamp(),
    })
  })
  return id
}

export async function updateApartmentOwner(
  db: Firestore,
  apartmentId: string,
  ownerName: string,
): Promise<void> {
  const id = requireNonEmpty(apartmentId, 'Apartamento')
  await updateDoc(doc(db, 'apartments', id), { ownerName: ownerName.trim() })
}

export async function deleteApartment(db: Firestore, apartmentId: string): Promise<void> {
  const id = requireNonEmpty(apartmentId, 'Apartamento')
  const aptSnap = await getDoc(doc(db, 'apartments', id))
  if (!aptSnap.exists()) return
  const residentUids = aptSnap.get('residentUids') as string[] | undefined
  if (residentUids && residentUids.length > 0) {
    throw new BusinessRuleError('failed-precondition', 'Desasigne primero los residentes de este apartamento antes de eliminarlo.')
  }
  const pendingPkgs = await getDocs(query(
    collection(db, 'packages'),
    where('apartmentId', '==', id),
    where('status', '==', 'Pendiente'),
    limit(1),
  ))
  if (!pendingPkgs.empty) {
    throw new BusinessRuleError('failed-precondition', 'No se puede eliminar un apartamento con paquetes pendientes en portería.')
  }
  await deleteDoc(doc(db, 'apartments', id))
}

export function subscribeToAllApartments(
  db: Firestore,
  onChange: (apartments: Apartment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'apartments'), orderBy('id', 'asc'))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as Apartment))
  }, onError)
}

export function subscribeToApartment(
  db: Firestore,
  apartmentId: string,
  onChange: (apartment: Apartment | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'apartments', apartmentId), (snap) => {
    onChange(snap.exists() ? (snap.data() as Apartment) : null)
  }, onError)
}

export async function getApartment(db: Firestore, apartmentId: string): Promise<Apartment | null> {
  const snap = await getDoc(doc(db, 'apartments', apartmentId))
  return snap.exists() ? (snap.data() as Apartment) : null
}

/** Residente o administradora registra a alguien autorizado para recibir paquetes. */
export async function addAuthorizedPerson(
  db: Firestore,
  apartmentId: string,
  person: { fullName: string; documentId: string; phone?: string; relation: string },
): Promise<string> {
  const fullName = requireNonEmpty(person.fullName, 'Nombre completo')
  const documentId = requireNonEmpty(person.documentId, 'Documento')
  const relation = requireNonEmpty(person.relation, 'Parentesco')
  if (relation === 'residente') {
    throw new BusinessRuleError('invalid-argument', 'Los residentes los registra la administradora.')
  }
  const ref = doc(collection(db, 'apartments', apartmentId, 'authorized'))
  await setDoc(ref, {
    id: ref.id,
    fullName,
    documentId,
    phone: person.phone?.trim() ?? '',
    relation,
    isActive: true,
    registeredAt: serverTimestamp(),
  })
  return ref.id
}

export async function setAuthorizedActive(
  db: Firestore,
  apartmentId: string,
  authId: string,
  isActive: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'apartments', apartmentId, 'authorized', authId), { isActive })
}

export async function removeAuthorizedPerson(db: Firestore, apartmentId: string, authId: string): Promise<void> {
  await deleteDoc(doc(db, 'apartments', apartmentId, 'authorized', authId))
}

export function subscribeToAuthorized(
  db: Firestore,
  apartmentId: string,
  onChange: (people: AuthorizedPerson[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'apartments', apartmentId, 'authorized'), (snap) => {
    onChange(snap.docs.map((d) => d.data() as AuthorizedPerson))
  }, onError)
}

/** Lista personas activas (residentes + autorizados) habilitadas para retirar paquetes (RN-B4). */
export async function listActiveAuthorized(
  db: Firestore,
  apartmentId: string,
): Promise<AuthorizedPerson[]> {
  const snap = await getDocs(query(
    collection(db, 'apartments', apartmentId, 'authorized'),
    where('isActive', '==', true),
  ))
  return snap.docs.map((d) => d.data() as AuthorizedPerson)
}

/** Busca, por documento, una persona activa habilitada para recibir en el apartamento. */
export async function findActiveAuthorizedByDocument(
  db: Firestore,
  apartmentId: string,
  documentId: string,
): Promise<AuthorizedPerson | null> {
  const snap = await getDocs(query(
    collection(db, 'apartments', apartmentId, 'authorized'),
    where('documentId', '==', documentId.trim()),
    where('isActive', '==', true),
  ))
  return snap.empty ? null : (snap.docs[0].data() as AuthorizedPerson)
}
