/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/home.js
 * Demostración en vivo del QR dinámico en la página de inicio.
 * ========================================================================= */

(function () {
  'use strict';

  const INTERVALO_MS = 15000;
  const canvas = document.getElementById('hero-qr');
  const tokenEl = document.getElementById('hero-token');
  if (!canvas || typeof QRCode === 'undefined') return;

  function pintar() {
    const sufijo = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
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
