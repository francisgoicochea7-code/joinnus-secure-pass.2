'use strict';

/** Extrae el token de un payload `JSP|CODIGO|NONCE|HORA` o de un token directo. */
function extraerToken(entrada) {
  const texto = String(entrada || '').trim();
  // El codigo de una entrada puede contener guiones (p. ej. CARLOS-20261210-01).
  const codigoValido = /^[A-Z0-9][A-Z0-9-]{3,23}$/i;
  const nonceValido = /^[0-9A-F]{8,}$/i;
  const directo = /^JSP-(.+)-([0-9A-F]{8,})$/i.exec(texto);
  if (directo && codigoValido.test(directo[1])) return texto.toUpperCase();
  const partes = texto.split('|');
  if (partes.length >= 3 && /^JSP$/i.test(partes[0]) &&
      codigoValido.test(partes[1]) && nonceValido.test(partes[2])) {
    return `JSP-${partes[1]}-${partes[2]}`.toUpperCase();
  }
  return null;
}

module.exports = { extraerToken };
