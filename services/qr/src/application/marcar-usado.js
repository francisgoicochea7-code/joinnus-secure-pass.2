'use strict';

function crearMarcarUsado({ tokenRepo }) {
  return async ({ token }) => {
    await tokenRepo.marcarUsado(token);
    return { ok: true };
  };
}

module.exports = { crearMarcarUsado };
