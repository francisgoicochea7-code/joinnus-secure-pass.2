'use strict';

const { crearCliente } = require('../../../../shared/http-client');

function crearTicketsClient({ baseUrl, token, logger }) {
  const cliente = crearCliente({
    baseUrl,
    token,
    servicio: 'tickets-service',
    logger
  });

  return {
    async obtenerEntrada(codigo, requestId, dni) {
      return cliente.pedir(`/internal/v1/entradas/${encodeURIComponent(codigo)}`, {
        requestId,
        headers: dni ? { 'X-Usuario-DNI': dni } : {}
      });
    },

    async actualizarProyeccionQr(codigo, datos, requestId) {
      return cliente.pedir(`/internal/v1/entradas/${encodeURIComponent(codigo)}/qr`, {
        method: 'PATCH',
        body: datos,
        requestId,
        intentos: 2
      });
    },

    async registrarHistorial(codigo, datos, requestId) {
      return cliente.pedir(`/internal/v1/entradas/${encodeURIComponent(codigo)}/historial`, {
        method: 'POST',
        body: datos,
        requestId,
        intentos: 1
      });
    }
  };
}

module.exports = { crearTicketsClient };
