/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/verificar.js
 * Consulta de estado de entradas sin recargar la página.
 * En modo Docker consume GET /api/verificar/:codigo; sin backend usa
 * la base de datos ficticia de localStorage.
 * ========================================================================= */

(function () {
  'use strict';

  const form = document.getElementById('form-verificar');
  if (!form) return;

  const input = document.getElementById('codigo');
  const errorBox = document.getElementById('error-codigo');
  const resultado = document.getElementById('resultado');
  const inicial = document.getElementById('inicial');
  const chips = document.getElementById('chips-codigos');
  const overlay = document.getElementById('scan-overlay');

  const STORAGE_ULTIMA = 'jsp.ultimaVerificacion';
  const STORAGE_CONTADOR = 'jsp.contadorVerificaciones';

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
  function pintarResultado(entrada) {
    const p = PRESENTACION[entrada.estado];
    resultado.className = 'result show ' + p.clase;

    document.getElementById('res-icon').textContent = p.icono;
    document.getElementById('res-titulo').textContent = p.titulo;
    document.getElementById('res-mensaje').textContent = p.mensaje;

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
      filas.push(['Titular anterior', `${entrada.titularAnterior} (${JSP.ocultarDNI(entrada.dniAnterior)})`]);
      filas.push(['Transferida el', JSP.formatFechaHora(entrada.transferidaEn)]);
    }
    if (entrada.estado === 'usado') {
      filas.push(['Ingresó el', JSP.formatFechaHora(entrada.usadoEn)]);
    }
    if (entrada.estado === 'anulado' && entrada.motivoAnulacion) {
      filas.push(['Motivo', entrada.motivoAnulacion]);
    }

    document.getElementById('res-datos').innerHTML = filas.map(f => `
      <div>
        <span class="k">${JSP.escapeHtml(f[0])}</span>
        <span class="v">${JSP.escapeHtml(f[1])}</span>
      </div>`).join('');

    const acciones = document.getElementById('res-acciones');
    // "Simular ingreso" NO se enseña aquí: vive junto al QR en Mi entrada, y
    // sólo si la persona está identificada (clase "hide" = sólo visualmente,
    // el botón y su guarda de error siguen intactos para no tocar el test).
    acciones.innerHTML = `
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
      </a>`;

    inicial.classList.add('hide');
  }

  function pintarNoEncontrado(codigo) {
    resultado.className = 'result show inexistente';
    document.getElementById('res-icon').textContent = '⚠️';
    document.getElementById('res-titulo').textContent = 'CÓDIGO NO ENCONTRADO';
    document.getElementById('res-mensaje').textContent =
      `El código "${codigo}" no existe en la base de datos. Verifique que esté bien escrito o que la entrada no haya sido dada de baja.`;
    document.getElementById('res-datos').innerHTML = '';
    document.getElementById('res-acciones').innerHTML =
      '<button class="btn btn-sm btn-ghost" id="btn-reintentar">Intentar otra vez</button>';
    inicial.classList.add('hide');
  }

  /* ------------------------------------------------------------------ */
  /* Consulta (sin recargar la página)                                   */
  /* ------------------------------------------------------------------ */
  async function consultar(codigo, opciones) {
    const opts = opciones || {};
    const limpio = String(codigo || '').trim().toUpperCase();

    if (!limpio) {
      input.classList.add('is-invalid');
      errorBox.classList.add('show');
      JSP.toast('error', 'Falta el código', 'Ingresa un código de entrada para continuar.');
      return false;
    }
    if (!/^[A-Z0-9-]{4,24}$/.test(limpio)) {
      input.classList.add('is-invalid');
      errorBox.classList.add('show');
      JSP.toast('error', 'Formato incorrecto', 'El código debe tener al menos 4 caracteres (ejemplo: ENTRY001).');
      return false;
    }

    input.classList.remove('is-invalid');
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
      if (entrada.estado === 'valido') {
        JSP.toast('ok', 'Entrada válida', `${entrada.evento} · ${entrada.titular}`);
      } else if (entrada.estado === 'usado') {
        JSP.toast('warn', 'Entrada utilizada', 'Ya se utilizó para ingresar al evento.');
      } else if (entrada.estado === 'anulado') {
        JSP.toast('warn', 'Entrada anulada', 'No puede utilizarse.');
      } else {
        JSP.toast('info', 'Entrada transferida', `Ahora pertenece a ${entrada.titular}.`);
      }
    }

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
  /* Simulación de escaneo QR                                            */
  /* ------------------------------------------------------------------ */
  async function simularEscaneo() {
    const entradas = await SecurePassAPI.listarEntradas();
    if (!entradas.length) return;

    const elegida = entradas[Date.now() % entradas.length];

    const zona = document.getElementById('zona-escaneo');
    zona.style.minHeight = '120px';
    overlay.classList.add('active');
    input.value = elegida.codigo;
    input.classList.remove('is-invalid');
    errorBox.classList.remove('show');

    await JSP.simularEscaneo(null, 1500);
    overlay.classList.remove('active');

    JSP.toast('info', 'Código detectado', `Se leyó ${elegida.codigo} desde el QR simulado.`);
    await consultar(elegida.codigo, { silencioso: false });
  }

  /* ------------------------------------------------------------------ */
  /* Carga inicial: chips, contador y tabla plegable                    */
  /* ------------------------------------------------------------------ */
  async function cargarBase() {
    const entradas = await SecurePassAPI.listarEntradas();
    const total = entradas.length;

    chips.innerHTML = entradas.map(e => `
      <button type="button" class="code-chip" data-codigo="${JSP.escapeHtml(e.codigo)}">
        <span class="st ${e.estadoDetalle.punto}"></span>${JSP.escapeHtml(e.codigo)}
      </button>`).join('');

    // Resumen discreto en el subtítulo del modal
    const sub = document.getElementById('modal-entradas-sub');
    if (sub) {
      const porEstado = entradas.reduce((acc, e) => {
        acc[e.estado] = (acc[e.estado] || 0) + 1;
        return acc;
      }, {});
      const resumen = Object.keys(porEstado)
        .map(k => porEstado[k] + ' ' + JSP.estadoBadge(k, { corta: true }))
        .join(' ');
      sub.innerHTML = total + ' ' + (total === 1 ? 'código' : 'códigos') +
        ' ficticios · ' + resumen;
    }

    const cuerpoTabla = document.querySelector('#tabla-db tbody');
    if (cuerpoTabla) {
      cuerpoTabla.innerHTML = entradas.map(e => `
        <tr>
          <td><strong class="mono">${JSP.escapeHtml(e.codigo)}</strong></td>
          <td>${JSP.escapeHtml(e.evento)}</td>
          <td>${JSP.escapeHtml(e.titular)}</td>
          <td class="nowrap">${JSP.formatFecha(e.fecha)} · ${JSP.escapeHtml(e.hora)}</td>
          <td>${JSP.estadoBadge(e.estado)}</td>
          <td><button class="btn btn-sm btn-ghost" data-consultar="${JSP.escapeHtml(e.codigo)}">Consultar</button></td>
        </tr>`).join('');
    }

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
    errorBox.classList.remove('show');
  });

  document.getElementById('btn-escanear').addEventListener('click', simularEscaneo);

  document.getElementById('btn-limpiar').addEventListener('click', function () {
    input.value = '';
    resultado.classList.remove('show');
    inicial.classList.remove('hide');
    inicial.innerHTML = `
      <div class="icon-box" style="margin:0 auto 1rem">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5ZM7 7h2v2H7V7Zm4 0h2v2h-2V7Zm4 0h2v2h-2V7ZM7 11h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2ZM7 15h2v2H7v-2Zm4 0h2v2h-2v-2Z"/></svg>
      </div>
      <h3>Esperando consulta</h3>
      <p class="small">Ingresa un código de entrada o usa “Simular escaneo QR”.</p>`;
    input.focus();
  });

  document.addEventListener('click', function (ev) {
    const reintentar = ev.target.closest('#btn-reintentar');
    if (reintentar) { input.focus(); return; }

    const chip = ev.target.closest('[data-codigo]');
    if (chip) {
      input.value = chip.getAttribute('data-codigo');
      consultar(input.value);
      return;
    }
    const btn = ev.target.closest('[data-consultar]');
    if (btn) {
      const codigo = btn.getAttribute('data-consultar');
      input.value = codigo;
      consultar(codigo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
        JSP.toast('ok', 'Ingreso simulado', 'La entrada pasó a estado “Usado / Ingresado”.');
        consultar(input.value, { silencioso: true });
        cargarBase();
      });
    }
  });

  cargarBase();

  const inicialCodigo = JSP.parametro('codigo');
  if (inicialCodigo) consultar(inicialCodigo);
})();
