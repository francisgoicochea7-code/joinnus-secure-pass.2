'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  HASH_RELLENO,
  passwordValida,
  hashPassword,
  verifyPassword
} = require('../../services/shared/password');

test('el hash guardado usa el formato scrypt con sal y coste', () => {
  const hash = hashPassword('Carlos2026!');
  const partes = hash.split('$');
  assert.equal(partes.length, 6);
  assert.equal(partes[0], 'scrypt');
  assert.equal(partes[1], '16384');
  assert.equal(partes[2], '8');
  assert.equal(partes[3], '1');
  assert.ok(partes[4].length >= 16, 'la sal debe tener entropía suficiente');
  assert.ok(partes[5].length >= 64, 'el hash debe tener al menos 64 caracteres');
  assert.ok(!hash.includes('Carlos2026!'), 'la contraseña no puede quedar en claro');
});

test('la misma contraseña genera hashes distintos (sal aleatoria)', () => {
  const a = hashPassword('ClaveSegura1');
  const b = hashPassword('ClaveSegura1');
  assert.notEqual(a, b);
  assert.ok(verifyPassword('ClaveSegura1', a));
  assert.ok(verifyPassword('ClaveSegura1', b));
});

test('verifyPassword acepta la contraseña correcta y rechaza el resto', () => {
  const hash = hashPassword('Demo2026!');
  assert.equal(verifyPassword('Demo2026!', hash), true);
  assert.equal(verifyPassword('demo2026!', hash), false);
  assert.equal(verifyPassword('Demo2026', hash), false);
  assert.equal(verifyPassword('', hash), false);
});

test('un hash mal formado o vacío nunca valida', () => {
  assert.equal(verifyPassword('x', null), false);
  assert.equal(verifyPassword('x', ''), false);
  assert.equal(verifyPassword('x', 'texto-plano'), false);
  assert.equal(verifyPassword('x', 'scrypt$16384$8$1$sal'), false);
  assert.equal(verifyPassword('x', 'bcrypt$16384$8$1$c2Fs$aGFzaA'), false);
  assert.equal(verifyPassword('x', HASH_RELLENO), false);
});

test('passwordValida exige entre 8 y 200 caracteres', () => {
  assert.equal(passwordValida('').ok, false);
  assert.equal(passwordValida('1234567').ok, false);
  assert.equal(passwordValida('12345678').ok, true);
  assert.equal(passwordValida('a'.repeat(200)).ok, true);
  assert.equal(passwordValida('a'.repeat(201)).ok, false);
  assert.match(passwordValida('1234567').mensaje, /8 caracteres/);
});

test('las cuentas de demostración guardadas en auth.sql verifican su contraseña', () => {
  // Un hash real del archivo de semillas (Carlos Pérez).
  const guardado = 'scrypt$16384$8$1$MLkhByupLKVhaC8a08NyHw$tZt0xqQKM8Q9xtknOz85UDxp2RTQNZWwAwuVbYyTSSNBk8UZkGajtAL3UvDd_2ighImAPxzs7LzwrIdSzX494A';
  assert.equal(verifyPassword('Carlos2026!', guardado), true);
  assert.equal(verifyPassword('otra', guardado), false);
});
