'use strict';

/* Pruebas unitarias de las funciones de seguridad del backend.
 * No tocan la base de datos: sólo se importan funciones puras. */

process.env.QR_SECRET = 'secreto-de-pruebas-con-mas-de-16-caracteres';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { util } = require('../../backend/index');

const HASH_ANA = '05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083';

test('ocultarDNI conserva la longitud y los dos últimos dígitos', () => {
  const oculto = util.ocultarDNI('45678945');
  assert.equal(oculto.length, 10);
  assert.equal(oculto.slice(-2), '45');
  assert.ok(!oculto.includes('6789'), 'no debe mostrar los dígitos del medio');
});

test('ocultarDNI devuelve la máscara completa si el DNI es muy corto', () => {
  assert.equal(util.ocultarDNI('123'), '********');
  assert.equal(util.ocultarDNI(''), '********');
});

test('hashCodigoEncargado coincide con el hash sembrado en init.sql', () => {
  assert.equal(util.hashCodigoEncargado('Ana Torres', 'ANA2026'), HASH_ANA);
});

test('hashCodigoEncargado normaliza el nombre y el código', () => {
  assert.equal(
    util.hashCodigoEncargado('  ANA   TORRES ', 'ana2026'),
    HASH_ANA,
    'el nombre va sin mayúsculas ni espacios dobles y el código en mayúsculas'
  );
});

test('hashCodigoEncargado cambia si cambia el código', () => {
  assert.notEqual(
    util.hashCodigoEncargado('Ana Torres', 'ANA2026'),
    util.hashCodigoEncargado('Ana Torres', 'ANA2027')
  );
});

test('firmarToken es determinista y devuelve 32 caracteres hexadecimales', () => {
  const expira = new Date(2026, 10, 3, 17, 30, 0);
  const a = util.firmarToken('ENTRY001', 'A1B2C3D4', expira);
  const b = util.firmarToken('ENTRY001', 'A1B2C3D4', expira);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test('firmarToken cambia con el nonce, el código o el vencimiento', () => {
  const expira = new Date(2026, 10, 3, 17, 30, 0);
  const base = util.firmarToken('ENTRY001', 'A1B2C3D4', expira);
  assert.notEqual(base, util.firmarToken('ENTRY001', 'A1B2C3D5', expira));
  assert.notEqual(base, util.firmarToken('ENTRY002', 'A1B2C3D4', expira));
  assert.notEqual(base, util.firmarToken('ENTRY001', 'A1B2C3D4', new Date(2026, 10, 3, 17, 30, 1)));
});

test('firmarToken acepta Date o marca de tiempo equivalente', () => {
  const fecha = new Date(2026, 10, 3, 17, 30, 0);
  assert.equal(
    util.firmarToken('ENTRY001', 'A1B2C3D4', fecha),
    util.firmarToken('ENTRY001', 'A1B2C3D4', fecha.getTime())
  );
});

test('generarToken devuelve un token con formato y una firma verificable', () => {
  const t = util.generarToken('ENTRY001');
  assert.match(t.token, /^JSP-ENTRY001-[0-9A-F]{8}$/);
  assert.equal(t.firma.length, 32);
  assert.equal(util.firmarToken('ENTRY001', t.nonce, t.expiraEn), t.firma);
});

test('generarToken usa un nonce distinto en cada llamada', () => {
  const a = util.generarToken('ENTRY001');
  const b = util.generarToken('ENTRY001');
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.firma, b.firma);
});

test('extraerToken reconoce el token directo y el payload del QR', () => {
  assert.equal(util.extraerToken('JSP-ENTRY001-ABCD1234'), 'JSP-ENTRY001-ABCD1234');
  assert.equal(util.extraerToken('jsp-entry001-abcd1234'), 'JSP-ENTRY001-ABCD1234');
  assert.equal(util.extraerToken('JSP|ENTRY001|ABCD1234|1730'), 'JSP-ENTRY001-ABCD1234');
});

test('extraerToken rechaza textos que no son tokens', () => {
  assert.equal(util.extraerToken(''), null);
  assert.equal(util.extraerToken('ENTRY001'), null);
  assert.equal(util.extraerToken('JSP-ENTRY001'), null);
  assert.equal(util.extraerToken('otro|formato|raro'), null);
});

test('firmasIguales acepta la firma correcta y rechaza cualquier cambio', () => {
  const firma = util.firmarToken('ENTRY001', 'A1B2C3D4', new Date(2026, 10, 3, 17, 30, 0));
  assert.equal(util.firmasIguales(firma, firma), true);
  assert.equal(util.firmasIguales(firma, firma.slice(0, -1) + '0'), false);
  assert.equal(util.firmasIguales(firma, ''), false);
  assert.equal(util.firmasIguales(null, undefined), true, 'dos valores vacíos son iguales');
});

test('internalAuth compara el token interno en tiempo constante', () => {
  const { internalAuth, igualesEnTiempoConstante } = require('../../services/shared/internal-auth');
  assert.equal(igualesEnTiempoConstante('abc', 'abc'), true);
  assert.equal(igualesEnTiempoConstante('abc', 'abd'), false);
  assert.equal(igualesEnTiempoConstante('abc', 'abcd'), false, 'la longitud no debe dar igual');

  const respuesta = () => ({
    codigo: 200,
    status(codigo) { this.codigo = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; }
  });

  let siguiente = false;
  const resMalo = respuesta();
  internalAuth('token-interno-de-prueba')({ get: () => 'otro-token' }, resMalo, () => { siguiente = true; });
  assert.equal(siguiente, false, 'un token distinto no debe pasar');
  assert.equal(resMalo.codigo, 401);

  const resBueno = respuesta();
  internalAuth('token-interno-de-prueba')({ get: () => 'token-interno-de-prueba' }, resBueno, () => { siguiente = true; });
  assert.equal(siguiente, true, 'el token correcto debe pasar');
});
