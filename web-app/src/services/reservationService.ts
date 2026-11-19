/**
 * Solicitud de reservas de zonas comunes (SCRUM-24).
 *
 * RN-B1: una franja aprobada se bloquea con reservationSlots/{area}_{fecha}_{franja}.
 * RN-B2: mínimo 48 h de anticipación (lo valida también firestore.rules).
 * RN-B3: una reserva por apartamento al mes, con reservationQuotas/{apto}_{YYYY-MM},
 *        que se crea en el mismo batch que la reserva.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { BusinessRuleError, requireNonEmpty } from './errors'
import {
  AREA_LABELS,
  hasMinimumNotice,
  isCommonArea,
  isSlotId,
  MIN_NOTICE_HOURS,
  monthOf,
  quotaId,
  SLOTS,
  slotLockId,
  slotTimes,
  type CommonArea,
  type SlotId,
} from './reservationSlots'

export type ReservationStatus = 'Pendiente' | 'Aprobada' | 'Rechazada'

export interface ReservationRequest {
  residentId: string
  apartmentId: string
  commonArea: CommonArea
  date: string // YYYY-MM-DD, hora local
  slot: SlotId
}

/** Validación local con mensajes claros (RNF-05), antes de ir a Firestore. */
export function validateReservationRequest(req: ReservationRequest, now: Date = new Date()) {
  if (!isCommonArea(req.commonArea)) {
    throw new BusinessRuleError('invalid-argument', 'Zona común no válida.')
  }
  if (!isSlotId(req.slot)) {
    throw new BusinessRuleError('invalid-argument', 'Franja no válida.')
  }
  let times: { start: Date; end: Date }
  try {
    times = slotTimes(req.commonArea, req.date, req.slot)
  } catch {
    throw new BusinessRuleError('invalid-argument', 'Fecha no válida.')
  }
  if (!hasMinimumNotice(times.start, now)) {
    throw new BusinessRuleError(
      'failed-precondition',
      `Las reservas se solicitan con mínimo ${MIN_NOTICE_HOURS} horas de anticipación (RN-B2).`,
    )
  }
  return times
}

/**
 * Crea la solicitud en estado 'Pendiente'. Devuelve el id de la reserva.
 * Las comprobaciones previas solo mejoran el mensaje de error: la garantía
 * real (incluso con dos solicitudes simultáneas) la dan las reglas.
 */
export async function requestReservation(db: Firestore, req: ReservationRequest): Promise<string> {
  const { start, end } = validateReservationRequest(req)

  const lockRef = doc(db, 'reservationSlots', slotLockId(req.commonArea, req.date, req.slot))
  const quotaRef = doc(db, 'reservationQuotas', quotaId(req.apartmentId, req.date))

  if ((await getDoc(lockRef)).exists()) {
    throw new BusinessRuleError(
      'already-exists',
      `${AREA_LABELS[req.commonArea]} ya está reservado en esa fecha y franja (RN-B1).`,
    )
  }
  if ((await getDoc(quotaRef)).exists()) {
    throw new BusinessRuleError(
      'resource-exhausted',
      'Su apartamento ya tiene una reserva este mes (RN-B3).',
    )
  }

  const reservationRef = doc(collection(db, 'reservations'))
  const batch = writeBatch(db)
  batch.set(reservationRef, {
    commonArea: req.commonArea,
    apartmentId: req.apartmentId,
    residentId: req.residentId,
    date: req.date,
    slot: req.slot,
    startTime: Timestamp.fromDate(start),
    endTime: Timestamp.fromDate(end),
    status: 'Pendiente',
    createdAt: serverTimestamp(),
  })
  batch.set(quotaRef, {
    apartmentId: req.apartmentId,
    month: monthOf(req.date),
    reservationId: reservationRef.id,
  })

  try {
    await batch.commit()
  } catch (err) {
    // Otra solicitud ganó la carrera por el mismo cupo mensual.
    if ((err as { code?: string }).code === 'permission-denied') {
      throw new BusinessRuleError(
        'failed-precondition',
        'No se pudo crear la reserva: revise que la franja esté libre y que su apartamento no tenga otra reserva este mes.',
      )
    }
    throw err
  }
  return reservationRef.id
}

export interface Reservation {
  id: string
  commonArea: CommonArea
  apartmentId: string
  residentId: string
  date: string
  slot: SlotId
  startTime: Timestamp | null
  endTime: Timestamp | null
  status: ReservationStatus
  createdAt: Timestamp | null
  rejectionReason?: string
  resolvedBy?: string
  resolvedAt?: Timestamp | null
}

