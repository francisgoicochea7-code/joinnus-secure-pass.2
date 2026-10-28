/* =========================================================================
 * JOINNUS SECURE PASS — scripts/migrar-encargados.js
 * -------------------------------------------------------------------------
 * Añade la tabla `encargados` y sus cuentas demo a una base YA sembrada
 * (por ejemplo la de Aiven que usa la web en producción).
 *
 * Es idempotente: se puede ejecutar las veces que haga falta.
 *
 * Uso:
 *   npm run db:encargados
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const archivoEnv = process.env.ARCHIVO_ENV || path.join(raiz, '.env.remota');

if (!fs.existsSync(archivoEnv)) {
  console.error(`[ERROR] No existe ${archivoEnv}`);
  process.exit(1);
}

require('dotenv').config({ path: archivoEnv });
const mysql = require('mysql2/promise');

function sslDeLaBase() {
  const ca = String(process.env.DB_SSL_CA || '').trim();
  if (!ca) {
    return process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : {};
  }
  const pem = ca.includes('-----BEGIN') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
  return { ca: pem };
}

const cfg = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'joinnus_secure_pass',
  ssl: process.env.DB_SSL === 'true' ? sslDeLaBase() : undefined
};

const falta = ['host', 'user', 'password'].filter(k => !cfg[k]);
if (falta.length) {
  console.error(`[ERROR] Faltan variables en ${archivoEnv}: ${falta.join(', ').toUpperCase()}`);
  process.exit(1);
}

(async () => {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'utf8mb4_unicode_ci',
    ssl: cfg.ssl,
    connectTimeout: 25000
  });
  console.log(`[BD] Conectado a ${cfg.host}:${cfg.port}/${cfg.database}`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS encargados (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nombre      VARCHAR(120) NOT NULL,
      codigo_hash CHAR(64)     NOT NULL,
      activo      TINYINT(1)   NOT NULL DEFAULT 1,
      creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_encargados_nombre (nombre),
      UNIQUE KEY uq_encargados_codigo (codigo_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[BD] Tabla encargados lista.');

  await conn.query(`
    INSERT INTO encargados (nombre, codigo_hash, activo) VALUES
      ('Ana Torres',   '05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083', 1),
      ('Luis Paredes', '0e1a8938b8da063e695a1a93c11eb3c61fbf78788269d0689f5b96fabd5df65b', 1)
    ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), activo = VALUES(activo)
  `);

  const [filas] = await conn.query('SELECT id, nombre, activo FROM encargados ORDER BY id');
  console.log('');
  console.log('  ====================================================');
  console.log('   ENCARGADOS DISPONIBLES');
  filas.forEach(f => console.log(`   #${f.id}  ${f.nombre}${Number(f.activo) ? '' : ' (inactivo)'}`));
  console.log('   Códigos demo: ANA2026 (Ana) · LUIS2026 (Luis)');
  console.log('  ====================================================');

  await conn.end();
})().catch(e => {
  console.error('[ERROR] No se pudo migrar la base remota:', e.message);
  process.exit(1);
});
