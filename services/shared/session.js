'use strict';

const crypto = require('crypto');

/**
 * Sesiones firmadas (HMAC-SHA256) para no confiar en el DNI que envía el
 * navegador. El token lo emite auth-service al comprobar la contraseña y
 * tickets-service lo verifica sin llamar a otro servicio.
 *
 * Formato: <payload base64url>.<firma base64url>
 * payload = {"dni":"12345678","exp":1712345678}
 *
 * No guarda nada en la base de datos: si se rota SESSION_SECRET, todas las
 * sesiones emitidas dejan de valer.
 */

const TTL_DEFECTO = 8 * 60 * 60; // 8 horas
const LARGO_MINIMO_SECRETO = 32;

function secretoValido(secreto) {
  return typeof secreto === 'string' && secreto.length >= LARGO_MINIMO_SECRETO;
}

/**
 * Secreto de firma. En producción debe venir de SESSION_SECRET.
 * Si no está, se deriva con SHA-256 de otro secreto ya obligatorio
 * (INTERNAL_TOKEN en microservicios, QR_SECRET en el monolito) para que el
 * prototipo siga funcionando en local. Nunca se usa un valor fijo.
 */
function secretoDeEntorno(entorno, respaldo) {
  const env = entorno || process.env || {};
  const propio = String(env.SESSION_SECRET || '').trim();
  if (propio.length >= LARGO_MINIMO_SECRETO) return propio;

  const otro = String(respaldo || env.INTERNAL_TOKEN || '').trim();
  if (otro.length >= 16) {
    return crypto.createHash('sha256').update(otro + '|jsp-sesion').digest('hex');
  }
  return '';
}

/** Firma una sesión para el DNI indicado. */
function firmarSesion({ dni, secreto, ttlSegundos, ahora }) {
  const limpio = String(dni || '').trim();
  if (!/^\d{8}$/.test(limpio)) throw new Error('DNI inválido para la sesión.');
  if (!secretoValido(secreto)) {
    throw new Error('Falta SESSION_SECRET (mínimo ' + LARGO_MINIMO_SECRETO + ' caracteres).');
  }

  const base = Number.isFinite(ahora) ? ahora : Date.now();
  const ttl = Number(ttlSegundos) > 0 ? Number(ttlSegundos) : TTL_DEFECTO;
  const exp = Math.floor(base / 1000) + Math.floor(ttl);

  const payload = Buffer.from(JSON.stringify({ dni: limpio, exp }), 'utf8').toString('base64url');
  const firma = crypto.createHmac('sha256', secreto).update(payload).digest('base64url');

  return { token: payload + '.' + firma, expiraEn: exp * 1000 };
}

/** Devuelve {dni, exp} si la firma es válida y no caducó; si no, null. */
function verificarSesion(token, secreto, ahora) {
  if (!secretoValido(secreto)) return null;

  const partes = String(token || '').split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

  let recibida;
  try {
    recibida = Buffer.from(partes[1], 'base64url');
  } catch (e) {
    return null;
  }

  const esperada = crypto.createHmac('sha256', secreto).update(partes[0]).digest();
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) {
    return null;
  }

  let datos;
  try {
    datos = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }

  if (!datos || !/^\d{8}$/.test(String(datos.dni || ''))) return null;
  if (!Number.isFinite(datos.exp)) return null;

  const base = Number.isFinite(ahora) ? ahora : Date.now();
  if (datos.exp * 1000 <= base) return null;

  return { dni: datos.dni, exp: datos.exp };
}

module.exports = {
  TTL_DEFECTO,
  LARGO_MINIMO_SECRETO,
  secretoValido,
  secretoDeEntorno,
  firmarSesion,
  verificarSesion
};
