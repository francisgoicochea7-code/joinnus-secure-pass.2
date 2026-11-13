'use strict';

class AppError extends Error {
  constructor(mensaje, status = 500, codigo = 'ERROR_INTERNO', detalles = null) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
    if (detalles && detalles.campos) this.campos = detalles.campos;
  }
}

/** Envuelve un handler async para que los errores lleguen al middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Middleware de error común. */
function errorMiddleware(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = Number(err.status || 500);
    const codigo = err.codigo || 'ERROR_INTERNO';
    const esServidor = status >= 500;

    logger.error('error_http', {
      requestId: req.id,
      ruta: `${req.method} ${req.originalUrl}`,
      status,
      codigo,
      error: err.message
    });

    const cuerpo = {
      ok: false,
      error: esServidor ? 'Error interno del servicio.' : err.message,
      codigo,
      requestId: req.id
    };
    if (err.detalles && typeof err.detalles === 'object') {
      for (const [clave, valor] of Object.entries(err.detalles)) {
        if (!['ok', 'error', 'codigo', 'requestId'].includes(clave)) {
          cuerpo[clave] = valor;
        }
      }
    }
    if (err.campos) cuerpo.campos = err.campos;

    res.status(status).json(cuerpo);
  };
}

module.exports = { AppError, asyncHandler, errorMiddleware };
