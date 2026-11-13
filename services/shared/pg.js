'use strict';

const { Pool, types } = require('pg');
const { crearLogger } = require('./logger');

// PostgreSQL devuelve BIGINT y NUMERIC como texto por defecto. Los servicios
// trabajan con números (ids, precios, contadores), así que se normalizan una
// sola vez para todos los pools.
types.setTypeParser(20, (valor) => Number.parseInt(valor, 10));
types.setTypeParser(1700, (valor) => Number.parseFloat(valor));

/**
 * Crea el pool de PostgreSQL de un microservicio y registra sus errores en el
 * log JSON común. Cada servicio pasa su propia configuración (`config.db`).
 */
function crearPool(config, servicio) {
  const pool = new Pool(config.db);
  const logger = crearLogger(servicio);

  pool.on('error', (error) => {
    logger.error('error_pool_postgres', { error: error.message });
  });

  return pool;
}

module.exports = { crearPool };
