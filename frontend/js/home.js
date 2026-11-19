/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/home.js
 * Portada: tarjetas con las entradas REALES de la persona identificada
 * (sin tarjetas de ejemplo) y demostración del QR dinámico del pase.
 * ========================================================================= */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. Entradas reales de la sesión                                     */
  /* ------------------------------------------------------------------ */
  const grid = document.getElementById('show-grid');
  const vacio = document.getElementById('lineup-vacio');

  // Imagen y categoría según el nombre real del evento. Si no coincide con
  // ninguna conocida se usa la portada genérica de concierto.
  const ARTE = [
    { prueba: /futbol|fútbol|liga|partido|estadio|club|deport/i, src: 'assets/evento-futbol.jpg', categoria: 'Fútbol' },
    { prueba: /festival|feria|parque|exposici/i, src: 'assets/evento-festival.jpg', categoria: 'Festival' },
    { prueba: /concierto|music|música|banda|rock|pop/i, src: 'assets/evento-concierto.jpg', categoria: 'Música' }
  ];

  function arteDe(evento) {
    const texto = String(evento || '');
    for (let i = 0; i < ARTE.length; i++) {
      if (ARTE[i].prueba.test(texto)) return ARTE[i];
    }
    return { src: 'assets/evento-concierto.jpg', categoria: 'Evento' };
  }

  function haySesion() {
    if (typeof Sesion === 'undefined' || !Sesion) return false;
    if (typeof Sesion.estaIdentificado !== 'function' || !Sesion.estaIdentificado()) return false;
    return /^\d{8}$/.test(String(Sesion.dni() || ''));
  }

  function mostrarVacio(titulo, texto, conBoton) {
    if (grid) {
      grid.innerHTML = '';
      grid.classList.add('hide');
    }
    if (!vacio) return;
    vacio.classList.remove('hide');
    const t = document.getElementById('lineup-vacio-titulo');
    const p = document.getElementById('lineup-vacio-texto');
    const b = document.getElementById('lineup-vacio-boton');
    if (t) t.textContent = titulo;
    if (p) p.textContent = texto;
    if (b) b.classList.toggle('hide', !conBoton);
  }

  function tarjeta(entrada) {
    const arte = arteDe(entrada.evento);
    const lugar = [entrada.lugar, entrada.zona]
      .filter(Boolean)
      .map(x => JSP.escapeHtml(x))
      .join(' · ');
    return `
      <a class="show-card" href="verificar.html?codigo=${encodeURIComponent(entrada.codigo)}"
         aria-label="Verificar la entrada de ${JSP.escapeHtml(entrada.evento)}">
        <div class="show-art">
          <img src="${arte.src}" alt="" width="1050" height="700" loading="lazy">
          <span class="show-cat">${JSP.escapeHtml(arte.categoria)}</span>
          <span class="show-code mono">${JSP.escapeHtml(entrada.codigo)}</span>
        </div>
        <div class="show-info">
          <div class="show-when">
            <span>${JSP.escapeHtml(JSP.formatFecha(entrada.fecha))}</span>
            <span>${JSP.escapeHtml(entrada.hora || '')}</span>
          </div>
          <h3>${JSP.escapeHtml(entrada.evento)}</h3>
          <p>${lugar}</p>
          <div class="show-foot"><span class="show-cta">Verificar pase <span aria-hidden="true">↗</span></span></div>
        </div>
      </a>`;
  }

  async function cargarEntradas() {
    if (!grid || !vacio) return;

    if (!haySesion() || typeof SecurePassAPI === 'undefined') {
      mostrarVacio('Inicia sesión para ver tus entradas',
        'Tus pases aparecerán aquí cuando entres con tu DNI y tu contraseña.', true);
      return;
    }

    let entradas = [];
    try {
      entradas = await SecurePassAPI.listarMisEntradas();
    } catch (e) { /* sin conexión: se muestra el estado vacío */ }
    entradas = (entradas || []).filter(e => e && e.codigo);

    if (!entradas.length) {
      mostrarVacio('Todavía no tienes entradas',
        'Cuando recibas un pase aparecerá aquí para verificarlo.', false);
      return;
    }

    vacio.classList.add('hide');
    grid.classList.remove('hide');
    grid.innerHTML = entradas.map(tarjeta).join('');
  }

  cargarEntradas();

  /* ------------------------------------------------------------------ */
  /* 2. QR ilustrativo del pase                                          */
  /* ------------------------------------------------------------------ */
  const INTERVALO_MS = 15000;
  const canvas = document.getElementById('hero-qr');
  const tokenEl = document.getElementById('hero-token');
  if (!canvas || typeof QRCode === 'undefined') return;

  function pintar() {
    const sufijo = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0');
    const token = `JSP-ENTRY001-${sufijo}`;
    const payload = `JSP|ENTRY001|${sufijo}|${Date.now().toString().slice(-4)}`;
    QRCode.render(payload, canvas, {
      scale: 5,
      quiet: 2,
      eccLevel: 'M',
      dark: '#0b1020',
      light: '#ffffff'
    });
    if (tokenEl) tokenEl.textContent = token;
  }

  pintar();
  setInterval(pintar, INTERVALO_MS);
})();
