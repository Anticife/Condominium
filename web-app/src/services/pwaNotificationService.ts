/**
 * Notificaciones locales PWA (Web Notifications API + Service Worker) para plan Spark.
 * Detecta cambios en tiempo real recibidos por Firestore onSnapshot y emite alertas
 * dirigidas al rol activo (residente, administradora o portero) mientras la app esté abierta.
 */
import type { Package } from './packageService'
import type { PqrsTicket } from './pqrsService'
import type { Reservation } from './reservationService'
import { AREA_LABELS } from './reservationSlots'
import type { Role, UserProfile } from './userService'

export interface LocalNotificationPayload {
  title: string
  body: string
  tag: string
}

export type NotificationPermissionState = NotificationPermission | 'unsupported'

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.warn('No se pudo registrar el Service Worker PWA:', err)
    return null
  }
}

export async function showLocalNotification(payload: LocalNotificationPayload): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false
  const options: NotificationOptions = {
    body: payload.body,
    tag: payload.tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(payload.title, options)
        return true
      }
    }
    new Notification(payload.title, options)
    return true
  } catch (err) {
    console.warn('No se pudo mostrar la notificación local:', err)
    return false
  }
}

/**
 * Detecta cambios relevantes en paquetería comparando el snapshot previo y el actual.
 */
export function detectPackageNotifications(
  previous: Package[],
  next: Package[],
  role: Role,
  currentUid: string,
): LocalNotificationPayload[] {
  const prevMap = new Map(previous.map((p) => [p.id, p]))
  const alerts: LocalNotificationPayload[] = []

  for (const pkg of next) {
    const old = prevMap.get(pkg.id)
    if (!old) {
      if (pkg.receivedByPorteroId === currentUid) continue
      if (role === 'residente') {
        alerts.push({
          title: `Nuevo paquete en portería (${pkg.apartmentId})`,
          body: `${pkg.courier} para ${pkg.recipientName}${pkg.trackingNumber ? ` · Guía ${pkg.trackingNumber}` : ''}.`,
          tag: `pkg-new-${pkg.id}`,
        })
      } else if (role === 'administradora' || role === 'portero') {
        alerts.push({
          title: `Paquete recibido — Apto ${pkg.apartmentId}`,
          body: `${pkg.courier} para ${pkg.recipientName}.`,
          tag: `pkg-new-${pkg.id}`,
        })
      }
    } else if (old.status === 'Pendiente' && pkg.status === 'Entregado') {
      if (pkg.deliveredByPorteroId === currentUid) continue
      if (role === 'residente' || role === 'administradora') {
        alerts.push({
          title: `Paquete entregado (${pkg.apartmentId})`,
          body: `${pkg.courier} entregado a ${pkg.deliveredToPerson || 'persona autorizada'}.`,
          tag: `pkg-del-${pkg.id}`,
        })
      }
    }
  }

  return alerts
}

/**
 * Detecta radicaciones nuevas (para administración) y cambios de estado (para residentes).
 */
export function detectPqrsNotifications(
  previous: PqrsTicket[],
  next: PqrsTicket[],
  role: Role,
  currentUid: string,
): LocalNotificationPayload[] {
  const prevMap = new Map(previous.map((t) => [t.id, t]))
  const alerts: LocalNotificationPayload[] = []

  for (const ticket of next) {
    const old = prevMap.get(ticket.id)
    if (!old) {
      if (role === 'administradora' && ticket.residentId !== currentUid) {
        alerts.push({
          title: `Nueva PQRS ${ticket.ticketNumber} (${ticket.apartmentId})`,
          body: `${ticket.category}: ${ticket.subject}`,
          tag: `pqrs-new-${ticket.id}`,
        })
      }
    } else if (old.status !== ticket.status) {
      if (role === 'residente') {
        const extra =
          ticket.status === 'Resuelta' && ticket.officialResponse
            ? ` — ${ticket.officialResponse.slice(0, 100)}`
            : ''
        alerts.push({
          title: `PQRS ${ticket.ticketNumber}: ${ticket.status}`,
          body: `${ticket.subject}${extra}`,
          tag: `pqrs-status-${ticket.id}-${ticket.status}`,
        })
      }
    }
  }

  return alerts
}

/**
 * Detecta solicitudes nuevas de reserva (para administración) y aprobaciones/rechazos (para residentes).
 */
export function detectReservationNotifications(
  previous: Reservation[],
  next: Reservation[],
  role: Role,
  currentUid: string,
): LocalNotificationPayload[] {
  const prevMap = new Map(previous.map((r) => [r.id, r]))
  const alerts: LocalNotificationPayload[] = []

  for (const res of next) {
    const old = prevMap.get(res.id)
    const areaLabel = AREA_LABELS[res.commonArea] || res.commonArea
    if (!old) {
      if (role === 'administradora' && res.residentId !== currentUid && res.status === 'Pendiente') {
        alerts.push({
          title: `Nueva solicitud de reserva (${res.apartmentId})`,
          body: `${areaLabel} · ${res.date} (${res.slot})`,
          tag: `res-new-${res.id}`,
        })
      }
    } else if (old.status !== res.status && (res.status === 'Aprobada' || res.status === 'Rechazada')) {
      if (role === 'residente' && res.resolvedBy !== currentUid) {
        const reason =
          res.status === 'Rechazada' && res.rejectionReason
            ? ` · Motivo: ${res.rejectionReason}`
            : ''
        alerts.push({
          title: `Reserva ${res.status.toLowerCase()}: ${areaLabel}`,
          body: `${res.date} (${res.slot})${reason}`,
          tag: `res-status-${res.id}-${res.status}`,
        })
      }
    }
  }

  return alerts
}

/**
 * Detecta nuevos usuarios unidos al conjunto (para administración).
 */
export function detectNewUsersNotifications(
  previous: UserProfile[],
  next: UserProfile[],
  currentUid: string,
): LocalNotificationPayload[] {
  const prevIds = new Set(previous.map((u) => u.uid))
  const alerts: LocalNotificationPayload[] = []

  for (const user of next) {
    if (!prevIds.has(user.uid) && user.uid !== currentUid) {
      alerts.push({
        title: 'Nuevo usuario en el conjunto',
        body: `${user.displayName || user.email} se unió y espera asignación.`,
        tag: `user-new-${user.uid}`,
      })
    }
  }

  return alerts
}

/**
 * Detecta cambios administrativos sobre el perfil propio del usuario (asignación de apto o cambio de rol).
 */
export function detectOwnProfileNotifications(
  previous: UserProfile | null,
  next: UserProfile | null,
): LocalNotificationPayload[] {
  if (!previous || !next || previous.uid !== next.uid) return []
  const alerts: LocalNotificationPayload[] = []

  if (previous.unitId !== next.unitId && next.unitId) {
    alerts.push({
      title: 'Apartamento asignado',
      body: `La administración asignó tu cuenta a la unidad ${next.unitId}.`,
      tag: `profile-unit-${next.unitId}`,
    })
  }
  if (previous.role !== next.role) {
    const roleLabel = next.role === 'administradora' ? 'Administración' : next.role === 'portero' ? 'Portería' : 'Residente'
    alerts.push({
      title: 'Rol actualizado',
      body: `Tu rol en el conjunto cambió a ${roleLabel}.`,
      tag: `profile-role-${next.role}`,
    })
  }

  return alerts
}
