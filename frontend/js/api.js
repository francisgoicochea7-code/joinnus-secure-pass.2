/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/api.js
 * -------------------------------------------------------------------------
 * Capa de datos con DOS modos de funcionamiento transparentes:
 *
 *   MODO API   -> el contenedor "backend" (Express + PostgreSQL) responde.
 *                 Los datos viven en la base de datos y los tokens QR se
 *                 firman en el servidor con HMAC-SHA256.
 *
 *   MODO LOCAL -> no hay backend disponible (se abrio index.html con doble
 *                 clic). Se usan los mismos datos ficticios guardados en
 *                 localStorage. Es el modo original del prototipo.
 *
 * La interfaz no cambia en ninguno de los dos casos: las funciones publicas
 * tienen exactamente las mismas firmas.
 * ========================================================================= */

const SecurePassAPI = (function () {
  'use strict';

  /* -------------------------------------------------------------------
   * Claves de almacenamiento del modo local
   * ----------------------------------------------------------------- */
  const STORAGE_ENTRADAS = 'jsp.entradas.v1';
  const STORAGE_HISTORIAL = 'jsp.historial.v1';
  const STORAGE_SESION = 'jsp.sesion.v1';
  const STORAGE_SEED = 'jsp.seed.v1';
  /* 5 = ENTRY001 nace con token (igual que database/init.sql), de modo que la
     transferencia tiene siempre un "QR anterior" que invalidar en ambos modos */
  const SEED_VERSION = 5;

  const LATENCIA_MS = 260;

  /* -------------------------------------------------------------------
   * Metadatos de estado
   * ----------------------------------------------------------------- */
  const ESTADOS = {
    valido: {
      clave: 'valido',
      etiqueta: 'Válido / Sin usar',
      corta: 'Válido',
      clase: 'badge-valido',
      punto: 'st-valido',
      emoji: '🟢',
      icono: 'check-circle',
      color: '#22c55e',
      descripcion: 'La entrada está activa y puede utilizarse una sola vez.'
    },
    usado: {
      clave: 'usado',
      etiqueta: 'Usado / Ingresado',
      corta: 'Usado',
      clase: 'badge-usado',
      punto: 'st-usado',
      emoji: '🔴',
      icono: 'x-circle',
      color: '#f43f5e',
      descripcion: 'Esta entrada ya fue utilizada para ingresar al evento.'
    },
    anulado: {
      clave: 'anulado',
      etiqueta: 'Anulado',
      corta: 'Anulado',
      clase: 'badge-anulado',
      punto: 'st-anulado',
      emoji: '🟠',
      icono: 'ban',
      color: '#f59e0b',
      descripcion: 'Esta entrada ya no puede utilizarse.'
    },
    transferido: {
      clave: 'transferido',
      etiqueta: 'Transferido',
      corta: 'Transferido',
      clase: 'badge-transferido',
      punto: 'st-transferido',
      emoji: '🔵',
      icono: 'repeat',
      color: '#3b82f6',
      descripcion: 'Esta entrada fue transferida a un nuevo titular.'
    }
  };

  /* -------------------------------------------------------------------
   * Usuario de la sesion
   * ------------------------------------------------------------------
   * Antes era fijo (siempre Carlos). Ahora depende de quien se haya
   * identificado en sesion.js. Si nadie se ha identificado, se usa el
   * usuario de demostracion para que el prototipo siga siendo usable
   * al abrirlo sin Docker.
   * ----------------------------------------------------------------- */
  const USUARIO_DEMO = {
    nombre: 'Carlos Pérez',
    dni: '45678945',
    correo: 'carlos.perez@demo.pe',
    evento: 'Universidad — Proyecto académico'
  };

  /** El usuario identificado, o el de demostracion como respaldo. */
  function usuarioSesion() {
    if (typeof window !== 'undefined' && window.Sesion && window.Sesion.estaIdentificado()) {
      const u = window.Sesion.usuario();
      if (u) {
        return {
          nombre: u.nombre,
          dni: u.dni,
          correo: '',
          evento: 'Universidad — Proyecto académico'
        };
      }
    }
    return USUARIO_DEMO;
  }

  /** Objeto compatible con el USUARIO de siempre (se lee de forma sincrona). */
  const USUARIO = {
    get nombre() { return usuarioSesion().nombre; },
    get dni() { return usuarioSesion().dni; },
    get correo() { return usuarioSesion().correo; },
    get evento() { return usuarioSesion().evento; }
  };

  /* -------------------------------------------------------------------
   * Base de datos ficticia (modo local) — replica database/init.sql
   * ----------------------------------------------------------------- */
  const BASE_DATOS_ENTRADAS = {
    ENTRY001: {
      codigo: 'ENTRY001',
      evento: 'Lima Music Fest',
      fecha: '2026-09-29',
      hora: '20:00',
      lugar: 'Estadio Nacional',
      zona: 'Preferencial',
      fila: 'B',
      asiento: '24',
      titular: 'Carlos Pérez',
      dni: '45678945',
      correo: 'carlos.perez@demo.pe',
      estado: 'valido',
      precioOriginal: 120,
      precioMaximo: 120,
      qrToken: 'JSP-ENTRY001-8F42A91C',
      qrAnterior: null,
      creadoEn: '2026-09-29T10:00:00'
    },
    ENTRY002: {
      codigo: 'ENTRY002',
      evento: 'Lima Music Fest',
      fecha: '2026-09-29',
      hora: '18:00',
      lugar: 'Estadio Nacional',
      zona: 'Platea',
      fila: 'P',
      asiento: '112',
      titular: 'Andrea Torres',
      dni: '52311878',
      correo: 'andrea.torres@demo.pe',
      estado: 'usado',
      precioOriginal: 180,
      precioMaximo: 180,
      qrToken: 'JSP-ENTRY002-B31D07E2',
      qrAnterior: null,
      usadoEn: '2026-09-29T18:12:00',
      creadoEn: '2026-09-12T09:30:00'
    },
    ENTRY003: {
      codigo: 'ENTRY003',
      evento: 'Festival Lima 2026',
      fecha: '2026-10-17',
      hora: '17:00',
      lugar: 'Parque de la Exposición',
      zona: 'General',
      fila: '—',
      asiento: 'G-120',
      titular: 'Luis Ramírez',
      dni: '40125678',
      correo: 'luis.ramirez@demo.pe',
      estado: 'anulado',
      precioOriginal: 90,
      precioMaximo: 90,
      qrToken: 'JSP-ENTRY003-77AC0D55',
      qrAnterior: null,
      motivoAnulacion: 'Solicitud del titular (devolución)',
      creadoEn: '2026-09-05T11:15:00'
    },
    ENTRY004: {
      codigo: 'ENTRY004',
      evento: 'Concierto Lima Rock',
      fecha: '2026-11-07',
      hora: '21:00',
      lugar: 'Estadio Alejandro Villanueva',
      zona: 'Tribuna',
      fila: 'T',
      asiento: '18',
      titular: 'Diego Vargas',
      dni: '47258963',
      correo: 'diego.vargas@demo.pe',
      estado: 'transferido',
      precioOriginal: 150,
      precioMaximo: 150,
      qrToken: 'JSP-ENTRY004-D00F1234',
      qrAnterior: 'JSP-ENTRY004-11AA22BB',
      titularAnterior: 'Renato Silva',
      dniAnterior: '39521478',
      creadoEn: '2026-09-15T16:45:00'
    },
    ENTRY005: {
      codigo: 'ENTRY005',
      evento: 'Liga 1 - Final',
      fecha: '2026-11-22',
      hora: '16:00',
      lugar: 'Estadio Nacional',
      zona: 'Popular',
      fila: 'N',
      asiento: '55',
      titular: 'María Torres',
      dni: '43871264',
      correo: 'maria.torres@demo.pe',
      estado: 'valido',
      precioOriginal: 110,
      precioMaximo: 110,
      qrToken: 'JSP-ENTRY005-C55D99AB',
      qrAnterior: null,
      creadoEn: '2026-09-18T08:20:00'
    },
    ENTRY006: {
      codigo: 'ENTRY006',
      evento: 'Liga 1 - Partido de Exhibición',
      fecha: '2026-10-03',
      hora: '19:30',
      lugar: 'Estadio Alejandro Villanueva',
      zona: 'Tribuna',
      fila: 'A',
      asiento: '9',
      titular: 'Carlos Pérez',
      dni: '45678945',
      correo: 'carlos.perez@demo.pe',
      estado: 'valido',
      precioOriginal: 120,
      precioMaximo: 120,
      qrToken: 'JSP-ENTRY006-5A2E77C1',
      qrAnterior: null,
      creadoEn: '2026-09-20T10:10:00'
    },
    ENTRY007: {
      codigo: 'ENTRY007',
      evento: 'Liga 1 - Final',
      fecha: '2026-11-22',
      hora: '16:00',
      lugar: 'Estadio Nacional',
      zona: 'Popular',
      fila: 'N',
      asiento: '56',
      titular: 'Renato Silva',
      dni: '39521478',
      correo: 'renato.silva@demo.pe',
      estado: 'valido',
      precioOriginal: 110,
      precioMaximo: 110,
      qrToken: 'JSP-ENTRY007-90BB3F6D',
      qrAnterior: null,
      creadoEn: '2026-09-21T13:40:00'
    }
  };

  const HISTORIAL_INICIAL = [
    { codigo: 'ENTRY001', accion: 'creada', fecha: '2026-09-29T10:00:00', titular: 'Carlos Pérez' },
    { codigo: 'ENTRY001', accion: 'verificada', fecha: '2026-09-29T12:30:00', titular: 'Carlos Pérez' },
    { codigo: 'ENTRY001', accion: 'qr', fecha: '2026-09-29T12:30:00', titular: 'Carlos Pérez' },
    { codigo: 'ENTRY002', accion: 'creada', fecha: '2026-09-12T09:30:00', titular: 'Andrea Torres' },
    { codigo: 'ENTRY002', accion: 'usada', fecha: '2026-09-29T18:12:00', titular: 'Andrea Torres' },
    { codigo: 'ENTRY003', accion: 'creada', fecha: '2026-09-05T11:15:00', titular: 'Luis Ramírez' },
    { codigo: 'ENTRY003', accion: 'anulada', fecha: '2026-09-20T09:00:00', titular: 'Luis Ramírez' },
    { codigo: 'ENTRY004', accion: 'creada', fecha: '2026-09-15T16:45:00', titular: 'Renato Silva' },
    { codigo: 'ENTRY004', accion: 'transferida', fecha: '2026-09-22T15:20:00', titular: 'Diego Vargas' },
    { codigo: 'ENTRY004', accion: 'qr', fecha: '2026-09-22T15:20:00', titular: 'Diego Vargas' },
    { codigo: 'ENTRY005', accion: 'creada', fecha: '2026-09-18T08:20:00', titular: 'María Torres' },
    { codigo: 'ENTRY006', accion: 'creada', fecha: '2026-09-20T10:10:00', titular: 'Carlos Pérez' },
    { codigo: 'ENTRY007', accion: 'creada', fecha: '2026-09-21T13:40:00', titular: 'Renato Silva' }
  ];

  /* ===================================================================
   *  PARTE 1 — ALMACENAMIENTO LOCAL (modo sin servidor)
   * =================================================================== */
  function leer(clave, porDefecto) {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : porDefecto;
    } catch (e) {
      console.warn('[JSP] No se pudo leer localStorage:', clave, e);
      return porDefecto;
    }
  }

  function escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.warn('[JSP] No se pudo escribir en localStorage:', clave, e);
      return false;
    }
  }

  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clonar(objeto) {
    return JSON.parse(JSON.stringify(objeto));
  }

  function ahoraISO() {
    return new Date().toISOString();
  }

  function generarToken(codigo) {
    // Token ficticio de 8 caracteres hexadecimales.
    // En modo API la firma HMAC-SHA256 la calcula el servidor.
    const hex = '0123456789ABCDEF';
    let semilla = '';
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint8Array(4);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < buf.length; i++) semilla += hex[(buf[i] >> 4) & 15] + hex[buf[i] & 15];
    } else {
      // Sin Web Crypto (navegadores muy antiguos) se usa el reloj:
      // es un token de demostración, no una credencial real.
      semilla = (Date.now() % 0xffffffff).toString(16).toUpperCase();
    }
    return `JSP-${codigo}-${semilla.slice(0, 8)}`;
  }

  function construirPayload(codigo, token) {
    const sufijo = String(token).split('-').pop();
    const d = new Date();
    const reloj = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return `JSP|${codigo}|${sufijo}|${reloj}`;
  }

  function sembrar() {
    const versionActual = leer(STORAGE_SEED, 0);
    if (versionActual === SEED_VERSION && leer(STORAGE_ENTRADAS, null)) return false;

    const entradas = {};
    for (const codigo of Object.keys(BASE_DATOS_ENTRADAS)) {
      entradas[codigo] = clonar(BASE_DATOS_ENTRADAS[codigo]);
    }
    escribir(STORAGE_ENTRADAS, entradas);
    escribir(STORAGE_HISTORIAL, HISTORIAL_INICIAL.map((h, i) => Object.assign({ id: `H${i + 1}` }, h)));
    escribir(STORAGE_SEED, SEED_VERSION);
    escribir(STORAGE_SESION, { usuario: USUARIO, iniciadaEn: ahoraISO() });
    return true;
  }

  function obtenerMapaEntradas() {
    sembrar();
    return leer(STORAGE_ENTRADAS, {});
  }

  function guardarMapaEntradas(mapa) {
    escribir(STORAGE_ENTRADAS, mapa);
  }

  function obtenerHistorialCompleto() {
    sembrar();
    return leer(STORAGE_HISTORIAL, []);
  }

  function registrar(codigo, accion, titular, detalle) {
    const historial = obtenerHistorialCompleto();
    const registro = {
      id: 'H' + Date.now().toString(36).toUpperCase() + String((Date.now() % 900) + 100),
      codigo: codigo,
      accion: accion,
      titular: titular || '—',
      detalle: detalle || '',
      fecha: ahoraISO()
    };
    historial.push(registro);
    escribir(STORAGE_HISTORIAL, historial);
    return registro;
  }

  function enriquecer(entrada) {
    if (!entrada) return null;
    const meta = ESTADOS[entrada.estado] || ESTADOS.valido;
    return Object.assign({}, entrada, {
      estadoDetalle: meta,
      dniOculto: ocultarDNI(entrada.dni),
      dniAnteriorOculto: entrada.dniAnterior ? ocultarDNI(entrada.dniAnterior) : null,
      precio: entrada.precioOriginal != null ? Number(entrada.precioOriginal) : 0,
      puedeTransferir: entrada.estado === 'valido',
      esMia: entrada.dni === USUARIO.dni
    });
  }

  function ocultarDNI(dni) {
    const d = String(dni || '');
    if (d.length < 4) return '********';
    return '********' + d.slice(-2);
  }

  /* --- Operaciones locales ------------------------------------------- */
  async function consultarEntradaLocal(codigo) {
    await esperar(LATENCIA_MS);
    if (!codigo) return null;
    const clave = String(codigo).trim().toUpperCase();
    const entrada = obtenerMapaEntradas()[clave];
    return entrada ? enriquecer(entrada) : null;
  }

  async function actualizarQRLocal(codigo, opciones) {
    const opts = opciones || {};
    await esperar(opts.silencioso ? 0 : 180);
    const clave = String(codigo).trim().toUpperCase();
    const mapa = obtenerMapaEntradas();
    const entrada = mapa[clave];
    if (!entrada) return null;

    const tokenAnterior = entrada.qrToken;
    const nuevoToken = generarToken(clave);

    entrada.qrAnterior = tokenAnterior;
    entrada.qrToken = nuevoToken;
    entrada.qrGeneradoEn = ahoraISO();
    guardarMapaEntradas(mapa);

    if (opts.log !== false) {
      registrar(clave, 'qr', entrada.titular,
        tokenAnterior ? `Nuevo QR generado (se invalidó ${tokenAnterior})` : 'Nuevo QR generado');
    }

    return {
      codigo: clave,
      token: nuevoToken,
      tokenAnterior: tokenAnterior,
      payload: construirPayload(clave, nuevoToken),
      entrada: enriquecer(entrada)
    };
  }

  async function transferirEntradaLocal(codigo, nuevoTitular) {
    await esperar(420);
    const clave = String(codigo).trim().toUpperCase();
    const mapa = obtenerMapaEntradas();
    const entrada = mapa[clave];

    const sesion = typeof window !== 'undefined' && window.Sesion;
    const dni = sesion && sesion.estaIdentificado() ? sesion.dni() : null;
    if (!dni) return { ok: false, error: 'Inicia sesión para transferir tu entrada.', status: 401 };
    if (!entrada) return { ok: false, error: 'La entrada no existe en el sistema.' };
    if (entrada.dni !== dni) return { ok: false, error: 'Solo puedes transferir tus propias entradas.', status: 403 };
    if (entrada.estado !== 'valido') {
      return {
        ok: false,
        error: `No es posible transferir una entrada con estado "${ESTADOS[entrada.estado].etiqueta}".`
      };
    }

    const validacion = validarTransferencia(nuevoTitular, entrada);
    if (!validacion.ok) {
      return { ok: false, error: validacion.error, campos: validacion.campos };
    }

    const titularAnterior = entrada.titular;
    const dniAnterior = entrada.dni;
    const tokenAnterior = entrada.qrToken;

    entrada.titular = nuevoTitular.nombre.trim();
    entrada.dni = nuevoTitular.dni.trim();
    entrada.correo = nuevoTitular.correo.trim();
    entrada.precioTransferencia = Number(nuevoTitular.precio);
    entrada.estado = 'transferido';
    entrada.titularAnterior = titularAnterior;
    entrada.dniAnterior = dniAnterior;
    entrada.transferidaEn = ahoraISO();
    entrada.qrAnterior = tokenAnterior;
    entrada.qrToken = generarToken(clave);
    entrada.qrGeneradoEn = ahoraISO();

    guardarMapaEntradas(mapa);

    registrar(clave, 'transferida', entrada.titular,
      `${titularAnterior} → ${entrada.titular} · S/ ${Number(nuevoTitular.precio).toFixed(2)}`);
    registrar(clave, 'qr', entrada.titular,
      tokenAnterior ? `Nuevo QR generado (se invalidó ${tokenAnterior})` : 'Nuevo QR generado para el nuevo titular');

    return {
      ok: true,
      codigo: clave,
      titularAnterior: titularAnterior,
      titularNuevo: entrada.titular,
      dniAnterior: ocultarDNI(dniAnterior),
      dniNuevo: ocultarDNI(entrada.dni),
      precio: Number(nuevoTitular.precio),
      estado: entrada.estado,
      estadoEtiqueta: ESTADOS[entrada.estado].etiqueta,
      tokenAnterior: tokenAnterior,
      tokenNuevo: entrada.qrToken,
      payload: construirPayload(clave, entrada.qrToken),
      entrada: enriquecer(entrada)
    };
  }

  async function obtenerHistorialLocal(codigo, dni) {
    await esperar(140);
    const historial = obtenerHistorialCompleto();
    let filtrado = historial;

    if (codigo) {
      filtrado = historial.filter(h => h.codigo === String(codigo).trim().toUpperCase());
    } else if (dni) {
      // Movimientos de una persona: las entradas que posee ahora mas las que
      // aparecen en alguna transferencia con su DNI (para que un traspaso no
      // desaparezca de su historial).
      const mias = Object.keys(obtenerMapaEntradas())
        .filter(c => obtenerMapaEntradas()[c].dni === dni);
      filtrado = historial.filter(h => mias.indexOf(h.codigo) !== -1);
    }

    return filtrado.slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  async function listarEntradasLocal() {
    await esperar(LATENCIA_MS);
    const mapa = obtenerMapaEntradas();
    return Object.keys(mapa).map(k => enriquecer(mapa[k]));
  }

  async function obtenerResumenLocal() {
    const entradas = await listarEntradasLocal();
    const mias = entradas.filter(e => e.esMia);
    return {
      activas: mias.filter(e => e.estado === 'valido').length,
      usadas: entradas.filter(e => e.estado === 'usado').length,
      transferidas: entradas.filter(e => e.estado === 'transferido').length,
      anuladas: entradas.filter(e => e.estado === 'anulado').length,
      total: entradas.length,
      mias: mias.length
    };
  }

  async function marcarUsadaLocal(codigo) {
    const clave = String(codigo).trim().toUpperCase();
    const mapa = obtenerMapaEntradas();
    const entrada = mapa[clave];
    if (!entrada || entrada.estado !== 'valido') return null;
    entrada.estado = 'usado';
    entrada.usadoEn = ahoraISO();
    guardarMapaEntradas(mapa);
    registrar(clave, 'usada', entrada.titular, 'Ingreso registrado en el evento');
    return enriquecer(entrada);
  }

  async function reiniciarDemoLocal() {
    await esperar(220);
    localStorage.removeItem(STORAGE_ENTRADAS);
    localStorage.removeItem(STORAGE_HISTORIAL);
    localStorage.removeItem(STORAGE_SESION);
    localStorage.removeItem(STORAGE_SEED);
    sembrar();
    return true;
  }

  /* --- Validadores (compartidos por ambos modos) --------------------- */
  function validarDNI(dni) {
    const valor = String(dni || '').trim();
    if (!valor) return { ok: false, mensaje: 'El DNI es obligatorio.' };
    if (!/^\d{8}$/.test(valor)) return { ok: false, mensaje: 'El DNI debe tener exactamente 8 números.' };
    return { ok: true, valor: valor };
  }

  function validarCorreo(correo) {
    const valor = String(correo || '').trim();
    if (!valor) return { ok: false, mensaje: 'El correo electrónico es obligatorio.' };
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(valor)) {
      return { ok: false, mensaje: 'Ingresa un correo electrónico válido (ejemplo@correo.com).' };
    }
    return { ok: true, valor: valor };
  }

  function validarNombre(nombre) {
    const valor = String(nombre || '').trim();
    if (!valor) return { ok: false, mensaje: 'El nombre del nuevo titular es obligatorio.' };
    if (valor.length < 5) return { ok: false, mensaje: 'El nombre debe tener al menos 5 caracteres.' };
    if (valor.split(/\s+/).length < 2) {
      return { ok: false, mensaje: 'Ingresa el nombre y el apellido del nuevo titular.' };
    }
    if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ' ]+$/.test(valor)) {
      return { ok: false, mensaje: 'El nombre solo puede contener letras y espacios.' };
    }
    return { ok: true, valor: valor };
  }

  function validarPrecio(precio, entrada) {
    const maximo = Number(entrada.precioMaximo != null ? entrada.precioMaximo : entrada.precio);
    if (precio === '' || precio == null) {
      return { ok: false, mensaje: 'Indique el precio de transferencia.' };
    }
    const numero = Number(precio);
    if (Number.isNaN(numero) || numero < 0) {
      return { ok: false, mensaje: 'El precio debe ser un número válido en soles.' };
    }
    if (numero > maximo) {
      return { ok: false, limite: true, mensaje: 'El precio de transferencia supera el límite permitido.' };
    }
    return { ok: true, valor: numero };
  }

  function validarTransferencia(datos, entrada) {
    const nombre = validarNombre(datos.nombre);
    const dni = validarDNI(datos.dni);
    const correo = validarCorreo(datos.correo);
    const precio = validarPrecio(datos.precio, entrada);

    const campos = {};
    if (!nombre.ok) campos.nombre = nombre.mensaje;
    if (!dni.ok) campos.dni = dni.mensaje;
    if (!correo.ok) campos.correo = correo.mensaje;
    if (!precio.ok) campos.precio = precio.mensaje;

    if (Object.keys(campos).length) {
      return { ok: false, error: 'Revisa los datos del formulario.', campos: campos };
    }
    return { ok: true };
  }

  /* ===================================================================
   *  PARTE 2 — SELECCION DE MODO (API con Docker  /  localStorage)
   * =================================================================== */
  const Cliente = (typeof window !== 'undefined' && window.ClienteAPI) ? window.ClienteAPI : null;
  let modoApi = false;

  /** true si el backend responde; false si se trabaja con localStorage */
  async function usarApi() {
    if (!Cliente) return false;
    try {
      modoApi = await Cliente.comprobar();
    } catch (e) {
      modoApi = false;
    }
    return modoApi;
  }

  function modoActual() {
    return modoApi ? 'api' : 'local';
  }

  /** Si la peticion falla por red, se degrada al modo local */
  function degradar(error) {
    if (error && error.esRed) {
      modoApi = false;
      if (Cliente) Cliente.reiniciarComprobacion();
    }
    return error;
  }

  /** El servidor YA respondio (400/403/404/409/500): ese es el error real y
   *  no hay que sustituirlo por el modo local, que trabaja con otros datos y
   *  esconde el motivo (por ejemplo "esta entrada pertenece a otra persona"
   *  se habria convertido en un fallo raro de la base local).
   *  Devuelve null si fue un fallo de red: en ese caso si procede local. */
  function errorDeServidor(e) {
    if (!e || typeof e.status !== 'number') return null;
    const cuerpo = e.body || {};
    return {
      ok: false,
      error: cuerpo.error || e.message || 'El servidor rechazo la operacion.',
      campos: cuerpo.campos,
      motivo: cuerpo.motivo,
      status: e.status
    };
  }

  /* ===================================================================
   *  PARTE 3 — API PUBLICA (misma firma en los dos modos)
   * =================================================================== */

  /**
   * consultarEntrada(codigo)
   * En modo API:  GET /api/entradas/:codigo
   * En modo local: base de datos ficticia guardada en localStorage
   */
  async function consultarEntrada(codigo) {
    if (await usarApi()) {
      try {
        const entrada = await Cliente.consultarEntrada(codigo);
        return entrada ? normalizarRemota(entrada) : null;
      } catch (e) {
        // Un rechazo de sesión/permisos nunca se sustituye por una entrada demo.
        if (errorDeServidor(e)) return null;
        degradar(e);
      }
    }
    return consultarEntradaLocal(codigo);
  }

  /**
   * actualizarQR(codigo, opciones)
   * En modo API:  POST /api/entradas/:codigo/qr  (firma HMAC en el servidor)
   */
  async function actualizarQR(codigo, opciones) {
    const opts = opciones || {};
    if (await usarApi()) {
      try {
        const r = await Cliente.actualizarQR(codigo, { log: opts.log });
        if (r) {
          return Object.assign({}, r, { entrada: normalizarRemota(r.entrada) });
        }
        return null;
      } catch (e) {
        // El servidor ya respondió (403: no es suya, 409: ya usada, 500…).
        // No se genera un token "local", que no existiría en la base de datos
        // y que el lector del evento rechazaría después.
        if (errorDeServidor(e)) return null;
        degradar(e);
      }
    }
    return actualizarQRLocal(codigo, opts);
  }

  /**
   * transferirEntrada(codigo, nuevoTitular)
   * En modo API:  POST /api/entradas/:codigo/transferir
   */
  async function transferirEntrada(codigo, nuevoTitular) {
    if (await usarApi()) {
      try {
        const r = await Cliente.transferirEntrada(codigo, nuevoTitular);
        if (r && r.ok) r.entrada = normalizarRemota(r.entrada);
        return r;
      } catch (e) {
        // 403 (la entrada pertenece a otra persona) o error del servidor: se
        // devuelve el motivo tal cual. Antes se caía al modo local, que no
        // conoce la entrada remota y respondía "La entrada no existe en el
        // sistema", escondiendo la causa real.
        const delServidor = errorDeServidor(e);
        if (delServidor) return delServidor;
        degradar(e);
        return { ok: false, error: 'No se pudo conectar con el servidor. Comprueba el estado de la entrada antes de reintentar.' };
      }
    }
    return transferirEntradaLocal(codigo, nuevoTitular);
  }

  /**
   * crearUsuario(datos)   datos = {dni, nombres, apellidos, correo}
   * En modo API:  POST /api/usuarios  (alta real en la base de datos)
   * En modo local: no hay base de datos, se explica y no se inventa el alta.
   * Devuelve {ok:true, usuario} o {ok:false, campo, mensaje}, el mismo
   * contrato que Sesion.identificar, para que el formulario marque el campo.
   */
  async function crearUsuario(datos) {
    const d = datos || {};

    const vDni = validarDNI(d.dni);
    if (!vDni.ok) return { ok: false, campo: 'dni', mensaje: vDni.mensaje };

    const nombres = String(d.nombres || '').replace(/\s+/g, ' ').trim();
    const apellidos = String(d.apellidos || '').replace(/\s+/g, ' ').trim();
    if (nombres.length < 2 || !/^\p{L}[\p{L}\s'.-]*$/u.test(nombres)) {
      return { ok: false, campo: 'nombres', mensaje: 'Escribe tus nombres (sólo letras).' };
    }
    if (apellidos.length < 2 || !/^\p{L}[\p{L}\s'.-]*$/u.test(apellidos)) {
      return { ok: false, campo: 'apellidos', mensaje: 'Escribe tus apellidos (sólo letras).' };
    }

    const vCorreo = validarCorreo(d.correo);
    if (!vCorreo.ok) return { ok: false, campo: 'correo', mensaje: vCorreo.mensaje };

    // La contraseña es obligatoria en la interfaz. En la capa de datos se
    // valida cuando viene; el servidor la exige igualmente para crear la
    // cuenta, así que no se puede saltar desde la consola.
    const clave = String(d.password == null ? '' : d.password);
    if (clave && clave.length < 8) {
      return { ok: false, campo: 'password', mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    if (clave.length > 200) {
      return { ok: false, campo: 'password', mensaje: 'La contraseña es demasiado larga (máximo 200 caracteres).' };
    }

    if (await usarApi()) {
      try {
        const cuerpo = {
          dni: vDni.valor,
          nombre: nombres + ' ' + apellidos,
          correo: String(vCorreo.valor).toLowerCase()
        };
        if (clave) cuerpo.password = clave;
        const r = await Cliente.crearUsuario(cuerpo);
        if (r && r.ok) return { ok: true, usuario: r.usuario };
        // 400 (datos inválidos) o 409 (DNI ya registrado): el servidor ya
        // dijo el motivo y el campo, se devuelve tal cual.
        return {
          ok: false,
          campo: (r && r.campo) || 'dni',
          mensaje: (r && (r.mensaje || r.error)) || 'No se pudo crear la cuenta.'
        };
      } catch (e) {
        const delServidor = errorDeServidor(e);
        if (delServidor) return { ok: false, campo: 'dni', mensaje: delServidor.error };
        degradar(e);
      }
    }
    return {
      ok: false,
      campo: 'dni',
      mensaje: 'El registro está disponible con la base de datos: arranca Docker (modo API).'
    };
  }

  /**
   * obtenerHistorial(codigo, dni)
   * - codigo: historial de una entrada concreta
   * - dni:    historial de los movimientos de esa persona
   * En modo API:  GET /api/entradas/:codigo/historial  |  GET /api/historial?dni=
   */
  async function obtenerHistorial(codigo, dni) {
    if (await usarApi()) {
      try {
        return await Cliente.obtenerHistorial(codigo, dni);
      } catch (e) {
        if (errorDeServidor(e)) return [];
        degradar(e);
      }
    }
    return obtenerHistorialLocal(codigo, dni);
  }

  /** Normaliza la respuesta de la API al formato interno de la interfaz */
  function normalizarRemota(e) {
    if (!e) return null;
    return Object.assign({}, e, {
      estadoDetalle: e.estadoDetalle || ESTADOS[e.estado] || ESTADOS.valido,
      dniOculto: e.dniOculto || ocultarDNI(e.dni),
      puedeTransferir: e.puedeTransferir !== undefined ? e.puedeTransferir : e.estado === 'valido',
      esMia: e.esMia !== undefined ? e.esMia : e.dni === USUARIO.dni
    });
  }

  /* --- Funciones de apoyo de la interfaz ---------------------------- */
  async function listarEntradas() {
    if (await usarApi()) {
      try {
        const lista = await Cliente.listarEntradas();
        return lista.map(normalizarRemota);
      } catch (e) {
        if (errorDeServidor(e)) return [];
        degradar(e);
      }
    }
    return listarEntradasLocal();
  }

  async function listarMisEntradas() {
    const todas = await listarEntradas();
    return todas.filter(e => e.esMia);
  }

  async function obtenerResumen() {
    if (await usarApi()) {
      try {
        const r = await Cliente.obtenerResumen();
        if (r) return r;
      } catch (e) { degradar(e); }
    }
    return obtenerResumenLocal();
  }

  async function verificar(codigo) {
    if (await usarApi()) {
      try {
        const entrada = await Cliente.verificar(codigo);
        return entrada ? normalizarRemota(entrada) : null;
      } catch (e) { degradar(e); }
    }
    const entrada = await consultarEntradaLocal(codigo);
    if (entrada) {
      registrar(entrada.codigo, 'verificada', entrada.titular, 'Consulta de estado desde el verificador');
    }
    return entrada;
  }

  async function marcarUsada(codigo) {
    if (await usarApi()) {
      try {
        const entrada = await Cliente.cambiarEstado(codigo, 'usado');
        return normalizarRemota(entrada);
      } catch (e) {
        // Un "409 ya usada" o "403 no es suya" del servidor NO se convierte
        // en un cambio de estado local: el lector no debe dar por registrada
        // una entrada que el backend rechazó. null = no se pudo (igual que en
        // modo local).
        if (errorDeServidor(e)) return null;
        degradar(e);
      }
    }
    return marcarUsadaLocal(codigo);
  }

  async function reiniciarDemo() {
    if (await usarApi()) {
      try {
        await Cliente.reiniciarDemo();
        return true;
      } catch (e) { degradar(e); }
    }
    return reiniciarDemoLocal();
  }

  /** Valida un token del QR contra el backend (simula el lector fisico) */
  async function validarToken(token) {
    if (await usarApi()) {
      try {
        return await Cliente.validarToken(token);
      } catch (e) { degradar(e); }
    }
    // En modo local se comprueba contra la entrada almacenada
    const codigo = String(token || '').split('-')[1];
    if (!codigo) return { valido: false, motivo: 'formato' };
    const entrada = await consultarEntradaLocal(codigo);
    if (!entrada) return { valido: false, motivo: 'desconocido' };
    return {
      valido: entrada.estado === 'valido' || entrada.estado === 'transferido',
      motivo: entrada.estado,
      codigo: entrada.codigo,
      titular: entrada.titular,
      entrada
    };
  }

  /* --- Arranque del modo local (por si se abre sin Docker) ---------- */
  sembrar();

  /* ===================================================================
   *  Exportacion
   * =================================================================== */
  return {
    ESTADOS: ESTADOS,
    USUARIO: USUARIO,
    BASE_DATOS: BASE_DATOS_ENTRADAS,

    // Funciones principales (identicas en los dos modos)
    consultarEntrada: consultarEntrada,
    actualizarQR: actualizarQR,
    transferirEntrada: transferirEntrada,
    crearUsuario: crearUsuario,
    obtenerHistorial: obtenerHistorial,

    // Funciones de apoyo de la interfaz
    listarEntradas: listarEntradas,
    listarMisEntradas: listarMisEntradas,
    obtenerResumen: obtenerResumen,
    verificar: verificar,
    marcarUsada: marcarUsada,
    reiniciarDemo: reiniciarDemo,
    validarToken: validarToken,
    registrar: registrar,

    // Estado de la conexion
    modoActual: modoActual,
    usarApi: usarApi,
    urlApi: function () { return Cliente ? Cliente.urlBase() : null; },

    // Utilidades
    construirPayload: construirPayload,
    generarToken: generarToken,
    ocultarDNI: ocultarDNI,
    validarDNI: validarDNI,
    validarCorreo: validarCorreo,
    validarNombre: validarNombre,
    validarPrecio: validarPrecio
  };
})();

/* Igual que en cliente-api.js: un `const` de nivel superior no aparece en
   `window`. app.js consulta `window.SecurePassAPI` para los badges de estado,
   para enmascarar el DNI y para mostrar el indicador de conexion. */
if (typeof window !== 'undefined') window.SecurePassAPI = SecurePassAPI;
