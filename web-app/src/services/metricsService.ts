/**
 * Servicio de analítica, agregaciones e indicadores mensuales — Multi-Tenant (SCRUM-39, RF-18, RN-B5).
 */
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore'
import { BusinessRuleError } from './errors'
import type { Package } from './packageService'
import type { PqrsCategory, PqrsStatus, PqrsTicket } from './pqrsService'
import type { Reservation, ReservationStatus } from './reservationService'
import type { CommonArea } from './reservationSlots'

export const OVERDUE_PACKAGE_DAYS = 15

export interface MonthlyPackageMetrics {
  month: number
  year: number
  receivedCount: number
  deliveredCount: number
  pendingCount: number
  overdueCount: number
  averagePickupHours: number
}

export interface OverduePackageItem {
  id: string
  apartmentId: string
  towerId: string
  recipientName: string
  courier: string
  receivedAt: Date
  daysPending: number
  hoursPending: number
}

export interface ReservationStats {
  month: number
  year: number
  total: number
  byStatus: Record<ReservationStatus, number>
  byArea: Record<CommonArea, number>
  mostRequestedArea: CommonArea | null
}

export interface PqrsResolutionStats {
  total: number
  byStatus: Record<PqrsStatus, number>
  byCategory: Record<PqrsCategory, number>
  averageResolutionHours: number
}

function validateMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BusinessRuleError('invalid-argument', 'El mes debe ser un entero entre 1 y 12.')
  }
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new BusinessRuleError('invalid-argument', 'El año no es válido.')
  }
}

function monthUtcRange(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, 5, 0, 0, 0))
  return { start, end }
}

