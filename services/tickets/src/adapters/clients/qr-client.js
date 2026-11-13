'use strict';

const { crearCliente } = require('../../../../shared/http-client');

function crearQrClient({ baseUrl, token, logger }) {
  const cliente = crearCliente({
    baseUrl,
    token,
    servicio: 'qr-service',
    logger
  });

  return {
    async rotar({ codigo, entradaId, titularDni }, requestId) {
      return cliente.pedir('/internal/v1/qr/rotar', {
        method: 'POST',
        body: { codigo, entradaId, titularDni },
        requestId
      });
    },

    async validar({ token }, requestId) {
      return cliente.pedir('/internal/v1/qr/validar', {
        method: 'POST',
        body: { token },
        requestId
      });
    },

    async invalidar(entradaId, requestId) {
      return cliente.pedir('/internal/v1/qr/invalidar', {
        method: 'POST',
        body: { entradaId },
        requestId
      });
    },

    async marcarUsado(token, requestId) {
      return cliente.pedir('/internal/v1/qr/marcar-usado', {
        method: 'POST',
        body: { token },
        requestId
      });
    },

    async reiniciar(requestId) {
      return cliente.pedir('/internal/v1/demo/reiniciar', {
        method: 'POST',
        body: {},
        requestId,
        intentos: 1
      });
    }
  };
}

module.exports = { crearQrClient };
