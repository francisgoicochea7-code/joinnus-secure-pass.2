'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: siguienteTurno } = require('node:timers/promises');
const { crearContexto, cargarJs, cargarPagina, evaluar } = require('../dom-sim');

const PROPIA = {
  codigo: 'ENTRY001', evento: 'Evento privado', dni: '45678945', titular: 'Carlos Pérez',
  estado: 'valido', esMia: true, puedeTransferir: true, estadoDetalle: { etiqueta: 'Válida' },
  fecha: '2026-12-01', hora: '20:00', lugar: 'Recinto privado', zona: 'A', fila: 'B', asiento: '1', precio: 100
};

async function pagina({ dni = '', entradas = [PROPIA], codigo = '', listar, historial } = {}) {
  const ctx = crearContexto();
  let identidad = dni;
  const cambios = [];
  const llamadas = { listar: 0, consultar: 0, historial: [], transferir: 0, modales: [] };
  ctx.sandbox.Sesion = {
    estaIdentificado: () => Boolean(identidad),
    dni: () => identidad || null,
    alCambiar: fn => cambios.push(fn)
  };
  ctx.sandbox.SecurePassAPI = {
    listarMisEntradas: async () => { llamadas.listar++; return listar ? listar() : entradas; },
    consultarEntrada: async () => { llamadas.consultar++; return PROPIA; },
    obtenerHistorial: async (...args) => { llamadas.historial.push(args); return historial ? historial() : []; },
    transferirEntrada: async () => { llamadas.transferir++; return { ok: true }; }
  };
  ctx.sandbox.JSP = {
    parametro: () => codigo,
    escapeHtml: v => String(v == null ? '' : v),
    estadoBadge: () => '<span>Válida</span>',
    formatFechaLarga: () => '1 de diciembre', formatFecha: () => '01/12', precio: v => 'S/ ' + v,
    ocultarDNI: () => '********45', icon: () => '', pintarModo: () => {}, toast: () => {},
    cerrarModal: id => llamadas.modales.push(['cerrar', id]),
    abrirModal: id => llamadas.modales.push(['abrir', id])
  };
  cargarPagina(ctx, 'frontend/transferencia.html', ['frontend/js/transferencia.js']);
  await siguienteTurno();
  return { ...ctx, llamadas, cambiarSesion: nuevo => { identidad = nuevo; cambios.forEach(fn => fn()); } };
}

test('sin sesion no consulta ni muestra entradas o transferencias, incluso con codigo en URL', async () => {
  const ctx = await pagina({ codigo: 'ENTRY001' });
  const doc = ctx.document;
  assert.equal(ctx.llamadas.listar, 0);
  assert.equal(ctx.llamadas.consultar, 0);
  assert.equal(ctx.llamadas.historial.length, 0);
  assert.equal(doc.getElementById('detalle-entrada').innerHTML, '');
  assert.ok(doc.getElementById('card-entrada').classList.contains('hide'));
  assert.ok(doc.getElementById('entrada-transferir').disabled);
  assert.match(doc.getElementById('transferencia-aviso-titulo').textContent, /Identifícate/);
  assert.ok(!doc.getElementById('ultimas-transferencias').innerHTML.includes('ENTRY'));
});

test('escribir un DNI sin iniciar sesion no abre el formulario ni transfiere', async () => {
  const ctx = await pagina();
  const campo = ctx.document.getElementById('dni-titular');
  campo.value = '45678945';
  campo._fire('input');
  ctx.document.getElementById('btn-continuar')._fire('click');
  ctx.document.getElementById('btn-confirmar')._fire('click');
  await siguienteTurno();
  assert.equal(ctx.llamadas.transferir, 0);
  assert.ok(!ctx.llamadas.modales.some(([accion]) => accion === 'abrir'));
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
});

test('el selector muestra entradas propias vigentes, incluso recibidas, y confirma el DNI de la sesion', async () => {
  const ctx = await pagina({ dni: PROPIA.dni, entradas: [
    PROPIA,
    { ...PROPIA, codigo: 'AJENA', dni: '52311878', esMia: false },
    { ...PROPIA, codigo: 'SINPERTENENCIA', esMia: undefined },
    { ...PROPIA, codigo: 'USADA', estado: 'usado' },
    { ...PROPIA, codigo: 'ANULADA', estado: 'anulado' },
    { ...PROPIA, codigo: 'TRANSFERIDA', estado: 'transferido' }
  ] });
  const doc = ctx.document;
  assert.match(doc.getElementById('detalle-entrada').innerHTML, /Evento privado/);
  const selector = doc.getElementById('entrada-transferir').innerHTML;
  assert.match(selector, /ENTRY001/);
  assert.match(selector, /TRANSFERIDA/);
  for (const codigo of ['AJENA', 'SINPERTENENCIA', 'USADA', 'ANULADA']) assert.ok(!selector.includes(codigo));
  assert.deepEqual(ctx.llamadas.historial, [[null, PROPIA.dni]]);
  assert.ok(doc.getElementById('btn-abrir-transferencia').disabled);
  const campo = doc.getElementById('dni-titular');
  campo.value = '52311878'; campo._fire('input');
  assert.ok(doc.getElementById('btn-abrir-transferencia').disabled);
  campo.value = PROPIA.dni; campo._fire('input');
  assert.equal(doc.getElementById('btn-abrir-transferencia').disabled, false);
});

