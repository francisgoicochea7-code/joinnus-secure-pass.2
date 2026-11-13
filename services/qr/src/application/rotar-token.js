'use strict';

const { generarToken, construirPayload } = require('../domain/qr');

function crearRotarToken({ tokenRepo }) {
  return async ({ codigo, entradaId, titularDni, secret, ttlSegundos }) => {
    const nuevo = generarToken(codigo, secret, ttlSegundos);
    const payload = construirPayload(codigo, nuevo.nonce);
    const resultado = await tokenRepo.rotar({
      entradaId,
      codigo,
      titularDni,
      token: nuevo.token,
      nonce: nuevo.nonce,
      firma: nuevo.firma,
      payload,
      expiraEn: nuevo.expiraEn
    });

    return {
      ...nuevo,
      payload,
      id: resultado.id,
      tokenAnterior: resultado.tokenAnterior
    };
  };
}

module.exports = { crearRotarToken };
