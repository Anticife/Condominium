import { describe, expect, it } from 'vitest'
import { parseAuthActionParams } from '../../src/services/authActionUtils'

describe('parseAuthActionParams', () => {
  it('acepta enlace verifyEmail aunque apiKey venga vacío (bug de plantilla Firebase)', () => {
    const search =
      '?mode=verifyEmail&oobCode=WKyrlw5TESTZp0hw&apiKey=&continueUrl=https%3A%2F%2Fcondominium-f6236.web.app&lang=es'
    expect(parseAuthActionParams(search)).toEqual({
      mode: 'verifyEmail',
      oobCode: 'WKyrlw5TESTZp0hw',
      continueUrl: 'https://condominium-f6236.web.app',
    })
  })

  it('acepta enlace resetPassword sin continueUrl', () => {
    expect(parseAuthActionParams('?mode=resetPassword&oobCode=abc123')).toEqual({
      mode: 'resetPassword',
      oobCode: 'abc123',
      continueUrl: null,
    })
  })

  it('retorna null cuando falta oobCode o el modo no es soportado', () => {
    expect(parseAuthActionParams('')).toBeNull()
    expect(parseAuthActionParams('?mode=verifyEmail')).toBeNull()
    expect(parseAuthActionParams('?mode=verifyEmail&oobCode=   ')).toBeNull()
    expect(parseAuthActionParams('?mode=unknownMode&oobCode=abc123')).toBeNull()
  })
})
