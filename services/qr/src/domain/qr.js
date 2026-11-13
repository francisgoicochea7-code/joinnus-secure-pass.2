'use strict';

const crypto = require('crypto');
const { extraerToken } = require('../../../shared/tokens');

/** Firma HMAC-SHA256 (32 caracteres hex). */
function firmarToken(codigo, nonce, expira, secret) {
  const ms = expira instanceof Date ? expira.getTime() : new Date(expira).getTime();
  return crypto
    .createHmac('sha256', secret)
    .update(`${codigo}|${nonce}|${ms}`)
    .digest('hex')
    .slice(0, 32);
}

function generarToken(codigo, secret, ttlSegundos) {
  const nonce = crypto.randomBytes(4).toString('hex').toUpperCase();
  // PostgreSQL guarda TIMESTAMP sin milisegundos: se redondea antes de firmar.
  const expira = new Date(Math.floor((Date.now() + ttlSegundos * 1000) / 1000) * 1000);
  const firma = firmarToken(codigo, nonce, expira, secret);
  return {
    token: `JSP-${codigo}-${nonce}`,
    nonce,
    firma,
    expiraEn: expira
  };
}

function construirPayload(codigo, nonce) {
  const d = new Date();
  const reloj = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `JSP|${codigo}|${nonce}|${reloj}`;
}

/** Evalúa firma, expiración, invalidación y uso de un token leído de la BD. */
function evaluarToken(fila, secret, ttlSegundos, ahora = Date.now()) {
  const esperado = firmarToken(fila.codigo, fila.nonce, fila.expira_en, secret);
  if (esperado !== fila.firma) {
    return { valido: false, motivo: 'firma', mensaje: 'La firma del token no es válida.' };
  }
  if (Number(fila.invalidado) === 1) {
    return { valido: false, motivo: 'invalidado', mensaje: 'El token fue invalidado al rotar el código QR.' };
  }
  if (new Date(fila.expira_en).getTime() < ahora) {
    return { valido: false, motivo: 'expirado', mensaje: `El token expiró (vigencia de ${ttlSegundos} segundos).` };
  }
  if (fila.usado_en) {
    return { valido: false, motivo: 'usado', mensaje: 'La entrada ya fue utilizada para ingresar al evento.' };
  }
  return { valido: true, motivo: 'ok', mensaje: 'Token vigente: acceso permitido.' };
}

module.exports = { firmarToken, generarToken, construirPayload, extraerToken, evaluarToken };
