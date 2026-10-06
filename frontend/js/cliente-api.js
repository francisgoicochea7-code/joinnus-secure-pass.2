/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/cliente-api.js
 * -------------------------------------------------------------------------
 * Cliente HTTP del backend (contenedor "backend" de Docker).
 *
 * No requiere librerias externas: usa fetch. Si en algun momento se quiere
 * usar Axios, solo hay que sustituir `pedir()` por `axios.get/post`
 * manteniendo las mismas rutas y la misma forma de respuesta.
 *
 * El cliente es "inteligente": prueba varias direcciones y remembers la
 * primera que responde. Si ninguna funciona (por ejemplo, al abrir el
 * prototipo con doble clic, sin Docker), SecurePassAPI cae automaticamente
 * en la simulacion local con localStorage.
 * ========================================================================= */

const ClienteAPI = (function () {
  'use strict';

  /* Direcciones candidatas, en orden de prioridad:
     1) mismo origen  -> nginx hace de proxy (/api -> backend:3000)
     2) backend directo por el puerto publicado en compose
     3) alternativa por IP local                                        */
  const CANDIDATOS = [
    '/api',
    'http://localhost:3000/api',
    'http://127.0.0.1:3000/api'
  ];

  const TIEMPO_LATIDO = 4000;      // ms maximos por peticion
  const CACHE_SALUD = 15000;      // ms antes de volver a preguntar

  let baseActiva = null;
  let ultimoChequeo = 0;
  let disponible = null;          // null = aun no se ha comprobado
  let comprobando = null;

  /* -------------------------------------------------------------------
   * Peticion base
   * ----------------------------------------------------------------- */
  async function pedir(ruta, opciones) {
    const opts = opciones || {};
    const base = baseActiva || CANDIDATOS[0];

    // Si hay una persona identificada, su DNI viaja en cada peticion para que
    // el backend sepa de quien son los datos que pide (ver sesion.js).
    const identidad = (typeof window !== 'undefined' && window.Sesion)
      ? window.Sesion.cabeceras() : {};

    const controlador = new AbortController();
    const t = setTimeout(() => controlador.abort(), TIEMPO_LATIDO);

    try {
      const respuesta = await fetch(base + ruta, {
        method: opts.method || 'GET',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          identidad,
          opts.headers || {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controlador.signal
      });

      let datos = null;
      try { datos = await respuesta.json(); } catch (e) { datos = null; }

      return { status: respuesta.status, ok: respuesta.ok, datos: datos };
    } catch (error) {
      // Fallo de red: sin servidor, CORS, archivo local, timeout...
      const e = new Error('No hay conexion con la API: ' + error.message);
      e.esRed = true;
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  /* -------------------------------------------------------------------
   * Descubrimiento del backend
   * ----------------------------------------------------------------- */
  async function comprobar(forzar) {
    const ahora = Date.now();
    if (!forzar && disponible !== null && ahora - ultimoChequeo < CACHE_SALUD) {
      return disponible;
    }
    if (comprobando) return comprobando;

    comprobando = (async () => {
      for (const base of CANDIDATOS) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 2500);
          const r = await fetch(base + '/health', { signal: ctrl.signal });
          clearTimeout(t);
          if (r.ok) {
            baseActiva = base;
            disponible = true;
            ultimoChequeo = Date.now();
            console.info('[JSP] API conectada en ' + base);
            return true;
          }
        } catch (e) { /* siguiente candidato */ }
      }
      baseActiva = null;
      disponible = false;
      ultimoChequeo = Date.now();
      console.info('[JSP] API no disponible: se usara el modo local (localStorage).');
      return false;
    })();

    const resultado = await comprobando;
    comprobando = null;
    return resultado;
  }

  /* -------------------------------------------------------------------
   * Endpoints
   * ----------------------------------------------------------------- */

  /** Estado del servicio (solo informativo) */
  async function health() {
    await comprobar();
    if (!disponible) return null;
    const r = await pedir('/health');
    return r.datos;
  }

  /** Resumen estadistico del dashboard */
  async function obtenerResumen() {
    const r = await pedir('/resumen');
    return r.datos && r.datos.resumen ? r.datos.resumen : null;
  }

  /** Listar entradas ficticias */
  async function listarEntradas() {
    const r = await pedir('/entradas');
    return (r.datos && r.datos.entradas) || [];
  }

  /** CONSULTAR entrada por codigo (null si no existe) */
  async function consultarEntrada(codigo) {
    const r = await pedir('/entradas/' + encodeURIComponent(codigo));
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error('Error del servidor'), { status: r.status, body: r.datos });
    return r.datos.entrada;
  }

  /** VERIFICAR estado de una entrada (registra la consulta) */
  async function verificar(codigo) {
    const r = await pedir('/verificar/' + encodeURIComponent(codigo));
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error('Error del servidor'), { status: r.status, body: r.datos });
    return r.datos.entrada;
  }

  /** GENERAR un token nuevo del QR dinamico */
  async function actualizarQR(codigo, opciones) {
    const opts = opciones || {};
    const log = opts.log === false ? '0' : '1';
    const r = await pedir('/entradas/' + encodeURIComponent(codigo) + '/qr?log=' + log, { method: 'POST' });
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error('No se pudo generar el QR'), { status: r.status, body: r.datos });
    return r.datos;
  }

  /** VALIDAR un token (lo que haria el lector fisico del evento) */
  async function validarToken(token) {
    const r = await pedir('/qr/validar', { method: 'POST', body: { token: token } });
    return r.datos || { valido: false, motivo: 'sin-respuesta' };
  }

  /** TRANSFERIR entrada */
  async function transferirEntrada(codigo, datos) {
    const r = await pedir('/entradas/' + encodeURIComponent(codigo) + '/transferir', {
      method: 'POST',
      body: datos
    });
    // 400/409 traen { ok:false, error, campos }: se devuelve tal cual
    if (r.status === 400 || r.status === 409 || r.status === 404) {
      return r.datos || { ok: false, error: 'La API no pudo completar la transferencia.' };
    }
    if (!r.ok) throw Object.assign(new Error('Error del servidor'), { status: r.status, body: r.datos });
    return r.datos;
  }

  /** IDENTIFICAR a una persona: comprueba que el DNI exista en la base */
  async function buscarUsuario(dni) {
    const r = await pedir('/usuarios/' + encodeURIComponent(dni));
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error('Error del servidor'), { status: r.status, body: r.datos });
    return r.datos.usuario;
  }

  /** OBTENER historial de trazabilidad.
   *  Con dni devuelve solo los movimientos de esa persona. */
  async function obtenerHistorial(codigo, dni) {
    let ruta;
    if (codigo) ruta = '/entradas/' + encodeURIComponent(codigo) + '/historial';
    else if (dni) ruta = '/historial?dni=' + encodeURIComponent(dni);
    else ruta = '/historial';
    const r = await pedir(ruta);
    return (r.datos && r.datos.historial) || [];
  }

  /** Marcar la entrada como usada o anulada */
  async function cambiarEstado(codigo, estado) {
    const r = await pedir('/entradas/' + encodeURIComponent(codigo) + '/estado/' + estado, { method: 'POST' });
    if (!r.ok) throw Object.assign(new Error('No se pudo cambiar el estado'), { status: r.status, body: r.datos });
    return r.datos.entrada;
  }

  /** REGISTRAR una persona nueva (alta en la base de usuarios).
   *  400 = datos inválidos y 409 = DNI ya registrado: se devuelven tal cual,
   *  con su campo y su mensaje, para que el formulario los marque. */
  async function crearUsuario(datos) {
    const r = await pedir('/usuarios', { method: 'POST', body: datos });
    if (r.status === 400 || r.status === 409) {
      return r.datos || { ok: false, error: 'No se pudo completar el registro.' };
    }
    if (!r.ok) throw Object.assign(new Error('Error del servidor'), { status: r.status, body: r.datos });
    return r.datos;
  }

  /** Reiniciar los datos ficticios */
  async function reiniciarDemo() {
    const r = await pedir('/demo/reiniciar', { method: 'POST' });
    return !!r.ok;
  }

  /* ------------------------------------------------------------------- */
  return {
    comprobar: comprobar,
    disponible: function () { return disponible === true; },
    urlBase: function () { return baseActiva; },
    reiniciarComprobacion: function () { disponible = null; ultimoChequeo = 0; },

    health: health,
    buscarUsuario: buscarUsuario,
    crearUsuario: crearUsuario,
    obtenerResumen: obtenerResumen,
    listarEntradas: listarEntradas,
    consultarEntrada: consultarEntrada,
    verificar: verificar,
    actualizarQR: actualizarQR,
    validarToken: validarToken,
    transferirEntrada: transferirEntrada,
    obtenerHistorial: obtenerHistorial,
    cambiarEstado: cambiarEstado,
    reiniciarDemo: reiniciarDemo
  };
})();

/* Un `const` de nivel superior crea un enlace lexicico global, NO una
   propiedad de `window`. Sin esta asignacion, api.js (que busca
   `window.ClienteAPI`) no encontraria el cliente y el prototipo se
   quedaria siempre en modo local. */
if (typeof window !== 'undefined') window.ClienteAPI = ClienteAPI;
