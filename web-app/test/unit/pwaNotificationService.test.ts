import { describe, expect, it } from 'vitest'
import {
  detectNewUsersNotifications,
  detectOwnProfileNotifications,
  detectPackageNotifications,
  detectPqrsNotifications,
  detectReservationNotifications,
} from '../../src/services/pwaNotificationService'
import type { Package } from '../../src/services/packageService'
import type { PqrsTicket } from '../../src/services/pqrsService'
import type { Reservation } from '../../src/services/reservationService'
import type { UserProfile } from '../../src/services/userService'

const basePkg: Package = {
  id: 'pkg-1',
  courier: 'Servientrega',
  towerId: 'T1',
  apartmentId: 'T1-101',
  recipientName: 'Ana López',
  status: 'Pendiente',
  receivedByPorteroId: 'portero-1',
  receivedAt: null,
  createdAt: null,
}

const basePqrs: PqrsTicket = {
  id: 'pqrs-1',
  ticketNumber: 'PQ-2026-0001',
  apartmentId: 'T1-101',
  residentId: 'res-1',
  category: 'Queja',
  subject: 'Ruido en pasillo',
  description: 'Ruido en horas de la noche',
  status: 'Radicada',
  createdAt: null,
}

const baseRes: Reservation = {
  id: 'res-1',
  commonArea: 'salon_social',
  apartmentId: 'T1-101',
  residentId: 'res-1',
  date: '2026-12-01',
  slot: 'PM',
  startTime: null,
  endTime: null,
  status: 'Pendiente',
  createdAt: null,
}

describe('pwaNotificationService diff detectors', () => {
  it('notifica al residente cuando llega un nuevo paquete y cuando es entregado', () => {
    const newAlerts = detectPackageNotifications([], [basePkg], 'residente', 'res-1')
    expect(newAlerts).toHaveLength(1)
    expect(newAlerts[0].title).toContain('Nuevo paquete')
    expect(newAlerts[0].body).toContain('Servientrega')

    const delivered: Package = {
      ...basePkg,
      status: 'Entregado',
      deliveredByPorteroId: 'portero-1',
      deliveredToPerson: 'Carlos López',
    }
    const delAlerts = detectPackageNotifications([basePkg], [delivered], 'residente', 'res-1')
    expect(delAlerts).toHaveLength(1)
    expect(delAlerts[0].title).toContain('Paquete entregado')
    expect(delAlerts[0].body).toContain('Carlos López')
  })

  it('no notifica al mismo portero que registró o entregó el paquete', () => {
    expect(detectPackageNotifications([], [basePkg], 'portero', 'portero-1')).toHaveLength(0)
  })

  it('notifica a la administradora cuando un residente radica PQRS y al residente cuando cambia de estado', () => {
    const adminAlerts = detectPqrsNotifications([], [basePqrs], 'administradora', 'admin-1')
    expect(adminAlerts).toHaveLength(1)
    expect(adminAlerts[0].title).toContain('PQ-2026-0001')

    const resolved: PqrsTicket = {
      ...basePqrs,
      status: 'Resuelta',
      officialResponse: 'Se notificó al apartamento y se solucionó el inconveniente.',
    }
    const resAlerts = detectPqrsNotifications([basePqrs], [resolved], 'residente', 'res-1')
    expect(resAlerts).toHaveLength(1)
    expect(resAlerts[0].title).toContain('Resuelta')
    expect(resAlerts[0].body).toContain('Se notificó')
  })

  it('notifica a la administradora nueva reserva y al residente aprobación/rechazo', () => {
    const adminAlerts = detectReservationNotifications([], [baseRes], 'administradora', 'admin-1')
    expect(adminAlerts).toHaveLength(1)
    expect(adminAlerts[0].title).toContain('Nueva solicitud de reserva')

    const rejected: Reservation = {
      ...baseRes,
      status: 'Rechazada',
      resolvedBy: 'admin-1',
      rejectionReason: 'Mantenimiento programado',
    }
    const resAlerts = detectReservationNotifications([baseRes], [rejected], 'residente', 'res-1')
    expect(resAlerts).toHaveLength(1)
    expect(resAlerts[0].title).toContain('rechazada')
    expect(resAlerts[0].body).toContain('Mantenimiento programado')
  })

  it('notifica nuevos usuarios a la administradora y cambios de perfil al residente', () => {
    const u1: UserProfile = {
      uid: 'u-1',
      email: 'nuevo@test.co',
      displayName: 'María',
      role: 'residente',
      isActive: true,
    }
    const userAlerts = detectNewUsersNotifications([], [u1], 'admin-1')
    expect(userAlerts).toHaveLength(1)
    expect(userAlerts[0].body).toContain('María')

    const alreadyAssigned: UserProfile = { ...u1, uid: 'u-2', unitId: 'T1-101' }
    const guardUser: UserProfile = { ...u1, uid: 'u-3', role: 'portero' }
    expect(detectNewUsersNotifications([], [alreadyAssigned, guardUser], 'admin-1')).toHaveLength(0)

    const updated: UserProfile = { ...u1, unitId: 'T1-202' }
    const profAlerts = detectOwnProfileNotifications(u1, updated)
    expect(profAlerts).toHaveLength(1)
    expect(profAlerts[0].title).toContain('Apartamento asignado')
    expect(profAlerts[0].body).toContain('T1-202')
  })
})
