/* =========================================================================
 * JOINNUS SECURE PASS — scripts/sembrar-remoto.js
 * -------------------------------------------------------------------------
 * Aplica database/init.sql (esquema + datos ficticios) a un PostgreSQL
 * REMOTO: el que usará la API desplegada en Vercel (Aiven u otro proveedor).
 *
 * Uso:
 *   1) Copia .env.remota.example a .env.remota y pon ahí los datos que te
 *      dio tu proveedor de base de datos (DB_SSL=true si exige TLS).
 *   2) npm run db:remoto              -> crea tablas y datos de la demo
 *      npm run db:remoto -- --reset   -> borra todo y empieza de cero
 *
 * No toca el PostgreSQL de Docker: ese lo siembra init.sql solo al arrancar.
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const archivoEnv = process.env.ARCHIVO_ENV || path.join(raiz, '.env.remota');

if (!fs.existsSync(archivoEnv)) {
  console.error(`[ERROR] No existe ${archivoEnv}`);
  console.error('        Copia .env.remota.example a .env.remota y pon ahi los datos');
  console.error('        del PostgreSQL remoto (host, puerto, usuario, clave y DB_SSL=true).');
  process.exit(1);
}

require('dotenv').config({ path: archivoEnv });

const { Client } = require('pg');

/* TLS: si el proveedor exige su propia CA (Aiven), DB_SSL_CA admite la ruta de
 * un fichero .pem o el propio certificado pegado (con \n como salto de línea).
 * Sin CA, DB_SSL_INSECURE=true cifra sin verificar el servidor. */
function sslDeLaBase() {
  const ca = String(process.env.DB_SSL_CA || '').trim();
  if (!ca) {
    return process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : {};
  }
  const pem = ca.includes('-----BEGIN')
    ? ca.replace(/\\n/g, '\n')
    : fs.readFileSync(ca, 'utf8');
  return { ca: pem };
}

const cfg = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
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
  const reiniciar = process.argv.includes('--reset');
  const init = fs.readFileSync(path.join(raiz, 'database', 'init.sql'), 'utf8');

  const conn = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl,
    connectionTimeoutMillis: 25000
  });
  await conn.connect();
  console.log(`[BD] Conectado a ${cfg.host}:${cfg.port}/${cfg.database}`);

  const contar = async tabla => {
    try {
      const { rows } = await conn.query(`SELECT COUNT(*) AS n FROM ${tabla}`);
      return rows[0].n;
    } catch (e) {
      return 0;             // la tabla aun no existe
    }
  };

  if (reiniciar) {
    console.log('[BD] --reset: se borran las tablas existentes…');
    await conn.query('DROP TABLE IF EXISTS ' +
      'encargados, tokens_qr, historial, transferencias, entradas, eventos, usuarios CASCADE');
  } else if (await contar('usuarios') > 0) {
    console.error('[ERROR] Esa base ya tiene datos (usuarios sembrados).');
    console.error('        Si quieres empezar de cero:  npm run db:remoto -- --reset');
    await conn.end();
    process.exit(1);
  }

  console.log('[BD] Ejecutando database/init.sql (esquema + demo)…');
  await conn.query(init);

  const usuarios = await contar('usuarios');
  const entradas = await contar('entradas');
  const eventos = await contar('eventos');
  console.log('');
  console.log('  ====================================================');
  console.log('   BASE DE DATOS REMOTA LISTA');
  console.log(`   ${usuarios} usuarios | ${eventos} eventos | ${entradas} entradas`);
  console.log('   Usuarios de la demo: DNI 45678945 (Carlos Perez),');
  console.log('   52311878 (Andrea Torres), 44370754 (nora bardales)…');
  console.log('  ====================================================');

  await conn.end();
})().catch(e => {
  console.error('[ERROR] No se pudo sembrar la base remota:', e.message);
  process.exit(1);
});
