/**
 * Usuarios y roles (SCRUM-6 + Multi-Tenancy). El rol y `condominiumId` viven en
 * `users/{uid}` y los protege `firestore.rules`: nadie puede cambiarse de conjunto
 * ni elevarse su rol por su cuenta.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { BusinessRuleError, requireNonEmpty } from './errors'

export type Role = 'residente' | 'portero' | 'administradora'
export const ROLES: readonly Role[] = ['residente', 'portero', 'administradora']

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  phone?: string
  role: Role
  condominiumId?: string | null
  unitId?: string
  towerId?: string
  isActive: boolean
}

/**
 * Crea el perfil propio tras registrarse en Firebase Auth. Siempre entra
 * como residente activo, sin conjunto y sin apartamento.
 */
export async function registerOwnProfile(
  db: Firestore,
  user: { uid: string; email: string | null; displayName?: string | null; phone?: string | null },
): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  if ((await getDoc(ref)).exists()) return
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    phone: user.phone?.trim() ?? '',
    role: 'residente',
    condominiumId: null,
    isActive: true,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export function subscribeToOwnProfile(
  db: Firestore,
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as UserProfile) : null)
  }, onError)
}

/** Administradora: lista únicamente los usuarios pertenecientes a SU conjunto. */
export function subscribeToUsers(
  db: Firestore,
  condoId: string,
  onChange: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'users'), where('condominiumId', '==', condoId))
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => d.data() as UserProfile)
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    onChange(list)
  }, onError)
}

export async function updateOwnContact(
  db: Firestore,
  uid: string,
  input: { displayName: string; phone: string },
): Promise<void> {
  const displayName = requireNonEmpty(input.displayName, 'Nombre completo')
  await updateDoc(doc(db, 'users', uid), {
    displayName,
    phone: input.phone.trim(),
  })
}

/**
 * Administradora: liga un residente de su conjunto a su apartamento. En un solo
 * batch actualiza su perfil, residentUids del apartamento y lo registra como
 * persona habilitada para recibir paquetes (RN-B4).
 */
export async function assignResidentToApartment(
  db: Firestore,
  condoId: string,
  input: { userId: string; apartmentId: string; fullName: string; documentId: string },
): Promise<void> {
  const fullName = requireNonEmpty(input.fullName, 'Nombre')
  const documentId = requireNonEmpty(input.documentId, 'Documento')

  const userRef = doc(db, 'users', input.userId)
  const aptRef = doc(db, 'condominiums', condoId, 'apartments', input.apartmentId)
  const [userSnap, aptSnap] = await Promise.all([getDoc(userRef), getDoc(aptRef)])
  if (!userSnap.exists()) throw new BusinessRuleError('not-found', 'El usuario no existe.')
  if (!aptSnap.exists()) throw new BusinessRuleError('not-found', 'El apartamento no existe.')

  const previousUnit = userSnap.get('unitId') as string | undefined
  const batch = writeBatch(db)
  batch.update(userRef, {
    role: 'residente',
    unitId: input.apartmentId,
    towerId: aptSnap.get('towerId'),
  })
  batch.update(aptRef, { residentUids: arrayUnion(input.userId) })
  const authRef = doc(db, 'condominiums', condoId, 'apartments', input.apartmentId, 'authorized', input.userId)
  const authSnap = await getDoc(authRef)
  batch.set(authRef, {
    id: input.userId,
    fullName,
    documentId,
    phone: authSnap.get('phone') ?? '',
    relation: 'residente',
    isActive: true,
    registeredAt: authSnap.exists() ? authSnap.get('registeredAt') : serverTimestamp(),
  })
  if (previousUnit && previousUnit !== input.apartmentId) {
    batch.update(doc(db, 'condominiums', condoId, 'apartments', previousUnit), { residentUids: arrayRemove(input.userId) })
    batch.delete(doc(db, 'condominiums', condoId, 'apartments', previousUnit, 'authorized', input.userId))
  }
  await batch.commit()
}

/** Administradora: asigna rol de portero o administradora dentro de su conjunto. */
export async function setStaffRole(
  db: Firestore,
  condoId: string,
  userId: string,
  role: Exclude<Role, 'residente'>,
): Promise<void> {
  if (!ROLES.includes(role) || role === ('residente' as Role)) {
    throw new BusinessRuleError('invalid-argument', 'Rol no válido para personal.')
  }
  const userRef = doc(db, 'users', userId)
  const snap = await getDoc(userRef)
  if (!snap.exists()) throw new BusinessRuleError('not-found', 'El usuario no existe.')

  const previousUnit = snap.get('unitId') as string | undefined
  const batch = writeBatch(db)
  batch.update(userRef, { role, unitId: deleteField(), towerId: deleteField() })
  if (previousUnit) {
    batch.update(doc(db, 'condominiums', condoId, 'apartments', previousUnit), { residentUids: arrayRemove(userId) })
    batch.delete(doc(db, 'condominiums', condoId, 'apartments', previousUnit, 'authorized', userId))
  }
  await batch.commit()
}

/** Administradora: activa o desactiva una cuenta de su conjunto (RF-02). */
export async function setUserActive(db: Firestore, userId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { isActive })
}
