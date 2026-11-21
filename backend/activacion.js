'use strict';

const crypto = require('crypto');

const VALIDEZ_MINUTOS = 20;
const FORMATO_CODIGO = /^[A-Za-z0-9_-]{32}$/;

function huella(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex');
}

async function asegurarColumnasActivacion(pool) {
  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS activacion_hash TEXT,
      ADD COLUMN IF NOT EXISTS activacion_expira_en TIMESTAMPTZ
  `);
}

async function emitirCodigoActivacion(pool, dni) {
  const codigo = crypto.randomBytes(24).toString('base64url');
  const resultado = await pool.query(`
    UPDATE usuarios
       SET activacion_hash = $2,
           activacion_expira_en = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute')
      WHERE dni = $1 AND password_hash IS NULL
        AND (activacion_expira_en IS NULL OR activacion_expira_en <= CURRENT_TIMESTAMP)
     RETURNING activacion_expira_en
  `, [dni, huella(codigo), VALIDEZ_MINUTOS]);

  if (!resultado.rows.length) return null;
  return { codigo, expiraEn: resultado.rows[0].activacion_expira_en };
}

async function consumirCodigoActivacion(pool, { dni, codigo, passwordHash }) {
  const resultado = await pool.query(`
    UPDATE usuarios
       SET password_hash = $3,
           activacion_hash = NULL,
           activacion_expira_en = NULL
      WHERE dni = $1
        AND password_hash IS NULL
       AND activacion_hash = $2
       AND activacion_expira_en > CURRENT_TIMESTAMP
     RETURNING id, nombre, dni, correo
  `, [dni, huella(codigo), passwordHash]);

  return resultado.rows[0] || null;
}

module.exports = {
  FORMATO_CODIGO,
  asegurarColumnasActivacion,
  emitirCodigoActivacion,
  consumirCodigoActivacion
};
