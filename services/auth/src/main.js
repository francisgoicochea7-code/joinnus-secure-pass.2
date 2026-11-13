'use strict';

const config = require('./config');
const { crearLogger } = require('../../shared/logger');
const { crearServicio } = require('../../shared/server');
const { internalAuth } = require('../../shared/internal-auth');
const { pool } = require('./adapters/postgres/pool');
const { PostgresEncargadoRepository } = require('./adapters/postgres/encargado-repository');
const { PostgresUsuarioRepository } = require('./adapters/postgres/usuario-repository');
const { PostgresDemoRepository } = require('./adapters/postgres/demo-repository');
const { crearLoginEncargado } = require('./application/login-encargado');
const { crearVerificarEncargado } = require('./application/verificar-encargado');
const { crearCrearUsuario } = require('./application/crear-usuario');
const { crearUpsertUsuario } = require('./application/upsert-usuario');
const { crearObtenerUsuario } = require('./application/obtener-usuario');
const { crearRutas } = require('./adapters/http/routes');

const logger = crearLogger('auth');

const encargadoRepo = new PostgresEncargadoRepository(pool);
const usuarioRepo = new PostgresUsuarioRepository(pool);
const demoRepo = new PostgresDemoRepository(pool, config.seedSql);

crearServicio({
  servicio: 'auth',
  puerto: config.puerto,
  pool,
  logger,
  montarRutas: (app) => {
    app.use(crearRutas({
      loginEncargado: crearLoginEncargado({ encargadoRepo }),
      verificarEncargado: crearVerificarEncargado({ encargadoRepo }),
      crearUsuario: crearCrearUsuario({ usuarioRepo }),
      upsertUsuario: crearUpsertUsuario({ usuarioRepo }),
      obtenerUsuario: crearObtenerUsuario({ usuarioRepo }),
      demoRepo,
      internalAuth: internalAuth(config.internalToken)
    }));
  },
  datosInicio: {
    baseDatos: `${config.db.host}:${config.db.port}/${config.db.database}`
  }
});
