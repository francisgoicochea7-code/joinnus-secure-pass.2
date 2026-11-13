'use strict';

/* Pruebas unitarias de la validación de una transferencia. */

process.env.QR_SECRET = 'secreto-de-pruebas-con-mas-de-16-caracteres';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { util } = require('../../backend/index');

const ENTRADA = { precio: 120 };

function datos(extra = {}) {
  return {
    nombre: 'Diego Vargas',
    dni: '47258963',
    correo: 'diego.vargas@demo.pe',
    precio: '100',
    ...extra
  };
}

test('una transferencia correcta devuelve ok y los datos normalizados', () => {
  const r = util.validarTransferencia(datos(), ENTRADA);
  assert.equal(r.ok, true);
  assert.equal(r.nombre, 'Diego Vargas');
  assert.equal(r.dni, '47258963');
  assert.equal(r.correo, 'diego.vargas@demo.pe');
  assert.equal(r.precio, 100);
});

test('el nombre es obligatorio', () => {
  const r = util.validarTransferencia(datos({ nombre: '   ' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.nombre, /obligatorio/i);
});

test('el nombre exige al menos 5 caracteres', () => {
  const r = util.validarTransferencia(datos({ nombre: 'Ana' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.nombre, /5 caracteres/i);
});

test('el nombre exige nombre y apellido', () => {
  const r = util.validarTransferencia(datos({ nombre: 'Diego' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.nombre, /apellido/i);
});

test('el nombre no admite números ni símbolos', () => {
  const r = util.validarTransferencia(datos({ nombre: 'Diego 123' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.nombre, /letras/i);
});

test('el DNI es obligatorio', () => {
  const r = util.validarTransferencia(datos({ dni: '' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.dni, /obligatorio/i);
});

test('el DNI debe tener exactamente 8 números', () => {
  const r = util.validarTransferencia(datos({ dni: '1234567' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.dni, /8 números/i);
});

test('el correo es obligatorio y debe tener formato válido', () => {
  const vacio = util.validarTransferencia(datos({ correo: '' }), ENTRADA);
  assert.match(vacio.campos.correo, /obligatorio/i);
  const malo = util.validarTransferencia(datos({ correo: 'diego.demo.pe' }), ENTRADA);
  assert.match(malo.campos.correo, /válido/i);
});

test('el precio es obligatorio', () => {
  const r = util.validarTransferencia(datos({ precio: '' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.precio, /precio/i);
});

test('el precio no puede ser negativo', () => {
  const r = util.validarTransferencia(datos({ precio: '-1' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.precio, /número válido/i);
});

test('el precio no puede superar el de la entrada', () => {
  const r = util.validarTransferencia(datos({ precio: '120.01' }), ENTRADA);
  assert.equal(r.ok, false);
  assert.match(r.campos.precio, /límite/i);
});

test('se admite transferir por 0 soles (regalo)', () => {
  const r = util.validarTransferencia(datos({ precio: '0' }), ENTRADA);
  assert.equal(r.ok, true);
  assert.equal(r.precio, 0);
});

test('se admite transferir justo por el precio máximo', () => {
  const r = util.validarTransferencia(datos({ precio: '120' }), ENTRADA);
  assert.equal(r.ok, true);
  assert.equal(r.precio, 120);
});

test('varios errores se informan todos juntos', () => {
  const r = util.validarTransferencia(
    { nombre: '', dni: '1', correo: 'x', precio: '999' }, ENTRADA);
  assert.equal(r.ok, false);
  assert.ok(r.campos.nombre);
  assert.ok(r.campos.dni);
  assert.ok(r.campos.correo);
  assert.ok(r.campos.precio);
});
