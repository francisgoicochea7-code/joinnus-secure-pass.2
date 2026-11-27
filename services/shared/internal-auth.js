'use strict';

const crypto = require('crypto');

/**
 * Compara dos textos en tiempo constante.
 *
 * Se comparan los SHA-256 de ambos valores para que ni el contenido ni la
 * longitud del token se puedan deducir midiendo la latencia de la respuesta.
 * Con `!==` el motor de JavaScript corta en el primer byte distinto.
 */
function igualesEnTiempoConstante(recibido, esperado) {
  const a = crypto.createHash('sha256').update(String(recibido == null ? '' : recibido)).digest();
  const b = crypto.createHash('sha256').update(String(esperado == null ? '' : esperado)).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Middleware para endpoints internos: exige el token compartido. */
function internalAuth(token) {
  return (req, res, next) => {
    const recibido = req.get('X-Internal-Token');
    if (!token || !igualesEnTiempoConstante(recibido, token)) {
      return res.status(401).json({
        ok: false,
        error: 'Token interno inválido.',
        codigo: 'INTERNO_NO_AUTORIZADO',
        requestId: req.id
      });
    }
    return next();
  };
}

module.exports = { internalAuth, igualesEnTiempoConstante };
