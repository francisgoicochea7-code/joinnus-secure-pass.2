'use strict';

// Solo se entrega un enlace para elegir una contraseña. Jamás una contraseña
// ni el hash salen de auth_db. El código viaja en el fragmento del enlace,
// que el navegador no envía al servidor en la petición HTTP.
function crearCorreoActivacion({ apiKey, from, publicUrl, fetchImpl = globalThis.fetch }) {
  const habilitado = Boolean(apiKey && from && /^https:\/\/[^/]+(?:\/)?$/.test(publicUrl || ''));
  return {
    habilitado,
    async enviar({ correo, dni, codigo }) {
      if (!habilitado) return false;
      const enlace = `${publicUrl.replace(/\/$/, '')}/activar.html#dni=${encodeURIComponent(dni)}&codigo=${encodeURIComponent(codigo)}`;
      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), 10000);
      try {
        const respuesta = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from,
            to: [correo],
            subject: 'Activa tu cuenta para ver tu entrada',
            text: `Te han transferido una entrada. Para elegir tu contraseña y acceder a ella, abre este enlace: ${enlace}\n\n` +
              'Este enlace vence en 20 minutos y solo se puede usar una vez. Si no esperabas una entrada, ignora este mensaje.\n' +
              'Nunca compartas este enlace ni tu contraseña.'
          }),
          signal: controlador.signal
        });
        return respuesta.ok;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

module.exports = { crearCorreoActivacion };
