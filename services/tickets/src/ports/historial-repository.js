'use strict';

/** Puerto: repositorio de historial. */
class HistorialRepository {
  async registrar() {
    throw new Error('HistorialRepository.registrar no implementado');
  }

  async listarPorDni() {
    throw new Error('HistorialRepository.listarPorDni no implementado');
  }

  async listarTodo() {
    throw new Error('HistorialRepository.listarTodo no implementado');
  }

  async listarPorEntrada() {
    throw new Error('HistorialRepository.listarPorEntrada no implementado');
  }
}

module.exports = { HistorialRepository };
