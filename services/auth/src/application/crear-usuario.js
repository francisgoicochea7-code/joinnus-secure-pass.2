'use strict';

const { AppError } = require('../../../shared/errors');
const { validarUsuario } = require('../../../shared/validaciones');
const { passwordValida, hashPassword } = require('../../../shared/password');

function crearCrearUsuario({ usuarioRepo }) {
  return async (datos) => {
    const v = validarUsuario(datos);
    if (!v.ok) {
      throw new AppError(v.error, 400, 'DATOS_INVALIDOS', { campos: v.campos });
    }

    // Toda cuenta nueva necesita contraseña: sin ella no podría iniciar sesión.
    const clave = passwordValida((datos || {}).password);
    if (!clave.ok) {
      throw new AppError('Revisa la contraseña.', 400, 'DATOS_INVALIDOS', {
        campos: { password: clave.mensaje }
      });
    }

    try {
      return await usuarioRepo.crear({
        ...v.datos,
        password_hash: hashPassword(clave.valor)
      });
    } catch (err) {
      if (err && err.code === '23505') {
        throw new AppError('Ese DNI ya está registrado: inicia sesión con tu contraseña.', 409, 'DNI_DUPLICADO', {
          campos: { dni: 'Ese DNI ya está registrado.' }
        });
      }
      throw err;
    }
  };
}

module.exports = { crearCrearUsuario };
