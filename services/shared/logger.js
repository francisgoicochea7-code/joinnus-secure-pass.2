'use strict';

/** Logger JSON mínimo, sin dependencias externas. */
function crearLogger(servicio) {
  function emitir(nivel, mensaje, datos = {}) {
    const entrada = {
      nivel,
      servicio,
      hora: new Date().toISOString(),
      mensaje,
      ...datos
    };
    const linea = JSON.stringify(entrada);
    if (nivel === 'error') console.error(linea);
    else console.log(linea);
  }

  return {
    info: (mensaje, datos) => emitir('info', mensaje, datos),
    warn: (mensaje, datos) => emitir('warn', mensaje, datos),
    error: (mensaje, datos) => emitir('error', mensaje, datos),
    debug: (mensaje, datos) => {
      if (process.env.LOG_DEBUG === '1') emitir('debug', mensaje, datos);
    }
  };
}

module.exports = { crearLogger };
