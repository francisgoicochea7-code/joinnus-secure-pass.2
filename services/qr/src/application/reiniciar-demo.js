'use strict';

function crearReiniciarDemo({ tokenRepo }) {
  return async () => {
    const tokens = await tokenRepo.reiniciar();
    return { tokens };
  };
}

module.exports = { crearReiniciarDemo };