test('un codigo ajeno por URL no se consulta ni se incluye en el selector', async () => {
  const ctx = await pagina({ dni: PROPIA.dni, codigo: 'ENTRY005' });
  assert.equal(ctx.llamadas.consultar, 0);
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
  assert.ok(!ctx.document.getElementById('entrada-transferir').innerHTML.includes('ENTRY005'));
  assert.match(ctx.document.getElementById('transferencia-aviso-titulo').textContent, /no disponible/);
});

test('una cuenta sin entradas no recibe una entrada de demostracion por defecto', async () => {
  const ctx = await pagina({ dni: '77665544', entradas: [] });
  assert.equal(ctx.llamadas.consultar, 0);
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
  assert.match(ctx.document.getElementById('transferencia-aviso-titulo').textContent, /No tienes entradas/);
});

test('la entrada recibida por transferencia aparece y permite iniciar otra transferencia', async () => {
  const recibida = { ...PROPIA, codigo: 'RECIBIDA', estado: 'transferido',
    titularAnterior: 'Titular anterior', esMia: true, puedeTransferir: true };
  const ctx = await pagina({ dni: PROPIA.dni, entradas: [recibida], codigo: 'RECIBIDA' });
  assert.match(ctx.document.getElementById('detalle-entrada').innerHTML, /RECIBIDA/);
  const dni = ctx.document.getElementById('dni-titular');
  dni.value = PROPIA.dni;
  dni._fire('input');
  assert.equal(ctx.document.getElementById('btn-abrir-transferencia').disabled, false);
});

test('un error de carga mantiene oculto el detalle y ofrece iniciar sesion', async () => {
  const ctx = await pagina({ dni: PROPIA.dni, listar: async () => { throw new Error('sin conexion'); } });
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
  assert.ok(ctx.document.getElementById('card-entrada').classList.contains('hide'));
  assert.equal(ctx.document.getElementById('btn-identificar-transferencia').classList.contains('hide'), false);
});

test('cerrar sesion borra el detalle y el modal sin dejar pintar respuestas pendientes', async () => {
  let resolver;
  const ctx = await pagina({ dni: PROPIA.dni, listar: () => new Promise(r => { resolver = r; }) });
  ctx.cambiarSesion('');
  resolver([PROPIA]);
  await siguienteTurno();
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
  assert.ok(ctx.document.getElementById('card-entrada').classList.contains('hide'));
  assert.ok(ctx.llamadas.modales.some(([accion, id]) => accion === 'cerrar' && id === 'modal-transferencia'));
});

test('cambiar a otro usuario elimina los datos de la sesion anterior', async () => {
  const ctx = await pagina({ dni: PROPIA.dni });
  assert.match(ctx.document.getElementById('detalle-entrada').innerHTML, /Evento privado/);
  ctx.cambiarSesion('52311878');
  await siguienteTurno();
  assert.equal(ctx.document.getElementById('detalle-entrada').innerHTML, '');
  assert.ok(!ctx.document.getElementById('entrada-transferir').innerHTML.includes('ENTRY001'));
});

test('un rechazo HTTP de la API no se sustituye por entradas o historial locales', async () => {
  const ctx = crearContexto();
  const rechazo = async () => { throw Object.assign(new Error('sesion requerida'), { status: 401 }); };
  ctx.sandbox.ClienteAPI = {
    comprobar: async () => true,
    consultarEntrada: rechazo, listarEntradas: rechazo, obtenerHistorial: rechazo
  };
  cargarJs(ctx, 'frontend/js/api.js');
  const api = evaluar(ctx, 'SecurePassAPI');
  assert.equal(await api.consultarEntrada('ENTRY001'), null);
  assert.equal((await api.listarMisEntradas()).length, 0);
  assert.equal((await api.obtenerHistorial()).length, 0);
});
