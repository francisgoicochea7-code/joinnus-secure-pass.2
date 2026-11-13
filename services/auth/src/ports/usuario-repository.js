'use strict';

/** Puerto: repositorio de usuarios. */
class UsuarioRepository {
  async crear() {
    throw new Error('UsuarioRepository.crear no implementado');
  }

  async upsert() {
    throw new Error('UsuarioRepository.upsert no implementado');
  }

  async buscarPorDni() {
    throw new Error('UsuarioRepository.buscarPorDni no implementado');
  }
}

module.exports = { UsuarioRepository };
