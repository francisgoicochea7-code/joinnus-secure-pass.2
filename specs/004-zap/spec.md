# 004 — Endurecimiento web tras ZAP

## Alcance

Joinnus v2, sin cambios en v1, culebrita ni Juice Shop. Resolver la falta de
CSP, autoalojar Plus Jakarta Sans y permitir HTTPS local sin guardar claves
en Git. Mantener el modo HTTP de desarrollo como opción explícita.

## Criterios de aceptación

- CSP en todas las respuestas Nginx, incluidos assets y errores; scripts sólo
  del mismo origen, sin `unsafe-inline` ni `unsafe-eval` en scripts.
- Fuente y licencia locales, sin conexiones a Google Fonts.
- HTTPS local mediante configuración Compose opcional, claves montadas sólo
  en lectura y fuera del contexto de construcción. HTTP redirige a HTTPS en
  ese modo. No instalar autoridades de confianza automáticamente.
- `npm test` pasa; verificar Nginx, cabeceras y navegación real cuando Docker
  esté disponible. Cámara y transferencias requieren comprobación adicional.
- Conservar informe ZAP original; no declarar resueltas las alertas hasta
  repetir el escaneo contra el despliegue HTTPS.

Fuera de alcance: autenticación, permisos y despliegue de producción.
