/** Error de negocio con un mensaje claro para mostrar al usuario (RNF-05). */
export class BusinessRuleError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'BusinessRuleError'
    this.code = code
  }
}

export function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BusinessRuleError('invalid-argument', `El campo «${field}» es obligatorio.`)
  }
  return value.trim()
}
