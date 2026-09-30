/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/historial.js
 * Línea de tiempo, tabla de trazabilidad y exportación a CSV.
 *
 * Sólo se ejecuta en historial.html. La página no despliega la lista larga
 * de forma automática: los bloques de resultados vienen ocultos y sólo se
 * muestran cuando el usuario busca una entrada (desplegable o ?codigo=).
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
  /* Línea de tiempo                                                     */
  /* ------------------------------------------------------------------ */
  function pintarLinea(eventos) {
    const cont = $('linea-tiempo');
    if (!cont) return;
    if (!eventos.length) {
      cont.innerHTML = '<p class="muted small">No hay eventos registrados para este filtro.</p>';
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
  function pintarTabla(eventos) {
    const cuerpo = tabla.querySelector('tbody');
    if (!eventos.length) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="center muted">Sin registros para este filtro.</td></tr>';
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
  /* Estados actuales por entrada                                        */
  /* ------------------------------------------------------------------ */
  async function pintarEstados() {
    const cont = $('estados-actuales');
    if (!cont) return;
    const entradas = await SecurePassAPI.listarEntradas();
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
  /* Filtro por código                                                  */
  /* ------------------------------------------------------------------ */
  async function cargarSelector() {
    const sel = $('filtro-codigo');
    if (!sel) return;
    const entradas = await SecurePassAPI.listarEntradas();
    sel.innerHTML = '<option value="">Todas las entradas</option>' + entradas.map(e =>
      `<option value="${JSP.escapeHtml(e.codigo)}"${e.codigo === filtro ? ' selected' : ''}>
         ${JSP.escapeHtml(e.codigo)} — ${JSP.escapeHtml(e.evento)}
       </option>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Carga principal                                                     */
  /* ------------------------------------------------------------------ */
  async function cargar() {
    const eventos = await SecurePassAPI.obtenerHistorial(filtro);

    pintarLinea(eventos);
    pintarTabla(eventos);

    const info = $('timeline-info');
    if (info) {
      info.textContent = filtro
        ? `Mostrando ${eventos.length} evento(s) de ${filtro}`
        : `Mostrando ${eventos.length} evento(s) de todas las entradas`;
    }
    const total = $('total-registros');
    if (total) {
      total.textContent = `${eventos.length} registro${eventos.length === 1 ? '' : 's'}`;
    }

    const todos = await SecurePassAPI.obtenerHistorial();
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
  /* Exportar CSV                                                        */
  /* ------------------------------------------------------------------ */
  const btnExportar = $('btn-exportar');
  if (btnExportar) btnExportar.addEventListener('click', async function () {
    const eventos = await SecurePassAPI.obtenerHistorial(filtro);
    const filas = [['Código', 'Acción', 'Titular', 'Detalle', 'Fecha']];
    eventos.forEach(e => filas.push([e.codigo, e.accion, e.titular, e.detalle || '', JSP.formatFechaHora(e.fecha)]));

    const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinnus-secure-pass-historial${filtro ? '-' + filtro : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    JSP.toast('ok', 'Historial exportado', `${eventos.length} registro(s) descargados en formato CSV.`);
  });

  /* ------------------------------------------------------------------ */
  /* Sólo por búsqueda                                                   */
  /* ------------------------------------------------------------------ */
  /** Los bloques largos (línea de tiempo, estados y tabla) vienen ocultos
   *  en el HTML: se despliegan únicamente cuando el usuario busca, para
   *  que la página no aparezca toda extendida. */
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

  cargarSelector();
  // Llegada desde otra página con ?codigo=XXXX: eso ya es una búsqueda.
  if (filtro) mostrarResultados();
  cargar();
  pintarEstados();
})();
