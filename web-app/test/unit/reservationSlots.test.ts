// Pruebas sin emulador de la lógica de franjas (SCRUM-24).
import { describe, expect, it } from 'vitest'
import { validateReservationRequest } from '../../src/services/reservationService'
import { hasMinimumNotice, quotaId, slotLockId, slotTimes } from '../../src/services/reservationSlots'

describe('slotTimes', () => {
  it('convierte la franja local de Colombia a UTC', () => {
    const { start, end } = slotTimes('salon_social', '2026-11-21', 'PM')
    expect(start.toISOString()).toBe('2026-11-21T20:00:00.000Z') // 3:00 p. m.
    expect(end.toISOString()).toBe('2026-11-22T03:00:00.000Z') // 10:00 p. m.
  })

  it('usa las franjas de la zona BBQ', () => {
    expect(slotTimes('bbq', '2026-11-21', 'AM').start.toISOString()).toBe('2026-11-21T15:00:00.000Z')
  })

  it('rechaza fechas imposibles o mal escritas', () => {
    expect(() => slotTimes('bbq', '2026-02-31', 'AM')).toThrow()
    expect(() => slotTimes('bbq', '21/11/2026', 'AM')).toThrow()
  })
})

describe('RN-B2: 48 horas de anticipación', () => {
  const now = new Date('2026-11-19T20:00:00Z')

  it('acepta exactamente 48 horas', () => {
    expect(hasMinimumNotice(new Date('2026-11-21T20:00:00Z'), now)).toBe(true)
  })

  it('rechaza menos de 48 horas', () => {
    expect(hasMinimumNotice(new Date('2026-11-21T19:59:00Z'), now)).toBe(false)
  })

  it('validateReservationRequest explica el motivo', () => {
    expect(() => validateReservationRequest({
      residentId: 'u', apartmentId: 'T1-302', commonArea: 'salon_social', date: '2026-11-20', slot: 'PM',
    }, now)).toThrow(/48 horas/)
  })
})

describe('ids deterministas', () => {
  it('bloqueo de franja (RN-B1) y cupo mensual (RN-B3)', () => {
    expect(slotLockId('salon_social', '2026-11-21', 'PM')).toBe('salon_social_2026-11-21_PM')
    expect(quotaId('T1-302', '2026-11-21')).toBe('T1-302_2026-11')
  })
})
