'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extraerToken } = require('../../services/shared/tokens');

test('los microservicios aceptan QR de entradas con y sin guiones en el codigo', () => {
  assert.equal(extraerToken('JSP-ENTRY001-ABCD1234'), 'JSP-ENTRY001-ABCD1234');
  assert.equal(extraerToken('JSP|ENTRY001|ABCD1234|1730'), 'JSP-ENTRY001-ABCD1234');
  assert.equal(extraerToken('JSP-CARLOS-20261210-01-ABCD1234'), 'JSP-CARLOS-20261210-01-ABCD1234');
  assert.equal(extraerToken('JSP|CARLOS-20261210-01|ABCD1234|1730'), 'JSP-CARLOS-20261210-01-ABCD1234');
});

test('los microservicios rechazan tokens mal formados', () => {
  assert.equal(extraerToken('JSP-ENTRY001-ABCD1234-basura'), null);
  assert.equal(extraerToken('JSP|ENTRY001|no-es-un-nonce|1730'), null);
  assert.equal(extraerToken('JSP|ENTRY001|ABCD1234-basura|1730'), null);
  assert.equal(extraerToken('JSP-ENTRY001'), null);
});
