'use strict';

const { AppError } = require('../../../shared/errors');
const { RE_DNI } = require('../../../shared/validaciones');

function crearObtenerUsuario({ usuarioRepo }) {
  return async (dniParam) => {
    const dni = String(dniParam || '').trim();
    if (!RE_DNI.test(dni)) {
      throw new AppError('El DNI debe tener exactamente 8 números.', 400, 'DNI_INVALIDO', {
        campos: { dni: 'El DNI debe tener exactamente 8 números.' }
      });
    }

    const usuario = await usuarioRepo.buscarPorDni(dni);
    if (!usuario) {
      throw new AppError('No encontramos a ninguna persona con ese DNI.', 404, 'USUARIO_NO_ENCONTRADO', {
        campos: { dni: 'No encontramos a ninguna persona con ese DNI.' }
      });
    }

    // El hash de la contraseña no sale nunca del servicio de autenticación.
    const { password_hash, ...publico } = usuario;
    return publico;
  };
}

module.exports = { crearObtenerUsuario };
