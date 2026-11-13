'use strict';

/** Puerto: repositorio de entradas. */
class EntradaRepository {
  async listar() {
    throw new Error('EntradaRepository.listar no implementado');
  }

  async obtenerPorCodigo() {
    throw new Error('EntradaRepository.obtenerPorCodigo no implementado');
  }

  async resumen() {
    throw new Error('EntradaRepository.resumen no implementado');
  }

  async contarHistorial() {
    throw new Error('EntradaRepository.contarHistorial no implementado');
  }

  async transferir() {
    throw new Error('EntradaRepository.transferir no implementado');
  }

  async actualizarProyeccionQr() {
    throw new Error('EntradaRepository.actualizarProyeccionQr no implementado');
  }

  async marcarUsada() {
    throw new Error('EntradaRepository.marcarUsada no implementado');
  }

  async cambiarEstado() {
    throw new Error('EntradaRepository.cambiarEstado no implementado');
  }
}

module.exports = { EntradaRepository };
