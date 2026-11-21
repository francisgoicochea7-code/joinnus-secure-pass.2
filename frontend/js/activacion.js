(function () {
  'use strict';

  const form = document.getElementById('form-activar');
  const aviso = document.getElementById('activar-mensaje');
  const enviar = document.getElementById('activar-enviar');
  const acceso = document.getElementById('activar-ir');

  // El fragmento no se envía al servidor. Se elimina del historial de la URL
  // en cuanto se rellenan los campos, para que no quede visible al compartirla.
  const parametros = new URLSearchParams(window.location.hash.slice(1));
  const dniEnlace = parametros.get('dni');
  const codigoEnlace = parametros.get('codigo');
  if (dniEnlace && /^\d{8}$/.test(dniEnlace)) document.getElementById('activar-dni').value = dniEnlace;
  if (codigoEnlace && /^[A-Za-z0-9_-]{32}$/.test(codigoEnlace)) document.getElementById('activar-codigo').value = codigoEnlace;
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);

  document.getElementById('form-pedir-activacion').addEventListener('submit', async event => {
    event.preventDefault();
    const boton = document.getElementById('pedir-enviar');
    const mensaje = document.getElementById('pedir-mensaje');
    const dni = document.getElementById('pedir-dni').value.trim();
    if (!/^\d{8}$/.test(dni)) return;
    boton.disabled = true;
    try {
      const respuesta = await ClienteAPI.solicitarActivacion(dni);
      mensaje.textContent = respuesta.ok
        ? 'Si tu cuenta está pendiente y el correo está habilitado, recibirás un enlace en el correo registrado. Revisa también spam.'
        : 'No se pudo procesar la solicitud. Inténtalo más tarde.';
    } catch (_) {
      mensaje.textContent = 'No se pudo procesar la solicitud. Inténtalo más tarde.';
    } finally {
      boton.disabled = false;
    }
  });

  function mostrar(mensaje, correcto) {
    aviso.textContent = mensaje;
    aviso.className = 'alert mt-3 ' + (correcto ? 'alert-ok' : 'alert-error');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const dni = document.getElementById('activar-dni').value.trim();
    const codigo = document.getElementById('activar-codigo').value.trim();
    const password = document.getElementById('activar-password').value;
    if (password !== document.getElementById('activar-confirmar').value) {
      mostrar('Las contraseñas deben coincidir.', false);
      return;
    }

    enviar.disabled = true;
    try {
      if (!await ClienteAPI.comprobar()) {
        mostrar('La activación requiere conexión con el servidor.', false);
        return;
      }
      const respuesta = await ClienteAPI.activarUsuario({ dni, codigo, password });
      if (!respuesta.ok || respuesta.datos?.ok !== true) {
        mostrar(respuesta.datos?.error || 'No pudimos activar la cuenta. Inténtalo de nuevo.', false);
        return;
      }
    } catch (error) {
      mostrar('No pudimos confirmar la activación. Intenta iniciar sesión con tu nueva contraseña.', false);
      return;
    } finally {
      enviar.disabled = false;
    }

    form.reset();
    form.classList.add('hide');
    mostrar('Cuenta activada. Ya puedes iniciar sesión con tu nueva contraseña.', true);
    acceso.classList.remove('hide');
    acceso.focus();
  });
})();
