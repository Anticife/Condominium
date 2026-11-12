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
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
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
  requireNonEmpty(tower.id, 'Id de torre')
  requireNonEmpty(tower.name, 'Nombre de torre')
  if (!Number.isInteger(tower.totalApartments) || tower.totalApartments <= 0) {
    throw new BusinessRuleError('invalid-argument', 'El total de apartamentos debe ser un entero positivo.')
  }
  await setDoc(doc(db, 'towers', tower.id), { ...tower })
}

/** Crea un apartamento; falla con mensaje claro si ya existe en esa torre (CON-02). */
export async function createApartment(
  db: Firestore,
  input: { towerId: string; number: string; ownerName: string },
): Promise<string> {
  const towerId = requireNonEmpty(input.towerId, 'Torre')
  const number = requireNonEmpty(input.number, 'Número de apartamento')
  if (!/^\d{3,4}$/.test(number)) {
    throw new BusinessRuleError('invalid-argument', 'El número de apartamento debe tener 3 o 4 dígitos (p. ej. 302).')
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
