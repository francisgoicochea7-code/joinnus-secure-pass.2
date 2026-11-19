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
  const paginas = [...secciones, 'activar.html'];
  paginas.forEach(p => ok(fs.existsSync(path.join(APP, p)), 'Falta la pagina frontend/' + p));

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
  ['postgres:', 'backend:', 'frontend:'].forEach(s =>
    ok(compose.includes(s), 'docker-compose.yml no declara el servicio ' + s));
  ['"${FRONTEND_PORT:-8081}:80"', '127.0.0.1:${BACKEND_PORT:-3001}:3000',
   './database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro',
   'condition: service_healthy', 'DB_HOST: postgres'].forEach(f =>
    ok(compose.includes(f), 'docker-compose.yml no contiene: ' + f));

  // Endpoints obligatorios en el backend
  const backend = fs.readFileSync(path.join(RAIZ, 'backend', 'index.js'), 'utf8');
  ['/api/health', '/api/entradas/:codigo', '/api/verificar/:codigo',
   '/api/entradas/:codigo/qr', '/api/qr/validar', '/api/entradas/:codigo/transferir',
   '/api/entradas/:codigo/historial', 'createHmac', 'multiples' === 'x' ? '' : 'new Pool']
    .forEach(f => ok(backend.includes(f), 'backend/index.js no contiene: ' + f));

  // Tablas obligatorias en el esquema
  const sql = fs.readFileSync(path.join(RAIZ, 'database', 'init.sql'), 'utf8');
  ['usuarios', 'eventos', 'entradas', 'transferencias', 'historial', 'tokens_qr']
    .forEach(t => ok(sql.includes('CREATE TABLE IF NOT EXISTS ' + t),
      'database/init.sql no crea la tabla ' + t));
  ok((sql.match(/ENTRY00\d/g) || []).length >= 5, 'init.sql tiene menos de 5 entradas ficticias');

  // Enlaces y recursos locales de cada pagina del frontend
  const htmls = fs.readdirSync(APP).filter(f => f.endsWith('.html'));
  ok(htmls.length === paginas.length, 'Cantidad inesperada de paginas HTML: ' + htmls.length);
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
  secciones.forEach(pag => {
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
    ['historial.html', ['js/historial.js']],
    ['activar.html', ['js/activacion.js']]
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
    const scripts = pag === 'activar.html'
      ? ['js/cliente-api.js', 'js/activacion.js']
      : ['js/qr.js', 'js/cliente-api.js', 'js/api.js', 'js/app.js', 'js/sesion.js', 'js/identificacion.js'];
    scripts.forEach(s => {
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
  const verificarHtml = fs.readFileSync(path.join(RAIZ, 'frontend/verificar.html'), 'utf8');
  ok(!verificarHtml.includes('Simular escaneo QR'),
    'La pagina no debe ofrecer "Simular escaneo QR"');
  ok(!verificarHtml.includes('Ver códigos de prueba'),
    'La pagina no debe ofrecer "Ver códigos de prueba"');
  ok(!verificarHtml.includes('id="btn-escanear"'),
    'Falta quitar el boton de escaneo simulado');
  ok(!verificarHtml.includes('id="chips-codigos"') && !verificarHtml.includes('id="modal-entradas"'),
    'Faltan quitar los chips y el modal de codigos ficticios');
  ok(!verificarHtml.includes('scan-overlay'),
    'Falta quitar la simulacion de escaneo');

  await probarPagina('verificar.html', ['js/verificar.js'],
    async ctx => {
      const doc = ctx.document;
      ok(!!doc.getElementById('codigo'), 'No se encontro el campo de codigo');
      ok(!!doc.getElementById('btn-verificar'), 'Falta el boton "Verificar entrada"');
      ok(!!doc.getElementById('btn-limpiar'), 'Falta el boton "Limpiar consulta"');
    },
    async ctx => {
      const doc = ctx.document;
      const API = evaluar(ctx, 'SecurePassAPI');
      const form = doc.getElementById('form-verificar');

      // Sin sesión: sólo el estado; nunca los detalles ni los accesos.
      doc.getElementById('codigo').value = 'ENTRY001';
      await form._fire('submit', { target: form });
      await dormir(600);
      ok(doc.getElementById('resultado').className.includes('valido'),
        'ENTRY001 debe mostrarse como valida');
      ok(doc.getElementById('res-titulo').textContent === NOMBRES.valido,
        'Titulo incorrecto: [' + doc.getElementById('res-titulo').textContent + ']');
      ok(doc.getElementById('res-mensaje').textContent.length > 20,
        'Falta la descripcion del estado');
      ok(doc.getElementById('res-detalles').classList.contains('hide'),
        'Sin sesion no deben mostrarse los detalles de la entrada');
      ok(doc.getElementById('res-datos').innerHTML === '',
        'Sin sesion el detalle debe quedar vacio: ' +
        doc.getElementById('res-datos').innerHTML.slice(0, 80));
      ok(doc.getElementById('res-acciones').classList.contains('hide'),
        'Sin sesion no deben mostrarse los botones de detalle');
      ok(!doc.getElementById('res-acciones').innerHTML.includes('Ver historial'),
        'Sin sesion no debe ofrecerse el historial');

      doc.getElementById('codigo').value = 'NOEXISTE99';
      await form._fire('submit', {});
      await esperarHasta(() => doc.getElementById('res-titulo').textContent === 'CÓDIGO NO ENCONTRADO');
      ok(doc.getElementById('res-titulo').textContent === 'CÓDIGO NO ENCONTRADO',
        'No se maneja el codigo inexistente');
      ok(doc.getElementById('res-detalles').classList.contains('hide'),
        'Un codigo inexistente no debe abrir el detalle');

      for (const par of [['ENTRY002', NOMBRES.usado], ['ENTRY003', NOMBRES.anulado],
      ['ENTRY004', NOMBRES.transferido], ['ENTRY005', NOMBRES.valido]]) {
        doc.getElementById('codigo').value = par[0];
        await form._fire('submit', {});
        await dormir(550);
        ok(doc.getElementById('res-titulo').textContent === par[1],
          par[0] + ': se esperaba [' + par[1] + '] y se obtuvo [' +
          doc.getElementById('res-titulo').textContent + ']');
        ok(doc.getElementById('res-detalles').classList.contains('hide'),
          par[0] + ': sin sesion no deben mostrarse detalles');
      }

      const h = await API.obtenerHistorial('ENTRY002');
      ok(h.some(x => x.accion === 'verificada'),
        'La verificacion no se registro en el historial');

      // El contador de verificaciones se incrementa
      ok(Number(doc.getElementById('contador-verificaciones').textContent) > 0,
        'El contador de verificaciones no se actualizo');
    },
    c => !!c.document.getElementById('form-verificar'));

  // Con sesión iniciada sí se ve la ficha completa de la entrada.
  const ctxVer = crearContexto();
  ctxVer.localStorage.setItem('jsp.sesion.usuario.v1', JSON.stringify({
    dni: '45678945', nombre: 'Carlos Pérez', nombres: 'Carlos', apellidos: 'Pérez'
  }));
  cargarJs(ctxVer, 'frontend/js/qr.js');
  cargarJs(ctxVer, 'frontend/js/cliente-api.js');
  cargarJs(ctxVer, 'frontend/js/api.js');
  cargarJs(ctxVer, 'frontend/js/sesion.js');
  cargarPagina(ctxVer, 'frontend/verificar.html',
    ['frontend/js/app.js', 'frontend/js/identificacion.js', 'frontend/js/verificar.js']);
  await dormir(400);

  const docVer = ctxVer.document;
  const formVer = docVer.getElementById('form-verificar');
  docVer.getElementById('codigo').value = 'ENTRY001';
  await formVer._fire('submit', { target: formVer });
  await dormir(700);

  ok(!docVer.getElementById('res-detalles').classList.contains('hide'),
    'Con sesion deben verse los detalles de la entrada');
  ok(docVer.getElementById('res-datos').innerHTML.includes(NOMBRES.carlos),
    'Con sesion el detalle debe mostrar al titular');
  ok(docVer.getElementById('res-datos').innerHTML.includes('ENTRY001'),
    'Con sesion el detalle debe mostrar el codigo');
  ok(docVer.getElementById('res-datos').innerHTML.includes('Estadio Nacional'),
    'Con sesion el detalle debe mostrar el lugar');
  ok(!docVer.getElementById('res-acciones').classList.contains('hide'),
    'Con sesion deben verse los accesos de detalle');
  ok(docVer.getElementById('res-acciones').innerHTML.includes('Ver entrada completa') &&
    docVer.getElementById('res-acciones').innerHTML.includes('Ver historial'),
    'Con sesion debe ofrecerse la entrada completa y el historial');

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
      ok(!html.includes(NOMBRES.carlos),
        'El detalle no debe mostrar el titular de la entrada: ' + NOMBRES.carlos);
      ok(!html.includes('********45'),
        'El detalle no debe mostrar el DNI del titular');
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
      ok(doc.getElementById('btn-ver-nueva').href.includes('verificar.html?codigo=ENTRY001'),
        'El boton de resultado debe abrir la consulta publica de la entrada transferida');

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

  /* --- Historial: sólo la actividad de la persona identificada -------- */
  // a) SIN sesión: estado vacío con aviso para entrar y sin datos de nadie.
  const ctxHist = crearContexto();
  cargarJs(ctxHist, 'frontend/js/qr.js');
  cargarJs(ctxHist, 'frontend/js/cliente-api.js');
  cargarJs(ctxHist, 'frontend/js/api.js');
  cargarJs(ctxHist, 'frontend/js/sesion.js');
  cargarPagina(ctxHist, 'frontend/historial.html',
    ['frontend/js/app.js', 'frontend/js/identificacion.js', 'frontend/js/historial.js']);
  await dormir(900);

  const docHist = ctxHist.document;
  const sinLinea = docHist.getElementById('linea-tiempo').innerHTML;
  const sinTabla = docHist.getElementById('tabla-historial').innerHTML;
  const sinEstados = docHist.getElementById('estados-actuales').innerHTML;
  const sinFiltro = docHist.getElementById('filtro-codigo').innerHTML;

  ok(!sinLinea.includes('tl-item'),
    'Sin sesion la linea de tiempo no debe mostrar eventos');
  ok(sinLinea.includes('Inicia sesión'),
    'Sin sesion debe pedir iniciar sesión: ' + sinLinea.slice(0, 120));
  ok(!sinTabla.includes('ENTRY') && !sinTabla.includes('Entrada creada'),
    'Sin sesion no debe listarse el historial de ninguna entrada');
  ok(!sinEstados.includes('ENTRY'),
    'Sin sesion no deben mostrarse entradas');
  ok(Number(docHist.getElementById('stat-eventos').textContent) === 0,
    'Sin sesion la metrica de eventos debe quedar en 0: ' +
    docHist.getElementById('stat-eventos').textContent);
  ok(sinFiltro.includes('Inicia sesión') && !sinFiltro.includes('ENTRY'),
    'Sin sesion el filtro no debe ofrecer entradas');
  ok(docHist.getElementById('btn-exportar').disabled === true,
    'Sin sesion la exportacion CSV debe quedar deshabilitada');

  // b) Con sesión de Carlos: sólo SUS entradas y SUS movimientos.
  const ctxCarlos = crearContexto();
  ctxCarlos.localStorage.setItem('jsp.sesion.usuario.v1', JSON.stringify({
    dni: '45678945', nombre: 'Carlos Pérez', nombres: 'Carlos', apellidos: 'Pérez'
  }));
  cargarJs(ctxCarlos, 'frontend/js/qr.js');
  cargarJs(ctxCarlos, 'frontend/js/cliente-api.js');
  cargarJs(ctxCarlos, 'frontend/js/api.js');
  cargarJs(ctxCarlos, 'frontend/js/sesion.js');
  cargarPagina(ctxCarlos, 'frontend/historial.html',
    ['frontend/js/app.js', 'frontend/js/identificacion.js', 'frontend/js/historial.js']);

  // El barrido espera a que la maqueta local termine de pintar y a que las
  // metricas terminen su animación.
  const listoHist = await esperarHasta(() => {
    const doc = ctxCarlos.document;
    return doc.getElementById('tabla-historial').innerHTML.includes('ENTRY001') &&
      Number(doc.getElementById('stat-eventos').textContent) === 4;
  }, 6000, 20);
  ok(listoHist, 'El historial de Carlos no se pinto (metrica=' +
    ctxCarlos.document.getElementById('stat-eventos').textContent + ')');

  const docCarlos = ctxCarlos.document;
  const lineaCarlos = docCarlos.getElementById('linea-tiempo').innerHTML;
  const tablaCarlos = docCarlos.getElementById('tabla-historial').innerHTML;
  const estadosCarlos = docCarlos.getElementById('estados-actuales').innerHTML;
  const filtroCarlos = docCarlos.getElementById('filtro-codigo').innerHTML;

  ok(lineaCarlos.includes('tl-item'), 'La linea de tiempo esta vacia');
  ok(tablaCarlos.includes('Entrada creada'),
    'La tabla no contiene la accion "Entrada creada"');
  ok(tablaCarlos.includes('ENTRY001'), 'La tabla no contiene los codigos propios');
  ok(!tablaCarlos.includes('ENTRY005') && !tablaCarlos.includes('ENTRY002') &&
     !tablaCarlos.includes('ENTRY003'),
    'La tabla muestra el historial de otra persona');
  ok(lineaCarlos.includes('ENTRY001') && !lineaCarlos.includes('ENTRY005'),
    'La linea de tiempo mezcla movimientos ajenos');
  ok(estadosCarlos.includes('ENTRY001'),
    'El panel de estados actuales esta vacio');
  ok(!estadosCarlos.includes('ENTRY005') && !estadosCarlos.includes('ENTRY002'),
    'El panel de estados muestra entradas de otra persona');
  ok(filtroCarlos.includes('ENTRY001'), 'El selector de entradas no se relleno');
  ok(!filtroCarlos.includes('ENTRY005') && !filtroCarlos.includes('ENTRY002'),
    'El selector ofrece entradas de otra persona');
  ok(Number(docCarlos.getElementById('stat-eventos').textContent) === 4,
    'Las metricas deben contar solo los eventos de Carlos: ' +
    docCarlos.getElementById('stat-eventos').textContent);

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

  // La portada ya no tiene titulo, subtitulo ni tarjetas ficticias.
  const homeHtml = fs.readFileSync(path.join(RAIZ, 'frontend/index.html'), 'utf8');
  ok(!homeHtml.includes('Entradas de prueba'),
    'La portada no debe tener el titulo "Entradas de prueba"');
  ok(!homeHtml.includes('Elige un evento ficticio'),
    'La portada no debe tener el subtitulo de eventos ficticios');
  ok(!homeHtml.includes('class="show-card"'),
    'Las tarjetas de la portada deben generarse con entradas reales');

  // Sin sesion: estado vacio limpio, sin tarjetas.
  ok(ctx3.document.getElementById('show-grid').innerHTML === '',
    'Sin sesion la portada no debe pintar tarjetas de ejemplo');
  ok(ctx3.document.getElementById('lineup-vacio-titulo').textContent.includes('Inicia sesión'),
    'Sin sesion la portada debe pedir iniciar sesion: ' +
    ctx3.document.getElementById('lineup-vacio-titulo').textContent);
  ok(!ctx3.document.getElementById('lineup-vacio').classList.contains('hide'),
    'Sin sesion se debe ver el estado vacio de entradas');

  // Con sesion: solo las entradas reales de la persona identificada.
  const ctxHome = crearContexto();
  ctxHome.localStorage.setItem('jsp.sesion.usuario.v1', JSON.stringify({
    dni: '45678945', nombre: 'Carlos Pérez', nombres: 'Carlos', apellidos: 'Pérez'
  }));
  cargarJs(ctxHome, 'frontend/js/qr.js');
  cargarJs(ctxHome, 'frontend/js/cliente-api.js');
  cargarJs(ctxHome, 'frontend/js/api.js');
  cargarJs(ctxHome, 'frontend/js/sesion.js');
  cargarPagina(ctxHome, 'frontend/index.html', ['frontend/js/app.js', 'frontend/js/home.js']);

  const listoHome = await esperarHasta(() =>
    ctxHome.document.getElementById('show-grid').innerHTML.includes('ENTRY001'), 6000, 30);
  ok(listoHome, 'Con sesion la portada no pinto las entradas reales');

  const gridHome = ctxHome.document.getElementById('show-grid').innerHTML;
  ok(gridHome.includes('ENTRY006'),
    'La portada debe mostrar todas las entradas propias');
  ok(!gridHome.includes('ENTRY002') && !gridHome.includes('ENTRY005'),
    'La portada no debe mostrar entradas de otras personas');
  ok(gridHome.includes('Verificar pase'),
    'Las tarjetas deben conservar el enlace "Verificar pase"');
  ok(ctxHome.document.getElementById('lineup-vacio').classList.contains('hide'),
    'Con entradas reales no debe verse el estado vacio');
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
/* 4c. Transferencia real: backend sin 500 y errores del servidor visibles */
/* =================================================================== */
async function pruebasTransferenciaBackend() {
  grupo('4c. Transferencia en la API real (regresiones del backend)');

  const backend = fs.readFileSync(path.join(RAIZ, 'backend/index.js'), 'utf8');

  ok(backend.includes('const [usuarioNuevo] = usr.rows.length'),
    'La transferencia debe resolver al destinatario nuevo o registrado');
  ok(backend.includes('ON CONFLICT (dni) DO NOTHING'),
    'La transferencia debe conservar el perfil de un destinatario registrado');

  const inicio = backend.indexOf('INSERT INTO transferencias');
  const bloque = inicio >= 0 ? backend.slice(inicio, inicio + 900) : '';
  ok(inicio >= 0, 'El backend ya no registra la transferencia en la tabla transferencias');
  ok(bloque.includes('precio_original') && bloque.includes('codigo_operacion'),
    'El INSERT de transferencias no envia precio_original ni codigo_operacion (columnas NOT NULL sin defecto): devolvia 500');
  ok(bloque.includes('titularAnteriorId'),
    'El id del titular anterior debe leerse ANTES de cambiar la titularidad');
  ok(backend.includes('generarCodigoOperacion()'),
    'Falta generarCodigoOperacion(), que rellena el codigo_operacion obligatorio');
  ok(backend.includes("app.set('trust proxy'"),
    'Falta app.set("trust proxy", 1): express-rate-limit denunciaba el X-Forwarded-For que añade nginx');

  const api = fs.readFileSync(path.join(APP, 'js/api.js'), 'utf8');
  ok(api.includes('function errorDeServidor'),
    'Falta errorDeServidor(): el modo local se tragaba los errores reales del servidor');
  ok(api.includes('if (delServidor) return delServidor'),
    'transferirEntrada ya no devuelve el error del servidor como si fuese "no existe en el sistema"');
  ok((api.match(/if \(errorDeServidor\(e\)\) return null;/g) || []).length >= 2,
    'actualizarQR y marcarUsada deben responder con el motivo del servidor en vez de simular la operación en local');

  const entradaJs = fs.readFileSync(path.join(APP, 'js/entrada.js'), 'utf8');
  ok(entradaJs.includes('!payload && entrada.qrToken'),
    'entrada.js dibujaba un QR falso cuando el servidor no emitía token');

  const verificarJs = fs.readFileSync(path.join(APP, 'js/verificar.js'), 'utf8');
  ok(verificarJs.includes('No se pudo registrar el ingreso'),
    'verificar.js anunciaba el ingreso aunque el servidor lo hubiese rechazado');
}

/* ===================================================================== */
/* 4d. El QR corresponde a la compra de la persona identificada          */
/* =================================================================== */
async function pruebasQrDeLaPersona() {
  grupo('4d. Cada persona identificada ve SU compra y SU QR');

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

  // a) Sin codigo en la URL se abre la compra de quien esta identificado
  ok(await esperar(() => doc.getElementById('t-codigo').textContent === 'ENTRY001'),
    'Sin codigo en la URL no se abrio la compra de la persona identificada');
  ok(!doc.getElementById('ticket-qr').classList.contains('hide'),
    'La compra propia debe mostrar su QR');

  // b) Identificarse en la pagina del QR navega a LA COMPRA de esa persona
  const identif = fs.readFileSync(path.join(RAIZ, 'frontend/js/identificacion.js'), 'utf8');
  ok(identif.includes('recargarCompraPropia'),
    'Identificarse en la pagina del QR no lleva a la compra de esa persona');
  ok(identif.includes('entrada.html?codigo='),
    'Falta el salto a la entrada de la persona recien identificada');

  // c) Persona identificada sin compras: no se cuelga la entrada de nadie
  evaluar(ctx, 'SecurePassAPI.listarMisEntradas = async function () { return []; };');
  cargarJs(ctx, 'frontend/js/entrada.js');

  ok(await esperar(() => doc.getElementById('aviso-titular') &&
    !doc.getElementById('aviso-titular').classList.contains('hide')),
    'Sin compras no se explica la situacion en el aviso de titular');
  ok(doc.getElementById('aviso-titular-texto').innerHTML.indexOf('no tienes entradas') >= 0,
    'El aviso no indica que esa persona no tiene entradas compradas');
  ok(doc.getElementById('ticket-qr').classList.contains('hide'),
    'Sin compras no debe mostrarse ningun QR');
  ok(doc.getElementById('panel-token-card').classList.contains('hide'),
    'Sin compras no debe mostrarse el panel de token');

  // d) Regresion: la funcion que evita colgar la entrada de otra persona
  const entradaJs = fs.readFileSync(path.join(APP, 'js/entrada.js'), 'utf8');
  ok(entradaJs.includes('pintarSinEntradas'),
    'Falta pintarSinEntradas() en entrada.js');
}

/* ===================================================================== */
/* 4e. Los datos de la entrada salen SÓLO DESPUÉS de identificarse       */
/* =================================================================== */
async function pruebasEntradaTrasIdentificar() {
  grupo('4e. La entrada pide identificarse antes de mostrar los datos');

  // El barrido comprueba el estado COMPLETO en un solo paso: otras páginas
  // abiertas en pruebas anteriores siguen girando su QR por reloj y tocan el
  // mismo micro-DOM, así no se apoya en una única lectura.
  const barrido = async fn => {
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) { if (fn()) return true; await dormir(5); }
    return false;
  };

  // a) Con la API real y SIN identificar: se pide identificarse, sin datos
  const ctxA = crearContexto();
  cargarJs(ctxA, 'frontend/js/qr.js');
  cargarJs(ctxA, 'frontend/js/cliente-api.js');
  cargarJs(ctxA, 'frontend/js/api.js');
  evaluar(ctxA, 'SecurePassAPI.usarApi = async function () { return true; };');
  evaluar(ctxA, 'var consultasA = 0; SecurePassAPI.consultarEntrada = ' +
    'async function () { consultasA = consultasA + 1; return null; };');
  cargarPagina(ctxA, 'frontend/entrada.html',
    ['frontend/js/app.js', 'frontend/js/sesion.js', 'frontend/js/identificacion.js',
     'frontend/js/entrada.js']);

  const docA = ctxA.document;
  const estadoA = () => {
    const aviso = docA.getElementById('aviso-titular');
    const texto = docA.getElementById('aviso-titular-texto');
    return !!(aviso && texto && texto.innerHTML.indexOf('Identifícate') >= 0) &&
      !aviso.classList.contains('hide') &&
      docA.getElementById('ticket-datos').classList.contains('hide') &&
      docA.getElementById('ticket-qr').classList.contains('hide');
  };
  const listoA = await barrido(estadoA);

  ok(listoA, 'Sin identificarse la entrada debe pedir identificarse y ocultar todo');
  if (listoA) {
    ok(docA.getElementById('aviso-titular-texto').innerHTML.indexOf('Identifícate') >= 0,
      'El aviso no invita a identificarse primero');
    ok(docA.getElementById('ticket-datos').classList.contains('hide'),
      'Sin identificarse deben ocultarse los datos de la entrada');
    ok(docA.getElementById('ticket-qr').classList.contains('hide'),
      'Sin identificarse no debe mostrarse el QR');
  }
  ok(evaluar(ctxA, 'consultasA') === 0,
    'Sin identificarse no se debio consultar ninguna entrada');

  // b) Ya identificada: recién salen LOS DATOS de esa persona y su QR
  const ctxB = crearContexto();
  ctxB.localStorage.setItem('jsp.sesion.usuario.v1', JSON.stringify({
    dni: '45678945', nombre: 'Carlos Pérez', nombres: 'Carlos', apellidos: 'Pérez'
  }));
  cargarJs(ctxB, 'frontend/js/qr.js');
  cargarJs(ctxB, 'frontend/js/cliente-api.js');
  cargarJs(ctxB, 'frontend/js/api.js');
  evaluar(ctxB, 'SecurePassAPI.usarApi = async function () { return false; };');
  cargarPagina(ctxB, 'frontend/entrada.html',
    ['frontend/js/app.js', 'frontend/js/sesion.js', 'frontend/js/identificacion.js',
     'frontend/js/entrada.js']);

  const docB = ctxB.document;
  const estadoB = () =>
    docB.getElementById('t-evento').textContent === 'Lima Music Fest' &&
    !docB.getElementById('ticket-datos').classList.contains('hide');
  const listoB = await barrido(estadoB);

  ok(listoB, 'Identificado: no salieron los datos de su compra');
  if (listoB) {
    ok(!docB.getElementById('ticket-datos').classList.contains('hide'),
      'Identificado: los datos de su entrada deben verse');
    ok(!docB.getElementById('ticket-qr').classList.contains('hide'),
      'Identificado: su QR debe mostrarse');
  }

  // c) Regresion: la funcion que exige identificarse sigue en entrada.js
  const entradaJs = fs.readFileSync(path.join(APP, 'js/entrada.js'), 'utf8');
  ok(entradaJs.includes('pintarIdentificacionRequerida'),
    'Falta pintarIdentificacionRequerida() en entrada.js');
  ok(entradaJs.indexOf('estaIdentificado()') >= 0,
    'La entrada ya no comprueba si hay alguien identificado');
}

/* ===================================================================== */
/* 5. Registro de usuarios nuevos (alta, modal e identificacion)         */
/* =================================================================== */
async function pruebasRegistroUsuarios() {
  grupo('5. Registro de usuarios nuevos');

  // --- a) El backend da de alta en la base -------------------------------
  const backend = fs.readFileSync(path.join(RAIZ, 'backend/index.js'), 'utf8');
  const ini = backend.indexOf("app.post('/api/usuarios'");
  ok(ini >= 0, 'Falta la ruta POST /api/usuarios en el backend');
  const bloque = ini >= 0 ? backend.slice(ini, ini + 1600) : '';

  ok(bloque.includes('INSERT INTO usuarios'),
    'La ruta de registro no inserta la persona en la tabla usuarios');
  ok(bloque.includes('limiteEscritura'),
    'El registro sin limite de peticiones permitiria inundar la base');
  ok(bloque.includes('^\\d{8}$'),
    'El registro no valida que el DNI tenga 8 numeros');
  ok(bloque.includes('campo: \'dni\'') && bloque.indexOf('409') >= 0,
    'Un DNI repetido debe responder 409 indicando el campo');
  ok(bloque.includes('23505'),
    'Falta el control de la clave unica uq_usuarios_dni ante dos altas simultaneas');

  // --- b) Capa de datos y cliente HTTP -----------------------------------
  const api = fs.readFileSync(path.join(APP, 'js/api.js'), 'utf8');
  ok(api.includes('async function crearUsuario'),
    'Falta crearUsuario() en api.js');
  ok(api.includes('crearUsuario: crearUsuario'),
    'crearUsuario no esta exportado en SecurePassAPI');
  ok(api.includes('El registro está disponible con la base de datos'),
    'Sin servidor el registro debe explicar que necesita la base, no fingir un alta');

  const cliente = fs.readFileSync(path.join(APP, 'js/cliente-api.js'), 'utf8');
  ok(cliente.includes("pedir('/usuarios'") && cliente.includes("method: 'POST'"),
    'El cliente no llama a POST /api/usuarios');
  ok(cliente.includes('r.status === 400 || r.status === 409'),
    'El cliente se traga los 400/409 del registro en vez de devolverlos al formulario');

  const identif = fs.readFileSync(path.join(APP, 'js/identificacion.js'), 'utf8');
  ok(identif.includes('id="reg-dni"') && identif.includes('id="reg-correo"'),
    'El modal no monta los campos del formulario de registro');
  ok(identif.includes('id="reg-enviar"'),
    'El modal no tiene el boton Crear cuenta');
  ok(identif.includes('function registrarse'),
    'Falta registrarse() en identificacion.js');
  ok(identif.includes('SecurePassAPI.crearUsuario'),
    'El formulario de registro no usa la capa de datos');

  // --- c) El modal alterna entre identificarse y crear cuenta ------------
  const ctx = crearContexto();
  cargarJs(ctx, 'frontend/js/qr.js');
  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/api.js');
  cargarPagina(ctx, 'frontend/index.html',
    ['frontend/js/app.js', 'frontend/js/sesion.js', 'frontend/js/identificacion.js']);

  const doc = ctx.document;
  ok(!!doc.getElementById('reg-formulario') && !!doc.getElementById('reg-pie'),
    'El modal no monta la vista de registro');
  ok(!!doc.getElementById('identif-formulario') && !!doc.getElementById('identif-pie'),
    'La vista de identificacion desaparecio del modal');
  ok(!!doc.getElementById('identif-a-registro'),
    'La vista de identificacion no ofrece crear una cuenta nueva');

  doc.getElementById('identif-a-registro').click();
  ok(doc.getElementById('identif-formulario').classList.contains('hide'),
    'Al pulsar "Crea tu cuenta" no se oculta la vista de identificacion');
  ok(!doc.getElementById('reg-formulario').classList.contains('hide'),
    'Al pulsar "Crea tu cuenta" no se muestra el formulario de registro');

  doc.getElementById('reg-a-identif').click();
  ok(!doc.getElementById('identif-formulario').classList.contains('hide'),
    'Volver desde el registro no restaura la vista de identificacion');
  ok(doc.getElementById('reg-formulario').classList.contains('hide'),
    'Volver desde el registro no vuelve a ocultar el formulario');

  // --- d) Validacion del formulario (funciona tambien sin servidor) ------
  let r = await evaluar(ctx,
    'SecurePassAPI.crearUsuario({dni:"123", nombres:"Ana", apellidos:"Gómez", correo:"ana@correo.com"})');
  ok(r && r.ok === false && r.campo === 'dni',
    'Un DNI de 3 digitos no debe pasar la validacion del registro');

  r = await evaluar(ctx,
    'SecurePassAPI.crearUsuario({dni:"77665544", nombres:"Ana123", apellidos:"Gómez", correo:"ana@correo.com"})');
  ok(r && r.ok === false && r.campo === 'nombres',
    'Un nombre con numeros debe rechazarse');

  r = await evaluar(ctx,
    'SecurePassAPI.crearUsuario({dni:"77665544", nombres:"Ana", apellidos:"Gómez", correo:"no-es-correo"})');
  ok(r && r.ok === false && r.campo === 'correo',
    'Un correo invalido debe marcar el campo correo');

  r = await evaluar(ctx,
    'SecurePassAPI.crearUsuario({dni:"77665544", nombres:"Ana", apellidos:"Gómez", correo:"ana@correo.com"})');
  ok(r && r.ok === false && /base de datos/.test(r.mensaje || ''),
    'Sin servidor el registro debe explicar que hace falta la base de datos');

  // --- e) Con la API simulada: alta real y identificacion inmediata ------
  const ctx2 = crearContexto();
  const llamadas = [];
  ctx2.sandbox.fetch = async (url, opciones) => {
    opciones = opciones || {};
    const metodo = opciones.method || 'GET';
    llamadas.push({ url: String(url), metodo: metodo, cuerpo: opciones.body });
    const responder = (cuerpo, status) => ({
      ok: (status || 200) < 400,
      status: status || 200,
      json: async () => cuerpo
    });

    if (String(url).endsWith('/health')) {
      return responder({ ok: true, baseDatos: 'conectada', tablas: 6 });
    }
    if (String(url).includes('/api/usuarios') && metodo === 'POST') {
      const cuerpo = JSON.parse(opciones.body);
      if (cuerpo.dni === '44332211') {
        return responder({
          ok: false, campo: 'dni',
          error: 'Ese DNI ya está registrado: identifícate con tu nombre.'
        }, 409);
      }
      return responder({
        ok: true,
        usuario: { id: 9, nombre: cuerpo.nombre, dni: cuerpo.dni, correo: cuerpo.correo }
      }, 201);
    }
    if (/\/api\/usuarios\/\d{8}$/.test(String(url))) {
      const dni = String(url).split('/').pop();
      return responder({ ok: true, usuario: { id: 9, nombre: 'Ana María Gómez Ríos', dni: dni, correo: 'ana@correo.pe' } });
    }
    return responder({ ok: false, error: 'Ruta no simulada: ' + url }, 404);
  };
  cargarJs(ctx2, 'frontend/js/qr.js');
  cargarJs(ctx2, 'frontend/js/cliente-api.js');
  cargarJs(ctx2, 'frontend/js/api.js');
  cargarJs(ctx2, 'frontend/js/sesion.js');

  const alta = await evaluar(ctx2,
    'SecurePassAPI.crearUsuario({dni:"77665544", nombres:"Ana María", apellidos:"Gómez Ríos", correo:"ANA@Correo.pe"})');
  ok(alta && alta.ok === true && alta.usuario && alta.usuario.dni === '77665544',
    'Con la API el registro no creo la cuenta');

  const post = llamadas.find(l => l.metodo === 'POST' && l.url.includes('/api/usuarios'));
  ok(!!post, 'No se llamo a POST /api/usuarios');
  if (post) {
    const cuerpo = JSON.parse(post.cuerpo);
    ok(cuerpo.dni === '77665544', 'El alta no envia el DNI');
    ok(cuerpo.nombre === 'Ana María Gómez Ríos',
      'El alta debe enviar el nombre completo (nombres + apellidos)');
    ok(cuerpo.correo === 'ana@correo.pe', 'El correo debe guardarse en minusculas');
  }

  const dup = await evaluar(ctx2,
    'SecurePassAPI.crearUsuario({dni:"44332211", nombres:"Luis", apellidos:"Prado", correo:"luis@correo.pe"})');
  ok(dup && dup.ok === false && dup.campo === 'dni' && /registrado/.test(dup.mensaje || ''),
    'Un DNI repetido (409) debe devolver el motivo del servidor marcando el DNI');

  // Recien creada ya se puede identificar con ese DNI (el backend la tiene)
  const sesion = await evaluar(ctx2, 'Sesion.identificar("77665544", "Ana María", "Gómez Ríos")');
  ok(sesion && sesion.ok === true,
    'Creada la cuenta no se pudo identificar con ese DNI');
  ok(evaluar(ctx2, 'Sesion.estaIdentificado()') === true,
    'Tras registrarse e identificarse no quedo la sesion activa');
}

/* ===================================================================== */
/* 5f. Inicio de sesión con contraseña (token firmado)                   */
/* ===================================================================== */
async function pruebasInicioSesion() {
  grupo('5f. Inicio de sesión con contraseña (token firmado)');

  const llamadas = [];
  const ctx = crearContexto();
  ctx.sandbox.fetch = async (url, opciones) => {
    opciones = opciones || {};
    const metodo = opciones.method || 'GET';
    llamadas.push({ url: String(url), metodo: metodo, cuerpo: opciones.body });
    const responder = (cuerpo, status) => ({
      ok: (status || 200) < 400,
      status: status || 200,
      json: async () => cuerpo
    });

    if (String(url).endsWith('/health')) {
      return responder({ ok: true, baseDatos: 'conectada', tablas: 6 });
    }
    if (String(url).endsWith('/api/usuarios/login') && metodo === 'POST') {
      const cuerpo = JSON.parse(opciones.body);
      if (cuerpo.dni === '45678945' && cuerpo.password === 'Carlos2026!') {
        return responder({
          ok: true,
          usuario: { id: 1, nombre: 'Carlos Pérez', dni: '45678945', correo: 'carlos.perez@demo.pe' },
          token: 'payload.firma',
          expiraEn: Date.now() + 3600000
        });
      }
      return responder({ ok: false, error: 'DNI o contraseña incorrectos.' }, 401);
    }
    return responder({ ok: false, error: 'Ruta no simulada: ' + url }, 404);
  };
  cargarJs(ctx, 'frontend/js/qr.js');
  cargarJs(ctx, 'frontend/js/cliente-api.js');
  cargarJs(ctx, 'frontend/js/sesion.js');

  let r = await evaluar(ctx, 'Sesion.iniciarSesion("123", "Carlos2026!")');
  ok(r && r.ok === false && r.campo === 'dni',
    'Un DNI inválido debe marcar el campo DNI antes de llamar a la API');

  r = await evaluar(ctx, 'Sesion.iniciarSesion("45678945", "otra-clave")');
  ok(r && r.ok === false && r.campo === 'password' && /incorrectos/.test(r.mensaje || ''),
    'Una contraseña incorrecta debe devolver el mensaje genérico del servidor');
  ok(evaluar(ctx, 'Sesion.estaIdentificado()') === false,
    'Tras un inicio de sesión fallido no debe quedar sesión');

  r = await evaluar(ctx, 'Sesion.iniciarSesion("45678945", "Carlos2026!")');
  ok(r && r.ok === true && r.usuario && r.usuario.dni === '45678945',
    'El inicio de sesión correcto no devolvió a la persona');
  ok(evaluar(ctx, 'Sesion.estaIdentificado()') === true,
    'El inicio de sesión correcto no dejó la sesión activa');

  const cab = await evaluar(ctx, 'Sesion.cabeceras()');
  ok(cab && cab.Authorization === 'Bearer payload.firma',
    'El token firmado debe viajar en la cabecera Authorization');
  ok(cab && cab['X-Usuario-DNI'] === '45678945',
    'La cabecera de compatibilidad debe conservar el DNI de la sesión');

  evaluar(ctx, 'Sesion.olvidar()');
  ok(evaluar(ctx, 'Sesion.estaIdentificado()') === false,
    'Cerrar sesión no debe dejar la sesión activa');

  // Sin API (modo local) sólo puede entrar el usuario de demostración.
  const sinApi = crearContexto();
  cargarJs(sinApi, 'frontend/js/sesion.js');
  const local = await evaluar(sinApi, 'Sesion.iniciarSesion("45678945", "Carlos2026!")');
  ok(local && local.ok === true,
    'Sin API el usuario de demostración debe poder entrar con su contraseña');

  const localOtra = await evaluar(sinApi, 'Sesion.iniciarSesion("52311878", "Andrea2026!")');
  ok(localOtra && localOtra.ok === false,
    'Sin API no debe entrar una cuenta que no existe en el modo local');
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
/* 7. Despliegue en Vercel: la rewrite devuelve a Express la ruta real   */
/* =================================================================== */
async function pruebasEnrutadoVercel() {
  grupo('7. Vercel: rutas de la API con varios tramos');

  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));

  // a) La rewrite captura TODOS los tramos bajo /api y los guarda en __ruta
  const rewrite = (vercel.rewrites || []).find(r => r.source === '/api/:path*');
  ok(rewrite, 'Falta la rewrite /api/:path* en vercel.json: sin ella, /api/entradas/ENTRY001 devolvia el 404 HTML de Vercel');
  ok(rewrite && rewrite.destination === '/api?__ruta=/api/:path*',
    'La rewrite debe reenviar a /api guardando la ruta original en el parametro __ruta');

  // b) El punto de entrada restaura esa ruta antes de llamar a Express
  const entrada = fs.readFileSync(path.join(RAIZ, 'api/index.js'), 'utf8');
  ok(entrada.includes("consulta.get('__ruta')"),
    'api/index.js no recupera la ruta original desde __ruta: Express veria "/api" y responderia 404');
  ok(entrada.includes('req.url = ruta'),
    'api/index.js no devuelve la ruta restaurada a req.url, por la que Express enruta');
  ok(entrada.includes('app(req, res)'),
    'api/index.js ya no enchufa la app Express como manejador de Vercel');
  ok(!fs.existsSync(path.join(RAIZ, 'api/[...path].js')),
    'api/[...path].js ya no debe existir: Vercel solo casaba un tramo y bloqueaba la rewrite');

  // c) El historial por dni y la rotacion del QR viajan en la query string,
  //    que la rewrite debe conservar junto a __ruta
  const cliente = fs.readFileSync(path.join(APP, 'js/cliente-api.js'), 'utf8');
  ok(cliente.includes("/historial?dni="),
    'obtenerHistorial debe poder filtrar por dni en la query string');
  ok(cliente.includes('/qr?log='),
    'actualizarQR debe enviar el parametro log en la query string');
}

/* ===================================================================== */
/* 8. La firma del QR debe sobrevivir el viaje por la base de datos      */
/* =================================================================== */
async function pruebasFirmaQr() {
  grupo('8. Firma del QR compatible con la columna TIMESTAMP');

  const backend = fs.readFileSync(path.join(RAIZ, 'backend/index.js'), 'utf8');

  const inicio = backend.indexOf('function generarToken');
  const bloque = inicio >= 0 ? backend.slice(inicio, inicio + 700) : '';
  ok(inicio >= 0, 'Falta generarToken() en el backend');
  ok(bloque.includes('Math.floor') && bloque.includes('/ 1000) * 1000'),
    'generarToken debe redondear la expiracion al segundo ANTES de firmarla: expira_en es TIMESTAMP, que guarda sin milisegundos, y una firma calculada con ms nunca cuadraba al validar (todo QR daba "firma no valida")');
  ok(bloque.includes('firmarToken(codigo, nonce, expira)'),
    'La firma debe calcularse sobre el instante ya redondeado (expira)');
  const inicioFirma = backend.indexOf('function firmarToken');
  const bloqueFirma = inicioFirma >= 0 ? backend.slice(inicioFirma, inicioFirma + 400) : '';
  ok(bloqueFirma.includes('expira.getTime()'),
    'firmarToken debe usar el instante de expiracion para calcular el HMAC');

  const validar = backend.slice(backend.indexOf("app.post('/api/qr/validar'"));
  ok(validar.includes('firmarToken(t.codigo, nonce, expiraEn)'),
    'La validacion debe recalcular la firma sobre el instante leido de la base, igual que al generarla');
}

/* ===================================================================== */
/* 12. Encargados de puerta (panel staff)                               */
/* ===================================================================== */
async function pruebasEncargados() {
  grupo('12. Encargados de puerta (panel staff)');

  const backend = fs.readFileSync(path.join(RAIZ, 'backend/index.js'), 'utf8');
  const pagina = path.join(APP, 'staff', 'index.html');
  const css = path.join(APP, 'staff', 'staff.css');
  const js = path.join(APP, 'staff', 'staff.js');

  ok(fs.existsSync(pagina), 'Falta frontend/staff/index.html (panel del encargado)');
  ok(fs.existsSync(css), 'Falta frontend/staff/staff.css');
  ok(fs.existsSync(js), 'Falta frontend/staff/staff.js');
  if (!fs.existsSync(pagina) || !fs.existsSync(js)) return;

  const html = fs.readFileSync(pagina, 'utf8');
  const codigo = fs.readFileSync(js, 'utf8');

  ok(html.includes('href="staff.css"'), 'El panel no carga su hoja de estilos');
  ok(html.includes('src="staff.js"'), 'El panel no carga su script');

  ['vista-login', 'form-login', 'enc-nombre', 'enc-codigo', 'btn-entrar',
   'vista-panel', 'btn-salir', 'btn-camara', 'qr-texto', 'btn-verificar',
   'resultado', 'btn-registrar', 'contador', 'escaneos'].forEach(id => {
    ok(html.includes('id="' + id + '"'), 'El panel no tiene el id "' + id + '"');
  });

  // Todo id que usa el JS debe existir en la pagina
  const idsHtml = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const usados = new Set();
  for (const m of codigo.matchAll(/el\(\s*'([^']+)'\s*\)/g)) usados.add(m[1]);
  usados.forEach(id => ok(idsHtml.has(id),
    'staff.js usa el id "' + id + '" que no existe en staff/index.html'));

  // Cámara y llamadas a la API
  ok(codigo.includes('getUserMedia'), 'staff.js no abre la cámara del celular');
  ok(codigo.includes('BarcodeDetector'), 'staff.js no usa BarcodeDetector para leer el QR');
  ok(codigo.includes('/encargados/login'), 'staff.js no llama al login de encargados');
  ok(codigo.includes('/encargados/validar'), 'staff.js no llama a la validacion de encargados');
  ok(codigo.includes('jsp_encargado'), 'staff.js no conserva la sesion del encargado');

  // Backend: endpoints, hash y trazabilidad
  ok(backend.includes("app.post('/api/encargados/login'"), 'Falta POST /api/encargados/login');
  ok(backend.includes("app.post('/api/encargados/validar'"), 'Falta POST /api/encargados/validar');
  ok(backend.includes('hashCodigoEncargado'), 'El backend no hashea el codigo del encargado');
  ok(backend.includes("createHash('sha256')"), 'El codigo del encargado no se guarda como SHA-256');
  ok(backend.includes('codigo_hash'), 'El backend no consulta la tabla encargados');
  ok(backend.includes('Ingreso registrado por ${encargado.nombre}'),
    'El ingreso no deja constancia del encargado en el historial');

  // Base de datos: tabla y hashes sembrados (sin codigos en claro)
  const init = fs.readFileSync(path.join(RAIZ, 'database', 'init.sql'), 'utf8');
  ok(/CREATE TABLE IF NOT EXISTS encargados/.test(init), 'init.sql no crea la tabla encargados');
  ok(!/INSERT INTO encargados[\s\S]*ANA2026/.test(init),
    'init.sql no debe guardar el codigo del encargado en claro');
  ok(init.includes('05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083'),
    'Falta el hash de Ana Torres en init.sql');
  ok(init.includes('0e1a8938b8da063e695a1a93c11eb3c61fbf78788269d0689f5b96fabd5df65b'),
    'Falta el hash de Luis Paredes en init.sql');

  // Enlace desde la web publica y script de migracion
  const sobre = fs.readFileSync(path.join(APP, 'sobre.html'), 'utf8');
  ok(sobre.includes('href="staff/"'), 'sobre.html no enlaza al panel de encargados');
  ok(fs.existsSync(path.join(RAIZ, 'scripts', 'migrar-encargados.js')),
    'Falta scripts/migrar-encargados.js (migracion de la base remota)');

  // Gestion de cuentas por consola: npm run encargado
  const gestion = path.join(RAIZ, 'scripts', 'encargado.js');
  ok(fs.existsSync(gestion), 'Falta scripts/encargado.js (alta y cambios de encargados)');
  if (fs.existsSync(gestion)) {
    const codigoGestion = fs.readFileSync(gestion, 'utf8');
    const paquete = fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8');
    ok(/"encargado"\s*:\s*"node scripts\/encargado\.js"/.test(paquete),
      'package.json no define el script npm run encargado');
    ok(codigoGestion.includes('--remoto'), 'scripts/encargado.js no admite --remoto (produccion)');
    ok(codigoGestion.includes("createHash('sha256')"), 'scripts/encargado.js no calcula el hash SHA-256');
    ok(codigoGestion.includes('--renombrar'), 'scripts/encargado.js no permite cambiar el nombre');
    ok(codigoGestion.includes('--desactivar'), 'scripts/encargado.js no permite dar de baja cuentas');
  }

  // El ingreso en puerta solo lo puede registrar un encargado
  const backendIngreso = fs.readFileSync(path.join(RAIZ, 'backend/index.js'), 'utf8');
  ok(backendIngreso.includes("motivo: 'solo-encargado'"),
    'backend/index.js permite marcar una entrada como usada sin pasar por el panel de encargados');
  ok(/estado === 'usado'\) \{\s*\n\s*return fallo\(res, 403/.test(backendIngreso),
    'falta el 403 de /api/entradas/:codigo/estado/usado');
  ok(backendIngreso.includes('WHERE invalidado = 0 AND entrada_id ='),
    'al registrar por codigo no se cierra el token vigente de la entrada');
  const jsEntrada = fs.readFileSync(path.join(APP, 'js', 'entrada.js'), 'utf8');
  ok(!jsEntrada.includes('puedeSimular'),
    'entrada.js vuelve a mostrar "Simular ingreso" al asistente');
}

/* ===================================================================== */
(async function () {
  pruebasEstaticas();
  await pruebasApi();
  await pruebasPaginas();
  await pruebasPropiedad();
  await pruebasTransferenciaBackend();
  await pruebasQrDeLaPersona();
  await pruebasEntradaTrasIdentificar();
  await pruebasRegistroUsuarios();
  await pruebasInicioSesion();
  await pruebasModoApi();
  await pruebasEnrutadoVercel();
  await pruebasFirmaQr();
  await pruebasEncargados();

  console.log('\n------------------------------------------------------------');
  console.log('  Verificacion funcional: ' + pruebas + ' comprobaciones, ' + fallos + ' fallo(s).');
  console.log('------------------------------------------------------------');
  process.exit(fallos ? 1 : 0);
})().catch(e => {
  console.error('\nERROR FATAL:', e);
  process.exit(1);
});
