'use strict';

/* Pruebas unitarias de la traducción de marcadores SQL. */

process.env.QR_SECRET = 'secreto-de-pruebas-con-mas-de-16-caracteres';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { util } = require('../../backend/index');

test('pgSql numera los marcadores en orden', () => {
  assert.equal(
    util.pgSql('SELECT * FROM usuarios WHERE dni = ? AND nombre = ?'),
    'SELECT * FROM usuarios WHERE dni = $1 AND nombre = $2'
  );
});

test('pgSql no cambia una consulta sin marcadores', () => {
  const sql = 'SELECT COUNT(*) FROM entradas';
  assert.equal(util.pgSql(sql), sql);
});

test('pgSql numera a través de varias líneas', () => {
  assert.equal(
    util.pgSql('INSERT INTO t (a, b, c)\nVALUES (?, ?, ?)\nRETURNING id'),
    'INSERT INTO t (a, b, c)\nVALUES ($1, $2, $3)\nRETURNING id'
  );
});

test('pgSql conserva los signos de interrogación repetidos', () => {
  assert.equal(util.pgSql('SELECT ? + ? AS suma'), 'SELECT $1 + $2 AS suma');
});
