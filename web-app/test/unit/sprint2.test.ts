// Pruebas sin emulador de la lógica del Sprint 2.
import { describe, expect, it } from 'vitest'
import { normalizeTowerId, parseCensusCsv, tableToCsv } from '../../src/services/censusImporter'
import { formatPqrsTicket } from '../../src/services/pqrsService'

describe('radicado PQRS (SCRUM-31)', () => {
  it('formatea PQ-AAAA-NNNN', () => {
    expect(formatPqrsTicket(2026, 42)).toBe('PQ-2026-0042')
    expect(formatPqrsTicket(2026, 12345)).toBe('PQ-2026-12345')
  })

  it('rechaza años y secuencias inválidas', () => {
    expect(() => formatPqrsTicket(2026, 0)).toThrow()
    expect(() => formatPqrsTicket(26, 1)).toThrow()
  })
})

describe('importador del censo (SCRUM-43)', () => {
  it('normaliza la torre como viene en la hoja de cálculo', () => {
    expect(normalizeTowerId('Torre 1')).toBe('T1')
    expect(normalizeTowerId('torre  03')).toBe('T3')
    expect(normalizeTowerId('T2')).toBe('T2')
    expect(normalizeTowerId('2')).toBe('T2')
    expect(normalizeTowerId('Bloque A')).toBe('BLOQUE_A')
  })

  it('importa filas con «Torre 1» y reporta la torre inválida', () => {
    const { validRows, errors } = parseCensusCsv([
      'Torre;Apartamento;NombreResidente;Email;Telefono;EsPropietario',
      'Torre 1;302;Carlos Mejía;carlos@x.co;300;Sí',
      'T-1;303;Torre mal escrita;otro@x.co;300;No',
    ].join('\n'))
    expect(validRows.map((r) => r.apartmentId)).toEqual(['T1-302'])
    expect(errors.map((e) => e.rowNumber)).toEqual([3])
  })

  it('convierte una hoja de Excel a CSV sin perder comas, comillas ni fechas', () => {
    const csv = tableToCsv([
      ['Torre', 'Apartamento', 'NombreResidente', 'Email', 'Telefono', 'EsPropietario'],
      ['Torre 2', 504, 'Torres, Ana "Lucía"', 'ana@x.co', 3001234567, 'Sí'],
      ['T3', '101', null, 'sin@x.co', '', 'No'],
    ])
    const { validRows, errors } = parseCensusCsv(csv)
    expect(validRows).toHaveLength(1)
    expect(validRows[0]).toMatchObject({
      apartmentId: 'T2-504', residentName: 'Torres, Ana "Lucía"', phone: '3001234567', isOwner: true,
    })
    expect(errors).toHaveLength(1) // fila sin nombre
    expect(tableToCsv([[new Date('2026-11-18T00:00:00Z')]])).toBe('2026-11-18')
  })
})
