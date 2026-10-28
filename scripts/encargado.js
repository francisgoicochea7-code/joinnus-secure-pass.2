/* =========================================================================
 * JOINNUS SECURE PASS — scripts/encargado.js
 * -------------------------------------------------------------------------
 * Gestiona las cuentas del panel de encargados (/staff/) SIN escribir SQL.
 *
 * Uso:
 *   npm run encargado -- --listar
 *   npm run encargado -- "grabiela paz" "GABI2026"
 *   npm run encargado -- --renombrar "grabiela paz" "Gabriela Paz Ríos" "GABI2026"
 *   npm run encargado -- --desactivar "Luis Paredes"
 *   npm run encargado -- --activar "Luis Paredes"
 *
 * Añade --remoto para trabajar sobre la base de producción (Aiven):
 *   npm run encargado -- --listar --remoto
 *
 * El código NUNCA se guarda: solo el hash SHA-256 de "nombre:codigo".
 * Por eso no se puede "ver" un código; este comando lo reemplaza.
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.join(__dirname, '..');
const usaRemoto = process.argv.includes('--remoto');
const archivoEnv = path.join(raiz, usaRemoto ? '.env.remota' : '.env');

if (usaRemoto && !fs.existsSync(archivoEnv)) {
  console.error('[ERROR] No existe .env.remota (datos de Aiven).');
  process.exit(1);
}

require('dotenv').config({ path: archivoEnv });
const mysql = require('mysql2/promise');

/* ----------------------------- Conexión ------------------------------- */

function sslDeLaBase() {
  const ca = String(process.env.DB_SSL_CA || '').trim();
  if (!ca) {
    return process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : {};
  }
  const pem = ca.includes('-----BEGIN') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
  return { ca: pem };
}

const cfg = usaRemoto
  ? {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'joinnus_secure_pass',
      ssl: process.env.DB_SSL === 'true' ? sslDeLaBase() : undefined
    }
  : {
      // Base local del docker-compose (el puerto 3307 está publicado)
      host: '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3307),
      user: process.env.DB_USER || 'joinnus',
      password: process.env.DB_PASSWORD || 'joinnus_pass',
      database: process.env.DB_NAME || 'joinnus_secure_pass'
    };

const ETIQUETA = usaRemoto ? 'PRODUCCIÓN (Aiven)' : 'LOCAL (Docker)';

/* ------------------------------ Utilidades ----------------------------- */

/** Mismo cálculo que backend/index.js: nombre sin mayúsculas, código en
 *  mayúsculas, y SHA-256 de "nombre:codigo". */
function huella(nombre, codigo) {
  const n = String(nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const c = String(codigo || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(`${n}:${c}`).digest('hex');
}

function normalizarNombre(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

async function listar(conn) {
  const [filas] = await conn.query(
    'SELECT id, nombre, activo, creado_en FROM encargados ORDER BY id');
  if (!filas.length) {
    console.log('No hay encargados todavía.');
    return;
  }
  console.log(`Encargados en ${ETIQUETA}:`);
  filas.forEach(f => {
    const estado = Number(f.activo) ? 'activo' : 'INACTIVO';
    console.log(`  #${f.id}  ${f.nombre}  (${estado})`);
  });
  console.log('\nLos códigos no se muestran porque no se guardan: solo su hash.');
}

async function crearOActualizar(conn, nombre, codigo) {
  const n = normalizarNombre(nombre);
  const c = String(codigo || '').trim().toUpperCase();
  if (!n || !c) throw new Error('Uso: npm run encargado -- "<nombre>" "<codigo>"');

  const h = huella(n, c);

  // El código no puede estar repetido en otra persona (el hash es único)
  const [dueno] = await conn.execute(
    'SELECT nombre FROM encargados WHERE codigo_hash = ? AND nombre <> ? LIMIT 1', [h, n]);
  if (dueno.length) {
    throw new Error(`Ese código ya lo usa ${dueno[0].nombre}. Elige otro.`);
  }

  await conn.execute(
    `INSERT INTO encargados (nombre, codigo_hash, activo) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), activo = 1`,
    [n, h]);

  console.log(`✔ ${n}: código "${c}" asignado en ${ETIQUETA}.`);
  console.log('  (El código no se guarda; si lo olvidas, asigna uno nuevo con este mismo comando.)');
}

async function renombrar(conn, anterior, nuevo, codigo) {
  const viejo = normalizarNombre(anterior);
  const n = normalizarNombre(nuevo);
  const c = String(codigo || '').trim().toUpperCase();
  if (!viejo || !n || !c) {
    throw new Error('Uso: npm run encargado -- --renombrar "<nombre actual>" "<nombre nuevo>" "<codigo nuevo>"');
  }

  const [filas] = await conn.execute(
    'SELECT id FROM encargados WHERE LOWER(nombre) = LOWER(?) LIMIT 1', [viejo]);
  if (!filas.length) throw new Error(`No existe ningún encargado llamado "${viejo}".`);

  const [choque] = await conn.execute(
    'SELECT nombre FROM encargados WHERE LOWER(nombre) = LOWER(?) AND id <> ? LIMIT 1',
    [n, filas[0].id]);
  if (choque.length) throw new Error(`Ya existe otro encargado llamado "${choque[0].nombre}".`);

  await conn.execute(
    'UPDATE encargados SET nombre = ?, codigo_hash = ? WHERE id = ?',
    [n, huella(n, c), filas[0].id]);

  console.log(`✔ "${viejo}" ahora es "${n}" con el código "${c}" (${ETIQUETA}).`);
}

async function cambiarActivo(conn, nombre, activo) {
  const n = normalizarNombre(nombre);
  if (!n) throw new Error('Uso: npm run encargado -- --desactivar "<nombre>"');
  const [res] = await conn.execute(
    'UPDATE encargados SET activo = ? WHERE LOWER(nombre) = LOWER(?)', [activo, n]);
  if (!res.affectedRows) throw new Error(`No existe ningún encargado llamado "${n}".`);
  console.log(`✔ ${n}: ${activo ? 'activado' : 'desactivado'} en ${ETIQUETA}.`);
}

/* -------------------------------- Main --------------------------------- */

(async () => {
  const args = process.argv.slice(2).filter(a => a !== '--remoto');
  const opcion = args.find(a => a.startsWith('--')) || '';
  const valores = args.filter(a => !a.startsWith('--'));

  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'utf8mb4_unicode_ci',
    ssl: cfg.ssl,
    connectTimeout: 20000
  });

  try {
    if (opcion === '--listar' || args.length === 0) {
      // solo listar
    } else if (opcion === '--renombrar') {
      await renombrar(conn, valores[0], valores[1], valores[2]);
    } else if (opcion === '--desactivar') {
      await cambiarActivo(conn, valores[0], 0);
    } else if (opcion === '--activar') {
      await cambiarActivo(conn, valores[0], 1);
    } else if (!opcion) {
      await crearOActualizar(conn, valores[0], valores[1]);
    } else {
      throw new Error('Opción no reconocida: ' + opcion);
    }
    console.log('');
    await listar(conn);
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('\n[ERROR] ' + e.message);
  if (/ECONNREFUSED|connect/i.test(e.message)) {
    console.error('        ¿Está Docker encendido? (docker compose up -d)');
  }
  process.exit(1);
});