/** Residente: reservas de su apartamento ordenadas de la más reciente a la más antigua. */
export function subscribeToApartmentReservations(
  db: Firestore,
  apartmentId: string,
  onChange: (reservations: Reservation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'reservations'),
    where('apartmentId', '==', apartmentId),
  )
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Reservation)
      .sort((a, b) => (b.startTime?.toMillis?.() ?? 0) - (a.startTime?.toMillis?.() ?? 0))
    onChange(items)
  }, onError)
}

/** Administración: todas las solicitudes de reserva en tiempo real. */
export function subscribeToAllReservations(
  db: Firestore,
  onChange: (reservations: Reservation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'reservations'), (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Reservation)
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    onChange(items)
  }, onError)
}

/** Franjas ya aprobadas para una zona y fecha (para pintar el calendario). */
export async function getTakenSlots(db: Firestore, commonArea: CommonArea, date: string): Promise<SlotId[]> {
  const snap = await getDocs(query(
    collection(db, 'reservationSlots'),
    where('commonArea', '==', commonArea),
    where('date', '==', date),
  ))
  return snap.docs.map((d) => d.get('slot') as SlotId)
}

// ---------- SCRUM-28: resolución por administración (CON-07) ----------

/**
 * Aprueba una reserva pendiente y bloquea la franja en el mismo batch atómico
 * (RN-B1: si otro administrador aprueba en paralelo la misma franja, uno falla).
 */
export async function approveReservation(
  db: Firestore,
  adminUid: string,
  reservationId: string,
): Promise<void> {
  const uid = requireNonEmpty(adminUid, 'Administrador')
  const resId = requireNonEmpty(reservationId, 'Reserva')
  const resRef = doc(db, 'reservations', resId)
  const snap = await getDoc(resRef)

  if (!snap.exists()) {
    throw new BusinessRuleError('not-found', 'La solicitud de reserva no existe.')
  }
  const data = snap.data() as Omit<Reservation, 'id'>
  if (data.status !== 'Pendiente') {
    throw new BusinessRuleError('failed-precondition', 'Solo se pueden aprobar reservas en estado Pendiente.')
  }

  const lockRef = doc(db, 'reservationSlots', slotLockId(data.commonArea, data.date, data.slot))
  if ((await getDoc(lockRef)).exists()) {
    throw new BusinessRuleError(
      'already-exists',
      `${AREA_LABELS[data.commonArea]} ya tiene una reserva aprobada en esa fecha y franja (RN-B1).`,
    )
  }

  const batch = writeBatch(db)
  batch.update(resRef, {
    status: 'Aprobada',
    resolvedAt: serverTimestamp(),
    resolvedBy: uid,
  })
  batch.set(lockRef, {
    reservationId: resId,
    commonArea: data.commonArea,
    date: data.date,
    slot: data.slot,
  })

  try {
    await batch.commit()
  } catch (err) {
    if ((err as { code?: string }).code === 'permission-denied') {
      throw new BusinessRuleError(
        'failed-precondition',
        'No se pudo aprobar la reserva: verifique permisos de administradora y que la franja siga disponible.',
      )
    }
    throw err
  }
}

/**
 * Rechaza una reserva pendiente exigiendo un motivo de al menos 5 caracteres
 * y libera el cupo mensual del apartamento (RN-B3) en el mismo batch.
 */
export async function rejectReservation(
  db: Firestore,
  adminUid: string,
  reservationId: string,
  rejectionReason: string,
): Promise<void> {
  const uid = requireNonEmpty(adminUid, 'Administrador')
  const resId = requireNonEmpty(reservationId, 'Reserva')
  const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : ''
  if (reason.length < 5) {
    throw new BusinessRuleError(
      'invalid-argument',
      'El motivo de rechazo es obligatorio y debe tener al menos 5 caracteres.',
    )
  }

  const resRef = doc(db, 'reservations', resId)
  const snap = await getDoc(resRef)
  if (!snap.exists()) {
    throw new BusinessRuleError('not-found', 'La solicitud de reserva no existe.')
  }
  const data = snap.data() as Omit<Reservation, 'id'>
  if (data.status !== 'Pendiente') {
    throw new BusinessRuleError('failed-precondition', 'Solo se pueden rechazar reservas en estado Pendiente.')
  }

  const qRef = doc(db, 'reservationQuotas', quotaId(data.apartmentId, data.date))
  const batch = writeBatch(db)
  batch.update(resRef, {
    status: 'Rechazada',
    rejectionReason: reason,
    resolvedAt: serverTimestamp(),
    resolvedBy: uid,
  })
  batch.delete(qRef)

  try {
    await batch.commit()
  } catch (err) {
    if ((err as { code?: string }).code === 'permission-denied') {
      throw new BusinessRuleError(
        'permission-denied',
        'No tiene permisos de administradora para rechazar reservas.',
      )
    }
    throw err
  }
}

export { SLOTS }
