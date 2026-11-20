'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { verifyPassword } = require('../../services/shared/password');

const script = path.join(__dirname, '../../scripts/contrasena.js');

function ejecutar(...args) {
  // Las operaciones inválidas deben fallar antes de intentar conectarse.
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/invalid' },
    timeout: 15000
  });
}

test('contrasena muestra ayuda sin conectarse a la base', () => {
  const resultado = ejecutar('--ayuda');
  assert.equal(resultado.status, 0);
  assert.match(resultado.stdout, /Uso:/);
});

test('contrasena genera un hash válido sin conectarse a la base', () => {
  const resultado = ejecutar('--hash', 'Prueba2026!');
  assert.equal(resultado.status, 0);
  const hash = resultado.stdout.split(/\r?\n/).find(linea => linea.startsWith('scrypt$'));
  assert.ok(verifyPassword('Prueba2026!', hash));
  assert.ok(!resultado.stdout.includes('Prueba2026!'));
});

test('contrasena rechaza claves fuera del límite antes de conectarse', () => {
  for (const clave of ['corta', 'x'.repeat(201)]) {
    const resultado = ejecutar('45678945', clave);
    assert.equal(resultado.status, 1);
    assert.match(resultado.stderr, /entre 8 y 200/);
    assert.ok(!resultado.stderr.includes(clave));
  }
});

test('contrasena rechaza DNI inválido antes de conectarse', () => {
  const resultado = ejecutar('--verificar', '123', 'Prueba2026!');
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /8 números/);
});

test('contrasena rechaza opciones desconocidas antes de conectarse', () => {
  const resultado = ejecutar('--opcion-inexistente');
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /Opción no reconocida/);
});

test('contrasena rechaza argumentos de más o ausentes', () => {
  for (const args of [
    ['--listar', 'extra'],
    ['--hash'],
    ['--verificar', '45678945'],
    ['45678945', 'Prueba2026!', 'extra']
  ]) {
    const resultado = ejecutar(...args);
    assert.equal(resultado.status, 1);
    assert.match(resultado.stderr, /Uso:/);
  }
});
