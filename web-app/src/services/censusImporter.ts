/**
 * Importador masivo del censo de copropiedad desde CSV/Excel (SCRUM-43, CON-13, RF-04).
 *
 * Columnas esperadas:
 *   Torre, Apartamento, NombreResidente, Email, Telefono, EsPropietario
 *
 * Estrategia plan Spark:
 * - Validación de esquema fila por fila sin abortar el lote ante errores individuales.
 * - Escritura por lotes (`writeBatch`) en chunks de máximo 400 operaciones.
 * - `firestore.rules` garantiza que solo el rol `administradora` pueda ejecutar estas escrituras.
 */
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { apartmentDocId } from './censusService'
import { BusinessRuleError } from './errors'

export const MAX_BATCH_OPERATIONS = 400

export interface CensusRow {
  rowNumber: number
  towerId: string
  apartmentNumber: string
  apartmentId: string
  residentName: string
  email: string
  phone: string
  isOwner: boolean
}

export interface CensusRowError {
  rowNumber: number
  raw: string
  reason: string
}

export interface ParseCensusResult {
  validRows: CensusRow[]
  errors: CensusRowError[]
}

export interface CensusImportReport {
  towersProcessed: number
  apartmentsCreated: number
  batchesCommitted: number
  skippedDuplicates: number
  errors: CensusRowError[]
}

const TOWER_ID_RE = /^[A-Z0-9_]{1,16}$/
const APARTMENT_NUM_RE = /^[A-Z0-9]{1,8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseBoolean(value: string): boolean | null {
  const norm = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (['si', 'yes', 'true', '1', 'propietario'].includes(norm)) return true
  if (['no', 'false', '0', 'arrendatario', ''].includes(norm)) return false
  return null
}

/**
 * Parsea y valida un archivo CSV/Excel del censo fila por fila.
 * Reporta campos vacíos, formatos inválidos y apartamentos duplicados en `errors`
 * sin abortar el procesamiento de las filas válidas.
 */
export function parseCensusCsv(csvText: string): ParseCensusResult {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw new BusinessRuleError('invalid-argument', 'El archivo CSV del censo está vacío.')
  }

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  if (lines.length < 2) {
    throw new BusinessRuleError(
      'invalid-argument',
      'El archivo CSV debe contener una fila de encabezados y al menos una fila de datos.',
    )
  }

  const headerLine = lines[0]
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ','
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeader)

  const colIndex = {
    torre: headers.indexOf('torre'),
    apartamento: headers.indexOf('apartamento'),
    nombre: headers.indexOf('nombreresidente'),
    email: headers.indexOf('email'),
    telefono: headers.indexOf('telefono'),
    esPropietario: headers.indexOf('espropietario'),
  }

  if (colIndex.torre === -1 || colIndex.apartamento === -1 || colIndex.nombre === -1) {
    throw new BusinessRuleError(
      'invalid-argument',
      'Encabezados inválidos. Columnas requeridas: Torre, Apartamento, NombreResidente, Email, Telefono, EsPropietario.',
    )
  }

  const validRows: CensusRow[] = []
  const errors: CensusRowError[] = []
  const seenApartments = new Set<string>()

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i]
    const rowNumber = i + 1
    const cols = splitCsvLine(raw, delimiter)

    const rawTower = (cols[colIndex.torre] ?? '').trim().toUpperCase()
    const rawApt = (cols[colIndex.apartamento] ?? '').trim().toUpperCase()
    const residentName = (cols[colIndex.nombre] ?? '').trim()
    const email = colIndex.email >= 0 ? (cols[colIndex.email] ?? '').trim() : ''
    const phone = colIndex.telefono >= 0 ? (cols[colIndex.telefono] ?? '').trim() : ''
    const rawOwner = colIndex.esPropietario >= 0 ? (cols[colIndex.esPropietario] ?? '') : 'Si'

    if (!rawTower || !TOWER_ID_RE.test(rawTower)) {
      errors.push({ rowNumber, raw, reason: `Código de torre inválido: "${rawTower}".` })
      continue
    }
    if (!rawApt || !APARTMENT_NUM_RE.test(rawApt)) {
      errors.push({ rowNumber, raw, reason: `Número de apartamento inválido: "${rawApt}".` })
      continue
    }
    if (!residentName) {
      errors.push({ rowNumber, raw, reason: 'El campo NombreResidente es obligatorio.' })
      continue
    }
    if (email && !EMAIL_RE.test(email)) {
      errors.push({ rowNumber, raw, reason: `Correo electrónico inválido: "${email}".` })
      continue
    }
    const isOwner = parseBoolean(rawOwner)
    if (isOwner === null) {
      errors.push({ rowNumber, raw, reason: `Valor inválido en EsPropietario: "${rawOwner}".` })
      continue
    }

    const apartmentId = apartmentDocId(rawTower, rawApt)
    if (seenApartments.has(apartmentId)) {
      errors.push({ rowNumber, raw, reason: `Apartamento duplicado en el archivo: ${apartmentId}.` })
      continue
    }
    seenApartments.add(apartmentId)

    validRows.push({
      rowNumber,
      towerId: rawTower,
      apartmentNumber: rawApt,
      apartmentId,
      residentName,
      email,
      phone,
      isOwner,
    })
  }

  return { validRows, errors }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Ejecuta la importación masiva en Firestore mediante `writeBatch()` en lotes
 * de máximo `chunkSize` (por defecto 400) operaciones.
 *
 * 1. Crea/actualiza las torres detectadas.
 * 2. Crea los apartamentos nuevos, reportando los ya existentes como duplicados
 *    sin abortar el resto de la carga.
 */
