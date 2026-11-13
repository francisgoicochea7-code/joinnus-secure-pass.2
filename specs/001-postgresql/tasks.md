# 001 — Tareas

> Marcar `[x]` al terminar y anotar el resultado de la verificación.
> Orden pensado para no romper la demo en ningún momento.

## A. Infraestructura

- [x] A1. Crear el servicio `postgres:16-alpine` en `docker-compose.yml`
      (contenedor `jsp2-postgres`, puerto `127.0.0.1:5433`, volumen
      `jsp2_postgres_data`, `pg_isready`, `TZ=America/Lima`).
- [x] A2. Cambiar backend y frontend a nombres `jsp2-*`, red `jsp2_net` y
      puertos 3001 / 8081.
- [x] A3. `DB_HOST: postgres`, `DB_PORT: 5432`, `POSTGRES_*` desde `.env`.
- [x] A4. Montar `database/init.sql` en `/docker-entrypoint-initdb.d/`.

## B. Esquema

- [x] B1. Reescribir las 7 tablas en sintaxis PostgreSQL.
- [x] B2. Índices, claves únicas y foráneas con nombres.
- [x] B3. `CHECK` de los estados y acciones (equivalente a los ENUM).
- [x] B4. Datos ficticios idénticos y **idempotentes** (`ON CONFLICT`).
- [x] B5. Verificar que el archivo se puede ejecutar dos veces.

## C. Backend

- [x] C1. `backend/package.json`: quitar `mysql2`, agregar `pg`.
- [x] C2. Pool de `pg` + *type parsers* + `options` de zona horaria.
- [x] C3. Ayudantes `consultar()` / `ejecutar()` con conversión `?` → `$n`.
- [x] C4. Adaptar las 24 consultas.
- [x] C5. `ON CONFLICT` en el alta/actualización de usuarios.
- [x] C6. `RETURNING id` donde se necesita el identificador.
- [x] C7. Reinicio de demo con `TRUNCATE … RESTART IDENTITY CASCADE`.
- [x] C8. `information_schema` con `table_schema = 'public'`.
- [x] C9. Error de duplicado `23505`.
- [x] C10. Mensajes y comentarios "MySQL" → "PostgreSQL".
- [x] C11. `backend/Dockerfile` con `DB_HOST=postgres`, `DB_PORT=5432`.

## D. Scripts

- [x] D1. `scripts/encargado.js` con `pg` (local y `--remoto`).
- [x] D2. `scripts/migrar-encargados.js` con `pg`.
- [x] D3. `scripts/sembrar-remoto.js` con `pg`.

## D.1 Cierre de dependencias (2026-11-13)

- [x] Sustituir `mysql2` por `pg` también en el paquete raíz y actualizar su lockfile.
      Los scripts de `scripts/` y la función de Vercel deben poder resolver `pg`
      tras instalar únicamente las dependencias de la raíz.
- [x] Añadir una prueba de regresión que compruebe ambos manifiestos y lockfiles,
      y ejecutar `npm test` antes de preparar el commit.

Verificación del cierre: instalación de dependencias de raíz correcta;
`npm test`: 756 + 863 comprobaciones y 38 pruebas unitarias, 0 fallos.
No se modificaron datos ni se ejecutaron scripts contra la base remota.

## E. Frontend

- [x] E1. Textos visibles de `index.html`, `historial.html`, `sobre.html`.
- [x] E2. Mensajes de `app.js`, `dashboard.js` y comentario de `api.js`.

## F. Pruebas y documentación

- [x] F1. Actualizar en `test/verificacion.js` lo que exigía MySQL.
- [x] F2. `npm test` en verde.
- [x] F3. README: puertos, credenciales, comandos de PostgreSQL.
- [x] F4. `.env.example` con las variables nuevas.
- [x] F5. Captura del tablero de SonarQube de la versión 2.

## G. Verificación final

- [x] G1. CA-1 arranque limpio.
- [x] G2. CA-2 datos iniciales.
- [x] G3. CA-3 reinicio de demo.
- [x] G4. CA-4 transferencia.
- [x] G5. CA-5 encargados.
- [x] G6. CA-6 pruebas.
- [x] G7. CA-7 coexistencia con la versión 1.

## Resultado de la verificación (2026-11-03)

- docker compose up -d --build: los tres contenedores quedaron *healthy*.
- /api/health: base conectada, 6 tablas de datos (la séptima, `encargados`,
  se cuenta aparte en el endpoint de salud de la versión 1).
- 7 entradas sembradas y 13 movimientos de historial.
- Transferencia de ENTRY001 correcta; el reinicio de la demo devolvió 7 entradas.
- Login de encargado: 200 con ANA2026 y 401 con un código incorrecto.
- `npm test`: 756 + 863 comprobaciones y 35 pruebas unitarias, 0 fallos.
- Coexistencia: v1 en 8080/3000/3307 y v2 en 8081/3001/5433.
