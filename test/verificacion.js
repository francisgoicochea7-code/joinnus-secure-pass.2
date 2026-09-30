/* =========================================================================
 * JOINNUS SECURE PASS - test/verificacion.js
 * Ejecuta los scripts reales de cada pagina dentro del micro-DOM y
 * comprueba todos los flujos del prototipo.
 *
 *   node test/verificacion.js
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { crearContexto, cargarJs, cargarPagina, evaluar } = require('./dom-sim');

const RAIZ = path.join(__dirname, '..');
const APP = path.join(RAIZ, 'frontend');
let pruebas = 0, fallos = 0;

function ok(cond, msg) {
  pruebas++;
  if (!cond) { fallos++; console.log('  [FALLA] ' + msg); }
}
function grupo(t) { console.log('\n== ' + t); }

const dormir = ms => new Promise(r => setTimeout(r, ms));

/** Espera a que una condicion sea cierta, sin afirmar nada por su cuenta.
 *  Sustituye a los `dormir(600)` fijos que se quedaban cortos al sumar la
 *  deteccion de la API. Devuelve false si se agota el tiempo. */
async function esperarHasta(condicion, ms, paso) {
  const limite = Date.now() + (ms || 3000);
  while (Date.now() < limite) {
    let okAhora = false;
    try { okAhora = !!condicion(); } catch (e) { okAhora = false; }
    if (okAhora) return true;
    await dormir(paso || 40);
  }
  return false;
}

/* Nombres con tilde usados en las comprobaciones */
const NOMBRES = {
  carlos: 'Carlos Pérez',
  andrea: 'Andrea Torres',
  valido: 'ENTRADA VÁLIDA',
  usado: 'ENTRADA UTILIZADA',
  anulado: 'ENTRADA ANULADA',
  transferido: 'ENTRADA TRANSFERIDA',
  limite: 'supera el límite permitido',
  invalido: 'invalidó'
};