export async function importCensusBatch(
  db: Firestore,
  condoId: string,
  rows: CensusRow[],
  options: { chunkSize?: number } = {},
): Promise<CensusImportReport> {
  const chunkSize = options.chunkSize ?? MAX_BATCH_OPERATIONS
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > MAX_BATCH_OPERATIONS) {
    throw new BusinessRuleError(
      'invalid-argument',
      `El tamaño de lote debe estar entre 1 y ${MAX_BATCH_OPERATIONS}.`,
    )
  }

  if (rows.length === 0) {
    return {
      towersProcessed: 0,
      apartmentsCreated: 0,
      batchesCommitted: 0,
      skippedDuplicates: 0,
      errors: [],
    }
  }

  // Consultar torres y apartamentos existentes en este conjunto para preservar nombres/capacidad
  // y detectar duplicados sin abortar el resto de la carga.
  const [existingTowersSnap, existingSnap] = await Promise.all([
    getDocs(collection(db, 'condominiums', condoId, 'towers')),
    getDocs(collection(db, 'condominiums', condoId, 'apartments')),
  ])
  const existingTowers = new Map<string, { name?: string; totalApartments?: number }>()
  for (const d of existingTowersSnap.docs) {
    const data = d.data() as { name?: string; totalApartments?: number }
    existingTowers.set(d.id, data)
  }

  const existingIds = new Set<string>()
  const existingCountByTower = new Map<string, number>()
  for (const d of existingSnap.docs) {
    existingIds.add(d.id)
    const tId = (d.data() as { towerId?: string }).towerId
    if (tId) {
      existingCountByTower.set(tId, (existingCountByTower.get(tId) ?? 0) + 1)
    }
  }

  const errors: CensusRowError[] = []
  const toCreate: CensusRow[] = []
  const newCountByTower = new Map<string, number>()
  const touchedTowers = new Set<string>()

  for (const row of rows) {
    touchedTowers.add(row.towerId)
    if (existingIds.has(row.apartmentId)) {
      errors.push({
        rowNumber: row.rowNumber,
        raw: `${row.towerId},${row.apartmentNumber},${row.residentName}`,
        reason: `El apartamento ${row.apartmentId} ya existe en Firestore.`,
      })
      continue
    }
    toCreate.push(row)
    newCountByTower.set(row.towerId, (newCountByTower.get(row.towerId) ?? 0) + 1)
  }

  let batchesCommitted = 0

  // Fase 1: torres del conjunto (preservando nombre y sin reducir capacidad en torres existentes).
  const towerIds = Array.from(touchedTowers)
  for (const chunk of chunkArray(towerIds, chunkSize)) {
    const batch = writeBatch(db)
    for (const towerId of chunk) {
      const existing = existingTowers.get(towerId)
      const defaultName =
        towerId.startsWith('T') && /^T\d+$/.test(towerId)
          ? `Torre ${towerId.slice(1)}`
          : `Torre ${towerId}`
      const totalAfterImport =
        (existingCountByTower.get(towerId) ?? 0) + (newCountByTower.get(towerId) ?? 0)
      const totalApartments = Math.max(
        existing?.totalApartments ?? 0,
        totalAfterImport,
        1,
      )

      batch.set(
        doc(db, 'condominiums', condoId, 'towers', towerId),
        {
          id: towerId,
          name: existing?.name?.trim() ? existing.name : defaultName,
          totalApartments,
        },
        { merge: true },
      )
    }
    await batch.commit()
    batchesCommitted += 1
  }

  // Fase 2: apartamentos nuevos en chunks de <= 400.
  for (const chunk of chunkArray(toCreate, chunkSize)) {
    const batch = writeBatch(db)
    for (const row of chunk) {
      batch.set(doc(db, 'condominiums', condoId, 'apartments', row.apartmentId), {
        id: row.apartmentId,
        towerId: row.towerId,
        number: row.apartmentNumber,
        ownerName: row.residentName,
        residentUids: [],
        createdAt: serverTimestamp(),
      })
    }
    await batch.commit()
    batchesCommitted += 1
  }

  return {
    towersProcessed: towerIds.length,
    apartmentsCreated: toCreate.length,
    batchesCommitted,
    skippedDuplicates: errors.length,
    errors,
  }
}

/** Atajo completo: parsea CSV y ejecuta la carga por lotes en Firestore para el conjunto. */
export async function importCensusFromCsv(
  db: Firestore,
  condoId: string,
  csvText: string,
  options?: { chunkSize?: number },
): Promise<CensusImportReport> {
  const parsed = parseCensusCsv(csvText)
  const batchReport = await importCensusBatch(db, condoId, parsed.validRows, options)
  return {
    ...batchReport,
    errors: [...parsed.errors, ...batchReport.errors],
  }
}
