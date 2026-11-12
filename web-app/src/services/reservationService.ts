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
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { BusinessRuleError } from './errors'
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

/** Franjas ya aprobadas para una zona y fecha (para pintar el calendario). */
export async function getTakenSlots(db: Firestore, commonArea: CommonArea, date: string): Promise<SlotId[]> {
  const snap = await getDocs(query(
    collection(db, 'reservationSlots'),
    where('commonArea', '==', commonArea),
    where('date', '==', date),
  ))
  return snap.docs.map((d) => d.get('slot') as SlotId)
}

export { SLOTS }
