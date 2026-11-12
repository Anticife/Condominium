/**
 * Usuarios y roles (SCRUM-6). El rol vive en users/{uid} y lo protege
 * firestore.rules: nadie puede cambiarse su propio rol, estado ni apartamento.
 */
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
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
  unitId?: string
  towerId?: string
  isActive: boolean
}

/**
 * Crea el perfil propio tras registrarse en Firebase Auth. Siempre entra
 * como residente activo y sin apartamento; la administradora lo asigna.
 */
export async function registerOwnProfile(
  db: Firestore,
  user: { uid: string; email: string | null; displayName?: string | null },
): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  if ((await getDoc(ref)).exists()) return
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    role: 'residente',
    isActive: true,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

/**
 * Administradora: liga un residente a su apartamento. En un solo batch
 * actualiza su perfil, residentUids del apartamento y lo registra como
 * persona habilitada para recibir paquetes (RN-B4).
 */
export async function assignResidentToApartment(
  db: Firestore,
  input: { userId: string; apartmentId: string; fullName: string; documentId: string },
): Promise<void> {
  const fullName = requireNonEmpty(input.fullName, 'Nombre')
  const documentId = requireNonEmpty(input.documentId, 'Documento')

  const userRef = doc(db, 'users', input.userId)
  const aptRef = doc(db, 'apartments', input.apartmentId)
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
  const authRef = doc(db, 'apartments', input.apartmentId, 'authorized', input.userId)
  const authSnap = await getDoc(authRef)
  batch.set(authRef, {
    id: input.userId,
    fullName,
    documentId,
    phone: authSnap.get('phone') ?? '',
    relation: 'residente',
    isActive: true,
    // registeredAt no puede cambiar en una actualización (firestore.rules).
    registeredAt: authSnap.exists() ? authSnap.get('registeredAt') : serverTimestamp(),
  })
  if (previousUnit && previousUnit !== input.apartmentId) {
    batch.update(doc(db, 'apartments', previousUnit), { residentUids: arrayRemove(input.userId) })
    batch.delete(doc(db, 'apartments', previousUnit, 'authorized', input.userId))
  }
  await batch.commit()
}

/** Administradora: asigna rol de portero o administradora (sin apartamento). */
export async function setStaffRole(
  db: Firestore,
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
    batch.update(doc(db, 'apartments', previousUnit), { residentUids: arrayRemove(userId) })
    batch.delete(doc(db, 'apartments', previousUnit, 'authorized', userId))
  }
  await batch.commit()
}

/** Administradora: activa o desactiva una cuenta (RF-02). */
export async function setUserActive(db: Firestore, userId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { isActive })
}
