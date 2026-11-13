'use strict';

/** Extrae el token de un payload `JSP|CODIGO|NONCE|HORA` o de un token directo. */
function extraerToken(entrada) {
  const texto = String(entrada || '').trim();
  const directo = /^JSP-[A-Z0-9]+-[0-9A-F]{8,}$/i.exec(texto);
  if (directo) return texto.toUpperCase();
  const partes = texto.split('|');
  if (partes.length >= 3 && /^JSP$/i.test(partes[0])) {
    return `JSP-${partes[1]}-${partes[2]}`.toUpperCase();
  }
  return null;
}

module.exports = { extraerToken };
