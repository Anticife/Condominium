/**
 * Franjas de zonas comunes y cálculo de horarios (SCRUM-24).
 * Debe coincidir con la función slots() de firestore.rules.
 */

export type CommonArea = 'salon_social' | 'bbq'
export type SlotId = 'AM' | 'PM'

/** [hora inicio, hora fin] en hora local de Colombia. */
export const SLOTS: Record<CommonArea, Record<SlotId, [number, number]>> = {
  salon_social: { AM: [8, 14], PM: [15, 22] },
  bbq: { AM: [10, 16], PM: [17, 22] },
}

export const AREA_LABELS: Record<CommonArea, string> = {
  salon_social: 'Salón social',
  bbq: 'Zona BBQ',
}

/** Colombia es UTC-5 todo el año (sin horario de verano). */
const COLOMBIA_UTC_OFFSET_HOURS = 5
export const MIN_NOTICE_HOURS = 48

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCommonArea(value: unknown): value is CommonArea {
  return value === 'salon_social' || value === 'bbq'
}

export function isSlotId(value: unknown): value is SlotId {
  return value === 'AM' || value === 'PM'
}

/** Inicio y fin (instantes UTC) de una franja en la fecha local `date`. */
export function slotTimes(area: CommonArea, date: string, slot: SlotId): { start: Date; end: Date } {
  const match = DATE_RE.exec(date)
  if (!match) throw new Error(`Fecha inválida: ${date}`)
  const [, y, m, d] = match.map(Number)
  // Rechaza fechas imposibles como 2026-02-31.
  const day = new Date(Date.UTC(y, m - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) {
    throw new Error(`Fecha inválida: ${date}`)
  }
  const [startHour, endHour] = SLOTS[area][slot]
  const at = (hour: number) => new Date(Date.UTC(y, m - 1, d, hour + COLOMBIA_UTC_OFFSET_HOURS))
  return { start: at(startHour), end: at(endHour) }
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function slotLockId(area: CommonArea, date: string, slot: SlotId): string {
  return `${area}_${date}_${slot}`
}

export function quotaId(apartmentId: string, date: string): string {
  return `${apartmentId}_${monthOf(date)}`
}

/** RN-B2: la franja debe empezar al menos 48 h después de `now`. */
export function hasMinimumNotice(start: Date, now: Date = new Date()): boolean {
  return start.getTime() - now.getTime() >= MIN_NOTICE_HOURS * 60 * 60 * 1000
}
