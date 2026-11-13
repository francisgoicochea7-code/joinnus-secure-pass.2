'use strict';

const crypto = require('crypto');

/** Asegura un X-Request-Id en cada petición y lo devuelve en la respuesta. */
function requestId(req, res, next) {
  const id = String(req.get('X-Request-Id') || '').trim() || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestId };
