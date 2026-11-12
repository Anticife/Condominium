# Product Context: Mi Conjunto en Línea (Altos del Parque)

## Purpose & Scope
**Mi Conjunto en Línea** es la plataforma tecnológica de gestión operativa y comunitaria para el **Conjunto Residencial Altos del Parque** (Copropiedad de 3 torres, 240 apartamentos, ~600 residentes).
La plataforma reemplaza las minutas en papel, llamadas telefónicas invasivas al citófono y trámites dispersos por WhatsApp o correo electrónico, ofreciendo un entorno operativo digital seguro, auditable y de alto rendimiento.

## Primary Personas & Operating Context
1. **Portero / Vigilante en Turno:**
   - **Dispositivo:** Tableta táctil en puesto de recepción/portería.
   - **Escenario:** Recepción rápida de encomiendas de múltiples transportadoras en horas pico.
   - **Objetivo:** Registrar un paquete en menos de 10 segundos (RNF-10) y verificar la identidad de la persona autorizada al entregar (RN-B4).
2. **Residente / Copropietario:**
   - **Dispositivo:** Teléfono inteligente móvil y navegador web.
   - **Escenario:** Consulta de paquetes pendientes en tiempo real, registro de personas autorizadas bajo Habeas Data, reserva de zonas comunes (Salón Social y BBQ) con validaciones de convivencia, y radicación de PQRS formales.
3. **Administradora General:**
   - **Dispositivo:** Computador portátil / Desktop y tableta.
   - **Escenario:** Censo de 240 apartamentos y 3 torres, resolución fundada de reservas, respuesta oficial a PQRS con historial inmutable (RN-B6) e importación de censo masivo.
4. **Miembros del Consejo de Administración:**
   - **Dispositivo:** Desktop / Tablet.
   - **Escenario:** Reunión mensual de evaluación de gestión con dashboard analítico de impacto (paquetes >15 días RN-B5, tiempo medio de retiro, tasas de resolución de PQRS).

## Core Capabilities & Business Rules
* **RN-B1 (Bloqueo de Cruces):** Prohibición absoluta de superposición horaria en la misma zona común.
* **RN-B2 (Antelación 48h):** Toda solicitud de reserva debe radicarse con al menos 48 horas de anticipación a la fecha/hora de inicio.
* **RN-B3 (Cupo Mensual):** Máximo 1 reserva activa por apartamento al mes calendario.
* **RN-B4 (Entrega Verificada):** Entrega de paquetería restringida exclusivamente a residentes registrados o autorizados en la lista del apartamento.
* **RN-B5 (Alerta Bodegaje >15 días):** Detección automática y cobro de tarifa de custodia para paquetes con más de 15 días en portería.
* **RN-B6 (PQRS con Respuesta Oficial):** Una PQRS solo puede transicionar a 'Resuelta' si incluye una respuesta oficial motivada de mínimo 10 caracteres; historial de cambios inmutable en subcolección de auditoría.
* **RN-B7 (Habeas Data Ley 1581):** Aislamiento estricto de datos privados; ningún residente puede consultar datos, autorizados o paquetes de otros apartamentos.

## Technology Stack & Platform
* **Platform:** Web (`web-app`) con responsive design de alta fidelidad para Desktop, Tablet de Portería y Móvil.
* **Frontend Framework:** React 19 + Vite.
* **Visual Language:** IBM Carbon Design System (Enterprise Grade, IBM Plex Sans, IBM Plex Mono, Carbon Gray & Interactive Blue Palette, Hairline Technical Borders).
* **Backend & Cloud:** Firebase (`condominium-f6236`) — Plan Spark (Hosting, Cloud Firestore, Firestore Security Rules declarativas).