/* ===================================================================== */
/* 1. Comprobacion estatica: rutas, ids y enlaces                       */
/* ===================================================================== */
function pruebasEstaticas() {
  grupo('1. Estructura del proyecto (frontend + docker)');

  const secciones = ['index.html', 'dashboard.html', 'verificar.html', 'entrada.html',
    'transferencia.html', 'historial.html', 'sobre.html'];
  secciones.forEach(p => ok(fs.existsSync(path.join(APP, p)), 'Falta la pagina frontend/' + p));

  ['css/styles.css', 'js/app.js', 'js/api.js', 'js/qr.js', 'js/cliente-api.js', 'js/home.js',
   'js/dashboard.js', 'js/verificar.js', 'js/entrada.js', 'js/transferencia.js',
   'js/historial.js', 'assets/favicon.svg', 'assets/logo.svg',
   'nginx.conf']
    .forEach(f => ok(fs.existsSync(path.join(APP, f)), 'Falta el archivo frontend/' + f));

  // Archivos de infraestructura Docker
  ['backend/index.js', 'backend/package.json', 'backend/Dockerfile', 'backend/.dockerignore',
   'database/init.sql', 'Dockerfile', 'docker-compose.yml', '.env.example', '.dockerignore',
   'README.md', 'server.js', 'package.json']
    .forEach(f => ok(fs.existsSync(path.join(RAIZ, f)), 'Falta el archivo ' + f));

  // docker-compose.yml debe declarar los tres servicios y sus puertos
  const compose = fs.readFileSync(path.join(RAIZ, 'docker-compose.yml'), 'utf8');
  ['mysql:', 'backend:', 'frontend:'].forEach(s =>
    ok(compose.includes(s), 'docker-compose.yml no declara el servicio ' + s));
  ['"${FRONTEND_PORT:-8080}:80"', '"${BACKEND_PORT:-3000}:3000"',
   './database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro',
   'condition: service_healthy', 'DB_HOST: mysql'].forEach(f =>
    ok(compose.includes(f), 'docker-compose.yml no contiene: ' + f));

  // Endpoints obligatorios en el backend
  const backend = fs.readFileSync(path.join(RAIZ, 'backend', 'index.js'), 'utf8');
  ['/api/health', '/api/entradas/:codigo', '/api/verificar/:codigo',
   '/api/entradas/:codigo/qr', '/api/qr/validar', '/api/entradas/:codigo/transferir',
   '/api/entradas/:codigo/historial', 'createHmac', 'multiples' === 'x' ? '' : 'mysql.createPool']
    .forEach(f => ok(backend.includes(f), 'backend/index.js no contiene: ' + f));

  // Tablas obligatorias en el esquema
  const sql = fs.readFileSync(path.join(RAIZ, 'database', 'init.sql'), 'utf8');
  ['usuarios', 'eventos', 'entradas', 'transferencias', 'historial', 'tokens_qr']
    .forEach(t => ok(sql.includes('CREATE TABLE IF NOT EXISTS ' + t),
      'database/init.sql no crea la tabla ' + t));
  ok((sql.match(/ENTRY00\d/g) || []).length >= 5, 'init.sql tiene menos de 5 entradas ficticias');

  // Enlaces y recursos locales de cada pagina del frontend
  const htmls = fs.readdirSync(APP).filter(f => f.endsWith('.html'));
  ok(htmls.length === 7, 'Se esperaban 7 paginas HTML, hay ' + htmls.length);
  htmls.forEach(pag => {
    const html = fs.readFileSync(path.join(APP, pag), 'utf8');
    const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(m => m[1])
      .filter(r => !/^(https?:|mailto:|data:|\/\/)/.test(r));
    refs.forEach(r => {
      const limpio = r.split('?')[0].split('#')[0];
      if (!limpio) return;
      ok(fs.existsSync(path.join(APP, limpio)), pag + ': enlace roto -> ' + limpio);
    });
  });

  // Navegacion completa en cada pagina
  htmls.forEach(pag => {
    const html = fs.readFileSync(path.join(APP, pag), 'utf8');
    secciones.forEach(destino => {
      ok(html.includes('href="' + destino + '"'), pag + ': no enlaza a ' + destino);
    });
  });

  // Los ids usados por los scripts existen en su pagina
  // (excluidos los que el propio JS crea dinámicamente en plantillas)
  const DINAMICOS = new Set(['btn-abrir-transferencia', 'btn-marcar-usada', 'btn-reintentar']);
  const pares = [
    ['index.html', ['js/home.js']],
    ['dashboard.html', ['js/dashboard.js']],
    ['verificar.html', ['js/verificar.js']],
    ['entrada.html', ['js/entrada.js']],
    ['transferencia.html', ['js/transferencia.js']],
    ['historial.html', ['js/historial.js']]
  ];
  pares.forEach(([pag, scripts]) => {
    const html = fs.readFileSync(path.join(APP, pag), 'utf8');
    const idsHtml = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
    scripts.forEach(s => {
      const js = fs.readFileSync(path.join(APP, s), 'utf8');
      const usados = new Set();
      for (const m of js.matchAll(/getElementById\(\s*'([^']+)'/g)) usados.add(m[1]);
      for (const m of js.matchAll(/getElementById\(\s*"([^"]+)"/g)) usados.add(m[1]);
      for (const m of js.matchAll(/\$\(\s*'([^']+)'\s*\)/g)) usados.add(m[1]);
      for (const m of js.matchAll(/\$\(\s*"([^"]+)"\s*\)/g)) usados.add(m[1]);
      usados.forEach(id => {
        if (DINAMICOS.has(id)) return;
        ok(idsHtml.has(id), pag + ' / ' + s + ': el id "' + id + '" no existe en el HTML');
      });
    });
  });

  // Scripts base cargados en cada pagina
  htmls.forEach(pag => {
    const html = fs.readFileSync(path.join(APP, pag), 'utf8');
    ['js/qr.js', 'js/cliente-api.js', 'js/api.js', 'js/app.js',
     'js/sesion.js', 'js/identificacion.js'].forEach(s => {
      ok(html.includes('src="' + s + '"'), pag + ': no carga ' + s);
    });
  });

  // Identificacion multiusuario: pildora en todas las paginas y propiedad
  // de la entrada exigida por el servidor para emitir el QR.
  ok(fs.existsSync(path.join(APP, 'js', 'identificacion.js')),
    'Falta frontend/js/identificacion.js (pildora de identidad)');
  ok(backend.includes("motivo: 'no-es-tuya'"),
    'backend/index.js no exige ser el titular para emitir el QR o transferir');
  ok(backend.includes('qrToken: esMia ?'),
    'backend entrega el QR vivo de una entrada que no es tuya');
}

/* ===================================================================== */
/* 2. Capa de datos (api.js)                                            */
/* ===================================================================== */
async function pruebasApi() {
  grupo('2. Capa de datos (js/api.js: modo API y modo local)');
  const ctx = crearContexto();
  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/api.js');
  const API = evaluar(ctx, 'SecurePassAPI');

  ok(!!API, 'SecurePassAPI no esta disponible');
  ok(evaluar(ctx, 'typeof ClienteAPI') === 'object', 'ClienteAPI no esta disponible');
  ok(API.modoActual() === 'local',
    'Sin backend disponible el modo debe ser "local" (fallback a localStorage)');
  ['consultarEntrada', 'actualizarQR', 'transferirEntrada', 'obtenerHistorial']
    .forEach(fn => ok(typeof API[fn] === 'function', 'Falta ' + fn + '()'));

  const todas = await API.listarEntradas();
  ok(todas.length >= 5, 'Se esperaban minimo 5 entradas, hay ' + todas.length);
  ok(new Set(todas.map(e => e.evento)).size >= 2, 'Se esperaban minimo 2 eventos');
  ok(new Set(todas.map(e => e.titular)).size >= 5, 'Faltan titulares distintos');
  ok(new Set(todas.map(e => e.estado)).size >= 4, 'Faltan estados distintos');

  const esperado = {
    ENTRY001: 'valido', ENTRY002: 'usado', ENTRY003: 'anulado',
    ENTRY004: 'transferido', ENTRY005: 'valido'
  };
  for (const codigo of Object.keys(esperado)) {
    const e = await API.consultarEntrada(codigo);
    ok(!!e, codigo + ' no existe');
    ok(e && e.estado === esperado[codigo],
      codigo + ': estado ' + (e && e.estado) + ' != ' + esperado[codigo]);
  }
  ok((await API.consultarEntrada('NOEXISTE99')) === null, 'Un codigo inexistente debe devolver null');
  ok((await API.consultarEntrada('')) === null, 'Un codigo vacio debe devolver null');

  ['valido', 'usado', 'anulado', 'transferido'].forEach(k => {
    ok(API.ESTADOS[k] && API.ESTADOS[k].etiqueta, 'Falta la etiqueta del estado ' + k);
  });

  const resumen = await API.obtenerResumen();
  ok(resumen.activas === 2, 'Entradas activas: ' + resumen.activas + ' (se esperaban 2)');
  ok(resumen.usadas === 1, 'Entradas usadas: ' + resumen.usadas + ' (se esperaba 1)');
  ok(resumen.transferidas === 1, 'Entradas transferidas: ' + resumen.transferidas + ' (se esperaba 1)');
  ok(resumen.anuladas === 1, 'Entradas anuladas: ' + resumen.anuladas + ' (se esperaba 1)');

  // Validaciones
  ok(API.validarDNI('45678945').ok, 'DNI valido rechazado');
  ok(!API.validarDNI('4567894').ok, 'DNI de 7 digitos aceptado');
  ok(!API.validarDNI('456789456').ok, 'DNI de 9 digitos aceptado');
  ok(!API.validarDNI('4567894a').ok, 'DNI con letras aceptado');
  ok(!API.validarDNI('').ok, 'DNI vacio aceptado');
  ok(API.validarCorreo('andrea@correo.com').ok, 'Correo valido rechazado');
  ok(!API.validarCorreo('andrea@correo').ok, 'Correo sin dominio aceptado');
  ok(!API.validarCorreo('andrea.correo.com').ok, 'Correo sin arroba aceptado');
  ok(!API.validarCorreo('').ok, 'Correo vacio aceptado');
  ok(API.validarNombre(NOMBRES.andrea).ok, 'Nombre valido rechazado');
  ok(!API.validarNombre('Ana').ok, 'Nombre demasiado corto aceptado');
  ok(!API.validarNombre('Andrea').ok, 'Nombre sin apellido aceptado');

  const e1 = await API.consultarEntrada('ENTRY001');
  ok(API.validarPrecio(100, e1).ok, 'Precio dentro del limite rechazado');
  ok(API.validarPrecio(120, e1).ok, 'Precio igual al maximo rechazado');
  ok(!API.validarPrecio(150, e1).ok, 'Precio por encima del limite aceptado');
  ok(API.validarPrecio(150, e1).limite === true, 'El error de precio debe marcarse como limite');
  ok(API.validarPrecio('abc', e1).ok === false, 'Precio no numerico aceptado');
  ok(API.validarPrecio('', e1).ok === false, 'Precio vacio aceptado');

  // QR dinamico
  const qr1 = await API.actualizarQR('ENTRY001');
  ok(!!qr1, 'actualizarQR devolvio vacio');
  ok(/^JSP-ENTRY001-[0-9A-F]{8}$/.test(qr1.token), 'Formato de token incorrecto: ' + qr1.token);
  ok(qr1.payload.includes('ENTRY001'), 'El payload no contiene el codigo de entrada');
  const qr2 = await API.actualizarQR('ENTRY001');
  ok(qr2.token !== qr1.token, 'El token no cambio al regenerar');
  ok(qr2.tokenAnterior === qr1.token, 'No se recuerda el token anterior');
  ok(qr2.entrada.qrAnterior === qr1.token, 'El QR anterior no quedo invalidado');

  const h1 = await API.obtenerHistorial('ENTRY001');
  ok(h1.length >= 3, 'El historial de ENTRY001 esta incompleto');
  ok(h1.some(x => x.accion === 'creada'), 'Falta el evento "creada"');
  ok(h1.every(x => x.codigo === 'ENTRY001'), 'El historial mezcla codigos');

  // Transferencia
  const historialAntes = (await API.obtenerHistorial('ENTRY001')).length;
  const qrPrevio = (await API.consultarEntrada('ENTRY001')).qrToken;

  const mala = await API.transferirEntrada('ENTRY001', {
    nombre: 'Ana', dni: '123', correo: 'no-es-correo', precio: 999
  });
  ok(!mala.ok, 'La transferencia con datos invalidos fue aceptada');
  ok(mala.campos && mala.campos.dni && mala.campos.correo && mala.campos.precio,
    'No se reportaron los campos con error');

  const overpriced = await API.transferirEntrada('ENTRY001', {
    nombre: NOMBRES.andrea, dni: '52311878',
    correo: 'andrea.torres@demo.pe', precio: 150
  });
  ok(!overpriced.ok, 'Se permitio transferir por encima del precio maximo');
  ok(overpriced.campos && overpriced.campos.precio, 'No se senalo el error de precio');

  const okTransfer = await API.transferirEntrada('ENTRY001', {
    nombre: NOMBRES.andrea, dni: '52311878',
    correo: 'andrea.torres@demo.pe', precio: 100
  });
  ok(okTransfer.ok, 'La transferencia valida fue rechazada: ' + okTransfer.error);
  ok(okTransfer.titularAnterior === NOMBRES.carlos,
    'Titular anterior incorrecto: ' + okTransfer.titularAnterior);
  ok(okTransfer.titularNuevo === NOMBRES.andrea, 'Nuevo titular incorrecto');
  ok(okTransfer.dniNuevo === '********78', 'El DNI no se enmascara correctamente');
  ok(okTransfer.estado === 'transferido', 'El estado no cambio a transferido');
  ok(okTransfer.tokenNuevo && okTransfer.tokenNuevo !== qrPrevio,
    'No se genero un token nuevo tras transferir');
  ok(okTransfer.tokenAnterior === qrPrevio, 'No se invalido el QR anterior');

  const transferida = await API.consultarEntrada('ENTRY001');
  ok(transferida.titular === NOMBRES.andrea, 'El titular no se actualizo en la base');
  ok(transferida.dni === '52311878', 'El DNI no se actualizo');
  ok(transferida.estado === 'transferido', 'El estado no se guardo');
  ok(transferida.qrAnterior === qrPrevio, 'El QR anterior no quedo invalidado');
  ok(transferida.puedeTransferir === false, 'Una entrada transferida no deberia volver a transferirse');

  const hd = await API.obtenerHistorial('ENTRY001');
  ok(hd.length > historialAntes, 'La transferencia no se registro en el historial');
  ok(hd.some(x => x.accion === 'transferida'), 'Falta el evento "transferida"');
  const ultimo = hd[hd.length - 1];
  ok(ultimo.accion === 'qr', 'El ultimo evento deberia ser la generacion del QR nuevo');
  ok(ultimo.detalle.includes(NOMBRES.invalido),
    'No se registro la invalidacion del QR anterior: ' + ultimo.detalle);

  const repetida = await API.transferirEntrada('ENTRY001', {
    nombre: 'Pedro Soto', dni: '41235678', correo: 'pedro@correo.com', precio: 90
  });
  ok(!repetida.ok, 'Se permitio transferir dos veces la misma entrada');

  // Persistencia
  const mapa = JSON.parse(ctx.localStorage.getItem('jsp.entradas.v1'));
  ok(!!mapa, 'Las entradas no se guardaron en localStorage');
  ok(mapa.ENTRY001.titular === NOMBRES.andrea, 'localStorage no conserva el nuevo titular');
  ok(!!ctx.localStorage.getItem('jsp.historial.v1'), 'El historial no se guardo');

  // Reinicio de la demo
  await API.reiniciarDemo();
  const trasReinicio = await API.consultarEntrada('ENTRY001');
  ok(trasReinicio.titular === NOMBRES.carlos, 'reiniciarDemo no restored los datos originales');
  ok(trasReinicio.estado === 'valido', 'reiniciarDemo no restored el estado original');

  /* ------------------------------------------------------------------
   * 2b. Identificacion de la persona (js/sesion.js)
   *     El DNI identificado viaja en X-Usuario-DNI y es con el que el
   *     servidor decide si el QR y la transferencia son de esa persona.
   * ---------------------------------------------------------------- */
  grupo('2b. Identificacion de la persona (js/sesion.js)');
  const ctxSesion = crearContexto();
  cargarJs(ctxSesion, 'frontend/js/sesion.js');
  const S = evaluar(ctxSesion, 'window.Sesion');

  ok(!!S && typeof S.identificar === 'function', 'Sesion.identificar no esta disponible');
  ok(S.estaIdentificado() === false, 'Sin sesion guardada no hay nadie identificado');

  let resId = await S.identificar('123', 'Carlos', 'Perez');
  ok(resId.ok === false && resId.campo === 'dni', 'Un DNI de 3 digitos debe rechazarse');

  resId = await S.identificar('45678945', 'Carlos', 'P');
  ok(resId.ok === false && resId.campo === 'apellidos',
    'Un apellido de 1 caracter debe rechazarse');

  // Sin API conectada (modo local) solo se reconoce el usuario de demostracion
  resId = await S.identificar('52311878', 'Andrea', 'Torres');
  ok(resId.ok === false, 'Sin API no debe identificarse un DNI distinto al de demostracion');

  resId = await S.identificar('45678945', 'Carlos', 'Perez');
  ok(resId.ok === true,
    'El usuario de demostracion debe poder identificarse: ' + (resId.mensaje || ''));
  if (resId.ok) {
    ok(S.dni() === '45678945', 'La sesion no guardo el DNI identificado');
    ok(S.cabeceras()['X-Usuario-DNI'] === '45678945',
      'La cabecera X-Usuario-DNI no lleva el DNI de la sesion');
  }
  S.olvidar();
  ok(S.estaIdentificado() === false, 'Tras olvidar() no debe quedar nadie identificado');
}

/* ===================================================================== */
/* 3. Paginas                                                            */
/* ===================================================================== */

/** Espera a que la pagina haya pintado, en lugar de dormir un tiempo fijo.
 *  El renderizado depende de la deteccion de la API y de la latencia
 *  simulada, asi que un `dormir(700)` fijo producia fallos intermitentes.
 *  `condicion` se consulta cada 40 ms hasta 4 s. */
async function esperarListo(ctx, condicion, etiqueta) {
  const limite = Date.now() + 4000;
  while (Date.now() < limite) {
    let listo = false;
    try { listo = !!condicion(ctx); } catch (e) { listo = false; }
    if (listo) return true;
    await dormir(40);
  }
  ok(false, 'La pagina no termino de renderizar a tiempo: ' + (etiqueta || ''));
  return false;
}

async function probarPagina(pagina, scripts, antes, despues, listo) {
  const ctx = crearContexto();
  cargarJs(ctx, 'frontend/js/qr.js');
  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/api.js');
  cargarPagina(ctx, 'frontend/' + pagina, ['frontend/js/app.js'].concat(scripts.map(s => 'frontend/' + s)));
  if (listo) {
    await esperarListo(ctx, listo, pagina);
  } else {
    await dormir(900);
  }
  if (antes) await antes(ctx);
  await dormir(400);
  if (despues) await despues(ctx);
  return ctx;
}

async function pruebasPaginas() {
  grupo('3. Paginas: carga y flujos sin errores de JavaScript');

  /* --- Verificar ---------------------------------------------------- */
  await probarPagina('verificar.html', ['js/verificar.js'],
    async ctx => {
      const doc = ctx.document;
      ok(!!doc.getElementById('codigo'), 'No se encontro el campo de codigo');
      ok(doc.getElementById('chips-codigos').innerHTML.includes('ENTRY001'),
        'Los chips de codigos de prueba no se rellenaron');
      ok(doc.getElementById('tabla-db').innerHTML.includes('ENTRY001'),
        'La tabla de la base de datos no se relleno');
    },
    async ctx => {
      const doc = ctx.document;
      const API = evaluar(ctx, 'SecurePassAPI');
      const form = doc.getElementById('form-verificar');

      doc.getElementById('codigo').value = 'ENTRY001';
      await form._fire('submit', { target: form });
      await dormir(600);
      ok(doc.getElementById('resultado').className.includes('valido'),
        'ENTRY001 debe mostrarse como valida');
      ok(doc.getElementById('res-titulo').textContent === NOMBRES.valido,
        'Titulo incorrecto: [' + doc.getElementById('res-titulo').textContent + ']');
      ok(doc.getElementById('res-datos').innerHTML.includes(NOMBRES.carlos),
        'El resultado no muestra al titular');
      ok(doc.getElementById('res-datos').innerHTML.includes('ENTRY001'),
        'El resultado no muestra el codigo de entrada');
      ok(doc.getElementById('res-datos').innerHTML.includes('Estadio Nacional'),
        'El resultado no muestra el lugar');

      doc.getElementById('codigo').value = 'NOEXISTE99';
      await form._fire('submit', {});
      await esperarHasta(() => doc.getElementById('res-titulo').textContent === 'CÓDIGO NO ENCONTRADO');
      ok(doc.getElementById('res-titulo').textContent === 'CÓDIGO NO ENCONTRADO',
        'No se maneja el codigo inexistente');

      for (const par of [['ENTRY002', NOMBRES.usado], ['ENTRY003', NOMBRES.anulado],
      ['ENTRY004', NOMBRES.transferido], ['ENTRY005', NOMBRES.valido]]) {
        doc.getElementById('codigo').value = par[0];
        await form._fire('submit', {});
        await dormir(550);
        ok(doc.getElementById('res-titulo').textContent === par[1],
          par[0] + ': se esperaba [' + par[1] + '] y se obtuvo [' +
          doc.getElementById('res-titulo').textContent + ']');
      }

      const h = await API.obtenerHistorial('ENTRY002');
      ok(h.some(x => x.accion === 'verificada'),
        'La verificacion no se registro en el historial');

      // El contador de verificaciones se incrementa
      ok(Number(doc.getElementById('contador-verificaciones').textContent) > 0,
        'El contador de verificaciones no se actualizo');
    },
    c => c.document.getElementById('tabla-db').innerHTML.includes('ENTRY001'));

  /* --- Dashboard ---------------------------------------------------- */
  await probarPagina('dashboard.html', ['js/dashboard.js'],
    async ctx => {
      const doc = ctx.document;
      const html = doc.getElementById('lista-entradas').innerHTML;
      ok(html.includes('Lima Music Fest'), 'El dashboard no pinto las entradas');
      ok(html.includes('ENTRY001'), 'El dashboard no pinto el codigo de entrada');
      ok(html.includes('Ver entrada'), 'Falta el boton "Ver entrada"');
      ok(html.includes('Transferir entrada'), 'Falta el boton "Transferir entrada"');
      ok(Number(doc.getElementById('stat-activas').textContent) === 2,
        'Tarjeta "Entradas activas" = ' + doc.getElementById('stat-activas').textContent);
      ok(Number(doc.getElementById('stat-usadas').textContent) === 1,
        'Tarjeta "Entradas usadas" incorrecta');
      ok(Number(doc.getElementById('stat-transferidas').textContent) === 1,
        'Tarjeta "Entradas transferidas" incorrecta');
      ok(doc.getElementById('actividad-reciente').innerHTML.includes('Entrada creada'),
        'La actividad reciente esta vacia');
    },
    c => c.document.getElementById('lista-entradas').innerHTML.includes('ENTRY001'));

  /* --- Mi entrada (QR dinamico) ------------------------------------- */
  await probarPagina('entrada.html', ['js/entrada.js'],
    async ctx => {
      const doc = ctx.document;
      ok(doc.getElementById('t-evento').textContent === 'Lima Music Fest',
        'El evento del ticket no es correcto: ' + doc.getElementById('t-evento').textContent);
      ok(doc.getElementById('t-titular').textContent === NOMBRES.carlos,
        'Titular del ticket incorrecto');
      ok(doc.getElementById('t-dni').textContent === '********45',
        'El DNI no esta enmascarado: ' + doc.getElementById('t-dni').textContent);
      ok(/^JSP-ENTRY001-[0-9A-F]{8}$/.test(doc.getElementById('t-token').textContent),
        'El token no cumple el formato: ' + doc.getElementById('t-token').textContent);
      ok(doc.getElementById('cd-num').textContent === '15',
        'El contador no arranca en 15: ' + doc.getElementById('cd-num').textContent);
      ok(doc.getElementById('panel-rotaciones').textContent === '0',
        'El contador de rotaciones debe empezar en 0');
      const canvas = doc.getElementById('qr-canvas');
      ok(canvas.width > 100 && canvas.height > 100,
        'El canvas del QR no tiene tamano: ' + canvas.width + 'x' + canvas.height);
    },
    async ctx => {
      const doc = ctx.document;
      const tokenAntes = doc.getElementById('t-token').textContent;

      const btn = doc.getElementById('btn-regenerar');
      await btn._fire('click', { target: btn });
      await esperarHasta(() => doc.getElementById('t-token').textContent !== tokenAntes);
      const tokenDespues = doc.getElementById('t-token').textContent;

      ok(tokenDespues !== tokenAntes, 'El token no cambio al pulsar "Regenerar ahora"');
      ok(/^JSP-ENTRY001-[0-9A-F]{8}$/.test(tokenDespues),
        'El nuevo token no tiene el formato correcto');
      ok(doc.getElementById('cd-num').textContent === '15', 'El contador no se reinicio a 15');
      ok(doc.getElementById('panel-rotaciones').textContent === '1',
        'No se contabilizo la rotacion: ' + doc.getElementById('panel-rotaciones').textContent);
      ok(doc.getElementById('panel-anterior').textContent === tokenAntes,
        'El QR anterior no se muestra como invalidado');
    },
    c => {
      const d = c.document;
      return d.getElementById('t-token').textContent && d.getElementById('qr-canvas').width > 0;
    });

  /* --- Transferencia ------------------------------------------------- */
  await probarPagina('transferencia.html', ['js/transferencia.js'],
    async ctx => {
      const doc = ctx.document;
      const html = doc.getElementById('detalle-entrada').innerHTML;
      ok(html.includes('Lima Music Fest'), 'No se muestra la entrada a transferir');
      ok(html.includes(NOMBRES.carlos), 'No se muestra el titular actual');
      ok(html.includes('********45'), 'No se muestra el DNI enmascarado');
      ok(html.includes('S/ 120.00'), 'No se muestra el precio original/maximo');
      ok(html.includes('btn-abrir-transferencia'), 'No aparece el boton de transferir');
    },
    async ctx => {
      const doc = ctx.document;
      const API = evaluar(ctx, 'SecurePassAPI');
      const click = el => el._fire('click', { target: el });
      const input = (el, v) => { el.value = v; return el._fire('input', { target: el }); };

      // Paso 1: sin el DNI del titular actual no se puede abrir el formulario
      ok(doc.getElementById('btn-abrir-transferencia').disabled,
        'La transferencia debe estar bloqueada sin el DNI del titular actual');
      await input(doc.getElementById('dni-titular'), '45678945');
      ok(!doc.getElementById('btn-abrir-transferencia').disabled,
        'El DNI correcto del titular actual no habilito la transferencia');

      const abrir = doc.getElementById('btn-abrir-transferencia');
      await click(abrir);
      ok(doc.getElementById('precio-maximo').textContent === 'S/ 120.00',
        'El precio maximo no se cargo en el modal');
      ok(doc.getElementById('precio-original').textContent === 'S/ 120.00',
        'El precio original no se cargo en el modal');

      // Precio por encima del limite
      await input(doc.getElementById('nuevo-precio'), '150');
      ok(doc.getElementById('error-precio').classList.contains('show'),
        'No se mostro el error por superar el precio maximo');
      ok(doc.getElementById('error-precio').innerHTML.includes(NOMBRES.limite),
        'El mensaje del limite no es el esperado');

      // Con el precio alto no deja continuar
      await input(doc.getElementById('nuevo-nombre'), NOMBRES.andrea);
      await input(doc.getElementById('nuevo-dni'), '52311878');
      await input(doc.getElementById('nuevo-correo'), 'andrea.torres@demo.pe');
      await click(doc.getElementById('btn-continuar'));
      ok(doc.getElementById('paso-confirmacion').classList.contains('hide'),
        'Se permitio continuar con un precio no permitido');

      // DNI invalido
      await input(doc.getElementById('nuevo-dni'), '5231187');
      ok(doc.getElementById('error-dni').classList.contains('show'),
        'No se valido el DNI incorrecto');
      await input(doc.getElementById('nuevo-dni'), '52311878');
      ok(!doc.getElementById('error-dni').classList.contains('show'),
        'El DNI valido sigue marcado con error');

      // El campo DNI solo admite numeros
      await input(doc.getElementById('nuevo-dni'), '52a3b11878xyz');
      ok(doc.getElementById('nuevo-dni').value === '52311878',
        'El campo DNI no filtra caracteres no numericos: ' + doc.getElementById('nuevo-dni').value);

      // Correo invalido
      await input(doc.getElementById('nuevo-correo'), 'correo-malo');
      ok(doc.getElementById('error-correo').classList.contains('show'),
        'No se valido el correo incorrecto');
      await input(doc.getElementById('nuevo-correo'), 'andrea.torres@demo.pe');

      // Continuar -> pantalla de confirmacion
      await input(doc.getElementById('nuevo-precio'), '100');
      await click(doc.getElementById('btn-continuar'));
      ok(!doc.getElementById('paso-confirmacion').classList.contains('hide'),
        'No se mostro la pantalla de confirmacion');
      ok(doc.getElementById('c-actual').textContent === NOMBRES.carlos, 'Titular actual incorrecto');
      ok(doc.getElementById('c-nuevo').textContent === NOMBRES.andrea, 'Nuevo titular incorrecto');
      ok(doc.getElementById('c-dni').textContent === '********78', 'DNI de la confirmacion incorrecto');
      ok(doc.getElementById('c-precio').textContent === 'S/ 100.00', 'Precio de la confirmacion incorrecto');
      ok(doc.getElementById('c-codigo').textContent === 'ENTRY001', 'Codigo de la confirmacion incorrecto');

      // Confirmar
      await click(doc.getElementById('btn-confirmar'));
      await esperarHasta(() => !doc.getElementById('paso-resultado').classList.contains('hide'));
      await esperarHasta(() => doc.getElementById('detalle-entrada').innerHTML.includes('badge-transferido')
        || doc.getElementById('detalle-entrada').innerHTML.includes('no puede transferirse'));
      ok(!doc.getElementById('paso-resultado').classList.contains('hide'),
        'No se mostro la pantalla de resultado');
      ok(doc.getElementById('r-anterior').textContent === NOMBRES.carlos, 'Titular anterior incorrecto');
      ok(doc.getElementById('r-nuevo').textContent === NOMBRES.andrea, 'Nuevo titular incorrecto');
      ok(doc.getElementById('r-dni').textContent === '********78', 'DNI del resultado incorrecto');
      ok(doc.getElementById('r-codigo').textContent === 'ENTRY001', 'Codigo de entrada incorrecto');
      ok(doc.getElementById('r-estado').innerHTML.includes('badge-transferido'),
        'El estado final no es "Transferido"');
      ok(doc.getElementById('btn-ver-nueva').href.includes('entrada.html?codigo=ENTRY001'),
        'El boton "Ver nueva entrada" no apunta a la entrada nueva');

      // Persistencia y trazabilidad
      const e = await API.consultarEntrada('ENTRY001');
      ok(e.titular === NOMBRES.andrea, 'El titular no se guardo en localStorage');
      ok(e.estado === 'transferido', 'El estado no se guardo');
      ok(e.qrAnterior && e.qrToken !== e.qrAnterior, 'El QR anterior no fue invalidado');
      const h = await API.obtenerHistorial('ENTRY001');
      ok(h.some(x => x.accion === 'transferida'), 'No se registro la transferencia');
      ok(h.some(x => x.detalle && x.detalle.includes(NOMBRES.carlos) && x.detalle.includes(NOMBRES.andrea)),
        'El historial no registra el paso de titularidad');

      // El detalle de la pagina ya no ofrece transferir
      ok(doc.getElementById('detalle-entrada').innerHTML.includes('no puede transferirse') ||
        doc.getElementById('detalle-entrada').innerHTML.includes('badge-transferido'),
        'La pagina no refleja el estado transferido');
    },
    c => c.document.getElementById('detalle-entrada').innerHTML.includes('Lima Music Fest'));

  /* --- Historial ----------------------------------------------------- */
  await probarPagina('historial.html', ['js/historial.js'],
    async ctx => {
      const doc = ctx.document;
      ok(doc.getElementById('linea-tiempo').innerHTML.includes('tl-item'),
        'La linea de tiempo esta vacia');
      ok(doc.getElementById('tabla-historial').innerHTML.includes('Entrada creada'),
        'La tabla no contiene la accion "Entrada creada"');
      ok(doc.getElementById('tabla-historial').innerHTML.includes('ENTRY001'),
        'La tabla no contiene los codigos');
      ok(doc.getElementById('estados-actuales').innerHTML.includes('ENTRY005'),
        'El panel de estados actuales esta vacio');
      ok(doc.getElementById('filtro-codigo').innerHTML.includes('ENTRY001'),
        'El selector de entradas no se relleno');
      ok(Number(doc.getElementById('stat-eventos').textContent) > 5,
        'Las estadisticas del historial no se calcularon');
    },
    c => c.document.getElementById('linea-tiempo').innerHTML.includes('tl-item'));

  /* --- Sobre --------------------------------------------------------- */
  grupo('4. Paginas secundarias: index.html y sobre.html');
  const ctx2 = crearContexto();
  cargarJs(ctx2, 'frontend/js/qr.js');
  cargarJs(ctx2, 'frontend/js/cliente-api.js');
  cargarJs(ctx2, 'frontend/js/api.js');
  cargarPagina(ctx2, 'frontend/sobre.html', ['frontend/js/app.js']);
  await dormir(300);
  ok(true, 'sobre.html carga sin errores');

  const ctx3 = crearContexto();
  cargarJs(ctx3, 'frontend/js/qr.js');
  cargarJs(ctx3, 'frontend/js/cliente-api.js');
  cargarJs(ctx3, 'frontend/js/api.js');
  cargarPagina(ctx3, 'frontend/index.html', ['frontend/js/app.js', 'frontend/js/home.js']);
  await dormir(300);
  const heroToken = ctx3.document.getElementById('hero-token').textContent;
  ok(/^JSP-ENTRY001-[0-9A-F]{8}$/.test(heroToken),
    'El QR de la portada no genero un token valido: ' + heroToken);
  const heroCanvas = ctx3.document.getElementById('hero-qr');
  ok(heroCanvas.width > 50, 'El canvas del QR de portada no se dibujo');
}

/* ===================================================================== */
/* 4b. Propiedad de la entrada: QR propio vs ajeno                       */
/* =================================================================== */
async function pruebasPropiedad() {
  grupo('4b. QR propio vs ajeno (pildora de identificacion y aviso)');

  const ctx = crearContexto();
  cargarJs(ctx, 'frontend/js/qr.js');
  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/api.js');
  cargarPagina(ctx, 'frontend/entrada.html',
    ['frontend/js/app.js', 'frontend/js/sesion.js', 'frontend/js/identificacion.js',
     'frontend/js/entrada.js']);

  const doc = ctx.document;
  const esperar = async (fn, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await dormir(100); }
    return false;
  };

  // a) La pildora de identificacion esta en la pagina
  ok(!!doc.getElementById('pildora-usuario'), 'No se monto la pildora de identificacion');
  ok(!!doc.getElementById('pildora-btn'), 'La pildora no tiene boton');
  ok(!!doc.getElementById('modal-identificacion'), 'No existe el modal de identificacion');

  // b) Entrada propia (sesion de demostracion = Carlos): se ve el QR
  const listo = await esperar(() => doc.getElementById('t-token').textContent &&
    doc.getElementById('t-token').textContent !== '—');
  ok(listo, 'La entrada propia no genero su QR');
  ok(doc.getElementById('aviso-no-mia').classList.contains('hide'),
    'La entrada propia no debe mostrar el aviso de entrada ajena');
  ok(!doc.getElementById('ticket-qr').classList.contains('hide'),
    'La entrada propia debe mostrar el QR');

  // c) Entrada ajena (ENTRY002, de Andrea): aviso y sin QR
  ctx.sandbox.location.search = '?codigo=ENTRY002';
  cargarJs(ctx, 'frontend/js/entrada.js');
  await esperar(() => doc.getElementById('t-codigo').textContent === 'ENTRY002');
  await dormir(300);

  ok(!doc.getElementById('aviso-no-mia').classList.contains('hide'),
    'La entrada ajena debe mostrar el aviso "pertenece a otra persona"');
  ok(doc.getElementById('aviso-no-mia-titular').textContent === 'Andrea Torres',
    'El aviso no indica el titular real: ' + doc.getElementById('aviso-no-mia-titular').textContent);
  ok(doc.getElementById('ticket-qr').classList.contains('hide'),
    'La entrada ajena no debe mostrar el QR');
  ok(doc.getElementById('panel-token-card').classList.contains('hide'),
    'La entrada ajena no debe mostrar el panel de token');
  ok(doc.getElementById('btn-regenerar').disabled === true,
    'Regenerar el QR de una entrada ajena debe quedar deshabilitado');
}

/* ===================================================================== */
/* 6. Modo API (Docker): el cliente HTTP contra un fetch simulado        */
/* =================================================================== */
async function pruebasModoApi() {
  grupo('6. Integracion con la API de Docker (fetch simulado)');

  const llamadas = [];
  const ENTRADA = {
    codigo: 'ENTRY001', evento: 'Lima Music Fest', fecha: '2026-09-29', hora: '20:00',
    lugar: 'Estadio Nacional', zona: 'Preferencial', fila: 'B', asiento: '24',
    titular: 'Carlos Pérez', dni: '45678945', correo: 'carlos.perez@demo.pe',
    estado: 'valido', estadoDetalle: null, dniOculto: '********45',
    precioOriginal: 120, precio: 120, qrToken: 'JSP-ENTRY001-AAAA1111',
    qrAnterior: null, creadoEn: '2026-09-29T10:00:00',
    puedeTransferir: true, esMia: true
  };

  function responder(ruta, cuerpo, status) {
    return {
      ok: (status || 200) < 400,
      status: status || 200,
      json: async () => cuerpo
    };
  }

  const ctx = crearContexto();
  ctx.sandbox.fetch = async (url, opciones) => {
    opciones = opciones || {};
    llamadas.push({ url: url, metodo: opciones.method || 'GET', cuerpo: opciones.body });

    if (url.endsWith('/health')) return responder(url, { ok: true, baseDatos: 'conectada', tablas: 6 });
    if (url.includes('/resumen')) {
      return responder(url, { ok: true, resumen: { activas: 2, usadas: 1, transferidas: 1, anuladas: 1, total: 7, mias: 2 } });
    }
    if (url.includes('/entradas') && (opciones.method || 'GET') === 'GET' && !/\/entradas\/[^/]+/.test(url.split('/api')[1])) {
      return responder(url, { ok: true, entradas: [ENTRADA] });
    }
    // Consulta de una entrada concreta
    if (/\/entradas\/ENTRY001$/.test(url)) return responder(url, { ok: true, entrada: ENTRADA });
    if (/\/entradas\/NOEXISTE$/.test(url)) return responder(url, { ok: false, error: 'no existe' }, 404);
    if (url.includes('/verificar/ENTRY001')) return responder(url, { ok: true, entrada: ENTRADA });
    if (url.includes('/verificar/NOEXISTE')) return responder(url, { ok: false, error: 'no existe' }, 404);
    if (/\/entradas\/ENTRY001\/qr/.test(url)) {
      return responder(url, {
        ok: true, token: 'JSP-ENTRY001-FFFF2222', tokenAnterior: 'JSP-ENTRY001-AAAA1111',
        payload: 'JSP|ENTRY001|FFFF2222|1730', expiraEn: '2026-09-29T17:30:15.000Z',
        entrada: Object.assign({}, ENTRADA, { qrToken: 'JSP-ENTRY001-FFFF2222', qrAnterior: 'JSP-ENTRY001-AAAA1111' })
      });
    }
    if (/\/entradas\/ENTRY001\/transferir/.test(url)) {
      return responder(url, {
        ok: false, error: 'Revisa los datos del formulario.',
        campos: { precio: 'El precio de transferencia supera el límite permitido.' }
      }, 400);
    }
    if (url.includes('/historial')) {
      return responder(url, { ok: true, historial: [{ id: 'H1', codigo: 'ENTRY001', accion: 'creada', titular: 'Carlos Pérez', fecha: '2026-09-29T10:00:00' }] });
    }
    return responder(url, { ok: false, error: 'ruta desconocida' }, 404);
  };

  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/api.js');
  const API = evaluar(ctx, 'SecurePassAPI');

  // 1) Detecta el backend
  const hayApi = await API.usarApi();
  ok(hayApi === true, 'El cliente deberia detectar la API disponible');
  ok(API.modoActual() === 'api', 'El modo deberia ser "api" cuando el backend responde');
  ok(llamadas.some(c => c.url.endsWith('/api/health')),
    'No se consulto /api/health para detectar el backend');

  // 2) Consultar entrada por HTTP
  const entrada = await API.consultarEntrada('ENTRY001');
  ok(entrada && entrada.codigo === 'ENTRY001', 'consultarEntrada no devolvio la entrada');
  ok(entrada.estadoDetalle && entrada.estadoDetalle.etiqueta === 'Válido / Sin usar',
    'La entrada remota no trae los metadatos de estado');
  ok(llamadas.some(c => /\/api\/entradas\/ENTRY001$/.test(c.url)),
    'No se llamo a GET /api/entradas/ENTRY001');
  ok(ctx.localStorage.getItem('jsp.entradas.v1') !== null,
    'La semilla local debe seguir disponible como respaldo sin conexion');

  // 3) Código inexistente -> null (no exception)
  ok((await API.consultarEntrada('NOEXISTE')) === null,
    'Un 404 de la API debe devolverse como null');

  // 4) Verificar estado
  const verificada = await API.verificar('ENTRY001');
  ok(verificada && verificada.codigo === 'ENTRY001', 'verificar() no devolvio la entrada');
  ok(llamadas.some(c => /\/api\/verificar\/ENTRY001$/.test(c.url)),
    'No se llamo a GET /api/verificar/ENTRY001');

  // 5) Generar token del QR
  const qr = await API.actualizarQR('ENTRY001', { log: true });
  ok(qr.token === 'JSP-ENTRY001-FFFF2222', 'El token remoto no se devolvio');
  ok(qr.payload.includes('ENTRY001'), 'El payload remoto no incluye el codigo');
  const llamadaQr = llamadas.find(c => /\/qr\?log=1$/.test(c.url));
  ok(!!llamadaQr, 'No se llamo a POST /api/entradas/ENTRY001/qr?log=1');
  ok(llamadaQr && llamadaQr.metodo === 'POST', 'La generacion de QR debe usar POST');

  const qrAuto = await API.actualizarQR('ENTRY001', { log: false });
  ok(llamadas.some(c => /\/qr\?log=0$/.test(c.url)),
    'Las rotaciones automaticas deben llamar con log=0');
  ok(qrAuto.token === 'JSP-ENTRY001-FFFF2222', 'La rotacion automatica fallo');

  // 6) Transferencia: el 400 del servidor se devuelve como { ok:false }
  const rechazo = await API.transferirEntrada('ENTRY001', {
    nombre: 'Andrea Torres', dni: '52311878', correo: 'andrea.torres@demo.pe', precio: 150
  });
  ok(rechazo && rechazo.ok === false, 'La API debe devolver ok:false ante un error de validacion');
  ok(rechazo && rechazo.campos && rechazo.campos.precio,
    'La API debe devolver el detalle de los campos con error');
  const llamadaT = llamadas.find(c => c.url.includes('/transferir'));
  ok(!!llamadaT && llamadaT.metodo === 'POST', 'La transferencia debe usar POST');
  ok(llamadaT && JSON.parse(llamadaT.cuerpo).precio === 150,
    'El cuerpo de la peticion no contiene el precio enviado');

  // 7) Resumen e historial
  const resumen = await API.obtenerResumen();
  ok(resumen && resumen.activas === 2, 'El resumen no llego desde la API');
  const historial = await API.obtenerHistorial('ENTRY001');
  ok(Array.isArray(historial) && historial.length === 1,
    'obtenerHistorial no devolvio el historial de la API');
}

/* ===================================================================== */
(async function () {
  pruebasEstaticas();
  await pruebasApi();
  await pruebasPaginas();
  await pruebasPropiedad();
  await pruebasModoApi();

  console.log('\n------------------------------------------------------------');
  console.log('  Verificacion funcional: ' + pruebas + ' comprobaciones, ' + fallos + ' fallo(s).');
  console.log('------------------------------------------------------------');
  process.exit(fallos ? 1 : 0);
})().catch(e => {
  console.error('\nERROR FATAL:', e);
  process.exit(1);
});
