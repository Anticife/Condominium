/**
 * Radicación y ciclo de vida de PQRS (SCRUM-31, SCRUM-35).
 *
 * - Radicado consecutivo atómico `PQ-YYYY-XXXX` respaldado por `counters/pqrs`.
 * - Transiciones controladas (`Radicada` -> `En gestión` -> `Resuelta`) con
 *   respuesta oficial obligatoria >= 10 caracteres (RN-B6) y auditoría
 *   inmutable en `pqrs/{pqrsId}/history/{historyId}`.
 */
import {
  collection,
  doc,
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
import { BusinessRuleError, requireNonEmpty } from './errors'

export type PqrsCategory = 'Peticion' | 'Queja' | 'Reclamo' | 'Sugerencia'
export type PqrsStatus = 'Radicada' | 'En gestión' | 'Resuelta'

export const PQRS_CATEGORIES: readonly PqrsCategory[] = [
  'Peticion',
  'Queja',
  'Reclamo',
  'Sugerencia',
] as const

export interface PqrsTicket {
  id: string
  ticketNumber: string
  apartmentId: string
  residentId: string
  category: PqrsCategory
  subject: string
  description: string
  status: PqrsStatus
  createdAt: Timestamp | null
  updatedAt?: Timestamp | null
  officialResponse?: string
  resolvedAt?: Timestamp | null
  resolvedBy?: string
}

export interface PqrsHistoryEntry {
  id: string
  previousStatus: PqrsStatus
  newStatus: PqrsStatus
  changedBy: string
  changedAt: Timestamp | null
  comment: string
}

export interface FilePqrsInput {
  apartmentId: string
  residentId: string
  category: PqrsCategory
  subject: string
  description: string
  year?: number
}

export interface TransitionPqrsInput {
  pqrsId: string
  newStatus: Exclude<PqrsStatus, 'Radicada'>
  comment?: string
  officialResponse?: string
}

export function formatPqrsTicket(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new BusinessRuleError('invalid-argument', 'Año de radicado no válido.')
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new BusinessRuleError('invalid-argument', 'Secuencia de radicado no válida.')
  }
  return `PQ-${year}-${String(sequence).padStart(4, '0')}`
}

function isValidCategory(value: unknown): value is PqrsCategory {
  return typeof value === 'string' && (PQRS_CATEGORIES as readonly string[]).includes(value)
}

// ---------- SCRUM-31: radicación atómica ----------

/**
 * Lee e incrementa `counters/pqrs` en +1 y crea el documento PQRS en una única
 * transacción atómica, garantizando radicados únicos y consecutivos sin Cloud Functions.
 */
export async function filePqrsTransaction(
  db: Firestore,
  input: FilePqrsInput,
): Promise<{ id: string; ticketNumber: string }> {
  const apartmentId = requireNonEmpty(input.apartmentId, 'Apartamento')
  const residentId = requireNonEmpty(input.residentId, 'Residente')
  const subject = requireNonEmpty(input.subject, 'Asunto')
  const description = requireNonEmpty(input.description, 'Descripción')

  if (!isValidCategory(input.category)) {
    throw new BusinessRuleError(
      'invalid-argument',
      'Categoría PQRS no válida. Use Peticion, Queja, Reclamo o Sugerencia.',
    )
  }

  const counterRef = doc(db, 'counters', 'pqrs')
  const fallbackYear = input.year ?? new Date().getFullYear()
  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pqrsRef = doc(collection(db, 'pqrs'))
    let observedSeq: number | null = null

    try {
      const ticketNumber = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef)
        let year: number
        let nextSequence: number

        if (!counterSnap.exists()) {
          observedSeq = 0
          year = fallbackYear
          nextSequence = 1
          tx.set(counterRef, { year, sequence: nextSequence })
        } else {
          const currentYear = counterSnap.get('year') as number
          const currentSeq = counterSnap.get('sequence') as number
          observedSeq = currentSeq
          if (fallbackYear > currentYear) {
            year = fallbackYear
            nextSequence = 1
          } else {
            year = currentYear
            nextSequence = currentSeq + 1
          }
          tx.update(counterRef, { year, sequence: nextSequence })
        }

        const generatedTicket = formatPqrsTicket(year, nextSequence)
        tx.set(pqrsRef, {
          ticketNumber: generatedTicket,
          apartmentId,
          residentId,
          category: input.category,
          subject,
          description,
          status: 'Radicada',
          createdAt: serverTimestamp(),
        })

        return generatedTicket
      })

      return { id: pqrsRef.id, ticketNumber }
    } catch (err) {
      const code = (err as { code?: string }).code
      // En Firestore, si dos transacciones leen el mismo sequence y una gana,
      // las reglas rechazan la segunda (sequence + 1 ya no coincide) antes del
      // conflicto ABORTED. Reintentamos solo si realmente hubo carrera en el contador.
      if ((code === 'permission-denied' || code === 'aborted') && observedSeq !== null && attempt < maxAttempts) {
        continue
      }
      throw err
    }
  }

  throw new BusinessRuleError('aborted', 'No se pudo asignar un radicado único tras varios intentos concurrentes.')
}

