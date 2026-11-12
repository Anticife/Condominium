// SCRUM-17: lectura y suscripción en tiempo real de paquetes (RN-B7, RNF-11).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  registerIncomingPackage,
  subscribeToApartmentPackages,
  subscribeToPendingPackages,
  type Package,
} from '../../src/services/packageService'
import { createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

/** Espera el primer snapshot que cumpla `ready`. */
function firstSnapshot(
  subscribe: (cb: (p: Package[]) => void, onError: (e: Error) => void) => () => void,
  ready: (p: Package[]) => boolean = () => true,
): Promise<Package[]> {
  return new Promise((resolve, reject) => {
    const unsub = subscribe((p) => {
      if (ready(p)) { unsub(); resolve(p) }
    }, (e) => reject(e))
  })
}

describe.skipIf(!hasEmulator)('packages_read (SCRUM-17)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => {
    await seed(env)
    const portero = dbAs(env, UIDS.portero)
    await registerIncomingPackage(portero, UIDS.portero, { apartmentId: 'T1-101', courier: 'A', recipientName: 'Carlos' })
    await registerIncomingPackage(portero, UIDS.portero, { apartmentId: 'T1-102', courier: 'B', recipientName: 'Ana' })
  })

  it('el residente no puede listar paquetes de otros apartamentos', async () => {
    const db = dbAs(env, UIDS.res101)
    await assertFails(getDocs(collection(db, 'packages')))
    await assertFails(getDocs(query(collection(db, 'packages'), where('apartmentId', '==', 'T1-102'))))
    await assertSucceeds(getDocs(query(collection(db, 'packages'), where('apartmentId', '==', 'T1-101'))))
  })

  it('el residente recibe en vivo solo los paquetes de su apartamento', async () => {
    const db = dbAs(env, UIDS.res101)
    const pkgs = await firstSnapshot((cb, err) => subscribeToApartmentPackages(db, 'T1-101', cb, err))
    expect(pkgs).toHaveLength(1)
    expect(pkgs[0].apartmentId).toBe('T1-101')
  })

  it('un residente no puede suscribirse al apartamento ajeno', async () => {
    const db = dbAs(env, UIDS.res101)
    await expect(firstSnapshot((cb, err) => subscribeToApartmentPackages(db, 'T1-102', cb, err)))
      .rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('un turno ve lo que registra el otro sin recargar (RNF-11)', async () => {
    const db = dbAs(env, UIDS.portero)
    const pending = firstSnapshot((cb, err) => subscribeToPendingPackages(db, cb, err), (p) => p.length === 3)
    // Otro turno registra mientras la suscripción está abierta.
    await registerIncomingPackage(dbAs(env, UIDS.admin), UIDS.admin, { apartmentId: 'T1-101', courier: 'C', recipientName: 'Carlos' })
    expect(await pending).toHaveLength(3)
  })
})
