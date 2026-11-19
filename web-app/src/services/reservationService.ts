/**
 * Solicitud y resolución de reservas de zonas comunes — Multi-Tenant (SCRUM-24, SCRUM-28).
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
  date: string
  slot: SlotId
}

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

export async function requestReservation(
  db: Firestore,
  condoId: string,
  req: ReservationRequest,
): Promise<string> {
  const { start, end } = validateReservationRequest(req)

  const lockRef = doc(db, 'condominiums', condoId, 'reservationSlots', slotLockId(req.commonArea, req.date, req.slot))
  const quotaRef = doc(db, 'condominiums', condoId, 'reservationQuotas', quotaId(req.apartmentId, req.date))

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

  const reservationRef = doc(collection(db, 'condominiums', condoId, 'reservations'))
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

export function subscribeToApartmentReservations(
  db: Firestore,
  condoId: string,
  apartmentId: string,
  onChange: (reservations: Reservation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'condominiums', condoId, 'reservations'),
    where('apartmentId', '==', apartmentId),
  )
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Reservation)
      .sort((a, b) => (b.startTime?.toMillis?.() ?? 0) - (a.startTime?.toMillis?.() ?? 0))
    onChange(items)
  }, onError)
}

export function subscribeToAllReservations(
  db: Firestore,
  condoId: string,
  onChange: (reservations: Reservation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'condominiums', condoId, 'reservations'), (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as object) }) as Reservation)
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    onChange(items)
  }, onError)
}

export async function getTakenSlots(
  db: Firestore,
  condoId: string,
  commonArea: CommonArea,
  date: string,
): Promise<SlotId[]> {
  const snap = await getDocs(query(
    collection(db, 'condominiums', condoId, 'reservationSlots'),
    where('commonArea', '==', commonArea),
    where('date', '==', date),
  ))
  return snap.docs.map((d) => d.get('slot') as SlotId)
}

export async function approveReservation(
  db: Firestore,
  condoId: string,
  adminUid: string,
  reservationId: string,
): Promise<void> {
  const uid = requireNonEmpty(adminUid, 'Administrador')
  const resId = requireNonEmpty(reservationId, 'Reserva')
  const resRef = doc(db, 'condominiums', condoId, 'reservations', resId)
  const snap = await getDoc(resRef)

  if (!snap.exists()) {
    throw new BusinessRuleError('not-found', 'La solicitud de reserva no existe.')
  }
  const data = snap.data() as Omit<Reservation, 'id'>
  if (data.status !== 'Pendiente') {
    throw new BusinessRuleError('failed-precondition', 'Solo se pueden aprobar reservas en estado Pendiente.')
  }

  const lockRef = doc(db, 'condominiums', condoId, 'reservationSlots', slotLockId(data.commonArea, data.date, data.slot))
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

export async function rejectReservation(
  db: Firestore,
  condoId: string,
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

  const resRef = doc(db, 'condominiums', condoId, 'reservations', resId)
  const snap = await getDoc(resRef)
  if (!snap.exists()) {
    throw new BusinessRuleError('not-found', 'La solicitud de reserva no existe.')
  }
  const data = snap.data() as Omit<Reservation, 'id'>
  if (data.status !== 'Pendiente') {
    throw new BusinessRuleError('failed-precondition', 'Solo se pueden rechazar reservas en estado Pendiente.')
  }

  const qRef = doc(db, 'condominiums', condoId, 'reservationQuotas', quotaId(data.apartmentId, data.date))
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
