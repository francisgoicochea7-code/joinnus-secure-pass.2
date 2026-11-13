# 001 — Migración de MySQL a PostgreSQL (entorno local)

- **Estado:** aprobado
- **Fecha:** 2026-11-03
- **Responsable:** equipo Joinnus Secure Pass
- **Alcance:** entorno local (Docker). Producción (Aiven/Vercel) queda para una
  fase posterior.

## 1. Contexto

La versión 1 guarda todo en **MySQL 8** y el backend usa el driver `mysql2`.
Eso deja huellas de MySQL por todas partes: `ON DUPLICATE KEY UPDATE`,
`TINYINT(1)`, `ENUM`, `AUTO_INCREMENT`, backticks, `SET FOREIGN_KEY_CHECKS`,
`information_schema` con el nombre de la base como esquema y marcadores `?`.

La versión 2 debe usar **PostgreSQL 16** en local sin cambiar el
comportamiento visible de la aplicación: mismas páginas, mismos 16 endpoints,
mismos estados de entrada y mismas pruebas funcionales.

## 2. Objetivo

Que `docker compose up --build` levante PostgreSQL + backend + frontend y que
todos los flujos (consulta, verificación, QR, transferencia, historial,
panel de encargados, reinicio de demo) funcionen igual que con MySQL.

## 3. Alcance

**Incluye**

- `database/init.sql` reescrito para PostgreSQL (esquema + datos ficticios).
- `docker-compose.yml`: servicio `postgres` en lugar de `mysql`.
- Backend (`backend/index.js`, `backend/package.json`, `backend/Dockerfile`).
- Scripts de administración (`scripts/*.js`).
- Textos visibles que dicen "MySQL".
- Verificaciones que exigían MySQL (se actualizan en este repositorio).
- README y ejemplos de conexión local.

**No incluye** (fase siguiente)

- Crear el servicio PostgreSQL en Aiven y migrar los datos de producción.
- Cambiar las variables de entorno de Vercel.
- Cambiar el diseño visual de las páginas.

## 4. Requisitos funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-1 | El compose declara exactamente 3 servicios: `postgres`, `backend`, `frontend` | obligatorio |
| RF-2 | PostgreSQL 16 con volumen persistente y *healthcheck* (`pg_isready`) | obligatorio |
| RF-3 | El backend se conecta con el driver `pg` y espera a la base al arrancar | obligatorio |
| RF-4 | `GET /api/health` responde `baseDatos: "conectada"` y `tablas: 6` | obligatorio |
| RF-5 | Los 16 endpoints conservan ruta, método y forma del JSON | obligatorio |
| RF-6 | Los datos ficticios son idénticos: 6 usuarios, 5 eventos, 7 entradas (`ENTRY001`…`ENTRY007`), historial, transferencia histórica y 2 encargados | obligatorio |
| RF-7 | `POST /api/demo/reiniciar` vuelve a dejar los datos iniciales | obligatorio |
| RF-8 | La transferencia en dos pasos y el QR dinámico funcionan igual | obligatorio |
| RF-9 | El panel `/staff/` valida códigos de encargado igual que antes | obligatorio |
| RF-10 | `database/init.sql` se puede ejecutar dos veces sin duplicar datos | obligatorio |
| RF-11 | Los scripts `npm run encargado` (local y `--remoto`) funcionan con PostgreSQL | obligatorio |
| RF-12 | La aplicación se puede levantar junto a la versión 1 sin chocar (puertos y nombres propios) | deseable |

## 5. Criterios de aceptación

**CA-1 — Arranque limpio**

```
Dado el repositorio sin contenedores de la versión 2
Cuando ejecuto `docker compose up -d --build`
Entonces los 3 contenedores quedan "healthy"
Y http://localhost:8081/api/health responde 200 con baseDatos="conectada"
```

**CA-2 — Datos iniciales**

```
Dado el stack arriba
Cuando consulto GET /api/entradas/ENTRY001
Entonces el estado es "valido", el titular es Carlos Pérez y el evento es Lima Music Fest
Y GET /api/entradas devuelve 7 entradas (ENTRY001…ENTRY007)
```

**CA-3 — Reinicio de demo**

```
Dado que usé o transferí entradas
Cuando ejecuto POST /api/demo/reiniciar
Entonces ENTRY001 vuelve a "valido", ENTRY002 a "usado", ENTRY003 a "anulado" y ENTRY004 a "transferido"
Y el historial vuelve a sus 13 registros iniciales
```

**CA-4 — Transferencia**

```
Dado ENTRY001 en estado "valido"
Cuando completo la transferencia en dos pasos
Entonces la entrada queda "transferido", el token anterior queda invalidado
Y aparece un registro nuevo en el historial
```

**CA-5 — Encargados**

```
Dado el encargado "Ana Torres" con código ANA2026 (hash en la base)
Cuando inicia sesión en /api/encargados/login
Entonces recibe 200
Y un código incorrecto recibe 401
```

**CA-6 — Pruebas**

```
Cuando ejecuto `npm test`
Entonces las comprobaciones de QR y de la aplicación terminan con 0 fallos
```

**CA-7 — Coexistencia**

```
Dado que la versión 1 está corriendo en 8080/3000/3307
Cuando levanto la versión 2
Entonces usa 8081/3001/5433 y contenedores jsp2-* sin detener la versión 1
```

## 6. Requisitos no funcionales

- **RNF-1:** credenciales sólo por `.env` (nunca en el repositorio).
- **RNF-2:** PostgreSQL escucha en `127.0.0.1` (no expuesto a la red).
- **RNF-3:** zona horaria `America/Lima` en los tres contenedores.
- **RNF-4:** el arranque completo no debe superar los 90 s en un equipo como el
  de la exposición.
- **RNF-5:** las fechas, horas y precios se muestran igual que en la versión 1
  (sin corrimientos por UTC ni precios convertidos a texto).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `pg` devuelve `COUNT(*)` y `DECIMAL` como texto | configurar *type parsers* (`int8` y `numeric`) |
| Fechas sin zona horaria | columnas `TIMESTAMP` + `TZ=America/Lima` |
| Pruebas que exigen MySQL | actualizarlas sólo en lo imprescindible (autorizado) |
| Choque con la demo de la versión 1 | puertos 8081/3001/5433 y contenedores `jsp2-*` |
| Código de error distinto al duplicar | traducir `23505` a la respuesta que ya existía |
| Volumen viejo de MySQL | volumen nuevo `jsp2_postgres_data` |

## 8. Cambios de alcance

- (ninguno por ahora)
