'use strict';
/* global __dirname */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function createClient(fetchImpl) {
  const source = fs.readFileSync(path.join(__dirname, '../src/api/client.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const storage = new Map();
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(id) {
      if (id === '@react-native-async-storage/async-storage') return { default: {
        getItem: async (key) => storage.get(key) || null,
        setItem: async (key, value) => { storage.set(key, value); },
      } };
      if (id === 'expo-constants') return { default: {} };
      throw new Error(`Modulo inesperado: ${id}`);
    },
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    process: { env: {} },
    __DEV__: false,
  }, { filename: 'mobile/src/api/client.ts' });
  return exports;
}

function reply(status, data) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

test('modo puerta muestra el rechazo de negocio HTTP 200 en vez de lanzar error', async () => {
  const client = createClient(async () => reply(200, {
    ok: false, valido: false, motivo: 'usado', mensaje: 'Entrada ya utilizada',
  }));
  const result = await client.api.staffValidate({ nombre: 'Ana', codigo: 'ABC' }, 'ENTRY001', true);
  assert.equal(result.valido, false);
  assert.equal(result.motivo, 'usado');
});

test('un error HTTP del personal sigue siendo un error, no un resultado de acceso', async () => {
  const client = createClient(async () => reply(401, { ok: false, error: 'Codigo incorrecto' }));
  await assert.rejects(client.api.staffValidate({ nombre: 'Ana', codigo: 'ABC' }, 'ENTRY001'),
    (error) => error.status === 401);
});

test('ok:false sigue siendo error para el resto de la API', async () => {
  const client = createClient(async () => reply(200, { ok: false, error: 'Operacion rechazada' }));
  await assert.rejects(client.api.health(), (error) => error.message === 'Operacion rechazada');
});

test('un 401 de usuario cierra la sesion, pero el codigo incorrecto del personal no', async () => {
  const requests = [];
  const client = createClient(async (url, options) => {
    requests.push({ url, options });
    return reply(401, { ok: false, error: 'No autorizado' });
  });
  let unauthorized = 0;
  client.setUnauthorizedHandler(() => { unauthorized++; });
  client.setSessionToken('token-usuario');

  await assert.rejects(client.api.staffLogin('Ana', 'incorrecto'));
  assert.equal(unauthorized, 0);
  assert.equal(requests[0].options.headers.Authorization, undefined);

  await assert.rejects(client.api.summary());
  assert.equal(unauthorized, 1);
  assert.equal(requests[1].options.headers.Authorization, 'Bearer token-usuario');
});

test('sin red avisa con un mensaje claro y reintenta una lectura', async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    throw new TypeError('Network request failed');
  });

  await assert.rejects(
    client.api.health(),
    (error) => error.code === 'network' && /conexion/i.test(error.message)
  );
  assert.equal(calls, 2);
});

test('un timeout se informa como tal y tambien se reintenta en lecturas', async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    throw abort;
  });

  await assert.rejects(client.api.health(), (error) => error.code === 'timeout');
  assert.equal(calls, 2);
});

test('un POST no se reintenta para no duplicar transferencias o ingresos', async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    throw new TypeError('Network request failed');
  });

  await assert.rejects(
    client.api.transfer('ENTRY001', { nombre: 'Maria', dni: '41234567', correo: 'maria@correo.com', precio: 10 }),
    (error) => error.code === 'network'
  );
  assert.equal(calls, 1);
});
