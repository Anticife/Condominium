/**
 * Utilidades compartidas para las pruebas de firestore.rules.
 * Se ejecutan con el emulador: `npm run test:rules`.
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

export const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

export const UIDS = {
  admin: 'admin',
  portero: 'portero',
  res101: 'res101', // T1-101
  res102: 'res102', // T1-102
  inactive: 'inactivo',
  noProfile: 'sin-perfil',
} as const

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-condominium',
    firestore: { rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8') },
  })
}

/** Firestore autenticado como `uid`, tipado para los servicios modulares. */
export function dbAs(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid, { email: `${uid}@test.co` }).firestore() as unknown as Firestore
}

export function anonDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore
}

const past = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'))

/** Datos base: 1 torre, 2 apartamentos, usuarios de cada rol y autorizados. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const user = (uid: string, data: object) =>
      setDoc(doc(db, 'users', uid), {
        uid, email: `${uid}@test.co`, displayName: uid, isActive: true, createdAt: past, ...data,
      })

    await setDoc(doc(db, 'towers/T1'), { id: 'T1', name: 'Torre 1', totalApartments: 80 })
    for (const n of ['101', '102']) {
      await setDoc(doc(db, `apartments/T1-${n}`), {
        id: `T1-${n}`, towerId: 'T1', number: n, ownerName: `Dueño ${n}`,
        residentUids: [`res${n}`], createdAt: past,
      })
    }

    await user(UIDS.admin, { role: 'administradora' })
    await user(UIDS.portero, { role: 'portero' })
    await user(UIDS.res101, { role: 'residente', unitId: 'T1-101', towerId: 'T1' })
    await user(UIDS.res102, { role: 'residente', unitId: 'T1-102', towerId: 'T1' })
    await user(UIDS.inactive, { role: 'administradora', isActive: false })

    const authorized = (apt: string, id: string, data: object) =>
      setDoc(doc(db, `apartments/${apt}/authorized/${id}`), {
        id, phone: '300', isActive: true, registeredAt: past, ...data,
      })
    await authorized('T1-101', UIDS.res101, { fullName: 'Carlos Mejía', documentId: '1001', relation: 'residente' })
    await authorized('T1-101', 'mama101', { fullName: 'Rosa Mejía', documentId: '2002', relation: 'madre' })
    await authorized('T1-101', 'exempleada', { fullName: 'Luz Pérez', documentId: '3003', relation: 'empleada', isActive: false })
    await authorized('T1-102', UIDS.res102, { fullName: 'Ana Lucía Torres', documentId: '4004', relation: 'residente' })
  })
}

/** Fecha local YYYY-MM-DD dentro de `days` días (hora de Colombia). */
export function localDatePlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000 - 5 * 3_600_000)
  return d.toISOString().slice(0, 10)
}
