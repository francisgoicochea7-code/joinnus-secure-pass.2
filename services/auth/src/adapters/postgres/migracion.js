'use strict';

const { hashPassword } = require('../../../../shared/password');
const { secretoValido } = require('../../../../shared/session');
const { asegurarColumnasActivacion } = require('../../../../../backend/activacion');

/**
 * Contraseñas de las cuentas de demostración. Son datos ficticios del
 * prototipo: la contraseña real de cada persona se guarda como hash scrypt.
 * Deben coincidir con las de database/micro/auth.sql.
 */
const DEMO_PASSWORDS = {
  '45678945': 'Carlos2026!',
  '52311878': 'Andrea2026!',
  '40125678': 'Luis2026!',
  '47258963': 'Diego2026!',
  '43871264': 'Maria2026!',
  '39521478': 'Renato2026!'
};

/**
 * Deja la tabla lista para contraseñas en bases que ya existían:
 *   1. Añade password_hash si falta (idempotente).
 *   2. Da contraseña a las cuentas de demostración que aún no tengan una.
 * No toca a quien ya tiene contraseña (por ejemplo, si la cambió).
 */
async function asegurarEsquema(pool, logger) {
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT');
  await asegurarColumnasActivacion(pool);

  const dnis = Object.keys(DEMO_PASSWORDS);
  const { rows } = await pool.query(
    'SELECT dni FROM usuarios WHERE dni = ANY($1) AND password_hash IS NULL',
    [dnis]
  );

  for (const fila of rows) {
    const clave = DEMO_PASSWORDS[String(fila.dni).trim()];
    if (!clave) continue;
    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE dni = $2 AND password_hash IS NULL',
      [hashPassword(clave), fila.dni]
    );
  }

  if (rows.length && logger) {
    logger.info('migracion_password', { cuentas_demo_actualizadas: rows.length });
  }
}

/** Aviso claro si la firma de sesiones no está configurada. */
function avisarSiFaltaSecreto(secreto, logger) {
  if (secretoValido(secreto)) return;
  if (logger) {
    logger.warn('sesion_sin_secreto', {
      mensaje: 'Define SESSION_SECRET (mínimo 32 caracteres) para poder iniciar sesión.'
    });
  }
}

module.exports = { DEMO_PASSWORDS, asegurarEsquema, avisarSiFaltaSecreto };
