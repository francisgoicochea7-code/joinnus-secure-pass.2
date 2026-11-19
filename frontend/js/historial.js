/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/historial.js
 * Línea de tiempo, tabla de trazabilidad y exportación a CSV.
 *
 * Sólo se ejecuta en historial.html. La vista es SIEMPRE personal: sólo se
 * pintan las entradas y los movimientos de la persona que ha iniciado
 * sesión. Sin sesión no se muestra ningún dato (sólo el aviso para entrar):
 * nunca historial de otras personas ni totales globales de la maqueta.
 * El desplegable o ?codigo= acotan la vista a una entrada propia.
 * Todos los contenedores siguen siendo opcionales.
 * ========================================================================= */

(function () {
  'use strict';

  const tabla = document.getElementById('tabla-historial');
  if (!tabla) return;

  const $ = id => document.getElementById(id);
  let filtro = JSP.parametro('codigo') || '';

  const ACCIONES = {
    creada:      { titulo: 'Entrada creada',      tipo: 'ok',     icono: 'ticket',       badge: 'badge-brand' },
    verificada:  { titulo: 'Entrada verificada',  tipo: 'ok',     icono: 'search',       badge: 'badge-valido' },
    transferida: { titulo: 'Entrada transferida', tipo: 'info',   icono: 'repeat',       badge: 'badge-transferido' },
    qr:          { titulo: 'Nuevo QR generado',   tipo: 'ok',     icono: 'qr',           badge: 'badge-brand' },
    usada:       { titulo: 'Ingreso registrado',  tipo: 'danger', icono: 'checkCircle',  badge: 'badge-usado' },
    anulada:     { titulo: 'Entrada anulada',     tipo: 'warn',   icono: 'ban',          badge: 'badge-anulado' }
  };

  const ESTADO_ETIQUETA = {
    creada: 'Creada',
    verificada: 'Verificada',
    transferida: 'Transferida',
    qr: 'QR emitido',
    usada: 'Ingresada',
    anulada: 'Anulada'
  };

  /* ------------------------------------------------------------------ */
  /* Sesión de la persona que mira la página                             */
  /* ------------------------------------------------------------------ */
  /** DNI de quien inició sesión; null si no hay nadie identificado. */
  function dniSesion() {
    if (typeof Sesion === 'undefined' || !Sesion) return null;
    const identificado = typeof Sesion.estaIdentificado === 'function' && Sesion.estaIdentificado();
    const dni = typeof Sesion.dni === 'function' ? Sesion.dni() : null;
    return identificado && /^\d{8}$/.test(String(dni || '')) ? String(dni) : null;
  }

  const BTN_SESION =
    '<button type="button" class="btn btn-primary btn-sm" data-modal-open="modal-identificacion" ' +
    'style="margin-top:.75rem">Iniciar sesión</button>';

  const AVISO_SESION = '<p class="muted small">Inicia sesión para ver tu historial.</p>' + BTN_SESION;
  const AVISO_VACIO = '<p class="muted small">Aún no tienes actividad registrada.</p>';
  const AVISO_SIN_ENTRADAS = '<p class="muted small">Todavía no tienes entradas registradas.</p>';
  const AVISO_SIN_FILTRO = '<p class="muted small">Sin registros para esta entrada.</p>';

  /* ------------------------------------------------------------------ */
  /* Línea de tiempo                                                     */
  /* ------------------------------------------------------------------ */
  function pintarLinea(eventos, aviso) {
    const cont = $('linea-tiempo');
    if (!cont) return;
    if (!eventos.length) {
      cont.innerHTML = aviso || AVISO_SIN_FILTRO;
      return;
    }

    cont.innerHTML = eventos.map(e => {
      const a = ACCIONES[e.accion] || { titulo: e.accion, tipo: '', icono: 'info' };
      return `
        <div class="tl-item ${a.tipo}">
          <div class="tl-title">
            ${JSP.icon(a.icono, { size: 16 })}
            ${JSP.escapeHtml(a.titulo)}
            <span class="badge ${a.badge}">${JSP.escapeHtml(e.codigo)}</span>
          </div>
          <div class="tl-sub">
            ${JSP.escapeHtml(e.titular || '—')}
            ${e.detalle ? ' · ' + JSP.escapeHtml(e.detalle) : ''}
          </div>
          <div class="tl-sub mono">${JSP.formatFechaHora(e.fecha)} · ${JSP.tiempoRelativo(e.fecha)}</div>
        </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Tabla                                                               */
  /* ------------------------------------------------------------------ */
  function pintarTabla(eventos, aviso) {
    const cuerpo = tabla.querySelector('tbody');
    if (!cuerpo) return;
    if (!eventos.length) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="center muted">' + (aviso || 'Sin registros para este filtro.') + '</td></tr>';
      return;
    }
    const ordenados = eventos.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    cuerpo.innerHTML = ordenados.map(e => {
      const a = ACCIONES[e.accion] || { titulo: e.accion, badge: 'badge-neutral' };
      return `
        <tr>
          <td class="nowrap">${JSP.formatFechaHora(e.fecha)}</td>
          <td><span class="badge ${a.badge}">${JSP.escapeHtml(a.titulo)}</span></td>
          <td><strong>${JSP.escapeHtml(e.titular || '—')}</strong></td>
          <td>${JSP.escapeHtml(ESTADO_ETIQUETA[e.accion] || '—')}</td>
          <td class="mono">${JSP.escapeHtml(e.codigo)}</td>
          <td class="small">${JSP.escapeHtml(e.detalle || '—')}</td>
        </tr>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Estados actuales por entrada (sólo las mías)                        */
  /* ------------------------------------------------------------------ */
  function pintarEstados(entradas, aviso) {
    const cont = $('estados-actuales');
    if (!cont) return;
    if (!entradas.length) {
      cont.innerHTML = aviso || AVISO_SIN_ENTRADAS;
      return;
    }
    cont.innerHTML = entradas.map(e => `
      <a href="entrada.html?codigo=${e.codigo}" class="row-between"
         style="padding:.55rem .7rem;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--border)">
        <div style="min-width:0">
          <div class="small mono" style="font-weight:700">${JSP.escapeHtml(e.codigo)}</div>
          <div class="tiny muted">${JSP.escapeHtml(e.titular)}</div>
        </div>
        ${JSP.estadoBadge(e.estado, { corta: true })}
      </a>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Filtro por código (sólo con mis entradas)                           */
  /* ------------------------------------------------------------------ */
  function pintarSelector(entradas) {
    const sel = $('filtro-codigo');
    if (!sel) return;
    sel.disabled = false;
    sel.innerHTML = '<option value="">Todas mis entradas</option>' + entradas.map(e =>
      `<option value="${JSP.escapeHtml(e.codigo)}"${e.codigo === filtro ? ' selected' : ''}>
         ${JSP.escapeHtml(e.codigo)} — ${JSP.escapeHtml(e.evento)}
       </option>`).join('');
  }

  /** Movimientos de MIS entradas; el filtro por código se aplica encima,
   *  nunca se pide al servidor el historial de una entrada ajena. */
  async function cargarEventos(dni, codigoFiltro) {
    const todos = await SecurePassAPI.obtenerHistorial(null, dni);
    const lista = Array.isArray(todos) ? todos : [];
    return codigoFiltro ? lista.filter(h => h.codigo === codigoFiltro) : lista;
  }

  function fijarTexto(id, texto) {
    const el = $(id);
    if (el) el.textContent = texto;
  }

  function fijarEstadistica(id, valor) {
    const el = $(id);
    if (el) el.textContent = String(valor);
  }

  /* ------------------------------------------------------------------ */
  /* Carga principal                                                     */
  /* ------------------------------------------------------------------ */
  async function cargar() {
    const dni = dniSesion();
    const sel = $('filtro-codigo');
    const btnExportar = $('btn-exportar');

    // Sin sesión no se pinta nada: ni métricas, ni filtros, ni entradas.
    if (!dni) {
      filtro = '';
      pintarLinea([], AVISO_SESION);
      pintarTabla([], AVISO_SESION);
      pintarEstados([], AVISO_SESION);
      if (sel) {
        sel.innerHTML = '<option value="">Inicia sesión para filtrar</option>';
        sel.disabled = true;
      }
      if (btnExportar) btnExportar.disabled = true;
      fijarTexto('timeline-info', 'Sin sesión');
      fijarTexto('total-registros', '0 registros');
      fijarEstadistica('stat-eventos', 0);
      fijarEstadistica('stat-verificaciones', 0);
      fijarEstadistica('stat-transferencias', 0);
      fijarEstadistica('stat-qr', 0);
      JSP.pintarModo();
      return;
    }

    if (btnExportar) btnExportar.disabled = false;

    const entradas = await SecurePassAPI.listarMisEntradas();
    // Un código ajeno llegado por URL no se consulta: se limpia el filtro.
    if (filtro && !entradas.some(e => e.codigo === filtro)) filtro = '';

    const todos = await cargarEventos(dni, null);
    const eventos = filtro ? todos.filter(h => h.codigo === filtro) : todos;

    pintarLinea(eventos, eventos.length ? '' : (filtro ? AVISO_SIN_FILTRO : AVISO_VACIO));
    pintarTabla(eventos, eventos.length ? '' : (filtro ? AVISO_SIN_FILTRO : AVISO_VACIO));
    pintarEstados(entradas, AVISO_SIN_ENTRADAS);
    pintarSelector(entradas);

    fijarTexto('timeline-info', filtro
      ? `Mostrando ${eventos.length} evento(s) de ${filtro}`
      : `Mostrando ${eventos.length} evento(s) de tus entradas`);
    fijarTexto('total-registros', `${eventos.length} registro${eventos.length === 1 ? '' : 's'}`);

    // Las métricas son de la persona identificada, no del total global.
    pintarEstadistica('stat-eventos', todos.length);
    pintarEstadistica('stat-verificaciones', todos.filter(h => h.accion === 'verificada').length);
    pintarEstadistica('stat-transferencias', todos.filter(h => h.accion === 'transferida').length);
    pintarEstadistica('stat-qr', todos.filter(h => h.accion === 'qr').length);

    JSP.pintarModo();
  }

  /** Contador de la tarjeta, sólo si esa tarjeta existe en la página. */
  function pintarEstadistica(id, valor) {
    const el = $(id);
    if (el) JSP.animarContador(el, valor);
  }

  /* ------------------------------------------------------------------ */
  /* Exportar CSV (sólo mis movimientos)                                 */
  /* ------------------------------------------------------------------ */
  const btnExportar = $('btn-exportar');
  if (btnExportar) btnExportar.addEventListener('click', async function () {
    const dni = dniSesion();
    if (!dni) return;

    const eventos = await cargarEventos(dni, filtro);
    const filas = [['Código', 'Acción', 'Titular', 'Detalle', 'Fecha']];
    eventos.forEach(e => filas.push([e.codigo, e.accion, e.titular, e.detalle || '', JSP.formatFechaHora(e.fecha)]));

    const celda = (valor) => {
      let texto = String(valor == null ? '' : valor);
      // Evita que una hoja de cálculo interprete texto como fórmula.
      if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
      return '"' + texto.replace(/"/g, '""') + '"';
    };
    // BOM para que Excel abra los acentos correctamente.
    const csv = '\ufeff' + filas.map(f => f.map(celda).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinnus-secure-pass-historial${filtro ? '-' + filtro : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    JSP.toast('ok', 'Historial exportado', `${eventos.length} registro(s) descargados en formato CSV.`);
  });

  /* ------------------------------------------------------------------ */
  /* Resultados                                                          */
  /* ------------------------------------------------------------------ */
  /** Los bloques de resultados se muestran al cargar; el filtro permite
   *  acotarlos a una entrada concreta. */
  function mostrarResultados() {
    ['resultados-flujo', 'registro-historial'].forEach(id => {
      const bloque = $(id);
      if (bloque) bloque.classList.remove('hide');
    });
    const aviso = $('busqueda-aviso');
    if (aviso) aviso.classList.add('hide');
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                             */
  /* ------------------------------------------------------------------ */
  const selectFiltro = $('filtro-codigo');
  if (selectFiltro) {
    selectFiltro.addEventListener('change', function () {
      filtro = this.value;
      mostrarResultados();
      cargar();
    });
  }

  // La vista inicial muestra la actividad propia; el desplegable permite
  // acotarla a una entrada sin dejar la página vacía.
  mostrarResultados();
  cargar();
})();
