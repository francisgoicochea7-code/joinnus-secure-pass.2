'use strict';

/** Convierte una columna DATE de PostgreSQL a 'YYYY-MM-DD'.
 *  pg la entrega como objeto Date; se usan los componentes locales para no
 *  desplazar el día por la zona horaria. */
function fechaCorta(valor) {
  if (valor instanceof Date) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  return String(valor).slice(0, 10);
}

module.exports = { fechaCorta };
