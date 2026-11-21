/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/transferencia.js
 * Formulario de transferencia segura con validación en vivo:
 *   nombre · DNI (8 dígitos) · correo · precio con límite máximo
 * En modo Docker la validación se repite en el servidor (backend/index.js).
 * ========================================================================= */

(function () {
  'use strict';

  const detalle = document.getElementById('detalle-entrada');
  if (!detalle) return;

  const $ = id => document.getElementById(id);

  let entrada = null;
  let pendiente = null;
  let dniTitularOk = false;
  let cargaActual = 0;
  let sesionPendiente = '';
  let codigoPendiente = '';
  let transfiriendo = false;

  function dniDeSesion() {
    if (typeof Sesion === 'undefined' || !Sesion ||
        typeof Sesion.estaIdentificado !== 'function' || !Sesion.estaIdentificado() ||
        typeof Sesion.dni !== 'function') return '';
    const dni = String(Sesion.dni() || '');
    return /^\d{8}$/.test(dni) ? dni : '';
  }

  function esPropia(e, dni) {
    return !!(dni && e && e.esMia === true && String(e.dni || '') === dni);
  }

  function esTransferible(e) {
    return esPropia(e, dniDeSesion()) && ['valido', 'transferido'].includes(e.estado) && e.puedeTransferir === true;
  }

  function mostrarAviso(titulo, texto, pedirSesion) {
    entrada = null;
    pendiente = null;
    dniTitularOk = false;
    sesionPendiente = '';
    codigoPendiente = '';
    detalle.innerHTML = '';
    $('card-entrada').classList.add('hide');
    $('bloque-titular-actual').classList.add('hide');
    $('transferencia-aviso').classList.remove('hide');
    $('transferencia-aviso-titulo').textContent = titulo;
    $('transferencia-aviso-texto').textContent = texto;
    $('btn-identificar-transferencia').classList.toggle('hide', !pedirSesion);
    const sel = $('entrada-transferir');
    sel.innerHTML = '<option value="">' + (pedirSesion ? 'Inicia sesión para ver tus entradas' : 'Sin entradas disponibles') + '</option>';
    sel.disabled = true;
    $('dni-titular').value = '';
    $('error-titular').classList.remove('show');
    pintarAtajoDni();
    JSP.pintarModo();
  }

  function pedirIdentificacion() {
    mostrarAviso('Identifícate para transferir tu entrada',
      'Inicia sesión con tu DNI y contraseña. Solo podrás ver y transferir tus propias entradas válidas.', true);
    $('ultimas-transferencias').innerHTML = '<p class="small muted mb-0">Inicia sesión para ver tus transferencias.</p>';
    limpiarModal();
    JSP.cerrarModal('modal-transferencia');
  }

  function limpiarModal() {
    ['nuevo-nombre', 'nuevo-dni', 'nuevo-correo', 'nuevo-precio'].forEach(id => { $(id).value = ''; });
    ['resumen-evento', 'resumen-titular', 'precio-original', 'precio-maximo', 'c-actual', 'c-nuevo', 'c-dni', 'c-dni-completo',
      'c-correo', 'c-precio', 'c-codigo', 'r-anterior', 'r-nuevo', 'r-dni', 'r-codigo', 'r-estado', 'r-activacion'].forEach(id => {
      $(id).textContent = '';
      $(id).innerHTML = '';
    });
  }

  /** Atajo opcional: no rellena nada solo, el usuario decide usarlo. */
  function pintarAtajoDni() {
    const boton = $('btn-usar-mi-dni');
    if (!boton) return;

    const dni = dniDeSesion();
    if (!esTransferible(entrada)) {
      boton.classList.add('hide');
      return;
    }

    boton.textContent = 'Usar el DNI de mi sesión (' + JSP.ocultarDNI(dni) + ')';
    boton.classList.remove('hide');
  }

  /* ------------------------------------------------------------------ */
  /* Mostrar la entrada actual                                           */
  /* ------------------------------------------------------------------ */
  async function cargarEntrada(codigoForzado) {
    const carga = ++cargaActual;
    const dni = dniDeSesion();
    if (!dni) {
      pedirIdentificacion();
      return;
    }

    mostrarAviso('Cargando tus entradas', 'Consultando las entradas válidas de tu sesión.', false);
    let mias;
    try {
      mias = await SecurePassAPI.listarMisEntradas();
    } catch (e) {
      if (carga !== cargaActual || dniDeSesion() !== dni) return;
      mostrarAviso('No se pudieron cargar tus entradas', 'Vuelve a iniciar sesión o inténtalo de nuevo. No se mostrarán entradas de demostración.', true);
      return;
    }
    if (carga !== cargaActual || dniDeSesion() !== dni) return;
    const lista = mias.filter(e => esPropia(e, dni) && ['valido', 'transferido'].includes(e.estado) && e.puedeTransferir === true);
    const codigo = codigoForzado === null ? '' : codigoForzado || JSP.parametro('codigo');
    entrada = codigo ? lista.find(e => e.codigo === codigo) : lista[0];
    if (!entrada) {
      mostrarAviso(codigo ? 'Entrada no disponible para transferir' : 'No tienes entradas disponibles para transferir',
        'Solo puedes transferir entradas válidas que pertenezcan a la cuenta con la que iniciaste sesión.', false);
      return;
    }
    $('transferencia-aviso').classList.add('hide');
    $('card-entrada').classList.remove('hide');

    detalle.innerHTML = `
      <div class="row-between" style="margin-bottom:1rem">
        <div>
          <h3 style="margin-bottom:.2rem">${JSP.escapeHtml(entrada.evento)}</h3>
          <div class="entry-code">Código: ${JSP.escapeHtml(entrada.codigo)}</div>
        </div>
        ${JSP.estadoBadge(entrada.estado)}
      </div>

      <div class="kv"><span class="k">Evento</span><span class="v">${JSP.escapeHtml(entrada.evento)}</span></div>
      <div class="kv"><span class="k">Fecha</span><span class="v">${JSP.formatFechaLarga(entrada.fecha)} · ${JSP.escapeHtml(entrada.hora)}</span></div>
      <div class="kv"><span class="k">Lugar</span><span class="v">${JSP.escapeHtml(entrada.lugar)}</span></div>
      <div class="kv"><span class="k">Zona / Fila / Asiento</span><span class="v">${JSP.escapeHtml(entrada.zona)} · ${JSP.escapeHtml(entrada.fila)} · ${JSP.escapeHtml(entrada.asiento)}</span></div>
      <div class="kv"><span class="k">Estado</span><span class="v">${JSP.escapeHtml(entrada.estadoDetalle.etiqueta)}</span></div>
      <div class="kv"><span class="k">Precio original</span><span class="v">${JSP.precio(entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio)}</span></div>
      <div class="kv"><span class="k">Precio máximo permitido</span><span class="v">${JSP.precio(entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio)}</span></div>

      <div class="mt-3">
        <button class="btn btn-primary btn-block btn-lg" id="btn-abrir-transferencia" disabled>
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>
               Transferir entrada
        </button>
      </div>`;

    $('bloque-titular-actual').classList.remove('hide');

    const boton = $('btn-abrir-transferencia');
    if (boton) boton.addEventListener('click', abrirFormulario);

    pintarAtajoDni();
    revisarTitular();
    cargarSelectorEntradas(lista);

    JSP.pintarModo();
  }

  /* ------------------------------------------------------------------ */
  /* 1) Selector de la entrada a transferir                              */
  /* ------------------------------------------------------------------ */
  function cargarSelectorEntradas(lista) {
    const sel = $('entrada-transferir');
    if (!sel || !entrada) return;

    sel.innerHTML = lista.map(e =>
        `<option value="${JSP.escapeHtml(e.codigo)}"${e.codigo === entrada.codigo ? ' selected' : ''}>` +
        `${JSP.escapeHtml(e.codigo)} — ${JSP.escapeHtml(e.evento)}</option>`).join('');
    sel.disabled = false;
  }

  /* ------------------------------------------------------------------ */
  /* 2) ¿Quién transfiere? — DNI del titular actual                      */
  /* ------------------------------------------------------------------ */
  /** El DNI escrito debe coincidir con el titular real de la entrada.   */
  function dniEsTitular(valor) {
    return esTransferible(entrada) && valor === dniDeSesion() && valor === String(entrada.dni);
  }

  function revisarTitular() {
    const campo = $('dni-titular');
    const caja = $('error-titular');
    const boton = $('btn-abrir-transferencia');
    if (!campo) return;

    const valor = campo.value.replace(/\D/g, '');
    const formatoOk = valor.length === 8;
    const coincide = formatoOk && dniEsTitular(valor);
    dniTitularOk = !!coincide;

    campo.classList.remove('is-invalid', 'is-valid');
    if (caja) {
      if (formatoOk && !coincide) {
        campo.classList.add('is-invalid');
        caja.classList.add('show');
        caja.innerHTML = JSP.icon('alert', { size: 15 }) +
          '<span>El DNI no coincide con el titular de la entrada.</span>';
      } else {
        if (coincide) campo.classList.add('is-valid');
        caja.classList.remove('show');
      }
    }

    // Sin el DNI correcto del titular actual no se puede abrir el formulario
    // del nuevo titular.
    if (boton) boton.disabled = !coincide;
  }

  /* ------------------------------------------------------------------ */
  /* Validación en vivo                                                  */
  /* ------------------------------------------------------------------ */
  function marcarError(campo, mensaje) {
    const input = $(campo);
    const caja = $('error-' + campo.replace('nuevo-', ''));
    if (!caja) return;
    if (mensaje) {
      caja.innerHTML = JSP.icon('alert', { size: 15 }) +
        '<span>' + JSP.escapeHtml(mensaje) + '</span>';
      caja.classList.add('show');
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
    } else {
      caja.classList.remove('show');
      input.classList.remove('is-invalid');
    }
  }

  function validarCampo(campo, valor) {
    switch (campo) {
      case 'nuevo-nombre': {
        if (!valor.trim()) return { ok: false, vacio: true };
        return SecurePassAPI.validarNombre(valor);
      }
      case 'nuevo-dni': {
        if (!valor.trim()) return { ok: false, vacio: true };
        return SecurePassAPI.validarDNI(valor);
      }
      case 'nuevo-correo': {
        if (!valor.trim()) return { ok: false, vacio: true };
        return SecurePassAPI.validarCorreo(valor);
      }
      case 'nuevo-precio': {
        if (valor === '') return { ok: false, vacio: true };
        return SecurePassAPI.validarPrecio(valor, entrada);
      }
    }
    return { ok: true };
  }

  function revisarCampo(campo) {
    const input = $(campo);
    const r = validarCampo(campo, input.value);

    if (r.ok) {
      marcarError(campo, null);
      input.classList.add('is-valid');
    } else if (!r.vacio) {
      marcarError(campo, r.mensaje);
      input.classList.remove('is-valid');
    } else {
      marcarError(campo, null);
      input.classList.remove('is-valid', 'is-invalid');
    }
    return r.ok;
  }

  function revisarTodos() {
    return ['nuevo-nombre', 'nuevo-dni', 'nuevo-correo', 'nuevo-precio'].map(revisarCampo);
  }

  /* ------------------------------------------------------------------ */
  /* Modal: paso 1 — formulario                                          */
  /* ------------------------------------------------------------------ */

  /** Marca el indicador "1 · Datos → 2 · Confirmar → 3 · Listo" del modal. */
  function marcarPaso(paso) {
    const lista = $('pasos-transferencia');
    if (!lista || typeof lista.querySelectorAll !== 'function') return;
    const orden = ['formulario', 'confirmacion', 'resultado'];
    const activo = Math.max(0, orden.indexOf(paso));
    const items = lista.querySelectorAll('li');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('activo', 'hecho');
      if (i < activo) items[i].classList.add('hecho');
      else if (i === activo) items[i].classList.add('activo');
    }
  }

  function abrirFormulario() {
    if (!dniDeSesion()) {
      pedirIdentificacion();
      return;
    }
    if (!esTransferible(entrada)) return;
    // El paso 2 (datos del nuevo titular) sólo se abre si el titular actual
    // confirmó su DNI en el paso anterior.
    revisarTitular();
    if (!dniTitularOk) {
      JSP.toast('error', 'Confirma quién transfiere',
        'Escribe el DNI del titular actual para poder continuar.');
      return;
    }

    $('paso-formulario').classList.remove('hide');
    $('paso-confirmacion').classList.add('hide');
    $('paso-resultado').classList.add('hide');
    $('acciones-formulario').classList.remove('hide');
    $('acciones-confirmacion').classList.add('hide');
    $('acciones-resultado').classList.add('hide');
    $('modal-sub').textContent = 'Completa los datos del nuevo titular.';

    const maximo = entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio;
    $('resumen-evento').textContent = `${entrada.evento} — ${entrada.zona} · Fila ${entrada.fila} · Asiento ${entrada.asiento}`;
    $('resumen-titular').innerHTML = `Titular actual: ${JSP.escapeHtml(entrada.titular)} · ${JSP.escapeHtml(entrada.dniOculto)} · ${JSP.estadoBadge(entrada.estado)}`;
    $('precio-original').textContent = JSP.precio(maximo);
    $('precio-maximo').textContent = JSP.precio(maximo);

    ['nuevo-nombre', 'nuevo-dni', 'nuevo-correo', 'nuevo-precio'].forEach(function (id) {
      $(id).value = '';
      $(id).classList.remove('is-valid', 'is-invalid');
    });
    ['error-nombre', 'error-dni', 'error-correo', 'error-precio'].forEach(id => $(id).classList.remove('show'));

    JSP.abrirModal('modal-transferencia');
  }

  /* ------------------------------------------------------------------ */
  /* Modal: paso 2 — confirmación                                        */
  /* ------------------------------------------------------------------ */
  function mostrarConfirmacion() {
    if (!dniDeSesion()) {
      pedirIdentificacion();
      return;
    }
    revisarTitular();
    if (!esTransferible(entrada) || !dniTitularOk) return;
    const nombre = $('nuevo-nombre').value.trim();
    const dni = $('nuevo-dni').value.trim();
    const correo = $('nuevo-correo').value.trim();
    const precio = Number($('nuevo-precio').value);

    const problemas = revisarTodos();
    if (problemas.some(p => !p)) {
      JSP.toast('error', 'Datos incompletos', 'Revisa los campos marcados en rojo antes de continuar.');
      return;
    }

    pendiente = { nombre: nombre, dni: dni, correo: correo, precio: precio };
    sesionPendiente = dniDeSesion();
    codigoPendiente = entrada.codigo;

    $('c-actual').textContent = entrada.titular;
    $('c-nuevo').textContent = nombre;
    $('c-dni').textContent = JSP.ocultarDNI(dni);
    const dniCompleto = $('c-dni-completo');
    if (dniCompleto) dniCompleto.textContent = dni;
    $('c-correo').textContent = correo;
    $('c-precio').textContent = JSP.precio(precio);
    $('c-codigo').textContent = entrada.codigo;

    $('paso-formulario').classList.add('hide');
    $('paso-confirmacion').classList.remove('hide');
    $('acciones-formulario').classList.add('hide');
    $('acciones-confirmacion').classList.remove('hide');
    marcarPaso('confirmacion');
    $('modal-sub').textContent = 'Revisa los datos y confirma.';
    $('btn-confirmar').focus();
  }

  /* ------------------------------------------------------------------ */
  /* Modal: paso 3 — resultado                                          */
  /* ------------------------------------------------------------------ */
  function mostrarResultado(res) {
    $('r-anterior').textContent = res.titularAnterior;
    $('r-nuevo').textContent = res.titularNuevo;
    $('r-dni').textContent = res.dniNuevo;
    $('r-codigo').textContent = res.codigo;
    $('r-estado').innerHTML = JSP.estadoBadge('transferido');
    $('r-activacion').textContent = 'El destinatario podrá iniciar sesión con la contraseña de su cuenta para ver la entrada.';
    marcarPaso('resultado');

    $('paso-confirmacion').classList.add('hide');
    $('paso-resultado').classList.remove('hide');
    $('acciones-confirmacion').classList.add('hide');
    $('acciones-resultado').classList.remove('hide');
    $('btn-ver-nueva').href = 'verificar.html?codigo=' + encodeURIComponent(res.codigo);
    $('modal-sub').textContent = 'La operación quedó registrada en el historial.';
  }

  /* ------------------------------------------------------------------ */
  /* Confirmación final                                                  */
  /* ------------------------------------------------------------------ */
  async function confirmar() {
    if (!dniDeSesion()) {
      pedirIdentificacion();
      return;
    }
    if (transfiriendo || !pendiente || !esTransferible(entrada) ||
        sesionPendiente !== dniDeSesion() || codigoPendiente !== entrada.codigo) return;
    const dni = sesionPendiente;
    transfiriendo = true;
    const boton = $('btn-confirmar');
    boton.disabled = true;
    boton.textContent = 'Procesando…';

    let resultado;
    try {
      resultado = await SecurePassAPI.transferirEntrada(entrada.codigo, pendiente);
    } catch (e) {
      resultado = { ok: false, error: 'No se pudo completar la transferencia. Comprueba tu sesión y vuelve a intentarlo.' };
    } finally {
      transfiriendo = false;
      boton.disabled = false;
      boton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4-10.6 10.6Z"/></svg> Confirmar transferencia';
    }
    if (dniDeSesion() !== dni) return;

    if (!resultado.ok) {
      JSP.toast('error', 'No se pudo transferir', resultado.error);
      $('paso-confirmacion').classList.add('hide');
      $('paso-formulario').classList.remove('hide');
      $('acciones-formulario').classList.remove('hide');
      $('acciones-confirmacion').classList.add('hide');
      marcarPaso('formulario');
      if (resultado.campos) {
        Object.keys(resultado.campos).forEach(function (campo) {
          marcarError('nuevo-' + campo, resultado.campos[campo]);
        });
      }
      return;
    }

    mostrarResultado(resultado);
    pendiente = null;
    JSP.toast('ok', 'Transferencia realizada',
      `${resultado.titularAnterior} → ${resultado.titularNuevo}.`);

    // La entrada transferida ya no es propia: no se vuelve a consultar ni
    // se conserva en el selector. El modal mantiene el recibo de la operación.
    // La URL puede apuntar a la entrada que acaba de salir de la cuenta.
    // Volver a elegir entre las restantes, si existen, sin usar ese código.
    await cargarEntrada(null);
    await cargarTransferencias();
  }

  /* ------------------------------------------------------------------ */
  /* Historial de transferencias recientes                               */
  /* ------------------------------------------------------------------ */
  async function cargarTransferencias() {
    const cont = $('ultimas-transferencias');
    const dni = dniDeSesion();
    const carga = cargaActual;
    if (!dni) {
      cont.innerHTML = '<p class="small muted mb-0">Inicia sesión para ver tus transferencias.</p>';
      return;
    }
    let historial;
    try {
      historial = await SecurePassAPI.obtenerHistorial(null, dni);
    } catch (e) {
      if (carga !== cargaActual || dniDeSesion() !== dni) return;
      cont.innerHTML = '<p class="small muted mb-0">No se pudieron cargar tus transferencias.</p>';
      return;
    }
    if (carga !== cargaActual || dniDeSesion() !== dni) return;
    const items = historial.filter(h => h.accion === 'transferida').slice(-3).reverse();

    cont.innerHTML = items.length ? items.map(h => `
      <div class="row-between" style="padding:.4rem 0;border-bottom:1px dashed rgba(255,255,255,.08)">
        <div style="min-width:0">
          <div class="small mono">${JSP.escapeHtml(h.codigo)}</div>
          <div class="tiny muted">${JSP.escapeHtml(h.detalle || h.titular)}</div>
        </div>
        <div class="tiny muted nowrap">${JSP.formatFecha(h.fecha)}</div>
      </div>`).join('')
      : '<p class="small muted mb-0">Aún no tienes transferencias registradas.</p>';
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                            */
  /* ------------------------------------------------------------------ */
  ['nuevo-nombre', 'nuevo-dni', 'nuevo-correo', 'nuevo-precio'].forEach(function (id) {
    const input = $(id);
    if (!input) return;

    input.addEventListener('input', function () {
      if (id === 'nuevo-dni') {
        input.value = input.value.replace(/\D/g, '').slice(0, 8);
      }
      if (id === 'nuevo-precio') {
        input.value = input.value.replace(/[^0-9.]/g, '');
        const partes = input.value.split('.');
        if (partes.length > 2) input.value = partes[0] + '.' + partes[1];
      }
      revisarCampo(id);
    });

    input.addEventListener('blur', function () { revisarCampo(id); });
  });

  /* Paso 1: entrada elegida + DNI del titular actual                    */
  const campoTitular = $('dni-titular');
  if (campoTitular) {
    campoTitular.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 8);
      revisarTitular();
    });
    campoTitular.addEventListener('blur', revisarTitular);

    const atajo = $('btn-usar-mi-dni');
    if (atajo) {
      atajo.addEventListener('click', function () {
        const dni = dniDeSesion();
        if (!dni) return;
        campoTitular.value = dni;
        campoTitular.dispatchEvent(new Event('input', { bubbles: true }));
        revisarTitular();
        campoTitular.focus();
      });
    }
  }

  const selEntrada = $('entrada-transferir');
  if (selEntrada) {
    selEntrada.addEventListener('change', function () {
      if (this.value && (!entrada || this.value !== entrada.codigo)) cargarEntrada(this.value);
    });
  }

  /* Chips de precio: original · S/ 100 · personalizado                  */
  const chipsPrecio = $('chips-precio');
  if (chipsPrecio && typeof chipsPrecio.querySelectorAll === 'function') {
    const chips = chipsPrecio.querySelectorAll('.chip');
    for (let i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        const campo = $('nuevo-precio');
        if (!campo) return;
        const valor = this.getAttribute('data-precio');
        if (valor === 'original') {
          campo.value = entrada
            ? String(entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio)
            : '';
        } else if (valor === '') {
          campo.value = '';
          campo.focus();
        } else {
          campo.value = valor;
        }
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        revisarCampo('nuevo-precio');
        for (let j = 0; j < chips.length; j++) chips[j].classList.remove('activo');
        this.classList.add('activo');
      });
    }
  }

  $('form-transferencia')?.addEventListener('submit', function (ev) {
    ev.preventDefault();
    mostrarConfirmacion();
  });

  $('btn-continuar')?.addEventListener('click', mostrarConfirmacion);
  $('btn-confirmar')?.addEventListener('click', confirmar);

  $('btn-cancelar-transferencia')?.addEventListener('click', function () {
    $('paso-confirmacion').classList.add('hide');
    $('paso-formulario').classList.remove('hide');
    $('acciones-confirmacion').classList.add('hide');
    $('acciones-formulario').classList.remove('hide');
    marcarPaso('formulario');
    $('modal-sub').textContent = 'Completa los datos del nuevo titular.';
  });

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  function actualizarSesion() {
    limpiarModal();
    JSP.cerrarModal('modal-transferencia');
    $('ultimas-transferencias').innerHTML = '';
    cargarEntrada();
    cargarTransferencias();
  }
  if (typeof Sesion !== 'undefined' && Sesion && typeof Sesion.alCambiar === 'function') {
    Sesion.alCambiar(actualizarSesion);
  }
  cargarEntrada();
  cargarTransferencias();
})();
