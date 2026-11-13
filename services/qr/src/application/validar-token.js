'use strict';

const { evaluarToken } = require('../domain/qr');

function crearValidarToken({ tokenRepo }) {
  return async ({ token, secret, ttlSegundos }) => {
    const fila = await tokenRepo.buscarPorToken(token);
    if (!fila) {
      return {
        valido: false,
        motivo: 'desconocido',
        mensaje: 'El código QR no pertenece a ninguna entrada emitida.'
      };
    }

    const evaluacion = evaluarToken(fila, secret, ttlSegundos);
    return {
      ...evaluacion,
      token: fila.token,
      codigo: fila.codigo,
      titularDni: fila.titular_dni,
      expiraEn: fila.expira_en
    };
  };
}

module.exports = { crearValidarToken };
