// Multi-Tenancy: aislamiento estricto entre conjuntos, creación autoservicio y códigos de invitación.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createCondominium, joinCondominiumByCode } from '../../src/services/condominiumService'
import { registerIncomingPackage } from '../../src/services/packageService'
import { filePqrsTransaction } from '../../src/services/pqrsService'
import { CONDO_A, CONDO_B, createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('multi_tenancy_isolation', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('un usuario sin conjunto crea su propio conjunto autoservicio y queda como administradora', async () => {
    const creatorDb = dbAs(env, UIDS.unassignedCreator)
    const created = await createCondominium(creatorDb, UIDS.unassignedCreator, {
      name: 'Reserva del Pinar P.H.',
      nit: '901.555.000-9',
      city: 'Cali',
      address: 'Av. 6N # 24-10',
      joinCode: 'PINAR-2026',
    })

    expect(created.joinCode).toBe('PINAR-2026')
    const userSnap = await getDoc(doc(creatorDb, 'users', UIDS.unassignedCreator))
    expect(userSnap.get('condominiumId')).toBe(created.id)
    expect(userSnap.get('role')).toBe('administradora')

    // Un segundo usuario sin conjunto se une mediante el código de invitación (siempre como residente)
    const joinerDb = dbAs(env, UIDS.unassignedJoiner)
    const joined = await joinCondominiumByCode(joinerDb, UIDS.unassignedJoiner, 'PINAR-2026')
    expect(joined.condominiumId).toBe(created.id)
    const joinerSnap = await getDoc(doc(joinerDb, 'users', UIDS.unassignedJoiner))
    expect(joinerSnap.get('condominiumId')).toBe(created.id)
    expect(joinerSnap.get('role')).toBe('residente')

    // Una vez vinculado, el residente NO puede cambiarse a otro conjunto
    await assertFails(updateDoc(doc(joinerDb, 'users', UIDS.unassignedJoiner), {
      condominiumId: CONDO_A,
      role: 'residente',
    }))
  })

  it('impide listar el catálogo completo de códigos de invitación (privacidad entre tenants)', async () => {
    await assertFails(getDocs(collection(dbAs(env, UIDS.res101), 'joinCodes')))
    await assertSucceeds(getDoc(doc(dbAs(env, UIDS.unassignedJoiner), 'joinCodes/ALFA-2026')))
  })

  it('aísla completamente los datos entre Conjunto A y Conjunto B incluso para administradoras', async () => {
    const adminA = dbAs(env, UIDS.admin)
    const porteroA = dbAs(env, UIDS.portero)
    const resA = dbAs(env, UIDS.res101)

    // Administradora de A no puede leer ni tocar Conjunto B, sus usuarios, torres ni apartamentos
    await assertFails(getDoc(doc(adminA, `condominiums/${CONDO_B}`)))
    await assertFails(getDoc(doc(adminA, `condominiums/${CONDO_B}/towers/T1`)))
    await assertFails(getDoc(doc(adminA, `condominiums/${CONDO_B}/apartments/T1-101`)))
    await assertFails(getDoc(doc(adminA, 'users', UIDS.resB101)))
    await assertFails(updateDoc(doc(adminA, 'users', UIDS.resB101), { isActive: false }))
    await assertFails(getDocs(query(collection(adminA, 'users'), where('condominiumId', '==', CONDO_B))))

    // Portero y residente de A no pueden registrar paquetes ni leer nada en B
    await assertFails(registerIncomingPackage(porteroA, CONDO_B, UIDS.portero, {
      apartmentId: 'T1-101', courier: 'DHL', recipientName: 'Intruso',
    }))
    await assertFails(getDoc(doc(resA, `condominiums/${CONDO_B}/apartments/T1-101`)))
  })

  it('permite consecutivos PQRS (PQ-2026-0001) y apartamentos T1-101 independientes por conjunto', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `condominiums/${CONDO_A}/counters/pqrs`), { year: 2026, sequence: 0 })
      await setDoc(doc(ctx.firestore(), `condominiums/${CONDO_B}/counters/pqrs`), { year: 2026, sequence: 0 })
    })

    const ticketA = await filePqrsTransaction(dbAs(env, UIDS.res101), CONDO_A, {
      apartmentId: 'T1-101', residentId: UIDS.res101, category: 'Queja',
      subject: 'Ruido Alfa', description: 'Detalle en conjunto Alfa', year: 2026,
    })
    const ticketB = await filePqrsTransaction(dbAs(env, UIDS.resB101), CONDO_B, {
      apartmentId: 'T1-101', residentId: UIDS.resB101, category: 'Peticion',
      subject: 'Luz Beta', description: 'Detalle en conjunto Beta', year: 2026,
    })

    expect(ticketA.ticketNumber).toBe('PQ-2026-0001')
    expect(ticketB.ticketNumber).toBe('PQ-2026-0001')
  })
})
