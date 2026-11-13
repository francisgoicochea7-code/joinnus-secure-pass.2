/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/app.js
 * -------------------------------------------------------------------------
 * Utilidades compartidas por todas las paginas: iconos SVG, notificaciones,
 * modales, formato de fechas, badges de estado, navegacion y reloj.
 * ========================================================================= */

const JSP = (function () {
  'use strict';

  /* -------------------------------------------------------------------
   * 1. Iconos SVG (sin dependencias externas)
   * ----------------------------------------------------------------- */
  const ICONOS = {
    shield: 'M12 2 4 5.5v6c0 4.8 3.4 9.3 8 10.5 4.6-1.2 8-5.7 8-10.5v-6L12 2Zm0 2.2 6 2.6v4.7c0 3.7-2.5 7.2-6 8.3-3.5-1.1-6-4.6-6-8.3V6.8l6-2.6Z',
    home: 'M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z',
    grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    checkCircle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z',
    xCircle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 12.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1Z',
    ban: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A8 8 0 0 1 4 12Zm8 8a8 8 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20Z',
    repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z',
    ticket: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm2 0v2h14V8H5Zm0 6v2h14v-2H5Z',
    history: 'M13 3a9 9 0 0 0-8.5 6H1l3.5 3.5L8 9H5.6A7 7 0 1 1 6 15H4a9 9 0 1 0 9-12v0Zm-1 5v5l4.2 2.5.7-1.2-3.4-2V8H12Z',
    search: 'M10 3a7 7 0 1 0 4.2 12.6l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 10 3Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
    x: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4L10.6 10.6l6.3-6.3 1.4 1.4-2.1 2.1 2.1 2.1Z',
    check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4-10.6 10.6Z',
    alert: 'M12 2 1 21h22L12 2Zm1 14h-2v2h2v-2Zm0-7h-2v5h2V9Z',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v2h-2V7Zm0 4h2v6h-2v-6Z',
    arrowRight: 'M13.2 5.6 11.8 7l4 4H3v2h12.8l-4 4 1.4 1.4 6.4-6.4-6.4-6.4Z',
    qr: 'M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z',
    lock: 'M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Zm3 8.7V17h-2v-1.3a1.7 1.7 0 0 1 1-1.6 1 1 0 1 0 2 0 1.7 1.7 0 0 1-1 1.6Z',
    user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Z',
    users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.7-6 3.8V20h12v-2.2C15 15.7 12.3 14 9 14Zm8.5-2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm.5 2c-.7 0-1.4.1-2 .3 1.2.9 2 2.1 2 3.5V20h6v-2.2c0-2-2.7-3.8-6-3.8Z',
    calendar: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7ZM5 9h14v11H5V9Z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7-4.2-2.2Z',
    pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
    mail: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.5L4.5 7.5 3 8.7V18h18V8.7l-1.5-1.2L12 12.5Z',
    refresh: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z',
    menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
    zap: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
    database: 'M12 2c-4.4 0-8 1.6-8 3.5v13C4 20.4 7.6 22 12 22s8-1.6 8-3.5v-13C20 3.6 16.4 2 12 2Zm6 15.5c0 .7-2.7 1.5-6 1.5s-6-.8-6-1.5v-2.2c1.5 1 3.7 1.7 6 1.7s4.5-.7 6-1.7v2.2Zm0-5c0 .7-2.7 1.5-6 1.5s-6-.8-6-1.5V9.8c1.5 1 3.7 1.7 6 1.7s4.5-.7 6-1.7v2.2ZM12 10.5c-3.3 0-6-.8-6-1.5S8.7 7.5 12 7.5s6 .8 6 1.5-.8 1.5-6 1.5Z',
    activity: 'M3 12h4l3-8 4 16 3-8h4v2h-2.6l-4.4 14-4-16-1.5 4H3v-2Z',
    eye: 'M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    edit: 'M3 17.2V21h3.8L18 9.8 14.2 6 3 17.2ZM20.7 7.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.8 1.8L18.9 8.9l1.8-1.8Z',
    send: 'M2 21 23 12 2 3v7l15 2-15 2v7Z',
    play: 'M8 5v14l11-7L8 5Z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.8L17.2 8H14V4.8ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z',
    chart: 'M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4.1c.7 1 1.3 2.3 1.7 3.9h-3.4c.4-1.6 1-2.9 1.7-3.9ZM4.3 14A8 8 0 0 1 4 12c0-.7.1-1.4.3-2h3.1a17 17 0 0 0 0 4H4.3Zm.8 2h3c.3 1.3.8 2.5 1.4 3.5A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.4-3.5A15.6 15.6 0 0 0 8.1 8ZM12 19.9c-.7-1-1.3-2.3-1.7-3.9h3.4c-.4 1.6-1 2.9-1.7 3.9ZM14.3 14H9.7a15 15 0 0 1 0-4h4.6a15 15 0 0 1 0 4Zm.2 5.4c.6-1 1.1-2.2 1.4-3.4h3a8 8 0 0 1-4.4 3.4Zm1.9-5.4a17 17 0 0 0 0-4h3.1c.2.6.3 1.3.3 2s-.1 1.4-.3 2h-3.1Z',
    lock2: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4Zm0 2.2 7 3.1V11c0 4.7-3 9-7 10.2C8 20 5 15.7 5 11V6.3l7-3.1Z',
    scan: 'M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5ZM7 7h2v2H7V7Zm4 0h2v2h-2V7Zm4 0h2v2h-2V7ZM7 11h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2ZM7 15h2v2H7v-2Zm4 0h2v2h-2v-2Z',
    trash: 'M9 3h6l1 2h4v2H4V5h4l1-2ZM6 8h12l-1 13H7L6 8Z'
  };

  function icon(nombre, opciones) {
    const opts = opciones || {};
    const d = ICONOS[nombre] || ICONOS.info;
    const size = opts.size || 24;
    const clase = opts.clase ? ' class="' + opts.clase + '"' : '';
    return '<svg' + clase + ' viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  /* -------------------------------------------------------------------
   * 2. Escape HTML
   * ----------------------------------------------------------------- */
  function escapeHtml(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* -------------------------------------------------------------------
   * 3. Fechas
   * ----------------------------------------------------------------- */
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

  function pad(n) { return String(n).padStart(2, '0'); }

  /* Interpreta el valor que llega como fecha.
   * Las fechas 'YYYY-MM-DD' (sin hora) se crean en la zona local: si no,
   * new Date('2026-09-29') es medianoche UTC y en América/Lima (UTC-5) el
   * día se muestra como 28 en vez de 29. */
  function parseFecha(iso) {
    if (typeof iso === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return new Date(iso);
  }

  function formatFecha(iso) {
    const d = parseFecha(iso);
    if (Number.isNaN(d)) return '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function formatHora(iso) {
    const d = parseFecha(iso);
    if (Number.isNaN(d)) return '—';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatFechaHora(iso) {
    const d = parseFecha(iso);
    if (Number.isNaN(d)) return '—';
    return `${formatFecha(d)} - ${formatHora(d)}`;
  }

  function formatFechaLarga(iso) {
    const d = parseFecha(iso);
    if (Number.isNaN(d)) return '—';
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  function tiempoRelativo(iso) {
    const d = parseFecha(iso);
    if (Number.isNaN(d)) return '—';
    const seg = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seg < 45) return 'hace un momento';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    if (seg < 604800) return `hace ${Math.floor(seg / 86400)} d`;
    return formatFecha(d);
  }

  /* -------------------------------------------------------------------
   * 4. Badges de estado
   * ----------------------------------------------------------------- */
  function estadoBadge(estado, opciones) {
    const meta = (window.SecurePassAPI && SecurePassAPI.ESTADOS[estado]) ||
      { etiqueta: estado, clase: 'badge-neutral' };
    const opts = opciones || {};
    return '<span class="badge ' + meta.clase + '"><span class="dot"></span>' +
      escapeHtml(opts.corta ? meta.corta : meta.etiqueta) + '</span>';
  }

  function ocultarDNI(dni) {
    if (window.SecurePassAPI) return SecurePassAPI.ocultarDNI(dni);
    const d = String(dni || '');
    return '********' + d.slice(-2);
  }

  function precio(valor) {
    const n = Number(valor || 0);
    return 'S/ ' + n.toFixed(2);
  }

  /* -------------------------------------------------------------------
   * 5. Notificaciones (toasts)
   * ----------------------------------------------------------------- */
  function contenedorToasts() {
    let c = document.querySelector('.toasts');
    if (!c) {
      c = document.createElement('div');
      c.className = 'toasts';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(tipo, titulo, mensaje, duracion) {
    const contenedor = contenedorToasts();
    const iconos = { ok: 'checkCircle', error: 'xCircle', warn: 'alert', info: 'info' };
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.innerHTML =
      '<span class="toast-icon">' + icon(iconos[tipo] || 'info', { size: 20 }) + '</span>' +
      '<div class="toast-body"><strong>' + escapeHtml(titulo) + '</strong>' +
      (mensaje ? '<span>' + escapeHtml(mensaje) + '</span>' : '') + '</div>';
    contenedor.appendChild(el);

    const cerrar = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    };
    el.addEventListener('click', cerrar);
    setTimeout(cerrar, duracion || 4200);
    return el;
  }

  /* -------------------------------------------------------------------
   * 6. Modales
   * ----------------------------------------------------------------- */
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    const focusable = m.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 120);
  }

  function cerrarModal(id) {
    const m = typeof id === 'string' ? document.getElementById(id) : id;
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
  }

  function initModales() {
    document.addEventListener('click', function (ev) {
      const disparador = ev.target.closest('[data-modal-open]');
      if (disparador) {
        ev.preventDefault();
        abrirModal(disparador.getAttribute('data-modal-open'));
        return;
      }
      const cerrador = ev.target.closest('[data-modal-close]');
      if (cerrador) {
        ev.preventDefault();
        cerrarModal(cerrador.getAttribute('data-modal-close'));
        return;
      }
      if (ev.target.classList && ev.target.classList.contains('modal-backdrop')) {
        cerrarModal(ev.target);
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        const abierto = document.querySelector('.modal-backdrop.open');
        if (abierto) cerrarModal(abierto);
      }
    });
  }

  /* -------------------------------------------------------------------
   * 7. Navegacion
   * ----------------------------------------------------------------- */
  function initNav() {
    const nav = document.querySelector('.nav');
    const toggle = document.querySelector('.nav-toggle');
    const movil = document.getElementById('nav-mobile');

    if (toggle && movil) {
      toggle.addEventListener('click', function () {
        const abierto = movil.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(abierto));
        toggle.innerHTML = icon(abierto ? 'x' : 'menu', { size: 20 });
      });
    }

    const actual = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav-links a, .nav-mobile a[data-page]').forEach(function (a) {
      const destino = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
      if (destino === actual) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });

    if (nav) {
      const alScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
      window.addEventListener('scroll', alScroll, { passive: true });
      alScroll();
    }
  }

  /* -------------------------------------------------------------------
   * 8. Reloj en vivo
   * ----------------------------------------------------------------- */
  function initReloj() {
    const objetivos = document.querySelectorAll('[data-clock]');
    if (!objetivos.length) return;
    const formato = document.body.getAttribute('data-clock-format') || 'fecha-hora';
    const pintar = () => {
      const ahora = new Date();
      let texto;
      if (formato === 'hora') texto = formatHora(ahora);
      else if (formato === 'larga') texto = formatFechaLarga(ahora);
      else texto = formatFechaHora(ahora);
      objetivos.forEach(el => { el.textContent = texto; });
    };
    pintar();
    setInterval(pintar, 1000);
  }

  /* -------------------------------------------------------------------
   * 9. Contadores animados
   * ----------------------------------------------------------------- */
  function animarContador(el, destino, duracion) {
    const inicio = performance.now();
    const total = duracion || 900;
    function paso(t) {
      const p = Math.min(1, (t - inicio) / total);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(destino * eased);
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  /* -------------------------------------------------------------------
   * 10. Portapapeles
   * ----------------------------------------------------------------- */
  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (resolve, reject) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) { reject(e); } finally { ta.remove(); }
    });
  }

  /* -------------------------------------------------------------------
   * 11. Utilidades varias
   * ----------------------------------------------------------------- */
  function parametro(nombre) {
    return new URLSearchParams(location.search).get(nombre);
  }

  function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function simularEscaneo(selectorOverlay, ms) {
    const overlay = typeof selectorOverlay === 'string'
      ? document.querySelector(selectorOverlay) : selectorOverlay;
    if (overlay) overlay.classList.add('active');
    await esperar(ms || 1400);
    if (overlay) overlay.classList.remove('active');
  }

  /* -------------------------------------------------------------------
   * 12. Indicador de conexion con la API (modo Docker / modo local)
   * ----------------------------------------------------------------- */
  function pintarModo() {
    const elementos = document.querySelectorAll('[data-modo]');
    if (!elementos.length || !window.SecurePassAPI) return;

    const aplicar = () => {
      const api = SecurePassAPI.modoActual() === 'api';
      elementos.forEach(function (el) {
        el.innerHTML = api
          ? '<span class="badge badge-valido"><span class="dot"></span>API conectada (Docker)</span>'
          : '<span class="badge badge-neutral"><span class="dot"></span>Modo local (localStorage)</span>';
        el.title = api
          ? 'Los datos provienen de PostgreSQL a traves de la API del contenedor backend.'
          : 'No se detecto la API: los datos se guardan en el navegador (localStorage).';
      });
    };

    aplicar();
    // La deteccion es asincrona: se repinta cuando el cliente responde
    SecurePassAPI.usarApi()
      .then(aplicar)
      .catch(() => aplicar());
  }

  /* -------------------------------------------------------------------
   * 13. Inicio global
   * ----------------------------------------------------------------- */
  function init() {
    initNav();
    initModales();
    initReloj();
    pintarModo();
    const anio = document.getElementById('anio');
    if (anio) anio.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    icon: icon,
    ICONOS: ICONOS,
    escapeHtml: escapeHtml,
    formatFecha: formatFecha,
    formatHora: formatHora,
    formatFechaHora: formatFechaHora,
    formatFechaLarga: formatFechaLarga,
    tiempoRelativo: tiempoRelativo,
    estadoBadge: estadoBadge,
    ocultarDNI: ocultarDNI,
    precio: precio,
    toast: toast,
    abrirModal: abrirModal,
    cerrarModal: cerrarModal,
    initNav: initNav,
    initReloj: initReloj,
    animarContador: animarContador,
    copiar: copiar,
    parametro: parametro,
    esperar: esperar,
    simularEscaneo: simularEscaneo,
    pintarModo: pintarModo
  };
})();
