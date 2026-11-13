'use strict';

/**
 * Prepara la base de datos administrada (Aiven o Render PostgreSQL) para los
 * tres microservicios.
 *
 * En local cada base la crea database/micro/00-init.sh dentro del contenedor
 * de PostgreSQL. En la nube no hay acceso a un shell del servidor, así que
 * este script hace lo mismo desde la propia aplicación y al arrancar:
 *
 *   1. Conecta con las credenciales de DATABASE_URL (o de las DB_*).
 *   2. Crea auth_db, tickets_db y qr_db si no existen.
 *   3. Carga el esquema y los datos de ejemplo sólo si la tabla principal de
 *      esa base todavía no existe. Así reiniciar el contenedor no duplica
 *      entradas ni historial.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { construirDb } = require('../shared/db-config');

const BASES = [
  { nombre: 'auth_db', tabla: 'usuarios', semilla: 'auth.sql' },
  { nombre: 'tickets_db', tabla: 'entradas', semilla: 'tickets.sql' },
  { nombre: 'qr_db', tabla: 'tokens_qr', semilla: 'qr.sql' }
];

const DIR_SEMILLAS = process.env.SEED_DIR || '/app/seed';
const INTENTOS = Number(process.env.DB_INTENTOS || 10);
const ESPERA_MS = Number(process.env.DB_ESPERA_MS || 3000);

function log(mensaje) {
  console.log(`[init-db] ${mensaje}`);
}

function dormir(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function conectar(config) {
  let ultimoError;

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    const cliente = new Client(config);
    try {
      await cliente.connect();
      return cliente;
    } catch (error) {
      ultimoError = error;
      await cliente.end().catch(() => {});
      log(`conexión fallida (intento ${intento}/${INTENTOS}): ${error.message}`);
      if (intento < INTENTOS) await dormir(ESPERA_MS);
    }
  }

  throw ultimoError;
}

// Cambia el nombre de la base conservando host, puerto y credenciales.
function conBase(config, nombre) {
  if (config.connectionString) {
    const url = new URL(config.connectionString);
    url.pathname = `/${nombre}`;
    return { ...config, connectionString: url.toString() };
  }
  return { ...config, database: nombre };
}

async function crearBaseSiFalta(cliente, nombre) {
  if (!/^[a-z_][a-z0-9_]*$/.test(nombre)) {
    throw new Error(`Nombre de base inválido: ${nombre}`);
  }

  const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (rowCount > 0) {
    log(`${nombre} ya existe`);
    return;
  }

  await cliente.query(`CREATE DATABASE "${nombre}"`);
  log(`${nombre} creada`);
}

async function sembrarBase(cliente, base) {
  const { rows } = await cliente.query('SELECT to_regclass($1) AS tabla', [`public.${base.tabla}`]);
  if (rows[0].tabla) {
    log(`${base.nombre} ya tiene esquema (${base.tabla})`);
    return;
  }

  const archivo = path.join(DIR_SEMILLAS, base.semilla);
  if (!fs.existsSync(archivo)) {
    throw new Error(`No se encontró el archivo ${archivo}`);
  }

  await cliente.query(fs.readFileSync(archivo, 'utf8'));
  log(`${base.nombre} inicializada con ${base.semilla}`);
}

async function main() {
  const admin = construirDb({ database: 'postgres', user: 'postgres', respetarUrl: true });
  const destino = admin.connectionString ? 'DATABASE_URL' : `${admin.host}:${admin.port}`;
  log(`conectando a la base administrada (${destino})`);

  const clienteAdmin = await conectar(admin);
  try {
    for (const base of BASES) {
      await crearBaseSiFalta(clienteAdmin, base.nombre);
    }
  } finally {
    await clienteAdmin.end().catch(() => {});
  }

  for (const base of BASES) {
    const cliente = await conectar(conBase(admin, base.nombre));
    try {
      await sembrarBase(cliente, base);
    } finally {
      await cliente.end().catch(() => {});
    }
  }

  log('base de datos lista');
}

main().catch((error) => {
  console.error(`[init-db] error: ${error.message}`);
  process.exit(1);
});
