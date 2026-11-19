/**
 * Utilidades para interpretar enlaces de acción de Firebase Authentication
 * (`/auth/action?mode=verifyEmail|resetPassword&oobCode=...`), tolerando
 * enlaces en los que Firebase envíe `&apiKey=` vacío.
 */

export type SupportedAuthActionMode = 'verifyEmail' | 'resetPassword'

export interface AuthActionParams {
  mode: SupportedAuthActionMode
  oobCode: string
  continueUrl: string | null
}

export function parseAuthActionParams(search: string): AuthActionParams | null {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const oobCode = params.get('oobCode')?.trim() ?? ''

  if ((mode !== 'verifyEmail' && mode !== 'resetPassword') || !oobCode) {
    return null
  }

  const continueUrl = params.get('continueUrl')?.trim() || null
  return { mode, oobCode, continueUrl }
}
