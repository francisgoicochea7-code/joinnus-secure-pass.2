'use strict';

const crypto = require('crypto');

/**
 * Contraseñas con scrypt (incluido en Node, sin dependencias).
 *
 * Formato guardado: scrypt$N$r$p$sal(base64url)$hash(base64url)
 *
 * La sal es aleatoria por usuario, así que dos personas con la misma
 * contraseña guardan hashes distintos. La comparación es en tiempo constante.
 */
const N = 16384;
const R = 8;
const P = 1;
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;
const MAX_MEMORIA = 64 * 1024 * 1024;

/** Valida la contraseña que elige la persona (no la que ya está guardada). */
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

/** Devuelve el hash listo para guardar en la columna password_hash. */
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

/**
 * Hash de relleno: se usa cuando el DNI no existe para que el tiempo de
 * respuesta sea parecido al de una contraseña incorrecta y no se pueda
 * averiguar qué DNIs están registrados midiendo la latencia.
 */
const HASH_RELLENO = hashPassword('contraseña-de-relleno-no-usable');

/** Comprueba una contraseña contra el hash guardado. */
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

module.exports = {
  HUECO: '',
  HASH_RELLENO,
  passwordValida,
  hashPassword,
  verifyPassword
};
