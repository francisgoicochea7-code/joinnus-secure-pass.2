'use strict';

/**
 * Construye la configuración del pool de PostgreSQL a partir del entorno.
 *
 * Dos modos, pensados para que el mismo código funcione en local y en la nube:
 *
 *  1. Local / Docker Compose: variables sueltas DB_HOST, DB_PORT, DB_NAME,
 *     DB_USER, DB_PASSWORD (sin TLS dentro de la red del compose).
 *  2. Nube (Render + Aiven): una sola DATABASE_URL con credenciales y, en el
 *     caso de Aiven, `?sslmode=require` porque exige conexión cifrada.
 *
 * Con DATABASE_URL cada servicio conserva su propia base (auth_db, tickets_db,
 * qr_db): la URL aporta servidor, puerto y credenciales, y el nombre de la base
 * lo pone el servicio. El script de inicialización usa `respetarUrl: true`
 * porque necesita conectarse a la base que trae la URL para poder crear las
 * otras tres.
 */

// Modos de sslmode aceptados por PostgreSQL. `verify-full` es el único que
// valida el certificado del servidor; el resto cifra sin verificar la CA.
const SSL_POR_MODO = {
  require: { rejectUnauthorized: false },
  prefer: { rejectUnauthorized: false },
  'no-verify': { rejectUnauthorized: false },
  'verify-ca': { rejectUnauthorized: false },
  'verify-full': { rejectUnauthorized: true }
};

function sslPorEntorno() {
  return String(process.env.DB_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : false;
}

function separarSslmode(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('DATABASE_URL no es una URL válida.');
  }

  const modo = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');

  return { connectionString: url.toString(), modo };
}

function cambiarBase(connectionString, nombre) {
  const url = new URL(connectionString);
  url.pathname = `/${nombre}`;
  return url.toString();
}

/**
 * @param {object} opciones
 * @param {string} opciones.database Base por defecto si no hay DB_NAME.
 * @param {string} opciones.user     Usuario por defecto si no hay DB_USER.
 * @param {string} [opciones.opciones] Parámetros extra de conexión
 *                                     (por ejemplo la zona horaria).
 * @param {boolean} [opciones.respetarUrl] Mantener la base de DATABASE_URL.
 */
function construirDb({ database, user, opciones = '', respetarUrl = false }) {
  const max = Number(process.env.DB_POOL_MAX || 10);
  const extra = opciones ? { options: opciones } : {};
  const url = String(process.env.DATABASE_URL || '').trim();

  if (url) {
    const { connectionString, modo } = separarSslmode(url);
    const ssl = modo ? (SSL_POR_MODO[modo] || { rejectUnauthorized: false }) : sslPorEntorno();
    return {
      connectionString: respetarUrl ? connectionString : cambiarBase(connectionString, database),
      ssl,
      max,
      ...extra
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || database,
    user: process.env.DB_USER || user,
    password: process.env.DB_PASSWORD || '',
    max,
    ssl: sslPorEntorno(),
    ...extra
  };
}

module.exports = { construirDb };
