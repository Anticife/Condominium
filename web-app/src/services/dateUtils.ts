import type { Timestamp } from 'firebase/firestore'

export type TimestampLike = Timestamp | { seconds: number; nanoseconds?: number } | Date | string | number | null | undefined

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  const d = new Date(value as string | number)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateTimeCO(value: TimestampLike): string {
  const d = toDate(value)
  if (!d) return 'Pendiente de sincronización'
  return d.toLocaleString('es-CO')
}

export function formatDateCO(value: TimestampLike): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('es-CO')
}

export function formatTimeCO(value: TimestampLike): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function getElapsedHours(value: TimestampLike, nowMs: number): number {
  const d = toDate(value)
  if (!d) return 0
  return Math.max(0, Math.floor((nowMs - d.getTime()) / (1000 * 60 * 60)))
}
