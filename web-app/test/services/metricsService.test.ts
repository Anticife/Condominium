// SCRUM-39: consultas agregadas, métricas mensuales e indicadores (RF-18, RN-B5).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getMonthlyPackageMetrics,
  getOverduePackages,
  getPqrsResolutionStats,
  getReservationStats,
} from '../../src/services/metricsService'
import { anonDb, createEnv, dbAs, hasEmulator, seed, UIDS } from '../rules/helpers'

describe.skipIf(!hasEmulator)('metricsService (SCRUM-39, RF-18, RN-B5)', () => {
  let env: RulesTestEnvironment
  const referenceNow = new Date('2026-11-20T15:00:00Z')

  beforeAll(async () => { env = await createEnv() })
  afterAll(async () => { await env?.cleanup() })

  beforeEach(async () => {
    await seed(env)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore

      // Paquete 1: entregado en noviembre, demoró exactamente 4 horas en retirarse.
      await setDoc(doc(db, 'packages/pkg-1'), {
        courier: 'Servientrega',
        towerId: 'T1',
        apartmentId: 'T1-101',
        recipientName: 'Carlos Mejía',
        status: 'Entregado',
        receivedByPorteroId: UIDS.portero,
        receivedAt: Timestamp.fromDate(new Date('2026-11-10T10:00:00Z')),
        createdAt: Timestamp.fromDate(new Date('2026-11-10T10:00:00Z')),
        deliveredAt: Timestamp.fromDate(new Date('2026-11-10T14:00:00Z')),
        deliveredByPorteroId: UIDS.portero,
      })

      // Paquete 2: entregado en noviembre, demoró exactamente 8 horas -> promedio = 6 horas.
      await setDoc(doc(db, 'packages/pkg-2'), {
        courier: 'Coordinadora',
        towerId: 'T1',
        apartmentId: 'T1-102',
        recipientName: 'Ana Lucía Torres',
        status: 'Entregado',
        receivedByPorteroId: UIDS.portero,
        receivedAt: Timestamp.fromDate(new Date('2026-11-12T10:00:00Z')),
        createdAt: Timestamp.fromDate(new Date('2026-11-12T10:00:00Z')),
        deliveredAt: Timestamp.fromDate(new Date('2026-11-12T18:00:00Z')),
        deliveredByPorteroId: UIDS.portero,
      })

      // Paquete 3: pendiente reciente (2 días en portería).
      await setDoc(doc(db, 'packages/pkg-3'), {
        courier: 'TCC',
        towerId: 'T1',
        apartmentId: 'T1-101',
        recipientName: 'Carlos Mejía',
        status: 'Pendiente',
        receivedByPorteroId: UIDS.portero,
        receivedAt: Timestamp.fromDate(new Date('2026-11-18T15:00:00Z')),
        createdAt: Timestamp.fromDate(new Date('2026-11-18T15:00:00Z')),
      })

      // Paquete 4: pendiente con 20 días en portería (RN-B5: alerta de cobro de bodegaje).
      await setDoc(doc(db, 'packages/pkg-4'), {
        courier: 'DHL',
        towerId: 'T1',
        apartmentId: 'T1-102',
        recipientName: 'Ana Lucía Torres',
        status: 'Pendiente',
        receivedByPorteroId: UIDS.portero,
        receivedAt: Timestamp.fromDate(new Date('2026-10-31T15:00:00Z')),
        createdAt: Timestamp.fromDate(new Date('2026-10-31T15:00:00Z')),
      })

      // Reservas de noviembre 2026
      await setDoc(doc(db, 'reservations/res-1'), {
        commonArea: 'salon_social', apartmentId: 'T1-101', residentId: UIDS.res101,
        date: '2026-11-15', slot: 'PM', status: 'Aprobada',
        createdAt: Timestamp.fromDate(new Date('2026-11-05T10:00:00Z')),
      })
      await setDoc(doc(db, 'reservations/res-2'), {
        commonArea: 'salon_social', apartmentId: 'T1-102', residentId: UIDS.res102,
        date: '2026-11-22', slot: 'AM', status: 'Pendiente',
        createdAt: Timestamp.fromDate(new Date('2026-11-08T10:00:00Z')),
      })
      await setDoc(doc(db, 'reservations/res-3'), {
        commonArea: 'bbq', apartmentId: 'T1-101', residentId: UIDS.res101,
        date: '2026-11-25', slot: 'PM', status: 'Rechazada', rejectionReason: 'Mantenimiento programado',
        createdAt: Timestamp.fromDate(new Date('2026-11-09T10:00:00Z')),
      })

      // PQRS de noviembre 2026
      await setDoc(doc(db, 'pqrs/pq-1'), {
        ticketNumber: 'PQ-2026-0001', apartmentId: 'T1-101', residentId: UIDS.res101,
        category: 'Queja', subject: 'Ruido', description: 'Ruido nocturno',
        status: 'Resuelta',
        officialResponse: 'Se notificó al apartamento y se reforzó ronda.',
        createdAt: Timestamp.fromDate(new Date('2026-11-10T10:00:00Z')),
        updatedAt: Timestamp.fromDate(new Date('2026-11-11T10:00:00Z')),
        resolvedAt: Timestamp.fromDate(new Date('2026-11-11T10:00:00Z')),
      })
      await setDoc(doc(db, 'pqrs/pq-2'), {
        ticketNumber: 'PQ-2026-0002', apartmentId: 'T1-102', residentId: UIDS.res102,
        category: 'Peticion', subject: 'Iluminación', description: 'Cambiar bombillo',
        status: 'En gestión',
        createdAt: Timestamp.fromDate(new Date('2026-11-14T10:00:00Z')),
        updatedAt: Timestamp.fromDate(new Date('2026-11-14T12:00:00Z')),
      })
    })
  })

  it('calcula métricas mensuales de paquetería y tiempo promedio de retiro', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    const metrics = await getMonthlyPackageMetrics(adminDb, 11, 2026, referenceNow)

    expect(metrics.receivedCount).toBe(3) // pkg-1, pkg-2, pkg-3 (pkg-4 fue en octubre)
    expect(metrics.deliveredCount).toBe(2) // pkg-1, pkg-2
    expect(metrics.pendingCount).toBe(2) // pkg-3, pkg-4
    expect(metrics.overdueCount).toBe(1) // solo pkg-4 (> 15 días)
    expect(metrics.averagePickupHours).toBe(6) // (4h + 8h) / 2
  })

  it('detecta paquetes con más de 15 días en portería (RN-B5)', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    const overdue = await getOverduePackages(adminDb, referenceNow)

    expect(overdue).toHaveLength(1)
    expect(overdue[0].id).toBe('pkg-4')
    expect(overdue[0].apartmentId).toBe('T1-102')
    expect(overdue[0].daysPending).toBe(20)
  })

  it('calcula estadísticas mensuales de reservas y zona más solicitada', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    const stats = await getReservationStats(adminDb, 11, 2026)

    expect(stats.total).toBe(3)
    expect(stats.byStatus).toEqual({ Pendiente: 1, Aprobada: 1, Rechazada: 1 })
    expect(stats.byArea).toEqual({ salon_social: 2, bbq: 1 })
    expect(stats.mostRequestedArea).toBe('salon_social')
  })

  it('calcula distribución y tiempo promedio de resolución de PQRS', async () => {
    const adminDb = dbAs(env, UIDS.admin)
    const stats = await getPqrsResolutionStats(adminDb, 11, 2026)

    expect(stats.total).toBe(2)
    expect(stats.byStatus).toEqual({ Radicada: 0, 'En gestión': 1, Resuelta: 1 })
    expect(stats.byCategory).toEqual({ Peticion: 1, Queja: 1, Reclamo: 0, Sugerencia: 0 })
    expect(stats.averageResolutionHours).toBe(24)
  })

  it('restringe las consultas globales de analítica exclusivamente a administradora', async () => {
    const resDb = dbAs(env, UIDS.res101)
    const porteroDb = dbAs(env, UIDS.portero)
    const anon = anonDb(env)

    // Residente no puede consultar consolidado global de paquetes, reservas ni PQRS.
    await assertFails(getMonthlyPackageMetrics(resDb, 11, 2026, referenceNow))
    await assertFails(getReservationStats(resDb, 11, 2026))
    await assertFails(getPqrsResolutionStats(resDb, 11, 2026))

    // Portero no puede consultar reservas globales ni PQRS globales.
    await assertFails(getReservationStats(porteroDb, 11, 2026))
    await assertFails(getPqrsResolutionStats(porteroDb, 11, 2026))

    // Anónimo no puede consultar nada.
    await assertFails(getOverduePackages(anon, referenceNow))
  })
})
