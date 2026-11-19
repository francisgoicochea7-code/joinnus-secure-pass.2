'use strict';

const { FORMATO_CODIGO } = require('../../../../backend/activacion');
const { AppError } = require('../../../shared/errors');
const { RE_DNI } = require('../../../shared/validaciones');
const { passwordValida, hashPassword } = require('../../../shared/password');

function crearActivarUsuario({ usuarioRepo }) {
  return async ({ dni: dniEntrada, codigo: codigoEntrada, password }) => {
    const dni = String(dniEntrada || '').trim();
    const codigo = String(codigoEntrada || '').trim();
    if (!RE_DNI.test(dni) || !FORMATO_CODIGO.test(codigo)) {
      throw new AppError('Revisa el DNI y el código de activación.', 400, 'ACTIVACION_INVALIDA');
    }

    const clave = passwordValida(password);
    if (!clave.ok) {
      throw new AppError(clave.mensaje, 400, 'PASSWORD_INVALIDA');
    }

    const usuario = await usuarioRepo.activar({ dni, codigo, passwordHash: hashPassword(clave.valor) });
    if (!usuario) {
      throw new AppError('El código de activación es incorrecto o ya no está vigente.', 400, 'ACTIVACION_INVALIDA');
    }
    return usuario;
  };
}

module.exports = { crearActivarUsuario };
