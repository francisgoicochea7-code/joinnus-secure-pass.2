'use strict';

const { AppError } = require('../../../shared/errors');
const { RE_DNI } = require('../../../shared/validaciones');
const { verifyPassword, HASH_RELLENO } = require('../../../shared/password');
const { firmarSesion } = require('../../../shared/session');

/**
 * Inicia sesión con DNI + contraseña.
 *
 * El mensaje de error es siempre el mismo para un DNI inexistente y para una
 * contraseña incorrecta: así no se puede averiguar quién está registrado.
 * Cuando el DNI no existe se verifica igualmente contra un hash de relleno
 * para que el tiempo de respuesta no lo delate.
 */
function crearLoginUsuario({ usuarioRepo, sessionSecret, sessionTtl }) {
  return async (datos) => {
    const b = datos || {};

    const dni = String(b.dni || '').trim();
    if (!RE_DNI.test(dni)) {
      throw new AppError('El DNI debe tener exactamente 8 números.', 400, 'DNI_INVALIDO', {
        campos: { dni: 'El DNI debe tener exactamente 8 números.' }
      });
    }

    const clave = String(b.password || '');
    if (!clave) {
      throw new AppError('Escribe tu contraseña.', 400, 'PASSWORD_REQUERIDA', {
        campos: { password: 'Escribe tu contraseña.' }
      });
    }

    if (!sessionSecret) {
      throw new AppError(
        'El inicio de sesión no está configurado en el servidor.',
        503,
        'SESION_SIN_CLAVE'
      );
    }

    const usuario = await usuarioRepo.buscarPorDni(dni);
    const almacenado = usuario && usuario.password_hash;
    const coincide = verifyPassword(clave, almacenado || HASH_RELLENO);

    if (!usuario || !almacenado || !coincide) {
      throw new AppError('DNI o contraseña incorrectos.', 401, 'CREDENCIALES_INVALIDAS');
    }

    const { password_hash, ...publico } = usuario;
    const { token, expiraEn } = firmarSesion({
      dni: usuario.dni,
      secreto: sessionSecret,
      ttlSegundos: sessionTtl
    });

    return { usuario: publico, token, expiraEn };
  };
}

module.exports = { crearLoginUsuario };
