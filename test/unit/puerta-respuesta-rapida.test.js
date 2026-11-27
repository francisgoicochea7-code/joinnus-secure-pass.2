'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearValidarPuerta } = require('../../services/tickets/src/application/validar-puerta');

test('puerta responde tras guardar el ingreso sin esperar la limpieza de qr_db', async () => {
  let usado = false;
  let marcoToken = false;
  const validar = crearValidarPuerta({
    entradaRepo: {
      obtenerPorCodigo: async () => ({
        id: 1, codigo: 'ENTRY001', estado: usado ? 'usado' : 'valido',
        titular_dni: '45678945', titular_nombre: 'Carlos Pérez',
        qr_ultimo_token: 'JSP-ENTRY001-ABCDEF12', fecha: '2026-12-10', hora: '20:00', precio: 120
      }),
      registrarIngreso: async () => { usado = true; return true; }
    },
    authClient: { verificarEncargado: async () => ({ nombre: 'Encargado' }) },
    qrClient: {
      validar: async () => ({ valido: true, codigo: 'ENTRY001', titularDni: '45678945' }),
      marcarUsado: () => { marcoToken = true; return new Promise(() => {}); }
    },
    logger: { warn: () => {} }
  });

  const respuesta = await Promise.race([
    validar({ datos: { encargado: 'Encargado', codigo: 'privado',
      token: 'JSP-ENTRY001-ABCDEF12', registrar: true } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('La respuesta espero a qr_db')), 2000))
  ]);
  assert.equal(marcoToken, true);
  assert.equal(respuesta.valido, true);
  assert.equal(respuesta.registrado, true);
  assert.equal(respuesta.entrada.estado, 'usado');
});
