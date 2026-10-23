/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/entrada.js
 * Entrada digital con código QR dinámico:
 *   - genera un token nuevo cada 15 segundos (en modo API, firmado por el servidor)
 *   - vuelve a dibujar el QR real en <canvas>
 *   - reinicia el contador regresivo
 *   - invalida el token anterior
 * ========================================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;

  const SEGUNDOS = 15;

  let entrada = null;
  let rotaciones = 0;
  let restante = SEGUNDOS;
  let finCiclo = Date.now() + SEGUNDOS * 1000;
  let temporizador = null;
  let generando = false;

  const $ = id => document.getElementById(id);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  function escaparEnlaces(codigo) {
    document.querySelectorAll('a[href*="__CODIGO__"]').forEach(function (a) {
      a.href = a.href.replace('__CODIGO__', encodeURIComponent(codigo));
    });
  }

  function pintarDatos(e) {
    $('t-evento').textContent = e.evento;
    $('t-cuando').textContent = `${JSP.formatFechaLarga(e.fecha)} · ${e.hora} hrs`;
    $('t-estado').innerHTML = JSP.estadoBadge(e.estado);
    $('t-fecha').textContent = JSP.formatFechaLarga(e.fecha);
    $('t-hora').textContent = e.hora + ' hrs';
    $('t-lugar').textContent = e.lugar;
    $('t-zona').textContent = e.zona;
    $('t-fila').textContent = e.fila;
    $('t-asiento').textContent = e.asiento;
    $('t-titular').textContent = e.titular;
    $('t-dni').textContent = e.dniOculto;
    $('t-codigo').textContent = e.codigo;
    $('t-precio').textContent = JSP.precio(e.precioOriginal != null ? e.precioOriginal : e.precio);
    $('panel-anterior').textContent = e.qrAnterior || '— (sin QR previo)';
    $('panel-rotaciones').textContent = rotaciones;
    $('panel-generado').textContent = e.qrGeneradoEn ? JSP.formatHora(e.qrGeneradoEn) : '—';
    $('panel-firma').textContent = SecurePassAPI.modoActual() === 'api'
      ? 'HMAC-SHA256 (servidor)'
      : 'Simulada (localStorage)';
    escaparEnlaces(e.codigo);

    const aviso = $('aviso-titular');
    if (e.estado === 'transferido') {
      $('aviso-titular-texto').innerHTML =
        `Esta entrada fue transferida el <strong>${JSP.formatFecha(e.transferidaEn || e.creadoEn)}</strong>. ` +
        `Titular anterior: <strong>${JSP.escapeHtml(e.titularAnterior || '—')}</strong> · ` +
        `Titular actual: <strong>${JSP.escapeHtml(e.titular)}</strong>. ` +
        `El QR anterior fue invalidado y se generó uno nuevo.`;
      aviso.classList.remove('hide');
    } else {
      aviso.classList.add('hide');
    }
  }

  function pintarToken(e, payload) {
    $('t-token').textContent = e.qrToken;
    $('panel-token').textContent = e.qrToken;
    $('payload-visible').textContent = payload;
  }

  function pintarQR(payload, animar) {
    QRCode.render(payload, canvas, {
      scale: 6,
      quiet: 3,
      eccLevel: 'M',
      dark: '#0b1020',
      light: '#ffffff'
    });
    const marco = $('qr-frame');
    if (animar) {
      marco.classList.add('regen');
      setTimeout(() => marco.classList.remove('regen'), 520);
    }
  }

  function pintarContador() {
    $('cd-num').textContent = restante;
    $('cd-seg').textContent = restante;
    const pct = (restante / SEGUNDOS) * 100;
    const fill = $('cd-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('low', restante <= 5);
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo del token                                                     */
  /* ------------------------------------------------------------------ */
  async function rotar(animar) {
    if (generando || !entrada) return;
    if (entrada.estado === 'usado' || entrada.estado === 'anulado') return;

    generando = true;
    try {
      const resultado = await SecurePassAPI.actualizarQR(entrada.codigo, {
        silencioso: true,
        log: false
      });
      if (resultado) {
        rotaciones++;
        entrada = resultado.entrada;
        pintarDatos(entrada);
        pintarToken(entrada, resultado.payload);
        pintarQR(resultado.payload, animar !== false);
      }
    } catch (e) {
      console.error('[Entrada] Error al rotar el QR', e);
    } finally {
      restante = SEGUNDOS;
      finCiclo = Date.now() + SEGUNDOS * 1000;
      pintarContador();
      generando = false;
    }
  }

  function iniciarContador() {
    if (temporizador) clearInterval(temporizador);
    restante = SEGUNDOS;
    finCiclo = Date.now() + SEGUNDOS * 1000;
    pintarContador();
    temporizador = setInterval(function () {
      restante = Math.max(0, Math.ceil((finCiclo - Date.now()) / 1000));
      pintarContador();
      if (restante <= 0) rotar(true);
    }, 250);
  }

  /* ------------------------------------------------------------------ */
  /* Selector de entradas del usuario                                    */
  /* ------------------------------------------------------------------ */
  async function cargarSelector(codigoActual) {
    const cont = $('selector-entradas');
    const mias = await SecurePassAPI.listarMisEntradas();
    const utilizables = mias.filter(e => e.estado === 'valido');

    if (utilizables.length <= 1) {
      cont.innerHTML = '';
      return;
    }
    cont.innerHTML = '<span class="tiny muted">Ver:</span>' + utilizables.map(e =>
      `<button class="code-chip" data-ir="${JSP.escapeHtml(e.codigo)}"
        style="font-family:var(--font);${e.codigo === codigoActual ? 'border-color:var(--brand)' : ''}">
        ${JSP.escapeHtml(e.evento.slice(0, 18))}
      </button>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Carga inicial                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * La persona identificada todavía no ha comprado nada: en vez de enseñar
   * la entrada de otra persona (con su aviso), se explica y se oculta el QR.
   */
  function pintarSinEntradas() {
    const aviso = $('aviso-titular');
    const texto = $('aviso-titular-texto');
    if (texto) {
      texto.innerHTML =
        'Tu identificación está activa, pero <strong>todavía no tienes entradas compradas</strong>. ' +
        'Cuando compres, aquí aparecerá <strong>tu compra con su QR</strong>. ' +
        'Mientras puedes consultar el estado de cualquier entrada desde ' +
        '<a href="verificar.html">Verificador</a>.';
    }
    if (aviso) aviso.classList.remove('hide');

    const datos = $('ticket-datos');
    if (datos) datos.classList.add('hide');
    const ticket = $('ticket-qr');
    if (ticket) ticket.classList.add('hide');
    const panel = $('panel-token-card');
    if (panel) panel.classList.add('hide');
    const selector = $('selector-entradas');
    if (selector) selector.innerHTML = '';
    if ($('aviso-no-mia')) $('aviso-no-mia').classList.add('hide');
    JSP.pintarModo();
  }

  /**
   * Todavía nadie se ha identificado: no se muestran los datos de ninguna
   * entrada ni el QR. Primero la identificación (píldora "Identifícate") y,
   * una vez identificada, recién salen los datos de SU compra y SU QR.
   *
   * Sólo aplica con la API real (base de datos), donde hay varios usuarios:
   * en la demostración local no se exige, porque ahí no hay sesión real.
   */
  function pintarIdentificacionRequerida() {
    const aviso = $('aviso-titular');
    const texto = $('aviso-titular-texto');
    if (texto) {
      texto.innerHTML =
        '<strong>Identifícate para ver tu entrada.</strong> Pulsa el botón ' +
        '<strong>Identifícate</strong> (abajo a la izquierda) y escribe tu DNI, nombres y ' +
        'apellidos: enseguida aparecerán <strong>los datos de tu compra</strong> y tu QR.';
    }
    if (aviso) aviso.classList.remove('hide');
    ['ticket-datos', 'ticket-qr', 'panel-token-card', 'selector-entradas'].forEach(function (id) {
      const el = $(id);
      if (el) el.classList.add('hide');
    });
    if ($('aviso-no-mia')) $('aviso-no-mia').classList.add('hide');
    JSP.pintarModo();
  }

  async function cargar() {
    // Los datos salen SÓLO DESPUÉS de identificarse (con la API real): así
    // cada persona identificada ve su propia compra y su propio QR.
    const enApi = await SecurePassAPI.usarApi();
    const identificado = typeof Sesion !== 'undefined' && Sesion.estaIdentificado();
    if (enApi && !identificado) return pintarIdentificacionRequerida();

    // Si había quedado el aviso de identificación, se retira lo que ocultó
    ['ticket-datos', 'ticket-qr', 'panel-token-card', 'selector-entradas'].forEach(function (id) {
      const el = $(id);
      if (el) el.classList.remove('hide');
    });

    let codigo = JSP.parametro('codigo');

    if (!codigo) {
      // Sin código en la URL se abre LA COMPRA de la persona identificada
      // (su entrada válida), no siempre la misma de una sola persona.
      const mias = await SecurePassAPI.listarMisEntradas();
      const preferida = mias.find(e => e.codigo === 'ENTRY001') ||
        mias.find(e => e.estado === 'valido') || mias[0];
      if (!preferida) return pintarSinEntradas();
      codigo = preferida.codigo;
    }

    entrada = await SecurePassAPI.consultarEntrada(codigo);
    if (!entrada) {
      JSP.toast('error', 'Entrada no encontrada', `El código ${codigo} no existe.`);
      entrada = await SecurePassAPI.consultarEntrada('ENTRY001');
      if (!entrada) return;
    }

    pintarDatos(entrada);
    await cargarSelector(entrada.codigo);
    JSP.pintarModo();

    // Sólo el titular ve y rota su QR: si la entrada no es tuya, el servidor
    // devuelve 403 y aquí sólo se muestra el aviso con el titular real.
    const esMia = entrada.esMia !== false;
    const avisoNoMia = $('aviso-no-mia');
    const avisoTitular = $('aviso-no-mia-titular');
    const ticket = $('ticket-qr');
    const panelToken = $('panel-token-card');
    const btnRegenerarLocal = $('btn-regenerar');
    const btnValidarLocal = $('btn-validar-token');

    if (avisoNoMia) { if (esMia) avisoNoMia.classList.add('hide'); else avisoNoMia.classList.remove('hide'); }
    if (avisoTitular && !esMia) avisoTitular.textContent = entrada.titular || 'otra persona';
    if (ticket) { if (esMia) ticket.classList.remove('hide'); else ticket.classList.add('hide'); }
    if (panelToken) { if (esMia) panelToken.classList.remove('hide'); else panelToken.classList.add('hide'); }
    if (btnRegenerarLocal) btnRegenerarLocal.disabled = !esMia;
    if (btnValidarLocal) btnValidarLocal.disabled = !esMia;

    // "Simular ingreso" vive junto al QR: sólo aparece si la persona está
    // identificada (con la API real, sin identificarse ni se llega aquí),
    // si la entrada es suya y si todavía no se usó ni se anuló.
    const btnSimular = $('btn-marcar-usada');
    if (btnSimular) {
      const puedeSimular = esMia && identificado && entrada.estado === 'valido';
      btnSimular.classList.toggle('hide', !puedeSimular);
    }

    if (esMia) {
      // Si la entrada todavía no tiene token, se genera el primero
      let payload;
      if (!entrada.qrToken) {
        const generado = await SecurePassAPI.actualizarQR(entrada.codigo, { silencioso: true });
        if (generado) {
          entrada = generado.entrada;
          payload = generado.payload;
          pintarDatos(entrada);
        }
      }
      if (!payload && entrada.qrToken) {
        payload = SecurePassAPI.construirPayload(entrada.codigo, entrada.qrToken);
      }

      if (payload) {
        pintarToken(entrada, payload);
        pintarQR(payload, false);
        iniciarContador();
      } else if (typeof JSP !== 'undefined' && JSP.toast) {
        // El servidor no quiso emitir el QR (entrada ajena, usada, error…):
        // no se dibuja un QR falso, se explica el motivo.
        JSP.toast('error', 'QR no disponible',
          'El servidor no pudo emitir el QR de esta entrada.');
      }
    }

    document.addEventListener('click', function (ev) {
      const boton = ev.target.closest('[data-ir]');
      if (!boton) return;
      const destino = boton.getAttribute('data-ir');
      if (destino === entrada.codigo) return;
      location.href = `entrada.html?codigo=${encodeURIComponent(destino)}`;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() > finCiclo + 1500) rotar(true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Eventos manuales                                                    */
  /* ------------------------------------------------------------------ */
  const btnRegenerar = $('btn-regenerar');
  if (btnRegenerar) {
    btnRegenerar.addEventListener('click', async function () {
      if (generando) return;
      btnRegenerar.disabled = true;
      const r = await SecurePassAPI.actualizarQR(entrada.codigo, { log: true });
      if (r) {
        rotaciones++;
        entrada = r.entrada;
        pintarDatos(entrada);
        pintarToken(entrada, r.payload);
        pintarQR(r.payload, true);
        JSP.toast('ok', 'QR regenerado', `El token ${r.tokenAnterior || 'anterior'} quedó invalidado.`);
      } else {
        JSP.toast('error', 'No se pudo regenerar',
          'El servidor no emitió un token nuevo; sigue viendo el QR anterior.');
      }
      restante = SEGUNDOS;
      finCiclo = Date.now() + SEGUNDOS * 1000;
      pintarContador();
      btnRegenerar.disabled = false;
    });
  }

  const btnCopiar = $('btn-copiar');
  if (btnCopiar) {
    btnCopiar.addEventListener('click', function () {
      JSP.copiar(entrada.codigo).then(() =>
        JSP.toast('ok', 'Código copiado', entrada.codigo + ' se copió al portapapeles.'));
    });
  }

  /* Valida el token vigente contra el servidor (como el lector del evento) */
  const btnValidar = $('btn-validar-token');
  if (btnValidar) {
    btnValidar.addEventListener('click', async function () {
      btnValidar.disabled = true;
      const r = await SecurePassAPI.validarToken(entrada.qrToken);
      btnValidar.disabled = false;

      if (r && r.valido) {
        JSP.toast('ok', 'Token validado por el servidor',
          `${r.codigo || entrada.codigo} · ${r.mensaje || 'acceso permitido'}`);
      } else {
        JSP.toast('error', 'Token rechazado',
          (r && r.mensaje) || 'Motivo: ' + ((r && r.motivo) || 'desconocido'));
      }
    });
  }

  /* Simular el ingreso del titular: marca la entrada como usada */
  const btnMarcarUsada = $('btn-marcar-usada');
  if (btnMarcarUsada) {
    btnMarcarUsada.addEventListener('click', async function () {
      if (!entrada) return;
      btnMarcarUsada.disabled = true;
      const r = await SecurePassAPI.marcarUsada(entrada.codigo);
      btnMarcarUsada.disabled = false;
      if (r) {
        JSP.toast('ok', 'Ingreso simulado', 'La entrada pasó a estado “Usado / Ingresado”.');
        cargar();
      } else {
        // El servidor rechazó la operación (entrada ajena, ya usada…):
        // no se anuncia un ingreso que no ocurrió.
        JSP.toast('error', 'No se pudo registrar el ingreso',
          'El servidor no cambió el estado de la entrada. Revisa el motivo e inténtalo de nuevo.');
      }
    });
  }

  cargar();
})();
