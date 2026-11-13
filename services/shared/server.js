'use strict';

const express = require('express');
const { requestId } = require('./request-id');
const { errorMiddleware } = require('./errors');
const { montarHealth } = require('./health');

/**
 * Arranque común de los microservicios: JSON, request-id, /health, /ready,
 * rutas propias, 404 y middleware de errores. También cierra el servidor y el
 * pool ante SIGTERM/SIGINT para que Docker no espere al timeout.
 */
function crearServicio({
  servicio,
  puerto,
  pool,
  logger,
  limiteJson = '32kb',
  montarRutas,
  datosInicio = {}
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: limiteJson }));
  app.use(requestId);

  montarHealth(app, { servicio, pool });
  montarRutas(app);

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: 'Ruta no encontrada.',
      codigo: 'NO_ENCONTRADO',
      requestId: req.id
    });
  });

  app.use(errorMiddleware(logger));

  const servidor = app.listen(puerto, '0.0.0.0', () => {
    logger.info('servicio_iniciado', { puerto, ...datosInicio });
  });

  function apagar(senal) {
    logger.info('apagando', { senal });
    servidor.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }

  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));

  return { app, servidor };
}

module.exports = { crearServicio };
