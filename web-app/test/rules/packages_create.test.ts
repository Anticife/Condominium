// SCRUM-14: registro de paquetes en portería (Multi-Tenant).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { registerIncomingPackage } from '../../src/services/packageService'
import { CONDO_A, createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

const valid = {
  courier: 'Servientrega', towerId: 'T1', apartmentId: 'T1-101', recipientName: 'Carlos Mejía',
}
const pkgsPath = `condominiums/${CONDO_A}/packages`

describe.skipIf(!hasEmulator)('packages_create (SCRUM-14)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('el portero registra un paquete pendiente', async () => {
    await assertSucceeds(registerIncomingPackage(dbAs(env, UIDS.portero), CONDO_A, UIDS.portero, {
      apartmentId: 'T1-101', courier: 'Servientrega', recipientName: 'Carlos Mejía', trackingNumber: 'SV-1',
    }))
  })

  it('un residente no puede registrar paquetes', async () => {
    const db = dbAs(env, UIDS.res101)
    await assertFails(addDoc(collection(db, pkgsPath), {
      ...valid, status: 'Pendiente', receivedByPorteroId: UIDS.res101, receivedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }))
  })

  it('no se puede crear un paquete ya entregado', async () => {
    const db = dbAs(env, UIDS.portero)
    await assertFails(addDoc(collection(db, pkgsPath), {
      ...valid, status: 'Entregado', receivedByPorteroId: UIDS.portero, receivedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }))
  })

  it('no se aceptan fechas puestas por el cliente', async () => {
    const db = dbAs(env, UIDS.portero)
    const fake = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'))
    await assertFails(addDoc(collection(db, pkgsPath), {
      ...valid, status: 'Pendiente', receivedByPorteroId: UIDS.portero, receivedAt: fake, createdAt: serverTimestamp(),
    }))
  })

  it('el portero no puede registrar a nombre de otro portero', async () => {
    const db = dbAs(env, UIDS.portero)
    await assertFails(addDoc(collection(db, pkgsPath), {
      ...valid, status: 'Pendiente', receivedByPorteroId: 'otro', receivedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }))
  })

  it('solo acepta apartamentos existentes y de la torre indicada', async () => {
    const db = dbAs(env, UIDS.portero)
    await expect(registerIncomingPackage(db, CONDO_A, UIDS.portero, {
      apartmentId: 'T1-999', courier: 'X', recipientName: 'Y',
    })).rejects.toThrow(/no existe/)
    await assertFails(addDoc(collection(db, pkgsPath), {
      ...valid, towerId: 'T2', status: 'Pendiente', receivedByPorteroId: UIDS.portero, receivedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }))
  })
})
