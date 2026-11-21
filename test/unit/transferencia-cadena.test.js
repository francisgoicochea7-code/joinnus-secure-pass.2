'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PostgresEntradaRepository } = require('../../services/tickets/src/adapters/postgres/entrada-repository');
const { enriquecer } = require('../../services/tickets/src/domain/entrada');
const { crearValidarPuerta } = require('../../services/tickets/src/application/validar-puerta');
const { validarTransferencia } = require('../../services/tickets/src/domain/transferencia');

test('una entrada recibida vigente es transferible solo para el titular de sesión', () => {
  const fila = {
    codigo: 'ENTRY001', titular_dni: '56428172', titular_nombre: 'Nora Bardales',
    estado: 'transferido', precio: 120, hora: '20:00:00', fecha: '2026-12-20'
  };
  assert.equal(enriquecer(fila, '56428172').puedeTransferir, true);
  assert.equal(enriquecer(fila, '12345678').puedeTransferir, false);
  for (const estado of ['usado', 'anulado']) {
    assert.equal(enriquecer({ ...fila, estado }, '56428172').puedeTransferir, false);
  }
  assert.equal(validarTransferencia({
    nombre: 'Otra Persona', dni: '12345678', correo: 'otro@example.org', precio: 121
  }, fila).campos.precio.includes('límite'), true);
});

test('la segunda transferencia bloquea la entrada y conserva el precio original', async () => {
  let liberado = false;
  const consultas = [];
  const repo = new PostgresEntradaRepository({ connect: async () => ({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: 1, titular_id: 2,
        titular_nombre: 'Nora Bardales', titular_dni: '56428172', estado: 'transferido' }] };
      return { rows: [] };
    },
    release: () => { liberado = true; }
  }) });
  const res = await repo.transferir({ codigo: 'ENTRY001', dniSolicitante: '56428172',
    usuarioNuevoId: 3, nombre: 'Tercera Persona', dni: '12345678', correo: 'tercero@example.org',
    precio: 70, precioOriginal: 120, codigoOperacion: 'TRF-12345678'
  });
  assert.equal(res.titularAnterior, 'Nora Bardales');
  assert.ok(consultas.some(q => q.sql.includes('FOR UPDATE')));
  assert.ok(consultas.some(q => q.sql.includes("estado = 'transferido'") && q.sql.includes('qr_ultimo_token = NULL')));
  assert.ok(consultas.some(q => q.sql.includes('INSERT INTO transferencias') && q.params.includes(120)));
  assert.ok(consultas.some(q => q.sql.includes('INSERT INTO historial') && q.sql.includes("'transferido'")));
  assert.ok(liberado);
});

test('el ingreso y su historial se guardan juntos y solo para el titular y QR actuales', async () => {
  const consultas = [];
  const repo = new PostgresEntradaRepository({ connect: async () => ({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (sql.includes('UPDATE entradas')) return { rows: [{ id: 1, titular_nombre: 'Nora Bardales' }] };
      return {};
    },
    release: () => {}
  }) });
  assert.equal(await repo.registrarIngreso('ENTRY001', '56428172', 'Ana Torres', 'JSP-ENTRY001-ABCDEF12'), true);
  const escritura = consultas.find(q => q.sql.includes('UPDATE entradas'));
  assert.match(escritura.sql, /estado IN \('valido', 'transferido'\)/);
  assert.match(escritura.sql, /qr_ultimo_token = \$3/);
  assert.deepEqual(escritura.params, ['ENTRY001', '56428172', 'JSP-ENTRY001-ABCDEF12']);
  assert.ok(consultas.some(q => q.sql.includes('INSERT INTO historial') && q.params[2].includes('Ana Torres')));
  assert.equal(consultas.at(-1).sql, 'COMMIT');
});

test('si otro encargado ya registró el ingreso, no se duplica el historial', async () => {
  const consultas = [];
  const repo = new PostgresEntradaRepository({ connect: async () => ({
    query: async sql => {
      consultas.push(sql);
      return sql.includes('UPDATE entradas') ? { rows: [] } : {};
    }, release: () => {}
  }) });
  assert.equal(await repo.registrarIngreso('ENTRY001', '56428172', 'Luis Paredes'), false);
  assert.ok(!consultas.some(sql => sql.includes('INSERT INTO historial')));
  assert.equal(consultas.at(-1), 'ROLLBACK');
});

test('puerta rechaza un QR vigente de un titular anterior aunque qr-service no lo haya invalidado', async () => {
  let ingresos = 0;
  const validar = crearValidarPuerta({
    entradaRepo: {
      obtenerPorCodigo: async () => ({ codigo: 'ENTRY001', estado: 'transferido',
        titular_dni: '56428172', qr_ultimo_token: 'JSP-ENTRY001-ABCDEF12', hora: '20:00', precio: 120 }),
      registrarIngreso: async () => { ingresos++; return true; }
    },
    historialRepo: { registrar: async () => { throw new Error('No se debe registrar'); } },
    authClient: { verificarEncargado: async () => ({ nombre: 'Ana Torres' }) },
    qrClient: { validar: async () => ({ valido: true, codigo: 'ENTRY001', titularDni: '45678945' }) },
    logger: { warn: () => {} }
  });
  const respuesta = await validar({ datos: { encargado: 'Ana Torres', codigo: 'privado',
    token: 'JSP-ENTRY001-ABCDEF12', registrar: true } });
  assert.equal(respuesta.valido, false);
  assert.equal(respuesta.motivo, 'titular');
  assert.equal(ingresos, 0);
});
