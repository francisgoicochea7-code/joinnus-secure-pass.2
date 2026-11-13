'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '../..');

for (const carpeta of ['', 'backend']) {
  test(`dependencias PostgreSQL coherentes en ${carpeta || 'raíz'}`, () => {
    const leer = nombre => JSON.parse(fs.readFileSync(path.join(raiz, carpeta, nombre), 'utf8'));
    const paquete = leer('package.json');
    const lock = leer('package-lock.json');

    assert.ok(paquete.dependencies.pg);
    assert.equal(paquete.dependencies.mysql2, undefined);
    assert.equal(lock.packages[''].dependencies.pg, paquete.dependencies.pg);
    assert.ok(lock.packages['node_modules/pg']);
    assert.equal(lock.packages['node_modules/mysql2'], undefined);
  });
}

test('los scripts de la raíz pueden resolver el driver PostgreSQL', () => {
  assert.ok(require.resolve('pg', { paths: [raiz] }));
});
