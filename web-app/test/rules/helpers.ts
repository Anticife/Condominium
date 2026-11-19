/**
 * Utilidades compartidas para las pruebas de firestore.rules (Multi-Tenant).
 * Siembra dos conjuntos independientes (`condo-a` y `condo-b`) + usuarios sin conjunto.
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

export const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

export const CONDO_A = 'condo-a'
export const CONDO_B = 'condo-b'

export const UIDS = {
  admin: 'admin',
  portero: 'portero',
  res101: 'res101', // condo-a / T1-101
  res102: 'res102', // condo-a / T1-102
  inactive: 'inactivo',
  noProfile: 'sin-perfil',
  // Segundo conjunto (para pruebas de aislamiento inter-tenant)
  adminB: 'admin-b',
  porteroB: 'portero-b',
  resB101: 'res-b-101', // condo-b / T1-101
  // Usuarios sin conjunto aún (onboarding)
  unassignedCreator: 'nuevo-creador',
  unassignedJoiner: 'nuevo-residente',
} as const

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-condominium',
    firestore: { rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8') },
  })
}

export function dbAs(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid, { email: `${uid}@test.co` }).firestore() as unknown as Firestore
}

export function anonDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore
}

const past = Timestamp.fromDate(new Date('2026-11-01T12:00:00Z'))

/** Siembra condo-a y condo-b completos, más usuarios de onboarding. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const user = (uid: string, data: object) =>
      setDoc(doc(db, 'users', uid), {
        uid, email: `${uid}@test.co`, displayName: uid, isActive: true, createdAt: past, ...data,
      })

    // Conjunto A
    await setDoc(doc(db, `condominiums/${CONDO_A}`), {
      id: CONDO_A, name: 'Conjunto Alfa P.H.', nit: '900111222-1',
      address: 'Calle 1 # 1-10', city: 'Bogotá', joinCode: 'ALFA-2026',
      ownerUid: UIDS.admin, isActive: true, createdAt: past,
    })
    await setDoc(doc(db, 'joinCodes/ALFA-2026'), {
      code: 'ALFA-2026', condominiumId: CONDO_A, condominiumName: 'Conjunto Alfa P.H.',
      isActive: true, createdAt: past,
    })
    await setDoc(doc(db, `condominiums/${CONDO_A}/towers/T1`), { id: 'T1', name: 'Torre 1', totalApartments: 80 })
    for (const n of ['101', '102']) {
      await setDoc(doc(db, `condominiums/${CONDO_A}/apartments/T1-${n}`), {
        id: `T1-${n}`, towerId: 'T1', number: n, ownerName: `Dueño ${n}`,
        residentUids: [`res${n}`], createdAt: past,
      })
    }

    // Conjunto B
    await setDoc(doc(db, `condominiums/${CONDO_B}`), {
      id: CONDO_B, name: 'Conjunto Beta P.H.', nit: '900333444-2',
      address: 'Calle 2 # 2-20', city: 'Medellín', joinCode: 'BETA-2026',
      ownerUid: UIDS.adminB, isActive: true, createdAt: past,
    })
    await setDoc(doc(db, 'joinCodes/BETA-2026'), {
      code: 'BETA-2026', condominiumId: CONDO_B, condominiumName: 'Conjunto Beta P.H.',
      isActive: true, createdAt: past,
    })
    await setDoc(doc(db, `condominiums/${CONDO_B}/towers/T1`), { id: 'T1', name: 'Torre 1 Beta', totalApartments: 40 })
    await setDoc(doc(db, `condominiums/${CONDO_B}/apartments/T1-101`), {
      id: 'T1-101', towerId: 'T1', number: '101', ownerName: 'Dueño Beta 101',
      residentUids: [UIDS.resB101], createdAt: past,
    })

    // Usuarios Conjunto A
    await user(UIDS.admin, { role: 'administradora', condominiumId: CONDO_A })
    await user(UIDS.portero, { role: 'portero', condominiumId: CONDO_A })
    await user(UIDS.res101, { role: 'residente', condominiumId: CONDO_A, unitId: 'T1-101', towerId: 'T1' })
    await user(UIDS.res102, { role: 'residente', condominiumId: CONDO_A, unitId: 'T1-102', towerId: 'T1' })
    await user(UIDS.inactive, { role: 'administradora', condominiumId: CONDO_A, isActive: false })

    // Usuarios Conjunto B
    await user(UIDS.adminB, { role: 'administradora', condominiumId: CONDO_B })
    await user(UIDS.porteroB, { role: 'portero', condominiumId: CONDO_B })
    await user(UIDS.resB101, { role: 'residente', condominiumId: CONDO_B, unitId: 'T1-101', towerId: 'T1' })

    // Usuarios sin conjunto aún
    await user(UIDS.unassignedCreator, { role: 'residente', condominiumId: null })
    await user(UIDS.unassignedJoiner, { role: 'residente', condominiumId: null })

    // Autorizados Conjunto A
    const authorized = (condoId: string, apt: string, id: string, data: object) =>
      setDoc(doc(db, `condominiums/${condoId}/apartments/${apt}/authorized/${id}`), {
        id, phone: '300', isActive: true, registeredAt: past, ...data,
      })
    await authorized(CONDO_A, 'T1-101', UIDS.res101, { fullName: 'Carlos Mejía', documentId: '1001', relation: 'residente' })
    await authorized(CONDO_A, 'T1-101', 'mama101', { fullName: 'Rosa Mejía', documentId: '2002', relation: 'madre' })
    await authorized(CONDO_A, 'T1-101', 'exempleada', { fullName: 'Luz Pérez', documentId: '3003', relation: 'empleada', isActive: false })
    await authorized(CONDO_A, 'T1-102', UIDS.res102, { fullName: 'Ana Lucía Torres', documentId: '4004', relation: 'residente' })

    // Autorizados Conjunto B
    await authorized(CONDO_B, 'T1-101', UIDS.resB101, { fullName: 'Sofía Beta', documentId: '9001', relation: 'residente' })
  })
}

export function localDatePlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000 - 5 * 3_600_000)
  return d.toISOString().slice(0, 10)
}
