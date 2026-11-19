// SCRUM-43: carga masiva del censo (CSV/Excel -> writeBatch <= 400, Multi-Tenant).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  importCensusBatch,
  importCensusFromCsv,
  parseCensusCsv,
} from '../../src/services/censusImporter'
import { anonDb, CONDO_A, createEnv, dbAs, hasEmulator, seed, UIDS } from '../rules/helpers'

const cPath = `condominiums/${CONDO_A}`

describe('parseCensusCsv (SCRUM-43 unit)', () => {
  it('parsea 3 torres y 240 apartamentos sin errores', () => {
    const lines = ['Torre,Apartamento,NombreResidente,Email,Telefono,EsPropietario']
    for (const t of ['T1', 'T2', 'T3']) {
      for (let floor = 1; floor <= 20; floor += 1) {
        for (let unit = 1; unit <= 4; unit += 1) {
          const apt = `${floor}0${unit}`
          lines.push(`${t},${apt},Residente ${t}-${apt},${t.toLowerCase()}_${apt}@conjunto.co,3001234567,Si`)
        }
      }
    }

    const result = parseCensusCsv(lines.join('\n'))
    expect(result.validRows).toHaveLength(240)
    expect(result.errors).toHaveLength(0)
    expect(result.validRows[0].apartmentId).toBe('T1-101')
    expect(result.validRows[239].apartmentId).toBe('T3-2004')
  })

  it('reporta errores fila por fila (campos vacíos, email inválido, duplicados) sin abortar las filas válidas', () => {
    const csv = [
      'Torre;Apartamento;NombreResidente;Email;Telefono;EsPropietario',
      'T1;201;María Gómez;maria@test.co;3001112222;Sí',
      'T1;201;Duplicado En Archivo;dup@test.co;3001112222;No',
      ';202;Sin Torre;sintorre@test.co;3001112222;Si',
      'T2;301;;sin-nombre@test.co;3001112222;Si',
      'T2;302;Pedro Ruiz;correo-invalido;3001112222;Si',
      'T3;401;Laura Díaz;laura@test.co;3003334444;No',
    ].join('\n')

    const { validRows, errors } = parseCensusCsv(csv)
    expect(validRows).toHaveLength(2)
    expect(validRows.map((r) => r.apartmentId)).toEqual(['T1-201', 'T3-401'])
    expect(validRows[0].isOwner).toBe(true)
    expect(validRows[1].isOwner).toBe(false)
    expect(errors).toHaveLength(4)
  })
})

describe.skipIf(!hasEmulator)('importCensusBatch (SCRUM-43 emulator)', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })
  beforeEach(async () => { await seed(env) })

  it('la administradora importa en lotes y omite duplicados ya existentes sin abortar', async () => {
    const csv = [
      'Torre,Apartamento,NombreResidente,Email,Telefono,EsPropietario',
      'T1,101,Ya Existe En Seed,ya@test.co,3000000000,Si',
      'T1,201,Carlos Nuevo,carlos@test.co,3001111111,Si',
      'T2,101,Ana Torre Dos,ana@test.co,3002222222,No',
      'T2,102,Luis Torre Dos,luis@test.co,3003333333,Si',
      'T3,101,Sofía Torre Tres,sofia@test.co,3004444444,Si',
    ].join('\n')

    const adminDb = dbAs(env, UIDS.admin)
    const report = await importCensusFromCsv(adminDb, CONDO_A, csv, { chunkSize: 2 })

    expect(report.towersProcessed).toBe(3)
    expect(report.apartmentsCreated).toBe(4)
    expect(report.skippedDuplicates).toBe(1)
    expect(report.batchesCommitted).toBe(4)
    expect(report.errors[0].reason).toContain('T1-101')

    const t1Snap = await getDoc(doc(adminDb, `${cPath}/towers/T1`))
    expect(t1Snap.exists()).toBe(true)
    expect(t1Snap.get('name')).toBe('Torre 1')
    expect(t1Snap.get('totalApartments')).toBeGreaterThanOrEqual(3)

    const t3Snap = await getDoc(doc(adminDb, `${cPath}/towers/T3`))
    expect(t3Snap.exists()).toBe(true)
    const aptSnap = await getDocs(collection(adminDb, `${cPath}/apartments`))
    expect(aptSnap.size).toBe(6)
  })

  it('respeta la capacidad declarada de torres existentes durante la carga masiva', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    // T1 ya tiene 2 apartamentos en seed; creamos T4 con capacidad máxima 1
    const { createTower } = await import('../../src/services/censusService')
    await createTower(adminDb, CONDO_A, { id: 'T4', name: 'Bloque Casas', totalApartments: 1 })

    const csv = [
      'Torre,Apartamento,NombreResidente,Email,Telefono,EsPropietario',
      'T4,C1,Casa Uno,c1@test.co,3001111111,Si',
      'T4,C2,Casa Dos Excedente,c2@test.co,3002222222,Si',
    ].join('\n')

    const report = await importCensusFromCsv(adminDb, CONDO_A, csv)
    expect(report.apartmentsCreated).toBe(1)
    expect(report.skippedDuplicates).toBe(0)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0].reason).toMatch(/capacidad declarada/)

    const t4Snap = await getDoc(doc(adminDb, `${cPath}/towers/T4`))
    expect(t4Snap.get('totalApartments')).toBe(1)
  })

  it('bloquea con permission-denied a residente, portero, administradora de otro conjunto y anónimo', async () => {
    const { validRows } = parseCensusCsv(
      'Torre,Apartamento,NombreResidente,Email,Telefono,EsPropietario\nT9,901,Intruso,i@test.co,300,Si',
    )

    await assertFails(importCensusBatch(dbAs(env, UIDS.res101), CONDO_A, validRows))
    await assertFails(importCensusBatch(dbAs(env, UIDS.portero), CONDO_A, validRows))
    await assertFails(importCensusBatch(dbAs(env, UIDS.adminB), CONDO_A, validRows))
    await assertFails(importCensusBatch(anonDb(env), CONDO_A, validRows))
  })
})
