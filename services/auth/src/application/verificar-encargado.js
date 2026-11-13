'use strict';

const { AppError } = require('../../../shared/errors');
const { hashCodigoEncargado, normalizarCredenciales } = require('../domain/encargado');

function crearVerificarEncargado({ encargadoRepo }) {
  return async (datos) => {
    const { nombre, codigo } = normalizarCredenciales(datos);
    if (!nombre || !codigo) {
      throw new AppError('Inicia sesión como encargado antes de validar entradas.', 401, 'CREDENCIALES_INVALIDAS');
    }

    const encargado = await encargadoRepo.buscarPorHash(hashCodigoEncargado(nombre, codigo));
    if (!encargado) {
      throw new AppError('Tu código de encargado ya no es válido: vuelve a iniciar sesión.', 401, 'CREDENCIALES_INVALIDAS');
    }

    return { id: encargado.id, nombre: encargado.nombre };
  };
}

module.exports = { crearVerificarEncargado };
