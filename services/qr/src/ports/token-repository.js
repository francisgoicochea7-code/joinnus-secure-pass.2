'use strict';

/** Puerto: repositorio de tokens QR. */
class TokenRepository {
  async buscarPorToken() {
    throw new Error('TokenRepository.buscarPorToken no implementado');
  }

  async ultimoPorEntrada() {
    throw new Error('TokenRepository.ultimoPorEntrada no implementado');
  }

  async rotar() {
    throw new Error('TokenRepository.rotar no implementado');
  }

  async invalidarPorEntrada() {
    throw new Error('TokenRepository.invalidarPorEntrada no implementado');
  }

  async marcarUsado() {
    throw new Error('TokenRepository.marcarUsado no implementado');
  }

  async reiniciar() {
    throw new Error('TokenRepository.reiniciar no implementado');
  }
}

module.exports = { TokenRepository };