function monthDatePrefix(month: number, year: number): { startDate: string; endDate: string } {
  const mm = String(month).padStart(2, '0')
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-31`,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getOverduePackages(
  db: Firestore,
  condoId: string,
  now: Date = new Date(),
  thresholdDays: number = OVERDUE_PACKAGE_DAYS,
): Promise<OverduePackageItem[]> {
  const cutoffMs = now.getTime() - thresholdDays * 86_400_000
  const cutoffTs = Timestamp.fromMillis(cutoffMs)

  const q = query(
    collection(db, 'condominiums', condoId, 'packages'),
    where('status', '==', 'Pendiente'),
    where('receivedAt', '<=', cutoffTs),
  )

  const snap = await getDocs(q)
  return snap.docs
    .map((d) => {
      const data = d.data() as Omit<Package, 'id'>
      const receivedDate = data.receivedAt?.toDate() ?? new Date(0)
      const hoursPending = Math.max(0, (now.getTime() - receivedDate.getTime()) / 3_600_000)
      return {
        id: d.id,
        apartmentId: data.apartmentId,
        towerId: data.towerId,
        recipientName: data.recipientName,
        courier: data.courier,
        receivedAt: receivedDate,
        hoursPending: round2(hoursPending),
        daysPending: Math.floor(hoursPending / 24),
      }
    })
    .sort((a, b) => b.hoursPending - a.hoursPending)
}

export async function getMonthlyPackageMetrics(
  db: Firestore,
  condoId: string,
  month: number,
  year: number,
  now: Date = new Date(),
): Promise<MonthlyPackageMetrics> {
  validateMonthYear(month, year)
  const { start, end } = monthUtcRange(month, year)
  const startTs = Timestamp.fromDate(start)
  const endTs = Timestamp.fromDate(end)
  const pkgsCol = collection(db, 'condominiums', condoId, 'packages')

  const receivedInMonthQ = query(
    pkgsCol,
    where('receivedAt', '>=', startTs),
    where('receivedAt', '<', endTs),
  )
  const deliveredInMonthQ = query(
    pkgsCol,
    where('deliveredAt', '>=', startTs),
    where('deliveredAt', '<', endTs),
  )
  const pendingCountQ = query(pkgsCol, where('status', '==', 'Pendiente'))
  const overdueCutoffTs = Timestamp.fromMillis(now.getTime() - OVERDUE_PACKAGE_DAYS * 86_400_000)
  const overdueCountQ = query(
    pkgsCol,
    where('status', '==', 'Pendiente'),
    where('receivedAt', '<=', overdueCutoffTs),
  )

  const [receivedAgg, pendingAgg, overdueAgg, deliveredSnap] = await Promise.all([
    getCountFromServer(receivedInMonthQ),
    getCountFromServer(pendingCountQ),
    getCountFromServer(overdueCountQ),
    getDocs(deliveredInMonthQ),
  ])

  let totalPickupHours = 0
  let validDeliveries = 0
  for (const d of deliveredSnap.docs) {
    const data = d.data() as Omit<Package, 'id'>
    if (data.receivedAt && data.deliveredAt) {
      const diffHours = Math.max(0, (data.deliveredAt.toMillis() - data.receivedAt.toMillis()) / 3_600_000)
      totalPickupHours += diffHours
      validDeliveries += 1
    }
  }

  return {
    month,
    year,
    receivedCount: receivedAgg.data().count,
    deliveredCount: deliveredSnap.size,
    pendingCount: pendingAgg.data().count,
    overdueCount: overdueAgg.data().count,
    averagePickupHours: validDeliveries > 0 ? round2(totalPickupHours / validDeliveries) : 0,
  }
}

export async function getReservationStats(
  db: Firestore,
  condoId: string,
  month: number,
  year: number,
): Promise<ReservationStats> {
  validateMonthYear(month, year)
  const { startDate, endDate } = monthDatePrefix(month, year)

  const q = query(
    collection(db, 'condominiums', condoId, 'reservations'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  )
  const snap = await getDocs(q)

  const byStatus: Record<ReservationStatus, number> = {
    Pendiente: 0,
    Aprobada: 0,
    Rechazada: 0,
  }
  const byArea: Record<CommonArea, number> = {
    salon_social: 0,
    bbq: 0,
  }

  for (const d of snap.docs) {
    const data = d.data() as Omit<Reservation, 'id'>
    if (data.status in byStatus) byStatus[data.status] += 1
    if (data.commonArea in byArea) byArea[data.commonArea] += 1
  }

  let mostRequestedArea: CommonArea | null = null
  if (snap.size > 0) {
    mostRequestedArea = byArea.salon_social >= byArea.bbq ? 'salon_social' : 'bbq'
  }

  return {
    month,
    year,
    total: snap.size,
    byStatus,
    byArea,
    mostRequestedArea,
  }
}

export async function getPqrsResolutionStats(
  db: Firestore,
  condoId: string,
  month?: number,
  year?: number,
): Promise<PqrsResolutionStats> {
  const pqrsCol = collection(db, 'condominiums', condoId, 'pqrs')
  let q = query(pqrsCol)

  if (month !== undefined || year !== undefined) {
    if (month === undefined || year === undefined) {
      throw new BusinessRuleError('invalid-argument', 'Debe indicar mes y año juntos para filtrar PQRS.')
    }
    validateMonthYear(month, year)
    const { start, end } = monthUtcRange(month, year)
    q = query(
      pqrsCol,
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
    )
  }

  const snap = await getDocs(q)

  const byStatus: Record<PqrsStatus, number> = {
    Radicada: 0,
    'En gestión': 0,
    Resuelta: 0,
  }
  const byCategory: Record<PqrsCategory, number> = {
    Peticion: 0,
    Queja: 0,
    Reclamo: 0,
    Sugerencia: 0,
  }

  let totalResolutionHours = 0
  let resolvedWithTimestamps = 0

  for (const d of snap.docs) {
    const data = d.data() as Omit<PqrsTicket, 'id'>
    if (data.status in byStatus) byStatus[data.status] += 1
    if (data.category in byCategory) byCategory[data.category] += 1
    if (data.status === 'Resuelta' && data.createdAt) {
      const endTs = data.resolvedAt ?? data.updatedAt
      if (endTs) {
        const diffHours = Math.max(0, (endTs.toMillis() - data.createdAt.toMillis()) / 3_600_000)
        totalResolutionHours += diffHours
        resolvedWithTimestamps += 1
      }
    }
  }

  return {
    total: snap.size,
    byStatus,
    byCategory,
    averageResolutionHours:
      resolvedWithTimestamps > 0 ? round2(totalResolutionHours / resolvedWithTimestamps) : 0,
  }
}
