'use strict';

const config = require('./config');
const { crearLogger } = require('../../shared/logger');
const { crearServicio } = require('../../shared/server');
const { internalAuth } = require('../../shared/internal-auth');
const { pool } = require('./adapters/postgres/pool');
const { PostgresTokenRepository } = require('./adapters/postgres/token-repository');
const { crearTicketsClient } = require('./adapters/clients/tickets-client');
const { crearRotarToken } = require('./application/rotar-token');
const { crearValidarToken } = require('./application/validar-token');
const { crearInvalidarTokens } = require('./application/invalidar-tokens');
const { crearMarcarUsado } = require('./application/marcar-usado');
const { crearReiniciarDemo } = require('./application/reiniciar-demo');
const { crearRutas } = require('./adapters/http/routes');

const logger = crearLogger('qr');
const tokenRepo = new PostgresTokenRepository(pool);
const ticketsClient = crearTicketsClient({
  baseUrl: config.ticketsServiceUrl,
  token: config.internalToken,
  logger
});

crearServicio({
  servicio: 'qr',
  puerto: config.puerto,
  pool,
  logger,
  montarRutas: (app) => {
    app.use(crearRutas({
      config,
      logger,
      internalAuth: internalAuth(config.internalToken),
      rotarToken: crearRotarToken({ tokenRepo }),
      validarToken: crearValidarToken({ tokenRepo }),
      invalidarTokens: crearInvalidarTokens({ tokenRepo }),
      marcarUsado: crearMarcarUsado({ tokenRepo }),
      reiniciarDemo: crearReiniciarDemo({ tokenRepo }),
      ticketsClient
    }));
  },
  datosInicio: {
    baseDatos: `${config.db.host}:${config.db.port}/${config.db.database}`,
    tickets: config.ticketsServiceUrl
  }
});
