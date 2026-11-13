'use strict';

const { AppError } = require('../../../shared/errors');
const { validarUsuario } = require('../../../shared/validaciones');

function crearCrearUsuario({ usuarioRepo }) {
  return async (datos) => {
    const v = validarUsuario(datos);
    if (!v.ok) {
      throw new AppError(v.error, 400, 'DATOS_INVALIDOS', { campos: v.campos });
    }

    try {
      return await usuarioRepo.crear(v.datos);
    } catch (err) {
      if (err && err.code === '23505') {
        throw new AppError('Ese DNI ya está registrado: identifícate con tu nombre.', 409, 'DNI_DUPLICADO', {
          campos: { dni: 'Ese DNI ya está registrado.' }
        });
      }
      throw err;
    }
  };
}

module.exports = { crearCrearUsuario };
