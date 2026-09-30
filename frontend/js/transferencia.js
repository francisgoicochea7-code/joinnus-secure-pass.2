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

  /* ------------------------------------------------------------------ */
  /* Mostrar la entrada actual                                           */
  /* ------------------------------------------------------------------ */
  async function cargarEntrada(codigoForzado) {
    // Tras una transferencia la entrada ya no pertenece al usuario de la
    // sesion, asi que hay que recargarla por su codigo explicito. Si no, la
    // pagina saltaria a otra entrada ("la primera mia que siga valida").
    let codigo = codigoForzado || JSP.parametro('codigo');

    if (!codigo) {
      const mias = await SecurePassAPI.listarMisEntradas();
      const preferida = mias.find(e => e.codigo === 'ENTRY001') ||
        mias.find(e => e.estado === 'valido') || mias[0];
      codigo = preferida ? preferida.codigo : 'ENTRY001';
    }

    entrada = await SecurePassAPI.consultarEntrada(codigo);
    if (!entrada) {
      detalle.innerHTML = '<p>No se encontró la entrada solicitada.</p>';
      return;
    }

    const puede = entrada.puedeTransferir;

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
      <div class="kv"><span class="k">Titular</span><span class="v">${JSP.escapeHtml(entrada.titular)}</span></div>
      <div class="kv"><span class="k">DNI</span><span class="v mono">${JSP.escapeHtml(entrada.dniOculto)}</span></div>
      <div class="kv"><span class="k">Estado</span><span class="v">${JSP.escapeHtml(entrada.estadoDetalle.etiqueta)}</span></div>
      <div class="kv"><span class="k">Precio original</span><span class="v">${JSP.precio(entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio)}</span></div>
      <div class="kv"><span class="k">Precio máximo permitido</span><span class="v">${JSP.precio(entrada.precioOriginal != null ? entrada.precioOriginal : entrada.precio)}</span></div>

      <div class="mt-3">
        ${puede
          ? `<button class="btn btn-primary btn-block btn-lg" id="btn-abrir-transferencia">
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>
               Transferir entrada
             </button>`
          : `<div class="alert alert-warn">
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2Zm1 14h-2v2h2v-2Zm0-7h-2v5h2V9Z"/></svg>
               <p>${JSP.escapeHtml(entrada.estadoDetalle.descripcion)} Esta entrada no puede transferirse.</p>
             </div>`}
      </div>`;

    // El paso "¿quién transfiere?" sólo se muestra si la entrada admite
    // transferencia; si no, sólo queda el aviso de estado.
    const bloqueTitular = $('bloque-titular-actual');
    if (bloqueTitular) {
      if (puede) bloqueTitular.classList.remove('hide');
      else bloqueTitular.classList.add('hide');
    }

    const boton = $('btn-abrir-transferencia');
    if (boton) boton.addEventListener('click', abrirFormulario);

    revisarTitular();
    cargarSelectorEntradas();

    JSP.pintarModo();
  }

  /* ------------------------------------------------------------------ */
  /* 1) Selector de la entrada a transferir                              */
  /* ------------------------------------------------------------------ */
  async function cargarSelectorEntradas() {
    const sel = $('entrada-transferir');
    if (!sel || !entrada) return;

    const pintar = lista => {
      sel.innerHTML = lista.map(e =>
        `<option value="${JSP.escapeHtml(e.codigo)}"${e.codigo === entrada.codigo ? ' selected' : ''}>` +
        `${JSP.escapeHtml(e.codigo)} — ${JSP.escapeHtml(e.evento)}</option>`).join('');
    };

    try {
      const mias = await SecurePassAPI.listarMisEntradas();
      const lista = mias.slice();
      // La entrada mostrada siempre debe figurar, aunque acabe de cambiar de titular.
      if (entrada.codigo && !lista.some(e => e.codigo === entrada.codigo)) {
        lista.unshift({ codigo: entrada.codigo, evento: entrada.evento });
      }
      pintar(lista);
    } catch (e) {
      pintar([{ codigo: entrada.codigo, evento: entrada.evento }]);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2) ¿Quién transfiere? — DNI del titular actual                      */
  /* ------------------------------------------------------------------ */
  /** El DNI escrito debe coincidir con el titular real de la entrada.   */
  function dniEsTitular(valor) {
    if (entrada && entrada.dni) return valor === String(entrada.dni);
    // Sin DNI completo disponible, se contrasta con la sesión identificada.
    const sesion = (typeof Sesion !== 'undefined' && Sesion && Sesion.dni) ? Sesion.dni() : null;
    if (sesion) return valor === sesion;
    return true;   // sin fuente de comparación: sólo se exige el formato
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
  function abrirFormulario() {
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

    $('c-actual').textContent = entrada.titular;
    $('c-nuevo').textContent = nombre;
    $('c-dni').textContent = JSP.ocultarDNI(dni);
    $('c-correo').textContent = correo;
    $('c-precio').textContent = JSP.precio(precio);
    $('c-codigo').textContent = entrada.codigo;

    $('paso-formulario').classList.add('hide');
    $('paso-confirmacion').classList.remove('hide');
    $('acciones-formulario').classList.add('hide');
    $('acciones-confirmacion').classList.remove('hide');
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
    $('r-token-anterior').textContent = res.tokenAnterior || '—';
    $('r-token-nuevo').textContent = res.tokenNuevo;

    $('paso-confirmacion').classList.add('hide');
    $('paso-resultado').classList.remove('hide');
    $('acciones-confirmacion').classList.add('hide');
    $('acciones-resultado').classList.remove('hide');
    $('btn-ver-nueva').href = 'entrada.html?codigo=' + encodeURIComponent(res.codigo);
    $('modal-sub').textContent = 'La operación quedó registrada en el historial.';
  }

  /* ------------------------------------------------------------------ */
  /* Confirmación final                                                  */
  /* ------------------------------------------------------------------ */
  async function confirmar() {
    if (!pendiente) return;
    const boton = $('btn-confirmar');
    boton.disabled = true;
    boton.textContent = 'Procesando…';

    const resultado = await SecurePassAPI.transferirEntrada(entrada.codigo, pendiente);

    boton.disabled = false;
    boton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4-10.6 10.6Z"/></svg> Confirmar transferencia';

    if (!resultado.ok) {
      JSP.toast('error', 'No se pudo transferir', resultado.error);
      $('paso-confirmacion').classList.add('hide');
      $('paso-formulario').classList.remove('hide');
      $('acciones-formulario').classList.remove('hide');
      $('acciones-confirmacion').classList.add('hide');
      if (resultado.campos) {
        Object.keys(resultado.campos).forEach(function (campo) {
          marcarError('nuevo-' + campo, resultado.campos[campo]);
        });
      }
      return;
    }

    mostrarResultado(resultado);
    JSP.toast('ok', 'Transferencia realizada',
      `${resultado.titularAnterior} → ${resultado.titularNuevo}. Nuevo QR generado.`);

    // Se recarga la MISMA entrada para que el panel refleje el estado nuevo
    await cargarEntrada(resultado.codigo);
    cargarTransferencias();
  }

  /* ------------------------------------------------------------------ */
  /* Historial de transferencias recientes                               */
  /* ------------------------------------------------------------------ */
  async function cargarTransferencias() {
    const cont = $('ultimas-transferencias');
    const historial = await SecurePassAPI.obtenerHistorial();
    const items = historial.filter(h => h.accion === 'transferida').slice(-3).reverse();

    cont.innerHTML = items.length ? items.map(h => `
      <div class="row-between" style="padding:.4rem 0;border-bottom:1px dashed rgba(255,255,255,.08)">
        <div style="min-width:0">
          <div class="small mono">${JSP.escapeHtml(h.codigo)}</div>
          <div class="tiny muted">${JSP.escapeHtml(h.detalle || h.titular)}</div>
        </div>
        <div class="tiny muted nowrap">${JSP.formatFecha(h.fecha)}</div>
      </div>`).join('')
      : '<p class="small muted mb-0">Aún no se han realizado transferencias en esta demostración.</p>';
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
  }

  const selEntrada = $('entrada-transferir');
  if (selEntrada) {
    selEntrada.addEventListener('change', function () {
      if (this.value && (!entrada || this.value !== entrada.codigo)) cargarEntrada(this.value);
    });
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
    $('modal-sub').textContent = 'Completa los datos del nuevo titular.';
  });

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  cargarEntrada();
  cargarTransferencias();
})();
