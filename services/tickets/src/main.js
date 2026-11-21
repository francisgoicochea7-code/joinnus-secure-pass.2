'use strict';

const config = require('./config');
const { crearLogger } = require('../../shared/logger');
const { crearServicio } = require('../../shared/server');
const { internalAuth } = require('../../shared/internal-auth');
const { pool } = require('./adapters/postgres/pool');
const { PostgresEntradaRepository } = require('./adapters/postgres/entrada-repository');
const { PostgresHistorialRepository } = require('./adapters/postgres/historial-repository');
const { PostgresDemoRepository } = require('./adapters/postgres/demo-repository');
const { crearAuthClient } = require('./adapters/clients/auth-client');
const { crearQrClient } = require('./adapters/clients/qr-client');
const { crearConsultas } = require('./application/consultas');
const { crearTransferirEntrada } = require('./application/transferir-entrada');
const { crearValidarPuerta } = require('./application/validar-puerta');
const { crearCambiarEstado } = require('./application/cambiar-estado');
const { crearReiniciarDemo } = require('./application/reiniciar-demo');
const { crearRutas } = require('./adapters/http/routes');

const logger = crearLogger('tickets');
const entradaRepo = new PostgresEntradaRepository(pool);
const historialRepo = new PostgresHistorialRepository(pool);
const demoRepo = new PostgresDemoRepository(pool, config.seedSql);
const authClient = crearAuthClient({
  baseUrl: config.authServiceUrl,
  token: config.internalToken,
  logger
});
const qrClient = crearQrClient({
  baseUrl: config.qrServiceUrl,
  token: config.internalToken,
  logger
});

crearServicio({
  servicio: 'tickets',
  puerto: config.puerto,
  pool,
  logger,
  limiteJson: '64kb',
  montarRutas: (app) => {
    app.use(crearRutas({
      config,
      consultas: crearConsultas({ entradaRepo, historialRepo }),
      transferirEntrada: crearTransferirEntrada({
        entradaRepo,
        historialRepo,
        authClient,
        qrClient,
        logger
      }),
      validarPuerta: crearValidarPuerta({
        entradaRepo,
        historialRepo,
        authClient,
        qrClient,
        logger
      }),
      cambiarEstado: crearCambiarEstado({
        entradaRepo,
        historialRepo,
        qrClient,
        logger
      }),
      reiniciarDemo: crearReiniciarDemo({ demoRepo, authClient, qrClient }),
      entradaRepo,
      authClient,
      historialRepo,
      demoRepo,
      internalAuth: internalAuth(config.internalToken)
    }));
  },
  datosInicio: {
    baseDatos: `${config.db.host}:${config.db.port}/${config.db.database}`,
    auth: config.authServiceUrl,
    qr: config.qrServiceUrl
  }
});
