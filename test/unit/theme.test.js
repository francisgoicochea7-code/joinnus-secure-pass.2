'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = path.join(__dirname, '../../frontend');
const paginas = ['dashboard.html', 'verificar.html', 'entrada.html', 'transferencia.html', 'historial.html', 'sobre.html'];

test('las páginas internas cargan el tema compartido después de styles.css', () => {
  for (const pagina of paginas) {
    const html = fs.readFileSync(path.join(frontend, pagina), 'utf8');
    const estilos = html.indexOf('css/styles.css');
    const tema = html.indexOf('css/theme.css');
    assert.ok(estilos >= 0, `${pagina} no carga styles.css`);
    assert.ok(tema > estilos, `${pagina} debe cargar theme.css después de styles.css`);
    assert.match(html, /<meta name="theme-color" content="#0b0d13">/);
  }
});

test('el tema mantiene las señales de estado y el modo claro del QR', () => {
  const css = fs.readFileSync(path.join(frontend, 'css/theme.css'), 'utf8');
  for (const estado of ['badge-valido', 'badge-usado', 'badge-anulado', 'badge-transferido']) {
    assert.match(css, new RegExp(`body\\.page-top \\.${estado}`), `Falta el estado ${estado}`);
  }
  assert.match(css, /\.qr-frame \{[^}]*background: #fff/);
  assert.match(css, /prefers-reduced-motion/);
});
