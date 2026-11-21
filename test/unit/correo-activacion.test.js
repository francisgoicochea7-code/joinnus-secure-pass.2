'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCorreoActivacion } = require('../../services/auth/src/adapters/email/resend');
const { PostgresUsuarioRepository } = require('../../services/auth/src/adapters/postgres/usuario-repository');
const { crearTransferirEntrada } = require('../../services/tickets/src/application/transferir-entrada');
const { emitirCodigoActivacion, consumirCodigoActivacion } = require('../../backend/activacion');

test('sin configuración no se contacta a Resend ni se considera enviado', async () => {
  const correo = crearCorreoActivacion({ fetchImpl: () => { throw Error('No se debe llamar'); } });
  assert.equal(correo.habilitado, false);
  assert.equal(await correo.enviar({ dni: '12345678', correo: 'user@example.org', codigo: 'a'.repeat(32) }), false);
});

test('Resend recibe enlace privado sin contraseña y comprueba respuesta HTTP', async () => {
  let peticion;
  const correo = crearCorreoActivacion({
    apiKey: 'prueba', from: 'Entradas <acceso@example.org>',
    publicUrl: 'https://ejemplo.org',
    fetchImpl: async (...args) => { peticion = args; return { ok: true }; }
  });
  assert.equal(await correo.enviar({ dni: '12345678', correo: 'user@example.org', codigo: 'z'.repeat(32) }), true);
  assert.equal(peticion[0], 'https://api.resend.com/emails');
  const mensaje = JSON.parse(peticion[1].body);
  assert.deepEqual(mensaje.to, ['user@example.org']);
  assert.match(mensaje.text, /activar\.html#dni=12345678&codigo=z{32}/);
  assert.doesNotMatch(mensaje.text, /password_hash|contraseña temporal|Carlos2026!/);
  const fallido = crearCorreoActivacion({
    apiKey: 'prueba', from: 'acceso@example.org', publicUrl: 'https://ejemplo.org',
    fetchImpl: async () => ({ ok: false, status: 422 })
  });
  assert.equal(await fallido.enviar({ dni: '12345678', correo: 'user@example.org', codigo: 'z'.repeat(32) }), false);
});

test('el código solo puede emitirse y consumirse si aún no hay contraseña', async () => {
  const pool = { query: async (sql) => {
    assert.match(sql, /password_hash IS NULL/);
    if (sql.includes('RETURNING activacion_expira_en')) {
      assert.match(sql, /activacion_expira_en IS NULL OR activacion_expira_en <= CURRENT_TIMESTAMP/);
    }
    return { rows: sql.includes('RETURNING activacion_expira_en')
      ? [{ activacion_expira_en: new Date() }]
      : [{ id: 1 }] };
  } };
  assert.equal((await emitirCodigoActivacion(pool, '12345678')).codigo.length, 32);
  assert.equal((await consumirCodigoActivacion(pool, {
    dni: '12345678', codigo: 'z'.repeat(32), passwordHash: 'hash'
  })).id, 1);
});

test('el correo del DNI existente debe coincidir: no se sustituye por otro en una transferencia', async () => {
  const repo = new PostgresUsuarioRepository({ query: async sql => sql.includes('INSERT INTO')
    ? { rows: [] }
    : { rows: [{ id: 1, dni: '12345678', nombre: 'Titular Existente', correo: 'real@example.org', password_hash: null }] }
  });
  await assert.rejects(repo.upsert({ nombre: 'Otro Nombre', dni: '12345678', correo: 'ajeno@example.org' }),
    { status: 409, codigo: 'CORREO_DESTINATARIO_NO_COINCIDE' });
  const publico = await repo.upsert({ nombre: 'Otro Nombre', dni: '12345678', correo: 'REAL@example.org' });
  assert.equal(publico.correo, 'real@example.org');
  assert.equal('password_hash' in publico, false);
});

test('el correo se pide después de guardar la transferencia; si falla no se repite la transferencia', async () => {
  const orden = [];
  const fila = {
    id: 1, codigo: 'ENTRY001', estado: 'valido', titular_dni: '45678945',
    titular_nombre: 'Carlos Pérez', precio: 120, evento: 'Concierto'
  };
  const transferir = crearTransferirEntrada({
    entradaRepo: {
      obtenerPorCodigo: async () => fila,
      transferir: async () => { orden.push('transferencia'); },
      actualizarProyeccionQr: async () => {}
    },
    historialRepo: { registrar: async () => {} },
    authClient: {
      upsertUsuario: async () => ({ id: 2, nombre: 'Ana Maria Gomez', dni: '77665544', correo: 'ana@example.org' }),
      avisarTransferencia: async () => { orden.push('correo'); throw new Error('falló'); }
    },
    qrClient: { rotar: async () => ({ token: 'token', expiraEn: new Date() }) },
    logger: { warn: () => {} }
  });
  const resultado = await transferir({ codigo: 'ENTRY001', dniSolicitante: '45678945',
    datos: { nombre: 'Ana Maria Gomez', dni: '77665544', correo: 'ana@example.org', precio: 100 }
  });
  assert.deepEqual(orden, ['transferencia', 'correo']);
  assert.equal(resultado.activacionCorreo, 'pendiente');
});
