'use strict';

function crearInvalidarTokens({ tokenRepo }) {
  return async ({ entradaId }) => {
    const invalidados = await tokenRepo.invalidarPorEntrada(entradaId);
    return { invalidados };
  };
}

module.exports = { crearInvalidarTokens };
