/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/identificacion.js
 * -------------------------------------------------------------------------
 * Píldora de identidad + modal, presentes en TODAS las páginas.
 *
 * La identificación la hace js/sesion.js (DNI + nombres + apellidos, que se
 * comprueban contra la base de datos). Este archivo sólo aporta la interfaz
 * para poder identificarse desde cualquier página y no sólo desde el panel.
 *
 * En cuanto alguien se identifica:
 *   - el DNI viaja en la cabecera X-Usuario-DNI (cliente-api.js)
 *   - el backend entrega SUS entradas, SU QR y SU historial
 *   - el servidor exige además que la entrada sea de esa persona para
 *     emitir un QR o transferirla (403 si no lo es)
 *
 * IMPORTANTE: esto NO es autenticación con contraseña, es identificación.
 * El límite está explicado en el README, sección 10.
 *
 * Las pruebas (test/verificacion.js) cargan este archivo en los grupos 4b,
 * 4d, 4e y 5, así que aquí sólo se usan ids creados por este mismo archivo.
 * ========================================================================= */

(function () {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (!window.Sesion) return;                 // página sin js/sesion.js

  const Sesion = window.Sesion;

  const ICONO_USUARIO = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.2 0-9 2.1-9 5v3h18v-3c0-2.9-4.8-5-9-5Z"/></svg>';

  const ICONO_ALERTA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2Zm1 14h-2v2h2v-2Zm0-7h-2v5h2V9Z"/></svg>';

  const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z"/></svg>';

  const CAMPOS = ['dni', 'nombres', 'apellidos'];

  function $(id) { return document.getElementById(id); }

  function notificar(tipo, titulo, texto) {
    if (window.JSP && typeof JSP.toast === 'function') JSP.toast(tipo, titulo, texto);
  }

  function recargar() {
    if (window.location && typeof window.location.reload === 'function') window.location.reload();
  }

  /**
   * En la PÁGINA DEL QR, después de identificarse se navega a la COMPRA de
   * esa persona (su entrada válida) para que el código que se dibuje sea el
   * suyo y con sus datos de compra, en vez de quedarse en la entrada de otra
   * persona. En el resto de páginas sólo se recarga, que ya filtran por el
   * DNI identificado.
   */
  async function recargarCompraPropia() {
    if (!$('qr-canvas') || typeof window.SecurePassAPI === 'undefined') {
      recargar();
      return;
    }
    try {
      const mias = await window.SecurePassAPI.listarMisEntradas();
      const suya = mias.find(function (e) { return e.estado === 'valido'; }) || mias[0];
      window.location.href = suya
        ? 'entrada.html?codigo=' + encodeURIComponent(suya.codigo)
        : 'entrada.html';
    } catch (e) {
      recargar();
    }
  }

  /* ---------------------------------------------------------------------
   * Errores de campo dentro del modal
   * ----------------------------------------------------------------- */
  function limpiarErrores() {
    CAMPOS.forEach(function (campo) {
      const caja = $('identif-error-' + campo);
      if (caja) caja.classList.remove('show');
      const input = $('identif-' + campo);
      if (input) input.classList.remove('is-invalid');
    });
    const alerta = $('identif-alerta');
    if (alerta) alerta.classList.add('hide');
  }

  function marcarError(campo, mensaje) {
    const caja = $('identif-error-' + campo);
    const input = $('identif-' + campo);
    if (caja) {
      const span = caja.querySelector('span');
      if (span) span.textContent = mensaje;
      caja.classList.add('show');
    }
    if (input) input.classList.add('is-invalid');
  }

  function mostrarAlerta(mensaje) {
    const alerta = $('identif-alerta');
    const texto = $('identif-alerta-texto');
    if (texto) texto.textContent = mensaje;
    if (alerta) alerta.classList.remove('hide');
  }

  /* ---------------------------------------------------------------------
   * Registro de usuarios nuevos (segunda vista del mismo modal)
   * ----------------------------------------------------------------- */
  const CAMPOS_REG = ['dni', 'nombres', 'apellidos', 'correo'];

  function limpiarErroresReg() {
    CAMPOS_REG.forEach(function (campo) {
      const caja = $('reg-error-' + campo);
      if (caja) caja.classList.remove('show');
      const input = $('reg-' + campo);
      if (input) input.classList.remove('is-invalid');
    });
    const alerta = $('reg-alerta');
    if (alerta) alerta.classList.add('hide');
  }

  function marcarErrorReg(campo, mensaje) {
    const caja = $('reg-error-' + campo);
    const input = $('reg-' + campo);
    if (caja) {
      const span = caja.querySelector('span');
      if (span) span.textContent = mensaje;
      caja.classList.add('show');
    }
    if (input) input.classList.add('is-invalid');
  }

  function mostrarAlertaReg(mensaje) {
    const alerta = $('reg-alerta');
    const texto = $('reg-alerta-texto');
    if (texto) texto.textContent = mensaje;
    if (alerta) alerta.classList.remove('hide');
  }

  /** Alterna entre identificarse y crear cuenta (mismo modal). */
  function mostrarRegistro(si) {
    const formIdentif = $('identif-formulario');
    const formReg = $('reg-formulario');
    const pieIdentif = $('identif-pie');
    const pieReg = $('reg-pie');
    if (formIdentif) formIdentif.classList[si ? 'add' : 'remove']('hide');
    if (formReg) formReg.classList[si ? 'remove' : 'add']('hide');
    if (pieIdentif) pieIdentif.classList[si ? 'add' : 'remove']('hide');
    if (pieReg) pieReg.classList[si ? 'remove' : 'add']('hide');

    const titulo = $('identif-titulo');
    if (titulo) titulo.textContent = si ? 'Crea tu cuenta' : '¿Quién eres?';
    const subtitulo = $('identif-subtitulo');
    if (subtitulo) {
      subtitulo.innerHTML = si
        ? 'Da de alta tu DNI, tu nombre y tu correo para poder identificarte y ver <strong>tus</strong> entradas.'
        : 'Escribe tus datos registrados para ver <strong>tus</strong> entradas, <strong>tu</strong> QR y <strong>tu</strong> historial.';
    }

    if (si) limpiarErroresReg();
    else limpiarErrores();
  }

  /** Da de alta la cuenta y, si el servidor la creó, se identifica sola. */
  async function registrarse() {
    limpiarErroresReg();

    const datos = {
      dni: ($('reg-dni') || {}).value || '',
      nombres: ($('reg-nombres') || {}).value || '',
      apellidos: ($('reg-apellidos') || {}).value || '',
      correo: ($('reg-correo') || {}).value || ''
    };

    const boton = $('reg-enviar');
    if (boton) boton.disabled = true;

    let r;
    try {
      r = await window.SecurePassAPI.crearUsuario(datos);
    } catch (e) {
      mostrarAlertaReg('No se pudo crear la cuenta. Revisa que la API esté arriba.');
      if (boton) boton.disabled = false;
      return;
    }
    if (boton) boton.disabled = false;

    if (!r || !r.ok) {
      const campo = r && r.campo;
      const mensaje = (r && r.mensaje) || 'Revisa los datos escritos.';
      if (campo && CAMPOS_REG.indexOf(campo) >= 0) marcarErrorReg(campo, mensaje);
      else mostrarAlertaReg(mensaje);
      return;
    }

    // Alta hecha: con los mismos datos se identifica (el backend ya la tiene)
    let id = null;
    try { id = await Sesion.identificar(datos.dni, datos.nombres, datos.apellidos); }
    catch (e) { id = null; }

    notificar('ok', 'Cuenta creada',
      ((r.usuario && r.usuario.nombre) || 'Tu cuenta') + ' ya está registrada.');

    if (id && id.ok) {
      mostrarRegistro(false);
      await recargarCompraPropia();
      return;
    }
    mostrarRegistro(false);
    mostrarAlerta('Cuenta creada. Ahora identifícate con tu nombre y apellidos.');
  }

  /* ---------------------------------------------------------------------
   * Píldora
   * ----------------------------------------------------------------- */
  function pintarPildora() {
    const texto = $('pildora-texto');
    if (!texto) return;
    const u = Sesion.usuario();
    if (u) {
      texto.textContent = u.nombre + ' · ' + u.dni;
      const salir = $('pildora-salir');
      if (salir) salir.classList.remove('hide');
    } else {
      texto.textContent = 'Identifícate';
      const salir = $('pildora-salir');
      if (salir) salir.classList.add('hide');
    }
  }

  /* ---------------------------------------------------------------------
   * Modal
   * ----------------------------------------------------------------- */
  function rellenarModal() {
    const u = Sesion.usuario();
    const dni = $('identif-dni');
    const nombres = $('identif-nombres');
    const apellidos = $('identif-apellidos');
    if (dni) dni.value = u ? u.dni : '';
    if (nombres) nombres.value = u ? (u.nombres || '') : '';
    if (apellidos) apellidos.value = u ? (u.apellidos || '') : '';
    limpiarErrores();
    mostrarRegistro(false);   // siempre se abre en la vista de identificación
  }

  async function identificar() {
    limpiarErrores();

    const dni = ($('identif-dni') || {}).value || '';
    const nombres = ($('identif-nombres') || {}).value || '';
    const apellidos = ($('identif-apellidos') || {}).value || '';

    const boton = $('identif-enviar');
    if (boton) boton.disabled = true;

    let r;
    try {
      r = await Sesion.identificar(dni, nombres, apellidos);
    } catch (e) {
      mostrarAlerta('No se pudo comprobar la identidad. Revisa que la API esté arriba.');
      if (boton) boton.disabled = false;
      return;
    }

    if (boton) boton.disabled = false;

    if (!r || !r.ok) {
      const campo = r && r.campo;
      const mensaje = (r && r.mensaje) || 'Revisa los datos escritos.';
      if (campo && CAMPOS.indexOf(campo) >= 0) marcarError(campo, mensaje);
      else mostrarAlerta(mensaje);
      return;
    }

    notificar('ok', 'Identificación correcta',
      (r.usuario && r.usuario.nombre ? r.usuario.nombre : 'Bienvenido') + ' ya ve sus entradas.');
    await recargarCompraPropia();
  }

  function salir() {
    Sesion.olvidar();
    notificar('ok', 'Sesión cerrada', 'Vuelves a ver el usuario de demostración.');
    recargarCompraPropia();
  }

  /* ---------------------------------------------------------------------
   * Montaje (una sola vez por página)
   * ----------------------------------------------------------------- */
  let montado = false;
  function montar() {
    // "Sólo una vez por página". Se comprueba con un flag y no mirando los
    // ids: en el micro-DOM de las pruebas, preguntar por un id que todavía no
    // existe lo CREA, así que el guard anterior se disparaba a sí mismo y el
    // modal de identificación (y el de registro) nunca llegaban a montarse.
    if (montado) return;
    montado = true;

    const pildora = document.createElement('div');
    pildora.className = 'pildora-usuario';
    pildora.id = 'pildora-usuario';
    pildora.innerHTML =
      '<button type="button" class="pildora-btn" id="pildora-btn" data-modal-open="modal-identificacion" title="Identifícate para ver tus entradas, tu QR y tu historial">' +
        ICONO_USUARIO +
        '<span id="pildora-texto">Identifícate</span>' +
      '</button>' +
      '<button type="button" class="pildora-salir hide" id="pildora-salir" title="Cerrar la identificación">Salir</button>';

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'modal-identificacion';
    modal.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head">' +
          '<div>' +
            '<h3 id="identif-titulo">¿Quién eres?</h3>' +
            '<p id="identif-subtitulo">Escribe tus datos registrados para ver <strong>tus</strong> entradas, <strong>tu</strong> QR y <strong>tu</strong> historial.</p>' +
          '</div>' +
          '<button class="modal-close" data-modal-close="modal-identificacion" aria-label="Cerrar">' + ICONO_CERRAR + '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div id="identif-formulario">' +
            '<div class="field">' +
              '<label for="identif-dni">DNI</label>' +
              '<input class="input mono" id="identif-dni" inputmode="numeric" maxlength="8" placeholder="12345678" autocomplete="off">' +
              '<div class="error-msg" id="identif-error-dni">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="identif-nombres">Nombres</label>' +
              '<input class="input" id="identif-nombres" placeholder="Carlos" autocomplete="off">' +
              '<div class="error-msg" id="identif-error-nombres">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="identif-apellidos">Apellidos</label>' +
              '<input class="input" id="identif-apellidos" placeholder="Pérez" autocomplete="off">' +
              '<div class="error-msg" id="identif-error-apellidos">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="alert alert-info hide" id="identif-alerta">' + ICONO_ALERTA +
              '<span id="identif-alerta-texto"></span>' +
            '</div>' +
            '<p class="tiny muted">No es una contraseña: el sistema comprueba que esos datos estén ' +
              'registrados en la base. Usuarios de la demostración: <span class="mono">45678945</span> ' +
              '(Carlos Pérez) y <span class="mono">52311878</span> (Andrea Torres).</p>' +
            '<p class="tiny muted">¿Todavía no estás registrado? ' +
              '<button type="button" class="btn-link" id="identif-a-registro">Crea tu cuenta</button></p>' +
          '</div>' +
          '<div id="reg-formulario" class="hide">' +
            '<div class="field">' +
              '<label for="reg-dni">DNI</label>' +
              '<input class="input mono" id="reg-dni" inputmode="numeric" maxlength="8" placeholder="12345678" autocomplete="off">' +
              '<div class="error-msg" id="reg-error-dni">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="reg-nombres">Nombres</label>' +
              '<input class="input" id="reg-nombres" placeholder="Ana" autocomplete="off">' +
              '<div class="error-msg" id="reg-error-nombres">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="reg-apellidos">Apellidos</label>' +
              '<input class="input" id="reg-apellidos" placeholder="Gómez" autocomplete="off">' +
              '<div class="error-msg" id="reg-error-apellidos">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="reg-correo">Correo electrónico</label>' +
              '<input class="input" id="reg-correo" type="email" placeholder="ana@correo.com" autocomplete="off">' +
              '<div class="error-msg" id="reg-error-correo">' + ICONO_ALERTA + '<span></span></div>' +
            '</div>' +
            '<div class="alert alert-info hide" id="reg-alerta">' + ICONO_ALERTA +
              '<span id="reg-alerta-texto"></span>' +
            '</div>' +
            '<p class="tiny muted">Al crear la cuenta sólo se guardan tu DNI, tu nombre y tu correo. ' +
              'No hay contraseña: es la misma identificación de siempre.</p>' +
            '<p class="tiny muted">¿Ya tienes cuenta? ' +
              '<button type="button" class="btn-link" id="reg-a-identif">Identifícate</button></p>' +
          '</div>' +
        '</div>' +
        '<div class="modal-foot" id="identif-pie">' +
          '<button class="btn btn-ghost" id="identif-salir" type="button">Salir de la identificación</button>' +
          '<button class="btn btn-primary" id="identif-enviar" type="button">Identificarme</button>' +
        '</div>' +
        '<div class="modal-foot hide" id="reg-pie">' +
          '<button class="btn btn-ghost" id="reg-volver" type="button">Ya tengo cuenta</button>' +
          '<button class="btn btn-primary" id="reg-enviar" type="button">Crear cuenta</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(pildora);
    document.body.appendChild(modal);

    const btnPildora = $('pildora-btn');
    if (btnPildora) btnPildora.addEventListener('click', rellenarModal);

    const btnSalir = $('pildora-salir');
    if (btnSalir) btnSalir.addEventListener('click', salir);

    const btnSalirModal = $('identif-salir');
    if (btnSalirModal) {
      btnSalirModal.addEventListener('click', function () {
        if (Sesion.estaIdentificado()) salir();
        else if (window.JSP && JSP.cerrarModal) JSP.cerrarModal('modal-identificacion');
      });
    }

    const btnEnviar = $('identif-enviar');
    if (btnEnviar) btnEnviar.addEventListener('click', identificar);

    // Registro de usuarios nuevos: la segunda vista de la misma modal
    const btnAResgistro = $('identif-a-registro');
    if (btnAResgistro) {
      btnAResgistro.addEventListener('click', function () { mostrarRegistro(true); });
    }

    const btnAIdentif = $('reg-a-identif');
    if (btnAIdentif) {
      btnAIdentif.addEventListener('click', function () { mostrarRegistro(false); });
    }

    const btnVolverReg = $('reg-volver');
    if (btnVolverReg) {
      btnVolverReg.addEventListener('click', function () { mostrarRegistro(false); });
    }

    const btnCrear = $('reg-enviar');
    if (btnCrear) btnCrear.addEventListener('click', registrarse);

    CAMPOS_REG.forEach(function (campo) {
      const input = $('reg-' + campo);
      if (!input) return;
      input.addEventListener('input', function () {
        const caja = $('reg-error-' + campo);
        if (caja) caja.classList.remove('show');
        input.classList.remove('is-invalid');
        if (campo === 'dni') input.value = String(input.value || '').replace(/\D/g, '').slice(0, 8);
      });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); registrarse(); }
      });
    });

    CAMPOS.forEach(function (campo) {
      const input = $('identif-' + campo);
      if (!input) return;
      input.addEventListener('input', function () {
        const caja = $('identif-error-' + campo);
        if (caja) caja.classList.remove('show');
        input.classList.remove('is-invalid');
        if (campo === 'dni') input.value = input.value.replace(/\D/g, '').slice(0, 8);
      });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); identificar(); }
      });
    });

    pintarPildora();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
