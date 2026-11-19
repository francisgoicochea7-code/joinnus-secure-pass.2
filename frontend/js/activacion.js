(function () {
  'use strict';

  const form = document.getElementById('form-activar');
  const aviso = document.getElementById('activar-mensaje');
  const enviar = document.getElementById('activar-enviar');
  const acceso = document.getElementById('activar-ir');

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
