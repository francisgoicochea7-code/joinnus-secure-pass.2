# 002 — Pruebas unitarias

- **Estado:** borrador
- **Fecha:** 2026-11-03

## 1. Contexto

Hoy `npm test` ejecuta:

- `test/qr-selftest.js`: 756 comprobaciones del codificador QR (unitarias de
  hecho, pero sobre una sola pieza).
- `test/verificacion.js`: 862 comprobaciones funcionales sobre las páginas
  reales dentro de un micro-DOM.

Falta lo clásico de un proyecto: **pruebas unitarias de las funciones del
backend**, aisladas, rápidas y sin base de datos.

## 2. Objetivo

Incorporar pruebas unitarias con el módulo nativo `node:test` (sin
dependencias nuevas) que cubran la lógica pura del backend y que se ejecuten
con `npm test`.

## 3. Alcance

**Incluye**

- `test/unit/*.test.js` ejecutables con `node --test`.
- Exportar desde `backend/index.js` las funciones puras que se van a probar,
  sin cambiar su comportamiento.
- Script `npm run test:unit`.
- Integración en `npm test`.

**No incluye**

- Pruebas de integración con PostgreSQL (fase 001).
- Pruebas de interfaz (ya existen en `test/verificacion.js`).
- Cobertura de código obligatoria.

## 4. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | `npm run test:unit` ejecuta sólo pruebas unitarias, sin red ni base de datos |
| RF-2 | Cubre como mínimo: ocultar DNI, fecha corta, hash de encargado, firma/validación de token y validación de la transferencia |
| RF-3 | Al menos 20 casos y mensajes de fallo claros en español |
| RF-4 | `npm test` ejecuta QR + aplicación + unitarias |
| RF-5 | Ninguna prueba toca `process.exit`, puertos ni archivos temporales |
| RF-6 | Las funciones exportadas no cambian el comportamiento actual |

## 5. Criterios de aceptación

```
Dado el repositorio sin contenedores
Cuando ejecuto `npm run test:unit`
Entonces todas las pruebas pasan en menos de 5 segundos
Y no se abre ninguna conexión a la base de datos
```

```
Dado un DNI de 8 dígitos
Cuando llamo a ocultarDNI
Entonces los dígitos del medio quedan ocultos y el resultado tiene la misma longitud
```

```
Dado el nombre "Ana Torres" y el código "ANA2026"
Cuando calculo el hash
Entonces coincide con 05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083
```

```
Dado un payload firmado con el secreto
Cuando lo valido con el mismo secreto
Entonces es válido
Y si cambio un carácter, deja de serlo
```

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| `backend/index.js` exige `QR_SECRET` al cargarse | el archivo de prueba define `process.env.QR_SECRET` antes del `require` |
| Cargar el backend crea un Pool | `pg` no conecta hasta la primera consulta; no se ejecuta ninguna |
| Duplicar lógica para poder probarla | se exportan las funciones reales, no copias |
