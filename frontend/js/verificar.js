/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/verificar.js
 * Consulta del estado de una entrada sin recargar la página.
 *
 * La verificación es pública, pero sólo publica el ESTADO de la entrada.
 * Los detalles (evento, fecha, lugar, titular, DNI, código…) y los accesos a
 * la entrada o al historial aparecen únicamente con la sesión iniciada.
 * En modo Docker consume GET /api/verificar/:codigo; sin backend usa la base
 * de datos local.
 * ========================================================================= */

(function () {
  'use strict';

  const form = document.getElementById('form-verificar');
  if (!form) return;

  const input = document.getElementById('codigo');
  const errorBox = document.getElementById('error-codigo');
  const resultado = document.getElementById('resultado');
  const inicial = document.getElementById('inicial');
  const detalles = document.getElementById('res-detalles');
  const acciones = document.getElementById('res-acciones');

  const STORAGE_ULTIMA = 'jsp.ultimaVerificacion';
  const STORAGE_CONTADOR = 'jsp.contadorVerificaciones';

  // HTML original del panel vacío: se guarda para poder restaurarlo cuando
  // el código no es válido (y no dejar en pantalla el resultado anterior).
  const INICIAL_HTML = inicial ? inicial.innerHTML : '';

  /** ¿Hay una persona identificada con DNI válido? */
  function haySesion() {
    if (typeof Sesion === 'undefined' || !Sesion) return false;
    if (typeof Sesion.estaIdentificado !== 'function' || !Sesion.estaIdentificado()) return false;
    return /^\d{8}$/.test(String(Sesion.dni() || ''));
  }

  function mostrarInicial() {
    if (!inicial) return;
    if (INICIAL_HTML) inicial.innerHTML = INICIAL_HTML;
    inicial.classList.remove('hide');
  }

  function marcarInvalido() {
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorBox) errorBox.classList.add('show');
    if (resultado) resultado.classList.remove('show');
    mostrarInicial();
    try { if (input) input.focus(); } catch (e) { /* sin foco */ }
  }

  /* ------------------------------------------------------------------ */
  /* Presentación por estado                                             */
  /* ------------------------------------------------------------------ */
  const PRESENTACION = {
    valido: {
      clase: 'valido',
      icono: '🟢',
      titulo: 'ENTRADA VÁLIDA',
      mensaje: 'El código es auténtico y la entrada todavía no ha sido utilizada. El acceso está permitido.'
    },
    usado: {
      clase: 'usado',
      icono: '🔴',
      titulo: 'ENTRADA UTILIZADA',
      mensaje: 'Esta entrada ya fue utilizada para ingresar al evento.'
    },
    anulado: {
      clase: 'anulado',
      icono: '🟠',
      titulo: 'ENTRADA ANULADA',
      mensaje: 'Esta entrada ya no puede utilizarse.'
    },
    transferido: {
      clase: 'transferido',
      icono: '🔵',
      titulo: 'ENTRADA TRANSFERIDA',
      mensaje: 'Esta entrada fue transferida a un nuevo titular.'
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render del resultado                                                */
  /* ------------------------------------------------------------------ */
  function filasDe(entrada) {
    const filas = [
      ['Evento', entrada.evento],
      ['Fecha', JSP.formatFechaLarga(entrada.fecha)],
      ['Hora', entrada.hora],
      ['Lugar', entrada.lugar],
      ['Zona', entrada.zona],
      ['Fila', entrada.fila],
      ['Asiento', entrada.asiento],
      ['Titular', entrada.titular],
      ['DNI', entrada.dniOculto],
      ['Código', entrada.codigo],
      ['Estado', entrada.estadoDetalle.etiqueta],
      ['Última operación', JSP.tiempoRelativo(
        entrada.transferidaEn || entrada.usadoEn || entrada.creadoEn)]
    ];

    if (entrada.estado === 'transferido' && entrada.titularAnterior) {
      filas.push(['Titular anterior', `${entrada.titularAnterior} (${entrada.dniAnteriorOculto || '********'})`]);
      filas.push(['Transferida el', JSP.formatFechaHora(entrada.transferidaEn)]);
    }
    if (entrada.estado === 'usado') {
      filas.push(['Ingresó el', JSP.formatFechaHora(entrada.usadoEn)]);
    }
    if (entrada.estado === 'anulado' && entrada.motivoAnulacion) {
      filas.push(['Motivo', entrada.motivoAnulacion]);
    }
    return filas;
  }

  function pintarResultado(entrada) {
    const p = PRESENTACION[entrada.estado];
    resultado.className = 'result show ' + p.clase;

    document.getElementById('res-icon').textContent = p.icono;
    document.getElementById('res-titulo').textContent = p.titulo;
    document.getElementById('res-mensaje').textContent = p.mensaje;

    // Sin sesión sólo se publica el bloque de estado: ni datos de la entrada
    // ni los accesos a la ficha completa o al historial.
    const conSesion = haySesion();

    if (detalles) {
      document.getElementById('res-datos').innerHTML = conSesion
        ? filasDe(entrada).map(f => `
            <div>
              <span class="k">${JSP.escapeHtml(f[0])}</span>
              <span class="v">${JSP.escapeHtml(f[1])}</span>
            </div>`).join('')
        : '';
      detalles.classList.toggle('hide', !conSesion);
    }

    if (acciones) {
      acciones.innerHTML = conSesion ? `
        <a href="entrada.html?codigo=${entrada.codigo}" class="btn btn-sm btn-primary">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm2 0v2h14V8H5Zm0 6v2h14v-2H5Z"/></svg>
          Ver entrada completa
        </a>
        ${entrada.puedeTransferir ? `
        <a href="transferencia.html?codigo=${entrada.codigo}" class="btn btn-sm btn-outline">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>
          Transferir entrada
        </a>
        <button class="btn btn-sm btn-ok hide" id="btn-marcar-usada">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z"/></svg>
          Simular ingreso
        </button>` : ''}
        <a href="historial.html?codigo=${entrada.codigo}" class="btn btn-sm btn-ghost">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-8.5 6H1l3.5 3.5L8 9H5.6A7 7 0 1 1 6 15H4a9 9 0 1 0 9-12v0Zm-1 5v5l4.2 2.5.7-1.2-3.4-2V8H12Z"/></svg>
          Ver historial
        </a>` : '';
      acciones.classList.toggle('hide', !conSesion);
    }

    inicial.classList.add('hide');
  }

  function pintarNoEncontrado(codigo) {
    resultado.className = 'result show inexistente';
    document.getElementById('res-icon').textContent = '⚠️';
    document.getElementById('res-titulo').textContent = 'CÓDIGO NO ENCONTRADO';
    document.getElementById('res-mensaje').textContent =
      `El código "${codigo}" no existe en la base de datos. Verifica que esté bien escrito o que la entrada no haya sido dada de baja.`;

    if (detalles) {
      document.getElementById('res-datos').innerHTML = '';
      detalles.classList.add('hide');
    }
    if (acciones) {
      acciones.innerHTML = '<button class="btn btn-sm btn-ghost" id="btn-reintentar">Intentar otra vez</button>';
      acciones.classList.remove('hide');
    }
    inicial.classList.add('hide');
  }

  /** Lleva el resultado a la vista y coloca allí el foco del teclado. */
  function llevarResultadoALaVista() {
    if (!resultado) return;
    const mover = function () {
      try {
        if (typeof resultado.scrollIntoView === 'function') {
          resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (e) { /* navegador sin scroll suave */ }
      try {
        resultado.focus({ preventScroll: true });
      } catch (e) {
        try { resultado.focus(); } catch (e2) { /* sin foco programatico */ }
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(mover);
    else setTimeout(mover, 30);
  }

  /* ------------------------------------------------------------------ */
  /* Consulta (sin recargar la página)                                   */
  /* ------------------------------------------------------------------ */
  async function consultar(codigo, opciones) {
    const opts = opciones || {};
    const limpio = String(codigo || '').trim().toUpperCase();

    if (!limpio) {
      marcarInvalido();
      JSP.toast('error', 'Falta el código', 'Ingresa un código de entrada para continuar.');
      return false;
    }
    if (!/^[A-Z0-9-]{4,24}$/.test(limpio)) {
      marcarInvalido();
      JSP.toast('error', 'Formato incorrecto', 'El código debe tener al menos 4 caracteres (ejemplo: ENTRY001).');
      return false;
    }

    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    errorBox.classList.remove('show');

    if (!opts.silencioso) {
      resultado.classList.remove('show');
      inicial.classList.remove('hide');
      inicial.innerHTML = '<div class="skeleton" style="height:150px"></div>';
    }

    const entrada = await SecurePassAPI.verificar(limpio);

    if (opts.silencioso) inicial.innerHTML = '';

    if (!entrada) {
      pintarNoEncontrado(limpio);
      JSP.toast('error', 'Entrada no encontrada', `El código ${limpio} no está registrado.`);
    } else {
      pintarResultado(entrada);
      // Los avisos tampoco revelan el evento ni el titular sin sesión.
      const conSesion = haySesion();
      if (entrada.estado === 'valido') {
        JSP.toast('ok', 'Entrada válida', conSesion
          ? `${entrada.evento} · ${entrada.titular}`
          : 'El código es auténtico y la entrada está vigente.');
      } else if (entrada.estado === 'usado') {
        JSP.toast('warn', 'Entrada utilizada', 'Ya se utilizó para ingresar al evento.');
      } else if (entrada.estado === 'anulado') {
        JSP.toast('warn', 'Entrada anulada', 'No puede utilizarse.');
      } else {
        JSP.toast('info', 'Entrada transferida', conSesion
          ? `Ahora pertenece a ${entrada.titular}.`
          : 'La entrada ya tiene otro titular.');
      }
    }

    if (!opts.silencioso) llevarResultadoALaVista();

    const resumen = {
      codigo: entrada ? entrada.codigo : limpio,
      estado: entrada ? entrada.estado : 'inexistente',
      titulo: entrada ? PRESENTACION[entrada.estado].titulo : 'CÓDIGO NO ENCONTRADO',
      fecha: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_ULTIMA, JSON.stringify(resumen));
      const contador = Number(localStorage.getItem(STORAGE_CONTADOR) || 0) + 1;
      localStorage.setItem(STORAGE_CONTADOR, String(contador));
      document.getElementById('contador-verificaciones').textContent = contador;
      document.getElementById('ultima-verificacion').textContent = resumen.codigo;
    } catch (e) { /* localStorage no disponible */ }

    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Resumen del panel lateral                                          */
  /* ------------------------------------------------------------------ */
  function cargarResumen() {
    try {
      const guardado = JSON.parse(localStorage.getItem(STORAGE_ULTIMA) || 'null');
      const contador = Number(localStorage.getItem(STORAGE_CONTADOR) || 0);
      document.getElementById('contador-verificaciones').textContent = contador;
      if (guardado) {
        document.getElementById('ultima-verificacion').textContent =
          `${guardado.codigo} — ${guardado.titulo}`;
      }
    } catch (e) { /* sin datos previos */ }

    JSP.pintarModo();
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                            */
  /* ------------------------------------------------------------------ */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    consultar(input.value);
  });

  input.addEventListener('input', function () {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    errorBox.classList.remove('show');
  });

  const btnLimpiar = document.getElementById('btn-limpiar');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', function () {
      input.value = '';
      resultado.classList.remove('show');
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      errorBox.classList.remove('show');
      mostrarInicial();
      input.focus();
    });
  }

  document.addEventListener('click', function (ev) {
    const reintentar = ev.target.closest('#btn-reintentar');
    if (reintentar) { input.focus(); return; }

    const usada = ev.target.closest('#btn-marcar-usada');
    if (usada) {
      usada.disabled = true;
      SecurePassAPI.marcarUsada(input.value.trim().toUpperCase()).then(function (entrada) {
        if (!entrada) {
          // El servidor rechazó la operación (o la entrada no estaba en
          // estado válido): no se anuncia un ingreso que no ocurrió.
          JSP.toast('error', 'No se pudo registrar el ingreso',
            'El servidor no cambió el estado de la entrada. Revisa el motivo e inténtalo de nuevo.');
          usada.disabled = false;
          return;
        }
        JSP.toast('ok', 'Ingreso registrado', 'La entrada pasó a estado “Usado / Ingresado”.');
        consultar(input.value, { silencioso: true });
      });
    }
  });

  cargarResumen();

  const inicialCodigo = JSP.parametro('codigo');
  if (inicialCodigo) consultar(inicialCodigo);
})();
