/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/dashboard.js
 * Carga las entradas del usuario, calcula las estadísticas y muestra la
 * actividad reciente. Los datos vienen de SecurePassAPI, que usa la API de
 * Docker si está disponible y, si no, el almacenamiento local.
 * ========================================================================= */

(function () {
  'use strict';

  const lista = document.getElementById('lista-entradas');
  const filtros = document.getElementById('filtros');
  if (!lista) return;

  let entradas = [];
  let filtroActual = 'todas';

  /* ------------------------------------------------------------------ */
  /* Tarjeta de entrada                                                  */
  /* ------------------------------------------------------------------ */
  function tarjetaEntrada(e) {
    const acciones = e.puedeTransferir
      ? `<a href="transferencia.html?codigo=${e.codigo}" class="btn btn-sm btn-outline">
           <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>
           Transferir entrada
         </a>`
      : `<button class="btn btn-sm btn-ghost" disabled
           title="Sólo las entradas válidas pueden transferirse">
           <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>
           No transferible
         </button>`;

    const notaTransferencia = e.estado === 'transferido' && e.titularAnterior
      ? `<div class="alert alert-info" style="margin-bottom:1rem">
           <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v2h-2V7Zm0 4h2v6h-2v-6Z"/></svg>
           <p>Transferida desde <strong>${JSP.escapeHtml(e.titularAnterior)}</strong> el ${JSP.formatFecha(e.transferidaEn || e.creadoEn)}.</p>
         </div>`
      : '';

    return `
      <article class="card card-hover entry-card fade-in">
        <div class="entry-head">
          <div style="min-width:0">
            <h3 class="entry-event">${JSP.escapeHtml(e.evento)}</h3>
            <div class="entry-code">Código: ${JSP.escapeHtml(e.codigo)}</div>
          </div>
          ${JSP.estadoBadge(e.estado)}
        </div>

        <div class="entry-meta">
          <div><span class="k">Fecha</span><span class="v">${JSP.formatFechaLarga(e.fecha)}</span></div>
          <div><span class="k">Hora</span><span class="v">${JSP.escapeHtml(e.hora)}</span></div>
          <div><span class="k">Lugar</span><span class="v">${JSP.escapeHtml(e.lugar)}</span></div>
          <div><span class="k">Zona</span><span class="v">${JSP.escapeHtml(e.zona)}</span></div>
          <div><span class="k">Fila</span><span class="v">${JSP.escapeHtml(e.fila)}</span></div>
          <div><span class="k">Asiento</span><span class="v">${JSP.escapeHtml(e.asiento)}</span></div>
          <div><span class="k">Titular</span><span class="v">${JSP.escapeHtml(e.titular)}</span></div>
          <div><span class="k">DNI</span><span class="v mono">${JSP.escapeHtml(e.dniOculto)}</span></div>
        </div>

        ${notaTransferencia}

        <div class="entry-actions">
          <a href="entrada.html?codigo=${e.codigo}" class="btn btn-sm btn-primary">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm2 0v2h14V8H5Zm0 6v2h14v-2H5Z"/></svg>
            Ver entrada
          </a>
          ${acciones}
          <button class="btn btn-sm btn-ghost" data-detalle="${e.codigo}" title="Ver detalle">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>
          </button>
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Render principal                                                    */
  /* ------------------------------------------------------------------ */
  function render() {
    const visibles = filtroActual === 'todas'
      ? entradas
      : entradas.filter(e => e.estado === filtroActual);

    if (!visibles.length) {
      lista.innerHTML = `
        <div class="card center" style="grid-column:1/-1">
          <div class="icon-box" style="margin:0 auto 1rem">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm2 0v2h14V8H5Zm0 6v2h14v-2H5Z"/></svg>
          </div>
          <h3>Ninguna entrada para este filtro</h3>
          <p class="small">Cuando transfers o uses una entrada, el panel se actualizará automáticamente.</p>
        </div>`;
      return;
    }

    lista.innerHTML = visibles.map(tarjetaEntrada).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Actividad reciente                                                  */
  /* ------------------------------------------------------------------ */
  const ETIQUETA_ACCION = {
    creada: 'Entrada creada',
    verificada: 'Entrada verificada',
    transferida: 'Entrada transferida',
    qr: 'Nuevo QR generado',
    usada: 'Ingreso registrado',
    anulada: 'Entrada anulada'
  };

  async function cargarActividad() {
    const cont = document.getElementById('actividad-reciente');
    const historial = await SecurePassAPI.obtenerHistorial();
    const recientes = historial.slice(-4).reverse();

    cont.innerHTML = recientes.length
      ? recientes.map(h => `
        <div class="row-between" style="padding:.5rem 0;border-bottom:1px dashed rgba(255,255,255,.08)">
          <div style="min-width:0">
            <div class="small" style="font-weight:700">${JSP.escapeHtml(ETIQUETA_ACCION[h.accion] || h.accion)}</div>
            <div class="tiny muted mono">${JSP.escapeHtml(h.codigo)} · ${JSP.escapeHtml(h.titular)}</div>
          </div>
          <div class="tiny muted nowrap">${JSP.tiempoRelativo(h.fecha)}</div>
        </div>`).join('')
      : '<p class="small muted">Sin actividad registrada todavía.</p>';

    document.getElementById('sys-eventos').textContent = historial.length;
  }

  /* ------------------------------------------------------------------ */
  /* Detalle rápido en modal                                             */
  /* ------------------------------------------------------------------ */
  async function abrirDetalle(codigo) {
    const e = await SecurePassAPI.consultarEntrada(codigo);
    if (!e) return;
    document.getElementById('detalle-titulo').textContent = e.evento;
    document.getElementById('detalle-sub').textContent = `Código ${e.codigo} · ${JSP.formatFechaLarga(e.fecha)} a las ${e.hora}`;
    document.getElementById('detalle-abrir').href = `entrada.html?codigo=${e.codigo}`;
    document.getElementById('detalle-body').innerHTML = `
      <div class="row-between" style="margin-bottom:1rem">
        ${JSP.estadoBadge(e.estado)}
        <span class="mono small muted">${JSP.escapeHtml(e.codigo)}</span>
      </div>
      <div class="alert ${e.estado === 'valido' ? 'alert-ok' : e.estado === 'usado' ? 'alert-error' : e.estado === 'anulado' ? 'alert-warn' : 'alert-info'}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v2h-2V7Zm0 4h2v6h-2v-6Z"/></svg>
        <p>${JSP.escapeHtml(e.estadoDetalle.descripcion)}</p>
      </div>
      <div class="mt-2">
        <div class="kv"><span class="k">Evento</span><span class="v">${JSP.escapeHtml(e.evento)}</span></div>
        <div class="kv"><span class="k">Fecha y hora</span><span class="v">${JSP.formatFecha(e.fecha)} · ${JSP.escapeHtml(e.hora)}</span></div>
        <div class="kv"><span class="k">Lugar</span><span class="v">${JSP.escapeHtml(e.lugar)}</span></div>
        <div class="kv"><span class="k">Zona</span><span class="v">${JSP.escapeHtml(e.zona)}</span></div>
        <div class="kv"><span class="k">Fila / Asiento</span><span class="v">${JSP.escapeHtml(e.fila)} / ${JSP.escapeHtml(e.asiento)}</span></div>
        <div class="kv"><span class="k">Titular</span><span class="v">${JSP.escapeHtml(e.titular)}</span></div>
        <div class="kv"><span class="k">DNI</span><span class="v mono">${JSP.escapeHtml(e.dniOculto)}</span></div>
        <div class="kv"><span class="k">Precio original</span><span class="v">${JSP.precio(e.precioOriginal != null ? e.precioOriginal : e.precio)}</span></div>
        <div class="kv"><span class="k">Token QR actual</span><span class="v mono tiny">${JSP.escapeHtml(e.qrToken || 'Se genera al abrir la entrada')}</span></div>
      </div>`;
    JSP.abrirModal('modal-detalle');
  }

  /* ------------------------------------------------------------------ */
  /* Formulario de identidad                                             */
  /* ------------------------------------------------------------------ */
  const CAMPOS_IDENTIDAD = {
    dni: { id: 'identidad-dni', error: 'error-dni-identidad' },
    nombres: { id: 'identidad-nombres', error: 'error-nombres-identidad' },
    apellidos: { id: 'identidad-apellidos', error: 'error-apellidos-identidad' }
  };

  /** Módulo de sesión (js/sesion.js). Puede no estar cargado en pruebas. */
  function sesion() {
    return (typeof window !== 'undefined' && window.Sesion) ? window.Sesion : null;
  }

  function pintarErrorCampo(campo, mensaje) {
    const input = document.getElementById(campo.id);
    const caja = document.getElementById(campo.error);
    if (!input || !caja) return;
    if (mensaje) {
      caja.innerHTML = JSP.icon('alert', { size: 15 }) +
        '<span>' + JSP.escapeHtml(mensaje) + '</span>';
      caja.classList.add('show');
      input.classList.add('is-invalid');
    } else {
      caja.classList.remove('show');
      input.classList.remove('is-invalid');
    }
  }

  function limpiarErroresIdentidad() {
    Object.keys(CAMPOS_IDENTIDAD).forEach(k => pintarErrorCampo(CAMPOS_IDENTIDAD[k], null));
    const alerta = document.getElementById('identidad-error');
    if (alerta) alerta.classList.add('hide');
  }

  function mostrarErrorIdentidad(mensaje) {
    const alerta = document.getElementById('identidad-error');
    const texto = document.getElementById('identidad-error-texto');
    if (!alerta || !texto) return;
    texto.textContent = mensaje;
    alerta.classList.remove('hide');
  }

  function pintarIdentidad() {
    const s = sesion();
    const u = s ? s.usuario() : null;
    const actual = SecurePassAPI.USUARIO;   // identificado, o el de demostración

    const nombre = document.getElementById('identidad-nombre');
    const dniActual = document.getElementById('identidad-dni-actual');
    const origen = document.getElementById('identidad-origen');
    const insignia = document.getElementById('identidad-badge');
    const saludo = document.getElementById('saludo');
    const botonCambiar = document.getElementById('btn-cambiar-identidad');

    if (nombre) nombre.textContent = actual.nombre;
    if (dniActual) dniActual.textContent = actual.dni;
    if (origen) {
      origen.textContent = u
        ? 'Formulario de identidad (este navegador)'
        : 'Invitado — usuario de demostración';
    }
    if (insignia) insignia.textContent = u ? 'Identificado' : 'Modo demo';
    if (saludo) {
      // Sin identificar: "Bienvenido"; identificado: el nombre de la persona
      const nombreSaludo = u
        ? JSP.escapeHtml(String(actual.nombre).split(' ')[0])
        : 'Bienvenido';
      saludo.innerHTML = 'Hola, ' + nombreSaludo + ' <span aria-hidden="true">👋</span>';
    }

    if (u) {
      document.getElementById('identidad-dni').value = u.dni;
      document.getElementById('identidad-nombres').value = u.nombres || '';
      document.getElementById('identidad-apellidos').value = u.apellidos || '';
    }
    if (botonCambiar) botonCambiar.textContent = u ? 'Cerrar identificación' : 'Limpiar formulario';
  }

  /* ------------------------------------------------------------------ */
  /* Carga inicial                                                      */
  /* ------------------------------------------------------------------ */
  async function cargar() {
    try {
      const [mias, resumen, historial] = await Promise.all([
        SecurePassAPI.listarMisEntradas(),
        SecurePassAPI.obtenerResumen(),
        SecurePassAPI.obtenerHistorial()
      ]);

      entradas = mias.length ? mias : await SecurePassAPI.listarEntradas();

      JSP.animarContador(document.getElementById('stat-activas'), resumen.activas);
      JSP.animarContador(document.getElementById('stat-usadas'), resumen.usadas);
      JSP.animarContador(document.getElementById('stat-transferidas'), resumen.transferidas);
      JSP.animarContador(document.getElementById('stat-anuladas'), resumen.anuladas);

      document.getElementById('usuario-dni').textContent = SecurePassAPI.USUARIO.nombre;
      document.getElementById('sys-total').textContent = resumen.total;
      document.getElementById('sys-eventos').textContent = historial.length;
      const almacen = document.getElementById('sys-almacen');
      if (almacen) {
        almacen.textContent = SecurePassAPI.modoActual() === 'api'
          ? 'MySQL (contenedor mysql)'
          : 'localStorage (navegador)';
      }

      render();
      await cargarActividad();
      JSP.pintarModo();
    } catch (e) {
      console.error('[Dashboard]', e);
      lista.innerHTML = '<div class="card" style="grid-column:1/-1"><p>No se pudieron cargar las entradas.</p></div>';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                            */
  /* ------------------------------------------------------------------ */
  if (filtros) {
    filtros.addEventListener('click', function (ev) {
      const chip = ev.target.closest('[data-filtro]');
      if (!chip) return;
      filtros.querySelectorAll('[data-filtro]').forEach(c => c.style.borderColor = '');
      chip.style.borderColor = 'var(--brand)';
      filtroActual = chip.getAttribute('data-filtro');
      render();
    });
  }

  lista.addEventListener('click', function (ev) {
    const boton = ev.target.closest('[data-detalle]');
    if (boton) abrirDetalle(boton.getAttribute('data-detalle'));
  });

  /* Formulario de identidad: confirmar quién navega por el panel */
  const formIdentidad = document.getElementById('form-identidad');
  if (formIdentidad) {
    formIdentidad.addEventListener('submit', async function (ev) {
      ev.preventDefault();

      const s = sesion();
      if (!s) {
        mostrarErrorIdentidad('El módulo de identidad (js/sesion.js) no está disponible en esta página.');
        return;
      }

      limpiarErroresIdentidad();

      const dni = document.getElementById('identidad-dni').value.trim();
      const nombres = document.getElementById('identidad-nombres').value.trim();
      const apellidos = document.getElementById('identidad-apellidos').value.trim();

      const boton = document.getElementById('btn-identificar');
      const htmlOriginal = boton.innerHTML;
      boton.disabled = true;
      boton.textContent = 'Comprobando…';

      try {
        const r = await s.identificar(dni, nombres, apellidos);

        if (!r.ok) {
          const campo = CAMPOS_IDENTIDAD[r.campo];
          if (campo) {
            pintarErrorCampo(campo, r.mensaje);
            const malo = document.getElementById(campo.id);
            if (malo) malo.focus();
          } else {
            mostrarErrorIdentidad(r.mensaje);
          }
          return;
        }

        JSP.toast('ok', 'Identidad confirmada',
          'El panel ahora muestra las entradas de ' + r.usuario.nombre + '.');
        s.notificar();
        pintarIdentidad();
        await cargar();
      } catch (e) {
        console.error('[Dashboard][identidad]', e);
        mostrarErrorIdentidad('No se pudo confirmar la identidad. Inténtalo de nuevo.');
      } finally {
        boton.disabled = false;
        boton.innerHTML = htmlOriginal;
      }
    });
  }

  /* Cerrar la identificación o limpiar el formulario para otra persona */
  const btnCambiarIdentidad = document.getElementById('btn-cambiar-identidad');
  if (btnCambiarIdentidad) {
    btnCambiarIdentidad.addEventListener('click', function () {
      const s = sesion();

      if (s && s.estaIdentificado()) {
        s.olvidar();
        JSP.toast('info', 'Identificación cerrada',
          'Vuelves a ver el panel con el usuario de demostración.');
        pintarIdentidad();
        cargar();
        return;
      }

      ['identidad-dni', 'identidad-nombres', 'identidad-apellidos'].forEach(function (id) {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
      });
      limpiarErroresIdentidad();
      const primero = document.getElementById('identidad-dni');
      if (primero) primero.focus();
    });
  }

  const btnReiniciar = document.getElementById('btn-reiniciar');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', async function () {
      btnReiniciar.disabled = true;
      await SecurePassAPI.reiniciarDemo();
      JSP.toast('ok', 'Datos reiniciados', 'La demostración volvió a su estado inicial.');
      cargar();
      btnReiniciar.disabled = false;
    });
  }

  const sesionInicial = sesion();
  if (sesionInicial) sesionInicial.alCambiar(pintarIdentidad);
  limpiarErroresIdentidad();
  pintarIdentidad();

  cargar();
})();
