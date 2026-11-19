'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  FORMATO_CODIGO, emitirCodigoActivacion, consumirCodigoActivacion
} = require('../../backend/activacion');
const { crearActivarUsuario } = require('../../services/auth/src/application/activar-usuario');
const { verifyPassword } = require('../../services/shared/password');

const dni = '40000001';
const codigo = 'A'.repeat(32);
const password = 'Clave-de-prueba-2026';

test('el emisor guarda una huella y el código vence en veinte minutos', async () => {
  const expiraEn = new Date();
  let llamada;
  const pool = {
    async query(sql, params) {
      llamada = { sql, params };
      return { rows: [{ activacion_expira_en: expiraEn }] };
    }
  };
  const resultado = await emitirCodigoActivacion(pool, dni);

  assert.match(resultado.codigo, FORMATO_CODIGO);
  assert.deepEqual(llamada.params, [
    dni, crypto.createHash('sha256').update(resultado.codigo).digest('hex'), 20
  ]);
  assert.match(llamada.sql, /CURRENT_TIMESTAMP.*INTERVAL/);
  assert.equal(resultado.expiraEn, expiraEn);
});

test('la activación comprueba vigencia y consume el código en la misma escritura', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /SET password_hash = \$3,\s+activacion_hash = NULL/);
      assert.match(sql, /activacion_hash = \$2\s+AND activacion_expira_en > CURRENT_TIMESTAMP/);
      assert.deepEqual(params, [dni, crypto.createHash('sha256').update(codigo).digest('hex'), 'hash']);
      return { rows: [] };
    }
  };
  assert.equal(await consumirCodigoActivacion(pool, { dni, codigo, passwordHash: 'hash' }), null);
});

test('el caso de uso activa el perfil con la contraseña elegida', async () => {
  const perfil = { dni, nombre: 'Usuario de prueba' };
  const activar = crearActivarUsuario({
    usuarioRepo: {
      async activar(datos) {
        assert.equal(datos.dni, dni);
        assert.equal(datos.codigo, codigo);
        assert.equal(verifyPassword(password, datos.passwordHash), true);
        return perfil;
      }
    }
  });
  assert.deepEqual(await activar({ dni, codigo, password }), perfil);
});

test('formato inválido y código vencido reciben una respuesta de activación inválida', async () => {
  let consultas = 0;
  const activar = crearActivarUsuario({
    usuarioRepo: { async activar() { consultas += 1; return null; } }
  });
  await assert.rejects(activar({ dni, codigo: 'corto', password }), { codigo: 'ACTIVACION_INVALIDA' });
  assert.equal(consultas, 0);
  await assert.rejects(activar({ dni, codigo, password }), { codigo: 'ACTIVACION_INVALIDA' });
  assert.equal(consultas, 1);
});