// ---------- SCRUM-35: ciclo de vida e historial inmutable (RN-B6) ----------

/**
 * Transiciona el estado de un PQRS (`Radicada` -> `En gestión` / `Resuelta`,
 * o `En gestión` -> `Resuelta`) y registra la entrada inmutable en `history`
 * dentro de la misma transacción.
 */
export async function transitionPqrsStatus(
  db: Firestore,
  adminUid: string,
  input: TransitionPqrsInput,
): Promise<void> {
  const uid = requireNonEmpty(adminUid, 'Administrador')
  const pqrsId = requireNonEmpty(input.pqrsId, 'PQRS')
  const { newStatus } = input

  if (newStatus !== 'En gestión' && newStatus !== 'Resuelta') {
    throw new BusinessRuleError('invalid-argument', 'Estado destino no válido para PQRS.')
  }

  const officialResponse = input.officialResponse?.trim() ?? ''
  if (newStatus === 'Resuelta' && officialResponse.length < 10) {
    throw new BusinessRuleError(
      'invalid-argument',
      'Para resolver una PQRS la respuesta oficial es obligatoria y debe tener mínimo 10 caracteres (RN-B6).',
    )
  }

  const pqrsRef = doc(db, 'pqrs', pqrsId)
  const historyRef = doc(collection(db, 'pqrs', pqrsId, 'history'))

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pqrsRef)
    if (!snap.exists()) {
      throw new BusinessRuleError('not-found', 'La PQRS no existe.')
    }
    const previousStatus = snap.get('status') as PqrsStatus

    if (previousStatus === 'Resuelta') {
      throw new BusinessRuleError('failed-precondition', 'Una PQRS resuelta no puede cambiar de estado.')
    }
    if (newStatus === 'En gestión' && previousStatus !== 'Radicada') {
      throw new BusinessRuleError(
        'failed-precondition',
        'Solo una PQRS en estado Radicada puede pasar a En gestión.',
      )
    }

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    }
    if (newStatus === 'Resuelta') {
      updatePayload.officialResponse = officialResponse
      updatePayload.resolvedAt = serverTimestamp()
      updatePayload.resolvedBy = uid
    }

    tx.update(pqrsRef, updatePayload)
    tx.set(historyRef, {
      previousStatus,
      newStatus,
      changedBy: uid,
      changedAt: serverTimestamp(),
      comment: input.comment?.trim() || (newStatus === 'Resuelta' ? officialResponse : 'PQRS tomada en gestión'),
    })
  })
}

// ---------- Suscripciones en tiempo real ----------

function toPqrsList(docs: { id: string; data: (o?: object) => unknown }[]): PqrsTicket[] {
  return docs
    .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as PqrsTicket)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

/** Residente: PQRS de su apartamento (el filtro por apartmentId es exigido por firestore.rules). */
export function subscribeToApartmentPqrs(
  db: Firestore,
  apartmentId: string,
  onChange: (items: PqrsTicket[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'pqrs'), where('apartmentId', '==', apartmentId))
  return onSnapshot(q, (snap) => onChange(toPqrsList(snap.docs)), onError)
}

/** Administración: todas las PQRS del conjunto. */
export function subscribeToAllPqrs(
  db: Firestore,
  onChange: (items: PqrsTicket[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'pqrs'), (snap) => onChange(toPqrsList(snap.docs)), onError)
}

/** Línea de tiempo inmutable de una PQRS ordenada cronológicamente. */
export function subscribeToPqrsHistory(
  db: Firestore,
  pqrsId: string,
  onChange: (entries: PqrsHistoryEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'pqrs', pqrsId, 'history'), orderBy('changedAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as PqrsHistoryEntry,
        ),
      )
    },
    onError,
  )
}
