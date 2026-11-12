/**
 * Inicialización de Firebase (plan Spark: Auth + Firestore, sin Functions).
 * La configuración se lee de variables VITE_FIREBASE_* con valores fallback seguros para RNF-07.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {}

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCgOVz0OTvKmv8ZdVS7XstuRZER1tI8tyI',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'condominium-f6236.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'condominium-f6236',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'condominium-f6236.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '452274246990',
  appId: env.VITE_FIREBASE_APP_ID || '1:452274246990:web:83f234b2cde639ba413a1f',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-LP5JYC0HZB',
}

let app: FirebaseApp
let auth: Auth
let db: Firestore

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
} catch (e) {
  console.warn('Firebase initializeApp warning:', e)
  app = {} as FirebaseApp
}

try {
  auth = getAuth(app)
} catch (e) {
  console.warn('Firebase getAuth warning (Identity Platform pending in console):', e)
  auth = {} as Auth
}

try {
  db = getFirestore(app)
} catch (e) {
  console.warn('Firebase getFirestore warning:', e)
  db = {} as Firestore
}

export { app, auth, db }
