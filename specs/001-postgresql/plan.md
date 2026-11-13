# 001 — Plan técnico

## 1. Decisiones de arquitectura

| Decisión | Motivo |
|---|---|
| PostgreSQL 16 (`postgres:16-alpine`) | versión estable, imagen liviana, misma que usaremos en Aiven |
| Driver `pg` (node-postgres) | estándar de facto, soporte de *pool* y *type parsers* |
| Mantener SQL en `backend/index.js` | la versión 2 no reescribe la API; sólo cambia el motor |
| Ayudante `?` → `$n` | evita reescribir a mano 24 consultas y reduce el riesgo de error |
| `SMALLINT` para `activo`/`invalidado` | conserva la semántica 0/1 que ya usa el código y las pruebas |
| `VARCHAR + CHECK` en lugar de `ENUM` | los ENUM nativos de PostgreSQL complican las migraciones |
| `SERIAL` | equivalente directo de `AUTO_INCREMENT` y suficiente para el prototipo |
| Puertos 8081 / 3001 / 5433 | permite tener la versión 1 y la 2 al mismo tiempo |
| Contenedores `jsp2-*`, red `jsp2_net` | aislamiento total de la demo anterior |

## 2. Traducción de sintaxis

| MySQL | PostgreSQL |
|---|---|
| `INT UNSIGNED AUTO_INCREMENT` | `SERIAL` |
| `TINYINT(1)` | `SMALLINT` (`0`/`1`) |
| `ENUM('a','b')` | `VARCHAR(20) CHECK (col IN ('a','b'))` |
| `DATETIME` | `TIMESTAMP` |
| `ENGINE=InnoDB DEFAULT CHARSET=...` | se elimina |
| `UNIQUE KEY nombre (col)` | `CONSTRAINT nombre UNIQUE (col)` |
| `KEY idx (col)` | `CREATE INDEX IF NOT EXISTS idx ON ...` |
| `ON DUPLICATE KEY UPDATE x = VALUES(x)` | `ON CONFLICT (clave) DO UPDATE SET x = EXCLUDED.x` |
| `SET FOREIGN_KEY_CHECKS = 0` + `TRUNCATE` | `TRUNCATE tabla1, tabla2, ... RESTART IDENTITY CASCADE` |
| `table_schema = <nombre de la base>` | `table_schema = 'public'` |
| `?` | `$1`, `$2`, … (ayudante) |
| `LAST_INSERT_ID()` | `RETURNING id` |
| error `ER_DUP_ENTRY` | código `23505` |

## 3. Archivos que se modifican

| Archivo | Cambio |
|---|---|
| `docker-compose.yml` | servicio `mysql` → `postgres`; nombres `jsp2-*`; puertos 8081/3001/5433; `DB_HOST: postgres`; `pg_isready`; volumen `jsp2_postgres_data`; red `jsp2_net` |
| `database/init.sql` | reescritura completa a PostgreSQL; mismas tablas, mismos datos, idempotente |
| `backend/package.json` | `mysql2` → `pg` |
| `backend/Dockerfile` | valores por defecto `DB_HOST=postgres`, `DB_PORT=5432`; comentario |
| `backend/index.js` | `Pool` de `pg`, *type parsers*, `consultar()`/`ejecutar()`, `ON CONFLICT`, `RETURNING id`, `TRUNCATE … CASCADE`, `information_schema` con `public`, mensajes y errores |
| `scripts/encargado.js` | conexión `pg`; mismas acciones y mensajes |
| `scripts/migrar-encargados.js` | conexión `pg` (remoto futuro) |
| `scripts/sembrar-remoto.js` | conexión `pg`; ya no hace `DROP TABLE` con FK de MySQL |
| `frontend/js/api.js`, `app.js`, `dashboard.js` | textos "MySQL" → "PostgreSQL" (sólo comentarios/mensajes) |
| `frontend/index.html`, `historial.html`, `sobre.html` | textos visibles |
| `test/verificacion.js` | verificar `postgres:` y `DB_HOST: postgres`, `pg` en el backend, DDL de PostgreSQL, puertos nuevos |
| `README.md`, `.env.example` | instrucciones y variables |
| `specs/`, `docs/` | SDD y diseño |

## 4. Detalle del backend

1. Reemplazar `require('mysql2/promise')` por `require('pg')`.
2. Configurar:

```js
types.setTypeParser(20, v => parseInt(v, 10));      // COUNT(*) / bigint
types.setTypeParser(1700, v => parseFloat(v));      // DECIMAL / numeric
```

3. Crear el `Pool` con `host`, `port`, `user`, `password`, `database`,
   `max: DB_POOL`, `ssl` si `DB_SSL=true` y `options: '-c timezone=America/Lima'`.
4. Añadir:

```js
function pgSql(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => '$' + (++n));
}
async function consultar(sql, params = []) {
  const { rows } = await pool.query(pgSql(sql), params);
  return rows;
}
async function ejecutar(sql, params = []) {
  return pool.query(pgSql(sql), params);
}
```

5. Sustituir `const [rows] = await pool.query(...)` por
   `const rows = await consultar(...)`.
6. Sustituir `await pool.execute(...)` por `await ejecutar(...)`.
7. Los `INSERT` que necesitan el id pasan a `RETURNING id` y leen
   `resultado.rows[0].id`.
8. `ON DUPLICATE KEY UPDATE` → `ON CONFLICT (dni) DO UPDATE SET ...`.
9. `information_schema` → `table_schema = 'public'`.
10. Reinicio de demo con `pg.Client` + `TRUNCATE ... RESTART IDENTITY CASCADE`
    y el mismo `init.sql`.
11. Duplicados: comprobar `e.code === '23505'`.

## 5. Verificación

| Paso | Comando / acción | Resultado esperado |
|---|---|---|
| 1 | `docker compose up -d --build` | 3 contenedores *healthy* |
| 2 | `curl http://localhost:8081/api/health` | `baseDatos: conectada`, `tablas: 6` |
| 3 | `curl http://localhost:8081/api/entradas` | 7 entradas |
| 4 | transferencia de ENTRY001 desde la web | estado `transferido` |
| 5 | `POST /api/demo/reiniciar` | datos iniciales |
| 6 | `/staff/` con `ANA2026` | panel abre |
| 7 | `npm test` | 0 fallos |
| 8 | `docker compose down` + `up` | datos persisten (volumen) |

## 6. Riesgos residuales

- **Zona horaria:** si el contenedor no hereda `TZ`, las horas se corren 5 h.
  Se fija `TZ` en compose y `options` en el Pool.
- **Precios como texto:** mitigado con el parser de `numeric`.
- **Pruebas con cadenas exactas:** se actualizan sólo las líneas que exigían
  MySQL; el resto queda intacto.
- **Scripts remotos:** quedan listos para PostgreSQL, pero no se probarán
  contra Aiven hasta la fase de producción.
