'use strict';

/** Convierte los marcadores '?' de las consultas al formato $1, $2... de pg. */
function pgSql(sql) {
  let n = 0;
  return String(sql).replace(/\?/g, () => '$' + (++n));
}

module.exports = { pgSql };
