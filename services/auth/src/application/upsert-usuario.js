'use strict';

const { AppError } = require('../../../shared/errors');
const { validarUsuario } = require('../../../shared/validaciones');

function crearUpsertUsuario({ usuarioRepo }) {
  return async (datos) => {
    const v = validarUsuario(datos);
    if (!v.ok) {
      throw new AppError(v.error, 400, 'DATOS_INVALIDOS', { campos: v.campos });
    }
    return usuarioRepo.upsert(v.datos);
  };
}

module.exports = { crearUpsertUsuario };
