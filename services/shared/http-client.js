'use strict';

const { AppError } = require('./errors');

/** Cliente HTTP interno con timeout, reintentos y token compartido. */
function crearCliente({ baseUrl, token, servicio, logger, timeoutMs = 3000 }) {
  async function pedir(ruta, opciones = {}) {
    const url = `${baseUrl}${ruta}`;
    const intentos = Math.max(1, Number(opciones.intentos || 2));
    let ultimoError = null;

    const headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': token,
      ...(opciones.requestId ? { 'X-Request-Id': opciones.requestId } : {}),
      ...(opciones.headers || {})
    };

    for (let i = 0; i < intentos; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opciones.timeoutMs || timeoutMs);
      try {
        const respuesta = await fetch(url, {
          method: opciones.method || 'GET',
          headers,
          body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
          signal: ctrl.signal
        });
        clearTimeout(timer);

        const texto = await respuesta.text();
        let datos = null;
        try {
          datos = texto ? JSON.parse(texto) : null;
        } catch {
          datos = { texto };
        }

        if (!respuesta.ok) {
          throw new AppError(
            (datos && datos.error) || `Error de ${servicio}.`,
            respuesta.status,
            (datos && datos.codigo) || 'ERROR_DEPENDENCIA',
            datos
          );
        }

        return datos;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof AppError) throw err;
        ultimoError = err;
        logger.warn('dependencia_fallo', {
          servicio,
          url,
          intento: i + 1,
          error: err.message
        });
        if (i < intentos - 1) {
          await new Promise((r) => setTimeout(r, 150 * (i + 1)));
        }
      }
    }

    throw new AppError(
      `No se pudo contactar con ${servicio}.`,
      503,
      'DEPENDENCIA_NO_DISPONIBLE',
      { causa: ultimoError ? ultimoError.message : 'desconocida' }
    );
  }

  return { pedir };
}

module.exports = { crearCliente };
