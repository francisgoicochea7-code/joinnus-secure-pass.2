'use strict';

const { emitirCodigoActivacion } = require('./activacion');

async function main(pool, entrada) {
  const dni = String(entrada || '').trim();
  if (!/^\d{8}$/.test(dni)) throw new Error('Indica el DNI de 8 números del titular.');

  const activacion = await emitirCodigoActivacion(pool, dni);
  if (!activacion) throw new Error('Ese perfil todavía no existe.');

  console.log('Código de un solo uso:', activacion.codigo);
  console.log('Vence:', new Date(activacion.expiraEn).toISOString());
  console.log('Entrégalo por privado al titular después de comprobar su identidad.');
}

async function ejecutarEmision(pool, dni) {
  try {
    await main(pool, dni);
  } catch (error) {
    console.error(error.code ? 'No se pudo emitir el código (' + error.code + ').' : error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT && Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  ejecutarEmision(pool, process.argv[2]);
}

module.exports = { ejecutarEmision };
