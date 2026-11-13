'use strict';

/* Pruebas unitarias del formateo de fechas. */

process.env.QR_SECRET = 'secreto-de-pruebas-con-mas-de-16-caracteres';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { util } = require('../../backend/index');

test('fechaCorta usa los componentes locales de un objeto Date', () => {
  assert.equal(util.fechaCorta(new Date(2026, 8, 29, 10, 0, 0)), '2026-09-29');
});

test('fechaCorta rellena mes y día con dos dígitos', () => {
  assert.equal(util.fechaCorta(new Date(2026, 0, 5)), '2026-01-05');
});

test('fechaCorta recorta una marca de tiempo en texto', () => {
  assert.equal(util.fechaCorta('2026-09-29T10:00:00'), '2026-09-29');
  assert.equal(util.fechaCorta('2026-09-29 10:00:00'), '2026-09-29');
});

test('fechaCorta no rompe con valores vacíos o nulos', () => {
  assert.doesNotThrow(() => util.fechaCorta(null));
  assert.equal(typeof util.fechaCorta(null), 'string');
  assert.equal(typeof util.fechaCorta(''), 'string');
});

test('fechaCorta respeta el día real del calendario', () => {
  assert.equal(util.fechaCorta(new Date(2026, 1, 28)), '2026-02-28');
  assert.equal(util.fechaCorta(new Date(2026, 11, 31)), '2026-12-31');
});
