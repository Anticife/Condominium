# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Backend (plan Spark: Firestore + reglas, sin Cloud Functions)

Toda la lógica de negocio vive en `../firestore.rules` y en los servicios de `src/services/`:

| Archivo | Tarea | Qué hace |
|---|---|---|
| `userService.ts` | SCRUM-6 | Autorregistro como residente, asignación de roles y apartamento |
| `censusService.ts` | SCRUM-10 | Torres, apartamentos (`T1-101`) y personas autorizadas |
| `packageService.ts` | SCRUM-14, 17, 21 | Registro, suscripción en tiempo real y entrega de paquetes |
| `reservationService.ts` | SCRUM-24 | Solicitud de reservas con RN-B1, RN-B2 y RN-B3 |

Configuración: copia `.env.example` como `.env`.

### Pruebas

```bash
npm test             # lógica sin emulador
npm run test:rules   # reglas + servicios contra el emulador de Firestore (requiere Java 11+)
```

GitHub Actions corre toda la suite con el emulador en cada pull request (`.github/workflows/rules-tests.yml`).

### Carga del censo (SCRUM-43)

- Plantilla: `public/plantilla-censo.csv` (columnas `Torre;Apartamento;NombreResidente;Email;Telefono;EsPropietario`).
  La torre puede escribirse «Torre 1», «T1» o «1».
- `readCensusFile(file)` acepta `.csv` o `.xlsx` y devuelve el texto para `importCensusFromCsv(db, texto)`.
- Las torres que ya existen no se modifican.
- Cada residente con correo queda pre-registrado en `residentInvitations/{email}` (solo lo ve la administradora).
  Sin Cloud Functions no se pueden crear cuentas desde el navegador: el residente se registra con ese correo y la
  administradora le asigna su apartamento con `assignResidentToApartment`, usando `getResidentInvitation(db, email)`.

### Primera administradora

No hay Cloud Functions, así que la primera cuenta con rol `administradora` se crea a mano:
regístrate en la app y, en la consola de Firebase → Firestore → `users/{tu uid}`, cambia `role` a `administradora`.
Desde ahí, la administradora asigna los demás roles desde la app.
