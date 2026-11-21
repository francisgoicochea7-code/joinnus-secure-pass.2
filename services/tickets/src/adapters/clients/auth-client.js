'use strict';

const { crearCliente } = require('../../../../shared/http-client');

function crearAuthClient({ baseUrl, token, logger }) {
  const cliente = crearCliente({
    baseUrl,
    token,
    servicio: 'auth-service',
    logger
  });

  return {
    async upsertUsuario({ nombre, dni, correo }, requestId) {
      const respuesta = await cliente.pedir('/internal/v1/usuarios/upsert', {
        method: 'POST',
        body: { nombre, dni, correo },
        requestId
      });
      return respuesta.usuario;
    },

    async verificarEncargado({ nombre, codigo }, requestId) {
      const respuesta = await cliente.pedir('/internal/v1/encargados/verificar', {
        method: 'POST',
        body: { nombre, codigo },
        requestId
      });
      return respuesta.encargado;
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

module.exports = { crearAuthClient };
