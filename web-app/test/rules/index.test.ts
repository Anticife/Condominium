// SCRUM-46: auditoría integral de firestore.rules y matriz de seguridad por rol (RN-B1 a RN-B7).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonDb, createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe('firestore.rules static audit (SCRUM-46)', () => {
  const rulesSource = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8')

  it('no contiene reglas abiertas ni basadas en fechas temporales', () => {
    expect(rulesSource).not.toMatch(/allow\s+read,\s*write\s*:\s*if\s+true/)
    expect(rulesSource).not.toMatch(/request\.time\s*<\s*timestamp\.date/)
  })

  it('declara cierre explícito por defecto para colecciones no autorizadas', () => {
    expect(rulesSource).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/)
  })

  it('cubre todas las colecciones del dominio', () => {
    for (const col of [
      'match /users/{userId}',
      'match /towers/{towerId}',
      'match /apartments/{apartmentId}',
      'match /authorized/{authId}',
      'match /packages/{packageId}',
      'match /reservations/{reservationId}',
      'match /reservationSlots/{slotId}',
      'match /reservationQuotas/{quotaId}',
      'match /counters/pqrs',
      'match /pqrs/{pqrsId}',
      'match /history/{historyId}',
    ]) {
      expect(rulesSource).toContain(col)
    }
  })
})

describe.skipIf(!hasEmulator)('firestore.rules end-to-end security matrix (SCRUM-46)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('deniega lectura y escritura a cualquier colección desconocida incluso para administradora', async () => {
    for (const db of [
      dbAs(env, UIDS.admin),
      dbAs(env, UIDS.portero),
      dbAs(env, UIDS.res101),
      anonDb(env),
    ]) {
      await assertFails(getDoc(doc(db, 'coleccion_no_autorizada/doc1')))
      await assertFails(setDoc(doc(db, 'coleccion_no_autorizada/doc1'), { hack: true }))
    }
  })

  it('usuario anónimo no puede leer ni escribir en ninguna colección del sistema (RN-B7)', async () => {
    const anon = anonDb(env)
    await assertFails(getDoc(doc(anon, 'towers/T1')))
    await assertFails(getDoc(doc(anon, 'apartments/T1-101')))
    await assertFails(getDoc(doc(anon, `users/${UIDS.res101}`)))
    await assertFails(getDoc(doc(anon, 'counters/pqrs')))
    await assertFails(setDoc(doc(anon, 'towers/T9'), { id: 'T9', name: 'Torre 9', totalApartments: 10 }))
  })

  it('usuario desactivado pierde todos sus privilegios aunque tenga rol administradora', async () => {
    const inactiveDb = dbAs(env, UIDS.inactive)
    await assertFails(setDoc(doc(inactiveDb, 'towers/T9'), { id: 'T9', name: 'Torre 9', totalApartments: 10 }))
    await assertFails(getDoc(doc(inactiveDb, 'apartments/T1-101')))
    await assertFails(getDoc(doc(inactiveDb, `users/${UIDS.res101}`)))
  })

  it('ningún rol puede eliminar usuarios, paquetes, reservas, contadores ni PQRS', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'counters/pqrs'), { year: 2026, sequence: 1 })
      await setDoc(doc(db, 'pqrs/p-del'), {
        ticketNumber: 'PQ-2026-0001', apartmentId: 'T1-101', residentId: UIDS.res101,
        category: 'Queja', subject: 'Test', description: 'Test desc', status: 'Radicada',
        createdAt: serverTimestamp(),
      })
    })

    const adminDb = dbAs(env, UIDS.admin)
    await assertFails(deleteDoc(doc(adminDb, `users/${UIDS.res101}`)))
    await assertFails(deleteDoc(doc(adminDb, 'counters/pqrs')))
    await assertFails(deleteDoc(doc(adminDb, 'pqrs/p-del')))
  })

  it('permite operaciones legítimas de lectura según matriz de roles', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, UIDS.admin), 'apartments/T1-101')))
    await assertSucceeds(getDoc(doc(dbAs(env, UIDS.portero), 'apartments/T1-101')))
    await assertSucceeds(getDoc(doc(dbAs(env, UIDS.res101), 'apartments/T1-101')))
    await assertFails(getDoc(doc(dbAs(env, UIDS.res101), 'apartments/T1-102')))
    await assertSucceeds(updateDoc(doc(dbAs(env, UIDS.res101), `users/${UIDS.res101}`), { phone: '3009998888' }))
  })
})
