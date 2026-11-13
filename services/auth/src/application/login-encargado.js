'use strict';

const { AppError } = require('../../../shared/errors');
const { hashCodigoEncargado, normalizarCredenciales } = require('../domain/encargado');

function crearLoginEncargado({ encargadoRepo }) {
  return async (datos) => {
    const { nombre, codigo } = normalizarCredenciales(datos);
    if (!nombre || !codigo) {
      throw new AppError('Escribe tu nombre y tu código de encargado.', 400, 'DATOS_INCOMPLETOS');
    }

    const encargado = await encargadoRepo.buscarPorHash(hashCodigoEncargado(nombre, codigo));
    if (!encargado) {
      throw new AppError('Nombre o código de encargado incorrecto.', 401, 'CREDENCIALES_INVALIDAS');
    }

    return {
      encargado: { id: encargado.id, nombre: encargado.nombre },
      mensaje: `Bienvenido, ${encargado.nombre}.`
    };
  };
}

module.exports = { crearLoginEncargado };
