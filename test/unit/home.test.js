'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const frontend = path.join(__dirname, '../../frontend');
const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');

test('la portada mantiene enlaces y recursos locales existentes', () => {
  // Los enlaces pueden llevar ?codigo=... para precargar el verificador:
  // la existencia se valida sobre la ruta, no sobre la cadena de consulta.
  const destinos = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)]
    .map(m => m[1].split(/[?#]/)[0])
    .filter(Boolean);
  for (const destino of destinos) {
    assert.ok(fs.existsSync(path.join(frontend, destino)), `No existe ${destino}`);
  }
  for (const pagina of ['verificar.html', 'entrada.html', 'transferencia.html', 'historial.html', 'dashboard.html', 'sobre.html', 'staff/']) {
    assert.ok(destinos.includes(pagina), `Falta acceso a ${pagina}`);
  }
});

test('la portada distingue el pase ilustrativo y permite saltar al contenido', () => {
  assert.match(html, /class="skip-link" href="#contenido"/);
  assert.match(html, /<main id="contenido">/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /aria-label="QR ilustrativo de demostración, no válido para ingresar"/);
  assert.match(html, /No es una entrada real/);
  assert.match(html, /aria-controls="nav-mobile"/);
  assert.match(html, /id="nav-mobile"/);
});

test('el QR de portada se renueva cada 15 segundos sin escribir en la API', () => {
  const canvas = {};
  const token = {};
  const dibujos = [];
  let reloj = 100000;
  let intervalo;
  let demora;
  const contexto = {
    document: { getElementById: id => ({ 'hero-qr': canvas, 'hero-token': token })[id] },
    Date: { now: () => reloj },
    QRCode: { render: (payload, elemento) => dibujos.push({ payload, elemento }) },
    setInterval: (fn, ms) => { intervalo = fn; demora = ms; }
  };
  // Sin fetch ni SecurePassAPI: el pase decorativo no modifica datos reales.
  vm.runInNewContext(fs.readFileSync(path.join(frontend, 'js/home.js'), 'utf8'), contexto);
  assert.equal(demora, 15000);
  assert.equal(dibujos.length, 1);
  assert.equal(dibujos[0].elemento, canvas);
  const anterior = token.textContent;
  reloj += 15000;
  intervalo();
  assert.equal(dibujos.length, 2);
  assert.notEqual(token.textContent, anterior);
});
