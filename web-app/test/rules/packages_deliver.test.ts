// SCRUM-21: entrega de paquetes (RN-B4) e inmutabilidad posterior.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deliverPackageTransaction, registerIncomingPackage } from '../../src/services/packageService'
import { createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('packages_deliver (SCRUM-21)', () => {
  let env: RulesTestEnvironment
  let packageId: string
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => {
    await seed(env)
    packageId = await registerIncomingPackage(dbAs(env, UIDS.portero), UIDS.portero, {
      apartmentId: 'T1-101', courier: 'Servientrega', recipientName: 'Carlos Mejía',
    })
  })

  it('entrega al residente del apartamento', async () => {
    const db = dbAs(env, UIDS.portero)
    await assertSucceeds(deliverPackageTransaction(db, UIDS.portero, packageId, '1001'))
    const pkg = (await getDoc(doc(db, 'packages', packageId))).data()
    expect(pkg).toMatchObject({ status: 'Entregado', deliveredToPerson: 'Carlos Mejía', deliveredByPorteroId: UIDS.portero })
  })

  it('entrega a una persona autorizada', async () => {
    await assertSucceeds(deliverPackageTransaction(dbAs(env, UIDS.portero), UIDS.portero, packageId, '2002', 'Retira la mamá'))
  })

  it('rechaza a quien no es residente ni autorizado (RN-B4)', async () => {
    await expect(deliverPackageTransaction(dbAs(env, UIDS.portero), UIDS.portero, packageId, '4004'))
      .rejects.toThrow(/no es residente/)
    await expect(deliverPackageTransaction(dbAs(env, UIDS.portero), UIDS.portero, packageId, '3003'))
      .rejects.toThrow(/no es residente/)
  })

  it('la regla rechaza una entrega directa a alguien no autorizado', async () => {
    const db = dbAs(env, UIDS.portero)
    const base = { status: 'Entregado', deliveredAt: serverTimestamp(), deliveredByPorteroId: UIDS.portero }
    // Residente de otro apartamento.
    await assertFails(updateDoc(doc(db, 'packages', packageId), {
      ...base, deliveredToAuthId: UIDS.res102, deliveredToPerson: 'Ana Lucía Torres', deliveredToDocument: '4004',
    }))
    // Autorización inactiva.
    await assertFails(updateDoc(doc(db, 'packages', packageId), {
      ...base, deliveredToAuthId: 'exempleada', deliveredToPerson: 'Luz Pérez', deliveredToDocument: '3003',
    }))
    // Documento que no coincide.
    await assertFails(updateDoc(doc(db, 'packages', packageId), {
      ...base, deliveredToAuthId: 'mama101', deliveredToPerson: 'Rosa Mejía', deliveredToDocument: '9999',
    }))
  })

  it('un paquete entregado queda sellado', async () => {
    const db = dbAs(env, UIDS.portero)
    await deliverPackageTransaction(db, UIDS.portero, packageId, '1001')
    await expect(deliverPackageTransaction(db, UIDS.portero, packageId, '2002')).rejects.toThrow(/ya fue entregado/)
    await assertFails(updateDoc(doc(db, 'packages', packageId), { status: 'Pendiente' }))
    await assertFails(updateDoc(doc(dbAs(env, UIDS.admin), 'packages', packageId), { recipientName: 'Otro' }))
  })

  it('un residente no puede marcar sus paquetes como entregados', async () => {
    await assertFails(updateDoc(doc(dbAs(env, UIDS.res101), 'packages', packageId), {
      status: 'Entregado', deliveredAt: serverTimestamp(), deliveredByPorteroId: UIDS.res101,
      deliveredToAuthId: UIDS.res101, deliveredToPerson: 'Carlos Mejía', deliveredToDocument: '1001',
    }))
  })
})
