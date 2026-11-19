// SCRUM-31: generador transaccional de radicado único PQRS (PQ-YYYY-XXXX) y reglas.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { filePqrsTransaction, formatPqrsTicket } from '../../src/services/pqrsService'
import { anonDb, createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('pqrs_create (SCRUM-31)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => {
    await seed(env)
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'counters/pqrs'), { year: 2026, sequence: 0 })
    })
  })

  it('radica PQRS con formato oficial PQ-YYYY-XXXX incrementando en +1', async () => {
    const db = dbAs(env, UIDS.res101)
    const first = await filePqrsTransaction(db, {
      apartmentId: 'T1-101',
      residentId: UIDS.res101,
      category: 'Queja',
      subject: 'Ruido en pasillo',
      description: 'Se escucha música fuerte después de las 11 PM.',
      year: 2026,
    })
    expect(first.ticketNumber).toBe('PQ-2026-0001')

    const second = await filePqrsTransaction(db, {
      apartmentId: 'T1-101',
      residentId: UIDS.res101,
      category: 'Peticion',
      subject: 'Luminaria dañada',
      description: 'Bombillo fundido en el piso 3 de la Torre 1.',
      year: 2026,
    })
    expect(second.ticketNumber).toBe('PQ-2026-0002')

    const snap = await getDoc(doc(db, 'pqrs', first.id))
    expect(snap.get('status')).toBe('Radicada')
    expect(snap.get('createdAt')).toBeTruthy()
  })

  it('soporta radicaciones concurrentes con tickets únicos consecutivos', async () => {
    const [a, b] = await Promise.all([
      filePqrsTransaction(dbAs(env, UIDS.res101), {
        apartmentId: 'T1-101',
        residentId: UIDS.res101,
        category: 'Reclamo',
        subject: 'Goteo en parqueadero',
        description: 'Filtración sobre el cupo 12.',
        year: 2026,
      }),
      filePqrsTransaction(dbAs(env, UIDS.res102), {
        apartmentId: 'T1-102',
        residentId: UIDS.res102,
        category: 'Sugerencia',
        subject: 'Biciestacionamiento',
        description: 'Ampliar ganchos en sótano 1.',
        year: 2026,
      }),
    ])

    const tickets = [a.ticketNumber, b.ticketNumber].sort()
    expect(tickets).toEqual(['PQ-2026-0001', 'PQ-2026-0002'])
    expect(formatPqrsTicket(2026, 42)).toBe('PQ-2026-0042')
  })

  it('protege counters/pqrs permitiendo únicamente incrementos exactos de +1', async () => {
    const resDb = dbAs(env, UIDS.res101)

    // +2 rechazado
    await assertFails(updateDoc(doc(resDb, 'counters/pqrs'), { year: 2026, sequence: 2 }))
    // 0 / decremento rechazado
    await assertFails(updateDoc(doc(resDb, 'counters/pqrs'), { year: 2026, sequence: 0 }))
    // Portero y anónimo no pueden tocar el contador
    await assertFails(updateDoc(doc(dbAs(env, UIDS.portero), 'counters/pqrs'), { year: 2026, sequence: 1 }))
    await assertFails(updateDoc(doc(anonDb(env), 'counters/pqrs'), { year: 2026, sequence: 1 }))
    // +1 válido permitido
    await assertSucceeds(updateDoc(doc(resDb, 'counters/pqrs'), { year: 2026, sequence: 1 }))
  })

  it('exige estado Radicada, timestamp del servidor, formato de ticket y apartamento propio', async () => {
    const resDb = dbAs(env, UIDS.res101)
    const base = {
      ticketNumber: 'PQ-2026-0001',
      apartmentId: 'T1-101',
      residentId: UIDS.res101,
      category: 'Queja',
      subject: 'Asunto válido',
      description: 'Descripción válida del incidente',
      status: 'Radicada',
      createdAt: serverTimestamp(),
    }

    // Estado inicial distinto a Radicada
    await assertFails(setDoc(doc(resDb, 'pqrs/p1'), { ...base, status: 'Resuelta' }))
    // Timestamp fabricado por el cliente
    await assertFails(setDoc(doc(resDb, 'pqrs/p2'), { ...base, createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')) }))
    // Apartamento ajeno
    await assertFails(setDoc(doc(resDb, 'pqrs/p3'), { ...base, apartmentId: 'T1-102' }))
    // Formato de radicado inválido
    await assertFails(setDoc(doc(resDb, 'pqrs/p4'), { ...base, ticketNumber: 'TICKET-1' }))
    // Portero no puede radicar PQRS
    await assertFails(setDoc(doc(dbAs(env, UIDS.portero), 'pqrs/p5'), { ...base, residentId: UIDS.portero }))
  })
})
