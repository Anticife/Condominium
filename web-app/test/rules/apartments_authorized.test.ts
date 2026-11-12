// SCRUM-10: torres, apartamentos y autorizados (RN-B4, RN-B7).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addAuthorizedPerson, createApartment, createTower } from '../../src/services/censusService'
import { createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('apartments_authorized (SCRUM-10)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('el residente del 101 no lee ni modifica autorizados del 102', async () => {
    const db = dbAs(env, UIDS.res101)
    await assertFails(getDocs(collection(db, 'apartments/T1-102/authorized')))
    await assertFails(getDoc(doc(db, `apartments/T1-102/authorized/${UIDS.res102}`)))
    await assertFails(addAuthorizedPerson(db, 'T1-102', { fullName: 'X', documentId: '9', relation: 'amigo' }))
    await assertFails(getDoc(doc(db, 'apartments/T1-102')))
  })

  it('el residente gestiona los autorizados de su apartamento', async () => {
    const db = dbAs(env, UIDS.res101)
    await assertSucceeds(getDocs(collection(db, 'apartments/T1-101/authorized')))
    await assertSucceeds(addAuthorizedPerson(db, 'T1-101', { fullName: 'Pedro', documentId: '5005', relation: 'hermano' }))
    await assertSucceeds(updateDoc(doc(db, 'apartments/T1-101/authorized/mama101'), { isActive: false }))
  })

  it('el residente no se registra a sí mismo ni a otros como residente', async () => {
    const db = dbAs(env, UIDS.res101)
    await assertFails(setDoc(doc(db, 'apartments/T1-101/authorized/x'), {
      id: 'x', fullName: 'X', documentId: '9', phone: '', relation: 'residente', isActive: true, registeredAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(db, `apartments/T1-101/authorized/${UIDS.res101}`), { documentId: '999' }))
  })

  it('el portero consulta apartamentos y autorizados, pero no los modifica', async () => {
    const db = dbAs(env, UIDS.portero)
    await assertSucceeds(getDoc(doc(db, 'apartments/T1-102')))
    await assertSucceeds(getDocs(collection(db, 'apartments/T1-102/authorized')))
    await assertFails(updateDoc(doc(db, 'apartments/T1-101/authorized/mama101'), { fullName: 'Otra' }))
    await assertFails(addAuthorizedPerson(db, 'T1-101', { fullName: 'X', documentId: '9', relation: 'amigo' }))
    await assertFails(updateDoc(doc(db, 'apartments/T1-101'), { ownerName: 'X' }))
  })

  it('solo la administradora crea torres y apartamentos', async () => {
    await assertFails(createTower(dbAs(env, UIDS.portero), { id: 'T2', name: 'Torre 2', totalApartments: 80 }))
    await assertFails(createApartment(dbAs(env, UIDS.res101), { towerId: 'T1', number: '201', ownerName: 'X' }))
    await assertSucceeds(createTower(dbAs(env, UIDS.admin), { id: 'T2', name: 'Torre 2', totalApartments: 80 }))
    await assertSucceeds(createApartment(dbAs(env, UIDS.admin), { towerId: 'T2', number: '201', ownerName: 'B' }))
  })

  it('no permite apartamentos repetidos en la misma torre', async () => {
    const admin = dbAs(env, UIDS.admin)
    await expect(createApartment(admin, { towerId: 'T1', number: '101', ownerName: 'X' })).rejects.toThrow(/ya existe/)
    // Aunque se salte el servicio, la regla también lo impide.
    await assertFails(setDoc(doc(admin, 'apartments/T1-101'), {
      id: 'T1-101', towerId: 'T1', number: '101', ownerName: 'X', residentUids: [], createdAt: serverTimestamp(),
    }))
  })

  it('el id del apartamento debe corresponder a torre y número', async () => {
    await assertFails(setDoc(doc(dbAs(env, UIDS.admin), 'apartments/cualquiera'), {
      id: 'cualquiera', towerId: 'T1', number: '201', ownerName: 'X', residentUids: [], createdAt: serverTimestamp(),
    }))
  })

  it('no permite apartamentos en torres inexistentes', async () => {
    await assertFails(setDoc(doc(dbAs(env, UIDS.admin), 'apartments/T9-101'), {
      id: 'T9-101', towerId: 'T9', number: '101', ownerName: 'X', residentUids: [], createdAt: serverTimestamp(),
    }))
  })
})
