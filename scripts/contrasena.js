/* =========================================================================
 * JOINNUS SECURE PASS — scripts/contrasena.js
 * -------------------------------------------------------------------------
 * Gestiona las contraseñas de las cuentas de la API (base auth_db) SIN tener
 * que escribir SQL a mano y sin guardar nunca el texto plano.
 *
 * Uso:
 *   npm run contrasena -- --listar
 *   npm run contrasena -- --hash "NuevaClave1"
 *   npm run contrasena -- 45678945 "NuevaClave1"
 *   npm run contrasena -- --verificar 45678945 "NuevaClave1"
 *
 * Por defecto trabaja con la base local del stack de microservicios
 * (127.0.0.1:5434 / auth_db) usando AUTH_DB_PASSWORD de .env.micro.
 * Para otra base (por ejemplo Aiven) define DATABASE_URL:
 *   set DATABASE_URL=postgres://usuario:clave@host:puerto/auth_db
 *   npm run contrasena -- --listar
 *
 * En DBeaver la columna password_hash sólo muestra el hash scrypt: es
 * imposible "leer" la contraseña original. Para cambiarla hay dos caminos:
 *   1) este comando (recomendado), o
 *   2) generar el hash con --hash y pegarlo en la celda password_hash.
 * ========================================================================= */

'use strict';

const path = require('path');

const raiz = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(raiz, '.env.micro') });

const { hashPassword, verifyPassword } = require('../services/shared/password');

const RE_DNI = /^\d{8}$/;
const MIN = 8;
const MAX = 200;

function errorar(texto) {
  throw new Error(texto);
}

function urlDeLaBase() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const usuario = process.env.AUTH_DB_USER || 'auth_user';
  const clave = process.env.AUTH_DB_PASSWORD;
  if (!clave) {
    errorar('Falta AUTH_DB_PASSWORD en .env.micro o define DATABASE_URL.');
  }
  const puerto = process.env.MICRO_POSTGRES_PORT || '5434';
  return 'postgres://' + encodeURIComponent(usuario) + ':' + encodeURIComponent(clave) +
    '@127.0.0.1:' + puerto + '/auth_db';
}

function validarNueva(nueva) {
  if (nueva.length < MIN || nueva.length > MAX) {
    errorar('La contraseña debe tener entre ' + MIN + ' y ' + MAX + ' caracteres.');
  }
}

function validarDni(dni) {
  if (!RE_DNI.test(dni)) {
    errorar('El DNI debe tener exactamente 8 números.');
  }
}

function ayuda() {
  console.log([
    '',
    'Uso:',
    '  npm run contrasena -- --listar',
    '  npm run contrasena -- --hash "NuevaClave1"',
    '  npm run contrasena -- 45678945 "NuevaClave1"',
    '  npm run contrasena -- --verificar 45678945 "NuevaClave1"',
    '',
    'Las contraseñas se guardan como hash scrypt (no se pueden leer).',
    ''
  ].join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const orden = String(args[0] || '').trim();

  if (!orden || orden === '--ayuda' || orden === '-h') {
    ayuda();
    return;
  }

  if (orden === '--hash') {
    if (args.length !== 2) errorar('Uso: npm run contrasena -- --hash "NuevaClave1"');
    const nueva = String(args[1] || '');
    validarNueva(nueva);
    const hash = hashPassword(nueva);
    if (!verifyPassword(nueva, hash)) errorar('No se pudo generar el hash.');
    console.log('\nHash scrypt listo para pegar en password_hash:\n\n' + hash + '\n');
    console.log('Comprueba que el hash empieza por "scrypt$". No pegues la contraseña.\n');
    return;
  }

  if (orden === '--listar') {
    if (args.length !== 1) errorar('Uso: npm run contrasena -- --listar');
  } else if (orden === '--verificar') {
    if (args.length !== 3) errorar('Uso: npm run contrasena -- --verificar DNI "Contraseña"');
    validarDni(args[1]);
    validarNueva(args[2]);
  } else {
    if (orden.startsWith('-')) errorar('Opción no reconocida: ' + orden);
    if (args.length !== 2) errorar('Uso: npm run contrasena -- DNI "NuevaClave1"');
    validarDni(orden);
    validarNueva(args[1]);
  }

  const { Client } = require('pg');
  const cliente = new Client({ connectionString: urlDeLaBase(), connectionTimeoutMillis: 10000 });

  try {
    await cliente.connect();
  } catch (e) {
    errorar('No se pudo conectar a la base: ' + e.message);
  }

  try {
    if (orden === '--listar') {
      const { rows } = await cliente.query(
        'SELECT dni, nombre, left(password_hash, 21) AS inicio FROM usuarios ORDER BY nombre');
      if (!rows.length) {
        console.log('\nNo hay usuarios todavía.\n');
        return;
      }
      console.log('\nDNI       | HASH (inicio)         | NOMBRE');
      console.log('----------+-----------------------+---------------------------');
      rows.forEach((u) => {
        console.log(
          String(u.dni).padEnd(9) + ' | ' +
          String(u.inicio || 'sin contraseña').padEnd(21) + ' | ' + u.nombre
        );
      });
      console.log('\nSólo se muestra el inicio del hash: la contraseña no se puede recuperar.\n');
      return;
    }

    if (orden === '--verificar') {
      const dni = String(args[1] || '').trim();
      const nueva = String(args[2] || '');
      validarDni(dni);
      validarNueva(nueva);
      const { rows } = await cliente.query(
        'SELECT password_hash FROM usuarios WHERE dni = $1', [dni]);
      if (!rows.length) errorar('No existe una cuenta con el DNI ' + dni + '.');
      const coincide = verifyPassword(nueva, rows[0].password_hash);
      console.log('\nDNI ' + dni + ': la contraseña ' + (coincide ? 'SÍ coincide' : 'NO coincide') + '.\n');
      process.exitCode = coincide ? 0 : 1;
      return;
    }

    const dni = orden;
    const nueva = String(args[1] || '');
    validarDni(dni);
    validarNueva(nueva);

    const hash = hashPassword(nueva);
    if (!verifyPassword(nueva, hash)) errorar('No se pudo generar el hash.');
    const { rowCount } = await cliente.query(
      'UPDATE usuarios SET password_hash = $1 WHERE dni = $2', [hash, dni]);
    if (rowCount !== 1) errorar('No existe una cuenta con el DNI ' + dni + '.');
    console.log('\nContraseña actualizada para el DNI ' + dni + ' (hash scrypt).\n');
  } finally {
    await cliente.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('\nFalló la operación:', e.message);
  process.exit(1);
});
