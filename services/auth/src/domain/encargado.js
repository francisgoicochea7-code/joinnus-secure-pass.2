'use strict';

const crypto = require('crypto');

/** SHA-256 de "nombre:codigo" (nombre en minúsculas, código en mayúsculas). */
function hashCodigoEncargado(nombre, codigo) {
  const n = String(nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const c = String(codigo || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(`${n}:${c}`).digest('hex');
}

function normalizarCredenciales(datos) {
  return {
    nombre: String((datos && datos.nombre) || '').trim(),
    codigo: String((datos && datos.codigo) || '').trim()
  };
}

module.exports = { hashCodigoEncargado, normalizarCredenciales };
