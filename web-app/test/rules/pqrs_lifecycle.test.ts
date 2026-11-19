// SCRUM-35: ciclo de vida de PQRS, respuesta oficial obligatoria e historial inmutable (RN-B6).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { filePqrsTransaction, transitionPqrsStatus } from '../../src/services/pqrsService'
import { createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('pqrs_lifecycle (SCRUM-35, RN-B6)', () => {
  let env: RulesTestEnvironment
  let pqrsId: string

  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => {
    await seed(env)
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'counters/pqrs'), { year: 2026, sequence: 0 })
    })
    const created = await filePqrsTransaction(dbAs(env, UIDS.res101), {
      apartmentId: 'T1-101',
      residentId: UIDS.res101,
      category: 'Reclamo',
      subject: 'Puerta peatonal sin cierre',
      description: 'La cerradura magnética de la puerta principal no ajusta bien.',
      year: 2026,
    })
    pqrsId = created.id
  })

  it('transiciona Radicada -> En gestión -> Resuelta registrando historial inmutable', async () => {
    const adminDb = dbAs(env, UIDS.admin)

    await transitionPqrsStatus(adminDb, UIDS.admin, {
      pqrsId,
      newStatus: 'En gestión',
      comment: 'Se programó visita del técnico de cerraduras.',
    })

    await transitionPqrsStatus(adminDb, UIDS.admin, {
      pqrsId,
      newStatus: 'Resuelta',
      officialResponse: 'Se reemplazó el electroimán y se verificó el cierre correcto.',
    })

    const snap = await getDoc(doc(adminDb, 'pqrs', pqrsId))
    expect(snap.get('status')).toBe('Resuelta')
    expect(snap.get('officialResponse')).toContain('electroimán')
    expect(snap.get('resolvedBy')).toBe(UIDS.admin)

    const histSnap = await getDocs(collection(adminDb, 'pqrs', pqrsId, 'history'))
    expect(histSnap.size).toBe(2)

    // El residente propietario puede leer su PQRS y el historial completo.
    const resDb = dbAs(env, UIDS.res101)
    await assertSucceeds(getDoc(doc(resDb, 'pqrs', pqrsId)))
    const resHist = await assertSucceeds(getDocs(collection(resDb, 'pqrs', pqrsId, 'history')))
    expect(resHist.size).toBe(2)
  })

  it('rechaza resolver sin respuesta oficial >= 10 caracteres (RN-B6)', async () => {
    const adminDb = dbAs(env, UIDS.admin)

    await expect(
      transitionPqrsStatus(adminDb, UIDS.admin, {
        pqrsId,
        newStatus: 'Resuelta',
        officialResponse: 'Listo',
      }),
    ).rejects.toThrow(/RN-B6/)

    // Directo contra firestore.rules sin respuesta oficial o con menos de 10 caracteres
    await assertFails(updateDoc(doc(adminDb, 'pqrs', pqrsId), {
      status: 'Resuelta',
      updatedAt: serverTimestamp(),
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
    await assertFails(updateDoc(doc(adminDb, 'pqrs', pqrsId), {
      status: 'Resuelta',
      officialResponse: 'Corto',
      updatedAt: serverTimestamp(),
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
    await assertFails(updateDoc(doc(adminDb, 'pqrs', pqrsId), {
      status: 'Resuelta',
      officialResponse: '          ',
      updatedAt: serverTimestamp(),
      resolvedAt: serverTimestamp(),
      resolvedBy: UIDS.admin,
    }))
  })

  it('garantiza inmutabilidad absoluta de la subcolección history (no update ni delete)', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    await transitionPqrsStatus(adminDb, UIDS.admin, {
      pqrsId,
      newStatus: 'En gestión',
      comment: 'Ticket asignado a mantenimiento.',
    })

    const histSnap = await getDocs(collection(adminDb, 'pqrs', pqrsId, 'history'))
    const entryRef = doc(adminDb, 'pqrs', pqrsId, 'history', histSnap.docs[0].id)

    await assertFails(updateDoc(entryRef, { comment: 'Comentario alterado' }))
    await assertFails(deleteDoc(entryRef))
    await assertFails(deleteDoc(doc(adminDb, 'pqrs', pqrsId)))
  })

  it('impide a residentes de otros apartamentos y a porteros leer o modificar la PQRS', async () => {
    const otherResDb = dbAs(env, UIDS.res102)
    const porteroDb = dbAs(env, UIDS.portero)

    await assertFails(getDoc(doc(otherResDb, 'pqrs', pqrsId)))
    await assertFails(getDocs(collection(otherResDb, 'pqrs', pqrsId, 'history')))
    await assertFails(getDoc(doc(porteroDb, 'pqrs', pqrsId)))

    await assertFails(updateDoc(doc(dbAs(env, UIDS.res101), 'pqrs', pqrsId), {
      status: 'En gestión',
      updatedAt: serverTimestamp(),
    }))
  })

  it('impide reabrir una PQRS que ya está Resuelta', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    await transitionPqrsStatus(adminDb, UIDS.admin, {
      pqrsId,
      newStatus: 'Resuelta',
      officialResponse: 'Respuesta oficial completa y verificada por administración.',
    })

    await assertFails(updateDoc(doc(adminDb, 'pqrs', pqrsId), {
      status: 'En gestión',
      updatedAt: serverTimestamp(),
    }))
  })
})
