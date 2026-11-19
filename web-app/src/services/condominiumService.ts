/**
 * Gestión Multi-Tenant de Conjuntos Residenciales (plan Spark, sin Cloud Functions).
 *
 * Estructura:
 *   condominiums/{condoId}          — Metadatos del conjunto (nombre, NIT, dirección, joinCode)
 *   joinCodes/{code}                — Índice determinista de códigos únicos de invitación
 *   condominiums/{condoId}/...      — Subcolecciones aisladas por conjunto
 */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { BusinessRuleError, requireNonEmpty } from './errors'

export interface Condominium {
  id: string
  name: string
  nit: string
  address: string
  city: string
  joinCode: string
  ownerUid: string
  isActive: boolean
  createdAt?: Timestamp | null
}

export interface JoinCodeRecord {
  code: string
  condominiumId: string
  condominiumName: string
  isActive: boolean
}

export interface CreateCondominiumInput {
  name: string
  nit?: string
  address?: string
  city?: string
  joinCode?: string
}

const JOIN_CODE_RE = /^[A-Z0-9-]{4,24}$/

export function normalizeJoinCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateJoinCode(name: string): string {
  const slug = normalizeJoinCode(name).slice(0, 12).replace(/-$/g, '') || 'CONJUNTO'
  const suffix = String(Math.floor(1000 + Math.random() * 9000))
  return `${slug}-${suffix}`.slice(0, 24)
}

/**
 * Crea un nuevo conjunto residencial, reserva su código de invitación único,
 * inicializa su contador de PQRS y promueve al usuario creador a `administradora`
 * de ese conjunto en un único `writeBatch` atómico.
 */
export async function createCondominium(
  db: Firestore,
  ownerUid: string,
  input: CreateCondominiumInput,
): Promise<Condominium> {
  const uid = requireNonEmpty(ownerUid, 'Usuario creador')
  const name = requireNonEmpty(input.name, 'Nombre del conjunto')
  const nit = input.nit?.trim() ?? ''
  const address = input.address?.trim() ?? ''
  const city = input.city?.trim() ?? ''

  const rawCode = input.joinCode?.trim() ? normalizeJoinCode(input.joinCode) : generateJoinCode(name)
  if (!JOIN_CODE_RE.test(rawCode)) {
    throw new BusinessRuleError(
      'invalid-argument',
      'El código de invitación debe tener entre 4 y 24 caracteres (letras, números o guiones).',
    )
  }

  const codeRef = doc(db, 'joinCodes', rawCode)
  if ((await getDoc(codeRef)).exists()) {
    throw new BusinessRuleError(
      'already-exists',
      `El código de invitación «${rawCode}» ya está en uso por otro conjunto. Elija otro código.`,
    )
  }

  const condoRef = doc(collection(db, 'condominiums'))
  const condoId = condoRef.id
  const userRef = doc(db, 'users', uid)
  const pqrsCounterRef = doc(db, 'condominiums', condoId, 'counters', 'pqrs')

  const batch = writeBatch(db)
  batch.set(condoRef, {
    id: condoId,
    name,
    nit,
    address,
    city,
    joinCode: rawCode,
    ownerUid: uid,
    isActive: true,
    createdAt: serverTimestamp(),
  })
  batch.set(codeRef, {
    code: rawCode,
    condominiumId: condoId,
    condominiumName: name,
    isActive: true,
    createdAt: serverTimestamp(),
  })
  batch.set(pqrsCounterRef, {
    year: new Date().getFullYear(),
    sequence: 0,
  })
  batch.update(userRef, {
    condominiumId: condoId,
    role: 'administradora',
  })

  try {
    await batch.commit()
  } catch (err) {
    if ((err as { code?: string }).code === 'permission-denied') {
      throw new BusinessRuleError(
        'permission-denied',
        'No se pudo crear el conjunto. Verifique que su cuenta no pertenezca ya a otro conjunto y que el código esté disponible.',
      )
    }
    throw err
  }

  return {
    id: condoId,
    name,
    nit,
    address,
    city,
    joinCode: rawCode,
    ownerUid: uid,
    isActive: true,
  }
}

/**
 * Busca un código de invitación exacto (sin exponer la lista de conjuntos).
 */
export async function lookupJoinCode(db: Firestore, rawCode: string): Promise<JoinCodeRecord | null> {
  const code = normalizeJoinCode(rawCode)
  if (!JOIN_CODE_RE.test(code)) return null
  const snap = await getDoc(doc(db, 'joinCodes', code))
  if (!snap.exists()) return null
  const data = snap.data() as JoinCodeRecord
  return data.isActive ? data : null
}

/**
 * Une a un usuario sin conjunto a un conjunto residencial existente mediante su
 * código de invitación, siempre con rol `residente` (pendiente de unidad).
 */
export async function joinCondominiumByCode(
  db: Firestore,
  uid: string,
  rawCode: string,
): Promise<JoinCodeRecord> {
  const userId = requireNonEmpty(uid, 'Usuario')
  const code = normalizeJoinCode(requireNonEmpty(rawCode, 'Código de invitación'))
  if (!JOIN_CODE_RE.test(code)) {
    throw new BusinessRuleError('invalid-argument', 'Formato de código de invitación no válido.')
  }

  const record = await lookupJoinCode(db, code)
  if (!record) {
    throw new BusinessRuleError(
      'not-found',
      `No se encontró ningún conjunto activo con el código «${code}». Verifique con la Administración.`,
    )
  }

  const batch = writeBatch(db)
  batch.update(doc(db, 'users', userId), {
    condominiumId: record.condominiumId,
    role: 'residente',
  })

  try {
    await batch.commit()
  } catch (err) {
    if ((err as { code?: string }).code === 'permission-denied') {
      throw new BusinessRuleError(
        'permission-denied',
        'Su cuenta ya está vinculada a un conjunto o no tiene permisos para completar el registro.',
      )
    }
    throw err
  }

  return record
}

export function subscribeToCondominium(
  db: Firestore,
  condoId: string,
  onChange: (condominium: Condominium | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'condominiums', condoId),
    (snap) => onChange(snap.exists() ? (snap.data() as Condominium) : null),
    onError,
  )
}

export async function updateCondominiumProfile(
  db: Firestore,
  condoId: string,
  joinCode: string,
  updates: { name: string; nit?: string; address?: string; city?: string },
): Promise<void> {
  const id = requireNonEmpty(condoId, 'Conjunto')
  const name = requireNonEmpty(updates.name, 'Nombre del conjunto')
  const batch = writeBatch(db)
  batch.update(doc(db, 'condominiums', id), {
    name,
    nit: updates.nit?.trim() ?? '',
    address: updates.address?.trim() ?? '',
    city: updates.city?.trim() ?? '',
  })
  if (joinCode) {
    batch.update(doc(db, 'joinCodes', joinCode), {
      condominiumName: name,
    })
  }
  await batch.commit()
}
