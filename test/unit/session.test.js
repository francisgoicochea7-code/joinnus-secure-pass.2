'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  TTL_DEFECTO,
  secretoValido,
  secretoDeEntorno,
  firmarSesion,
  verificarSesion
} = require('../../services/shared/session');
const { dniDePeticion, requerirDniDeSesion } = require('../../services/shared/validaciones');

const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';
const OTRO_SECRETO = 'otro-secreto-de-pruebas-con-mas-de-32-caracteres';

test('una operación privada exige una sesión vigente', () => {
  const sinSesion = { get: () => '' };
  assert.throws(() => requerirDniDeSesion(sinSesion, SECRETO), {
    status: 401, codigo: 'SESION_REQUERIDA'
  });

  const { token } = firmarSesion({ dni: '45678945', secreto: SECRETO });
  const conSesion = { get: () => 'Bearer ' + token };
  assert.equal(requerirDniDeSesion(conSesion, SECRETO), '45678945');
});

test('una sesión firmada se verifica y devuelve el DNI', () => {
  const { token, expiraEn } = firmarSesion({ dni: '45678945', secreto: SECRETO });
  const datos = verificarSesion(token, SECRETO);
  assert.ok(datos);
  assert.equal(datos.dni, '45678945');
  assert.ok(expiraEn > Date.now());
  assert.ok(datos.exp * 1000 === expiraEn);
});

test('el TTL configurable se respeta', () => {
  const ahora = 1_700_000_000_000;
  const { expiraEn } = firmarSesion({ dni: '45678945', secreto: SECRETO, ttlSegundos: 60, ahora });
  assert.equal(expiraEn, ahora + 60_000);
});

test('una firma con otro secreto no vale', () => {
  const { token } = firmarSesion({ dni: '45678945', secreto: SECRETO });
  assert.equal(verificarSesion(token, OTRO_SECRETO), null);
});

test('un token manipulado no vale', () => {
  const { token } = firmarSesion({ dni: '45678945', secreto: SECRETO });
  const [payload, firma] = token.split('.');
  const otroPayload = Buffer.from(JSON.stringify({ dni: '52311878', exp: 9999999999 }))
    .toString('base64url');
  assert.equal(verificarSesion(otroPayload + '.' + firma, SECRETO), null);
  assert.equal(verificarSesion(payload + '.' + firma.slice(0, -2) + 'AA', SECRETO), null);
  assert.equal(verificarSesion(payload, SECRETO), null);
  assert.equal(verificarSesion('', SECRETO), null);
  assert.equal(verificarSesion(token, ''), null);
});

test('un token caducado no vale', () => {
  const ahora = 1_700_000_000_000;
  const { token } = firmarSesion({ dni: '45678945', secreto: SECRETO, ttlSegundos: 10, ahora });
  assert.equal(verificarSesion(token, SECRETO, ahora + 10_000), null);
  assert.ok(verificarSesion(token, SECRETO, ahora + 9_000));
});

test('no se firma un DNI que no tiene 8 números', () => {
  assert.throws(() => firmarSesion({ dni: '123', secreto: SECRETO }), /DNI inválido/);
  assert.throws(() => firmarSesion({ dni: '45678945', secreto: 'corto' }), /SESSION_SECRET/);
});

test('secretoDeEntorno prefiere SESSION_SECRET y nunca usa un valor fijo', () => {
  assert.equal(secretoDeEntorno({}, ''), '');
  assert.equal(secretoDeEntorno({ INTERNAL_TOKEN: '' }, ''), '');
  assert.equal(secretoDeEntorno({ SESSION_SECRET: SECRETO }, 'x'), SECRETO);

  const derivado = secretoDeEntorno({ INTERNAL_TOKEN: 'token-interno-de-32-caracteres' }, '');
  assert.equal(derivado.length, 64);
  assert.equal(derivado, secretoDeEntorno({ INTERNAL_TOKEN: 'token-interno-de-32-caracteres' }, ''));
  assert.equal(secretoValido(derivado), true);

  const conRespaldo = secretoDeEntorno({}, 'qr-secret-de-mas-de-16');
  assert.equal(secretoValido(conRespaldo), true);
});

test('el TTL por defecto es de 8 horas', () => {
  assert.equal(TTL_DEFECTO, 8 * 60 * 60);
});

test('dniDePeticion usa el token y ya no confía en X-Usuario-DNI', () => {
  const { token } = firmarSesion({ dni: '45678945', secreto: SECRETO });
  const conToken = {
    get: (cabecera) => (cabecera === 'Authorization' ? 'Bearer ' + token : '')
  };
  assert.equal(dniDePeticion(conToken, '11111111', SECRETO), '45678945');

  const soloCabecera = {
    get: (cabecera) => (cabecera === 'X-Usuario-DNI' ? '52311878' : '')
  };
  assert.equal(dniDePeticion(soloCabecera, '11111111', SECRETO), '11111111',
    'sin token se atiende como el usuario demo, no como el DNI de la cabecera');

  const tokenFalso = {
    get: (cabecera) => (cabecera === 'Authorization' ? 'Bearer inventado.firma' : '')
  };
  assert.equal(dniDePeticion(tokenFalso, '11111111', SECRETO), '11111111');
});
