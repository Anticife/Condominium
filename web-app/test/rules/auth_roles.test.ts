// SCRUM-6: roles y aislamiento de users/{userId}.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assignResidentToApartment, registerOwnProfile, setStaffRole } from '../../src/services/userService'
import { anonDb, createEnv, dbAs, hasEmulator, seed, UIDS } from './helpers'

describe.skipIf(!hasEmulator)('auth_roles (SCRUM-6)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('un usuario no autenticado no lee nada', async () => {
    const db = anonDb(env)
    await assertFails(getDoc(doc(db, 'users', UIDS.res101)))
    await assertFails(getDoc(doc(db, 'towers', 'T1')))
    await assertFails(getDoc(doc(db, 'apartments', 'T1-101')))
  })

  it('el autorregistro crea un residente sin apartamento', async () => {
    const db = dbAs(env, 'nuevo')
    await assertSucceeds(registerOwnProfile(db, { uid: 'nuevo', email: 'nuevo@test.co', displayName: 'Nuevo' }))
  })

  it('nadie se registra como administradora ni con apartamento', async () => {
    const db = dbAs(env, 'nuevo')
    const base = { uid: 'nuevo', email: 'nuevo@test.co', displayName: 'N', isActive: true, createdAt: serverTimestamp() }
    await assertFails(setDoc(doc(db, 'users/nuevo'), { ...base, role: 'administradora' }))
    await assertFails(setDoc(doc(db, 'users/nuevo'), { ...base, role: 'residente', unitId: 'T1-101' }))
  })

  it('un residente no puede cambiarse rol, estado ni apartamento', async () => {
    const db = dbAs(env, UIDS.res101)
    const ref = doc(db, 'users', UIDS.res101)
    await assertFails(updateDoc(ref, { role: 'administradora' }))
    await assertFails(updateDoc(ref, { isActive: false }))
    await assertFails(updateDoc(ref, { unitId: 'T1-102' }))
    await assertSucceeds(updateDoc(ref, { displayName: 'Carlos', phone: '310' }))
  })

  it('un residente no lee el perfil de otro', async () => {
    await assertFails(getDoc(doc(dbAs(env, UIDS.res101), 'users', UIDS.res102)))
    await assertFails(getDoc(doc(dbAs(env, UIDS.portero), 'users', UIDS.res102)))
    await assertSucceeds(getDoc(doc(dbAs(env, UIDS.admin), 'users', UIDS.res102)))
  })

  it('la administradora asigna roles y apartamentos', async () => {
    const admin = dbAs(env, UIDS.admin)
    await assertSucceeds(setStaffRole(admin, UIDS.res102, 'portero'))
    await assertSucceeds(assignResidentToApartment(admin, {
      userId: UIDS.res102, apartmentId: 'T1-101', fullName: 'Ana Lucía Torres', documentId: '4004',
    }))
  })

  it('la administradora no puede quitarse su propio rol', async () => {
    await assertFails(updateDoc(doc(dbAs(env, UIDS.admin), 'users', UIDS.admin), { role: 'residente' }))
  })

  it('un usuario desactivado pierde sus permisos', async () => {
    await assertFails(getDoc(doc(dbAs(env, UIDS.inactive), 'users', UIDS.res101)))
    await assertFails(updateDoc(doc(dbAs(env, UIDS.inactive), 'users', UIDS.res101), { role: 'portero' }))
  })

  it('un usuario sin perfil no tiene rol', async () => {
    await assertFails(getDoc(doc(dbAs(env, UIDS.noProfile), 'apartments', 'T1-101')))
  })
})
