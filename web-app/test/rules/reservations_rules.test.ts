// SCRUM-24: solicitud de reservas (RN-B1, RN-B2, RN-B3).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { requestReservation } from '../../src/services/reservationService'
import { slotTimes } from '../../src/services/reservationSlots'
import { createEnv, dbAs, hasEmulator, localDatePlus, seed, UIDS } from './helpers'

const date = localDatePlus(5)
const sameMonthOther = localDatePlus(6)

function rawReservation(overrides: Record<string, unknown> = {}) {
  const { start, end } = slotTimes('salon_social', date, 'PM')
  return {
    commonArea: 'salon_social', apartmentId: 'T1-101', residentId: UIDS.res101,
    date, slot: 'PM', startTime: Timestamp.fromDate(start), endTime: Timestamp.fromDate(end),
    status: 'Pendiente', createdAt: serverTimestamp(), ...overrides,
  }
}

describe.skipIf(!hasEmulator)('reservations_rules (SCRUM-24)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('el residente solicita una franja libre', async () => {
    const db = dbAs(env, UIDS.res101)
    const id = await requestReservation(db, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date, slot: 'PM',
    })
    const snap = await getDoc(doc(db, 'reservations', id))
    expect(snap.get('status')).toBe('Pendiente')
  })

  it('rechaza con menos de 48 h de anticipación (RN-B2)', async () => {
    const db = dbAs(env, UIDS.res101)
    const tomorrow = localDatePlus(1)
    await expect(requestReservation(db, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'bbq', date: tomorrow, slot: 'PM',
    })).rejects.toThrow(/48 horas/)
    // Saltándose el servicio, la regla también lo bloquea.
    const { start, end } = slotTimes('bbq', tomorrow, 'PM')
    const batch = writeBatch(db)
    const ref = doc(db, 'reservations', 'r-corta')
    batch.set(ref, rawReservation({ commonArea: 'bbq', date: tomorrow, startTime: Timestamp.fromDate(start), endTime: Timestamp.fromDate(end) }))
    batch.set(doc(db, 'reservationQuotas', `T1-101_${tomorrow.slice(0, 7)}`), { apartmentId: 'T1-101', month: tomorrow.slice(0, 7), reservationId: 'r-corta' })
    await assertFails(batch.commit())
  })

  it('rechaza una segunda reserva del mismo apartamento en el mes (RN-B3)', async () => {
    const db = dbAs(env, UIDS.res101)
    await requestReservation(db, { residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date, slot: 'PM' })
    // Mismo mes salvo que localDatePlus(6) caiga en el mes siguiente.
    if (sameMonthOther.slice(0, 7) === date.slice(0, 7)) {
      await expect(requestReservation(db, {
        residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'bbq', date: sameMonthOther, slot: 'AM',
      })).rejects.toThrow(/RN-B3/)
    }
  })

  it('el cupo mensual no se puede saltar escribiendo directo', async () => {
    const db = dbAs(env, UIDS.res101)
    // Reserva sin cupo en el mismo batch.
    await assertFails(setDoc(doc(db, 'reservations', 'r1'), rawReservation()))
  })

  it('rechaza una franja ya aprobada (RN-B1)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `reservationSlots/salon_social_${date}_PM`), {
        reservationId: 'otra', commonArea: 'salon_social', date, slot: 'PM',
      })
    })
    const db = dbAs(env, UIDS.res102)
    await expect(requestReservation(db, {
      residentId: UIDS.res102, apartmentId: 'T1-102', commonArea: 'salon_social', date, slot: 'PM',
    })).rejects.toThrow(/RN-B1/)
  })

  it('no se puede reservar para otro apartamento ni a nombre de otro', async () => {
    const db = dbAs(env, UIDS.res101)
    await expect(requestReservation(db, {
      residentId: UIDS.res101, apartmentId: 'T1-102', commonArea: 'salon_social', date, slot: 'PM',
    })).rejects.toThrow()
    const batch = writeBatch(db)
    batch.set(doc(db, 'reservations', 'r2'), rawReservation({ residentId: UIDS.res102 }))
    batch.set(doc(db, 'reservationQuotas', `T1-101_${date.slice(0, 7)}`), { apartmentId: 'T1-101', month: date.slice(0, 7), reservationId: 'r2' })
    await assertFails(batch.commit())
  })

  it('rechaza horarios que no coinciden con la franja', async () => {
    const db = dbAs(env, UIDS.res101)
    const batch = writeBatch(db)
    const { start } = slotTimes('salon_social', date, 'PM')
    batch.set(doc(db, 'reservations', 'r3'), rawReservation({ endTime: Timestamp.fromDate(new Date(start.getTime() + 20 * 3_600_000)) }))
    batch.set(doc(db, 'reservationQuotas', `T1-101_${date.slice(0, 7)}`), { apartmentId: 'T1-101', month: date.slice(0, 7), reservationId: 'r3' })
    await assertFails(batch.commit())
  })

  it('toda reserva nueva entra en estado Pendiente', async () => {
    const db = dbAs(env, UIDS.res101)
    const batch = writeBatch(db)
    batch.set(doc(db, 'reservations', 'r4'), rawReservation({ status: 'Aprobada' }))
    batch.set(doc(db, 'reservationQuotas', `T1-101_${date.slice(0, 7)}`), { apartmentId: 'T1-101', month: date.slice(0, 7), reservationId: 'r4' })
    await assertFails(batch.commit())
  })

  it('el residente no ve reservas de otros apartamentos, pero sí la disponibilidad', async () => {
    await requestReservation(dbAs(env, UIDS.res101), {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date, slot: 'PM',
    })
    const other = dbAs(env, UIDS.res102)
    await assertSucceeds(getDoc(doc(other, `reservationSlots/salon_social_${date}_PM`)))
    await assertFails(getDoc(doc(other, `reservationQuotas/T1-101_${date.slice(0, 7)}`)))
  })
})
