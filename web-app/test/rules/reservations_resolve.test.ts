// SCRUM-28: resolución de reservas (Multi-Tenant).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  approveReservation,
  rejectReservation,
  requestReservation,
} from '../../src/services/reservationService'
import { quotaId, slotLockId } from '../../src/services/reservationSlots'
import { anonDb, CONDO_A, createEnv, dbAs, hasEmulator, localDatePlus, seed, UIDS } from './helpers'

const cPath = `condominiums/${CONDO_A}`
const targetDate = localDatePlus(5)
const otherDate = localDatePlus(6)

describe.skipIf(!hasEmulator)('reservations_resolve (SCRUM-28)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('la administradora aprueba una reserva pendiente y bloquea la franja (RN-B1)', async () => {
    const resId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date: targetDate, slot: 'PM',
    })

    const adminDb = dbAs(env, UIDS.admin)
    await approveReservation(adminDb, CONDO_A, UIDS.admin, resId)

    const snap = await getDoc(doc(adminDb, `${cPath}/reservations`, resId))
    expect(snap.get('status')).toBe('Aprobada')
    expect(snap.get('resolvedBy')).toBe(UIDS.admin)
    expect(snap.get('resolvedAt')).toBeTruthy()

    const lockSnap = await getDoc(doc(adminDb, `${cPath}/reservationSlots`, slotLockId('salon_social', targetDate, 'PM')))
    expect(lockSnap.exists()).toBe(true)
    expect(lockSnap.get('reservationId')).toBe(resId)
  })

  it('impide aprobar una segunda reserva en la misma zona, fecha y franja (RN-B1)', async () => {
    const r1 = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'bbq', date: targetDate, slot: 'AM',
    })
    const r2 = await requestReservation(dbAs(env, UIDS.res102), CONDO_A, {
      residentId: UIDS.res102, apartmentId: 'T1-102', commonArea: 'bbq', date: targetDate, slot: 'AM',
    })

    const adminDb = dbAs(env, UIDS.admin)
    await approveReservation(adminDb, CONDO_A, UIDS.admin, r1)
    await expect(approveReservation(adminDb, CONDO_A, UIDS.admin, r2)).rejects.toThrow(/RN-B1/)

    const batch = writeBatch(adminDb)
    batch.update(doc(adminDb, `${cPath}/reservations`, r2), {
      status: 'Aprobada',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    })
    batch.set(doc(adminDb, `${cPath}/reservationSlots`, slotLockId('bbq', targetDate, 'AM')), {
      reservationId: r2, commonArea: 'bbq', date: targetDate, slot: 'AM',
    })
    await assertFails(batch.commit())
  })

  it('la administradora rechaza con motivo >= 5 caracteres y libera el cupo mensual (RN-B3)', async () => {
    const resId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date: targetDate, slot: 'PM',
    })

    const adminDb = dbAs(env, UIDS.admin)
    await rejectReservation(adminDb, CONDO_A, UIDS.admin, resId, 'Mantenimiento programado de pintura')

    const snap = await getDoc(doc(adminDb, `${cPath}/reservations`, resId))
    expect(snap.get('status')).toBe('Rechazada')
    expect(snap.get('rejectionReason')).toBe('Mantenimiento programado de pintura')
    expect(snap.get('resolvedBy')).toBe(UIDS.admin)

    const qSnap = await getDoc(doc(adminDb, `${cPath}/reservationQuotas`, quotaId('T1-101', targetDate)))
    expect(qSnap.exists()).toBe(false)

    const retryId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'bbq', date: otherDate, slot: 'PM',
    })
    expect(retryId).toBeTruthy()
  })

  it('deniega rechazo sin motivo o con menos de 5 caracteres en servicio y en firestore.rules', async () => {
    const resId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date: targetDate, slot: 'PM',
    })
    const adminDb = dbAs(env, UIDS.admin)

    await expect(rejectReservation(adminDb, CONDO_A, UIDS.admin, resId, 'no')).rejects.toThrow(/5 caracteres/)
    await expect(rejectReservation(adminDb, CONDO_A, UIDS.admin, resId, '     ')).rejects.toThrow(/5 caracteres/)

    await assertFails(updateDoc(doc(adminDb, `${cPath}/reservations`, resId), {
      status: 'Rechazada',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
    await assertFails(updateDoc(doc(adminDb, `${cPath}/reservations`, resId), {
      status: 'Rechazada',
      rejectionReason: 'abc',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
    await assertFails(updateDoc(doc(adminDb, `${cPath}/reservations`, resId), {
      status: 'Rechazada',
      rejectionReason: '     ',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
  })

  it('deniega la resolución a usuarios no administradores (residente, portero, anónimo, inactivo)', async () => {
    const resId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date: targetDate, slot: 'PM',
    })

    for (const [uid, db] of [
      [UIDS.res101, dbAs(env, UIDS.res101)],
      [UIDS.portero, dbAs(env, UIDS.portero)],
      [UIDS.inactive, dbAs(env, UIDS.inactive)],
      ['anon', anonDb(env)],
    ] as const) {
      await assertFails(updateDoc(doc(db, `${cPath}/reservations`, resId), {
        status: 'Rechazada',
        rejectionReason: 'Intento no autorizado',
        resolvedAt: serverTimestamp(),
        resolvedBy: uid,
      }))
    }
  })

  it('impide alterar zona común, apartamento u horarios al resolver y re-resolver una reserva', async () => {
    const resId = await requestReservation(dbAs(env, UIDS.res101), CONDO_A, {
      residentId: UIDS.res101, apartmentId: 'T1-101', commonArea: 'salon_social', date: targetDate, slot: 'PM',
    })
    const adminDb = dbAs(env, UIDS.admin)

    await assertFails(updateDoc(doc(adminDb, `${cPath}/reservations`, resId), {
      status: 'Rechazada',
      rejectionReason: 'Motivo suficientemente largo',
      commonArea: 'bbq',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))

    await assertSucceeds(rejectReservation(adminDb, CONDO_A, UIDS.admin, resId, 'Motivo suficientemente largo'))
    await assertFails(updateDoc(doc(adminDb, `${cPath}/reservations`, resId), {
      status: 'Rechazada',
      rejectionReason: 'Otro motivo distinto',
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
  })
})
