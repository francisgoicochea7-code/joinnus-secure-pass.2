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
const { crearLoginUsuario } = require('./application/login-usuario');
const { crearActivarUsuario } = require('./application/activar-usuario');
const { crearRutas } = require('./adapters/http/routes');
const { crearCorreoActivacion } = require('./adapters/email/resend');
const { asegurarEsquema, avisarSiFaltaSecreto } = require('./adapters/postgres/migracion');

const logger = crearLogger('auth');

const encargadoRepo = new PostgresEncargadoRepository(pool);
const usuarioRepo = new PostgresUsuarioRepository(pool);
const demoRepo = new PostgresDemoRepository(pool, config.seedSql);
const correoActivacion = crearCorreoActivacion({
  apiKey: config.resendApiKey, from: config.mailFrom, publicUrl: config.publicUrl
});

avisarSiFaltaSecreto(config.sessionSecret, logger);

(async () => {
  // Bases creadas antes de existir las contraseñas: añade la columna y da
  // contraseña a las cuentas de demostración que aún no tengan.
  try {
    await asegurarEsquema(pool, logger);
  } catch (error) {
    logger.warn('migracion_password_fallida', { mensaje: error.message });
  }

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
        activarUsuario: crearActivarUsuario({ usuarioRepo }),
        enviarActivacion: async (dni) => {
          const usuario = await usuarioRepo.buscarPorDni(dni);
          if (!usuario || usuario.password_hash) return 'no-necesaria';
          if (!correoActivacion.habilitado) return 'pendiente';
          try {
            const activacion = await usuarioRepo.emitirActivacion(dni);
            if (!activacion) return 'pendiente';
            return await correoActivacion.enviar({
              correo: activacion.correo, dni, codigo: activacion.codigo
            }) ? 'enviado' : 'pendiente';
          } catch (error) {
            // No registrar destinatarios, códigos ni el cuerpo de la respuesta.
            logger.warn('correo_activacion_fallido', { tipo: error.name });
            return 'pendiente';
          }
        },
        sessionSecret: config.sessionSecret,
        loginUsuario: crearLoginUsuario({
          usuarioRepo,
          sessionSecret: config.sessionSecret,
          sessionTtl: config.sessionTtl
        }),
        demoRepo,
        internalAuth: internalAuth(config.internalToken)
      }));
    },
    datosInicio: {
      baseDatos: `${config.db.host}:${config.db.port}/${config.db.database}`,
      sesiones: config.sessionSecret ? 'firmadas' : 'sin_secreto'
    }
  });
})().catch((error) => {
  logger.error('arranque_fallido', { mensaje: error.message });
  process.exit(1);
});
