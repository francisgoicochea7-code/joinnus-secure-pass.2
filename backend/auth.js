'use strict';

/* =========================================================================
 * JOINNUS SECURE PASS — backend/auth.js
 * -------------------------------------------------------------------------
 * Contraseñas y sesiones del servicio monolítico.
 *
 * Es una copia deliberada de services/shared/password.js y session.js: el
 * contenedor del backend se construye con contexto ./backend, así que no
 * puede importar la carpeta services/. Si cambias el formato del hash o la
 * firma, cambia también esos dos archivos.
 *
 * La contraseña se guarda como scrypt$N$r$p$sal$hash (nunca en claro) y la
 * sesión es un token HMAC-SHA256 firmado con SESSION_SECRET (o, si no está,
 * derivado de QR_SECRET, que ya es obligatorio).
 * ========================================================================= */

const crypto = require('crypto');

const N = 16384;
const R = 8;
const P = 1;
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;
const MAX_MEMORIA = 64 * 1024 * 1024;
const TTL_DEFECTO = 8 * 60 * 60;
const LARGO_MINIMO_SECRETO = 32;

function passwordValida(valor) {
  const clave = String(valor == null ? '' : valor);
  if (clave.length < 8) {
    return { ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (clave.length > 200) {
    return { ok: false, mensaje: 'La contraseña es demasiado larga (máximo 200 caracteres).' };
  }
  return { ok: true, valor: clave };
}

function hashPassword(valor) {
  const sal = crypto.randomBytes(LARGO_SAL);
  const hash = crypto.scryptSync(String(valor), sal, LARGO_CLAVE, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORIA
  });
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

const HASH_RELLENO = hashPassword('contraseña-de-relleno-no-usable');

function verifyPassword(valor, almacenado) {
  try {
    const partes = String(almacenado || '').split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

    const n = Number(partes[1]);
    const r = Number(partes[2]);
    const p = Number(partes[3]);
    if (!Number.isInteger(n) || n < 1024 || n > 1048576) return false;
    if (!Number.isInteger(r) || r < 1 || r > 32) return false;
    if (!Number.isInteger(p) || p < 1 || p > 16) return false;

    const sal = Buffer.from(partes[4], 'base64url');
    const esperado = Buffer.from(partes[5], 'base64url');
    if (!sal.length || esperado.length < 16) return false;

    const real = crypto.scryptSync(String(valor), sal, esperado.length, {
      N: n,
      r,
      p,
      maxmem: 128 * 1024 * 1024
    });
    return crypto.timingSafeEqual(real, esperado);
  } catch (e) {
    return false;
  }
}

function secretoValido(secreto) {
  return typeof secreto === 'string' && secreto.length >= LARGO_MINIMO_SECRETO;
}

function secretoDeEntorno(entorno, respaldo) {
  const env = entorno || process.env || {};
  const propio = String(env.SESSION_SECRET || '').trim();
  if (propio.length >= LARGO_MINIMO_SECRETO) return propio;

  const otro = String(respaldo || '').trim();
  if (otro.length >= 16) {
    return crypto.createHash('sha256').update(otro + '|jsp-sesion').digest('hex');
  }
  return '';
}

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
  HASH_RELLENO,
  TTL_DEFECTO,
  passwordValida,
  hashPassword,
  verifyPassword,
  secretoValido,
  secretoDeEntorno,
  firmarSesion,
  verificarSesion
};
