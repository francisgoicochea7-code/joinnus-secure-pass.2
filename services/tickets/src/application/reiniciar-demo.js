'use strict';

function crearReiniciarDemo({ demoRepo, authClient, qrClient }) {
  return async (requestId) => {
    // auth primero: los IDs de usuario sembrados (1..6) deben existir antes
    // de que tickets.sql inserte entradas con titular_id fijo.
    const auth = await authClient.reiniciar(requestId);
    const qr = await qrClient.reiniciar(requestId);
    const entradas = await demoRepo.reiniciar();

    return {
      mensaje: 'Datos de demostración reiniciados.',
      entradas,
      usuarios: auth.usuarios,
      tokens: qr.tokens
    };
  };
}

module.exports = { crearReiniciarDemo };
