/* =========================================================================
 *  JOINNUS SECURE PASS — staff/staff.js
 * -------------------------------------------------------------------------
 *  Panel del encargado de puerta:
 *    1. Entra con su nombre + código (el servidor comprueba el hash).
 *    2. Escanea el QR con la cámara del celular (BarcodeDetector) o escribe
 *       el código de la entrada.
 *    3. Ve el resultado y, si es correcto, guarda el ingreso. El
 *       historial guarda que lo validó él/ella.
 *
 *  La sesión vive en localStorage: igual que el DNI del sitio público, no
 *  es una autenticación fuerte, pero el código NO se guarda en la base y
 *  se revalida en cada petición.
 * ========================================================================= */

'use strict';

(function () {
  const API = '/api';
  const CLAVE_SESION = 'jsp_encargado';
  const CLAVE_INGRESOS = 'jsp_ingresos_';

  const el = id => document.getElementById(id);

  const ui = {
    chip: el('st-chip'),
    vistaLogin: el('vista-login'),
    formLogin: el('form-login'),
    nombre: el('enc-nombre'),
    codigo: el('enc-codigo'),
    loginError: el('login-error'),
    btnEntrar: el('btn-entrar'),
    vistaPanel: el('vista-panel'),
    btnSalir: el('btn-salir'),
    cam: el('st-cam'),
    video: el('video'),
    btnCamara: el('btn-camara'),
    aviso: el('camara-aviso'),
    formVerificar: el('form-verificar'),
    qrTexto: el('qr-texto'),
    btnVerificar: el('btn-verificar'),
    resultado: el('resultado'),
    resIcono: el('res-icono'),
    resTitulo: el('res-titulo'),
    resMotivo: el('res-motivo'),
    resDatos: el('res-datos'),
    btnRegistrar: el('btn-registrar'),
    resNota: el('res-nota'),
    contador: el('contador'),
    escaneos: el('escaneos'),
    quien: el('quien')
  };

  let sesion = null;
  let ultimoTexto = '';
  let verificando = false;
  let camaraActiva = false;
  let streamCamara = null;
  let detector = null;
  let escaneosSesion = 0;

  /* Respuestas legibles para cada motivo que devuelve el servidor */
  const MOTIVOS = {
    usada: {
      icono: '🔴', titulo: 'Entrada ya utilizada', clase: 'is-bad',
      texto: 'Esta entrada ya ingresó al evento. No se permite un segundo ingreso.'
    },
    anulada: {
      icono: '🟠', titulo: 'Entrada anulada', clase: 'is-warn',
      texto: 'La entrada fue anulada y ya no puede utilizarse.'
    },
    expirado: {
      icono: '⏰', titulo: 'QR expirado', clase: 'is-warn',
      texto: 'El código rota cada 15 segundos: pide al asistente que refresque su entrada.'
    },
    invalidado: {
      icono: '🔁', titulo: 'QR invalidado', clase: 'is-warn',
      texto: 'Ese QR fue reemplazado por uno más nuevo. Muestra el QR actual en pantalla.'
    },
    firma: {
      icono: '🚫', titulo: 'QR alterado', clase: 'is-bad',
      texto: 'La firma digital no coincide: es una copia falsa o manipulada.'
    },
    desconocido: {
      icono: '❓', titulo: 'QR no reconocido', clase: 'is-bad',
      texto: 'Ese código no pertenece a ninguna entrada emitida por el sistema.'
    },
    formato: {
      icono: '✏️', titulo: 'Formato no válido', clase: 'is-warn',
      texto: 'Escanea el QR o escribe el código de la entrada (por ejemplo ENTRY001).'
    },
    error: {
      icono: '⚠️', titulo: 'No se pudo validar', clase: 'is-warn',
      texto: 'Revisa la conexión e inténtalo de nuevo.'
    }
  };

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                         */
  /* ------------------------------------------------------------------ */

  function hoyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function ingresosDeHoy() {
    const n = Number(localStorage.getItem(CLAVE_INGRESOS + hoyLocal()) || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function sumarIngreso() {
    const clave = CLAVE_INGRESOS + hoyLocal();
    localStorage.setItem(clave, String(ingresosDeHoy() + 1));
    pintarContadores();
  }

  function pintarContadores() {
    ui.contador.textContent = String(ingresosDeHoy());
    ui.escaneos.textContent = String(escaneosSesion);
  }

  /** POST a la API. Devuelve { status, datos }; datos.ok dice si salió bien. */
  async function pedir(ruta, cuerpo) {
    const resp = await fetch(API + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    let datos = {};
    try { datos = await resp.json(); } catch (e) { /* respuesta sin JSON */ }
    return { status: resp.status, datos };
  }

  /* ------------------------------------------------------------------ */
  /* 1. Acceso                                                          */
  /* ------------------------------------------------------------------ */

  function mostrarError(mensaje) {
    ui.loginError.textContent = mensaje;
    ui.loginError.hidden = false;
  }

  function limpiarError() {
    ui.loginError.hidden = true;
    ui.loginError.textContent = '';
  }

  async function entrar(evento) {
    evento.preventDefault();
    const nombre = ui.nombre.value.trim();
    const codigo = ui.codigo.value.trim();

    if (!nombre || !codigo) {
      mostrarError('Escribe tu nombre y tu código de encargado.');
      return;
    }

    limpiarError();
    ui.btnEntrar.disabled = true;
    ui.btnEntrar.textContent = 'Comprobando…';

    try {
      const { datos } = await pedir('/encargados/login', { nombre, codigo });
      if (!datos.ok) {
        mostrarError(datos.error || 'Nombre o código de encargado incorrecto.');
        return;
      }
      sesion = { nombre: datos.encargado.nombre, codigo, id: datos.encargado.id };
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      abrirPanel();
    } catch (e) {
      mostrarError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      ui.btnEntrar.disabled = false;
      ui.btnEntrar.textContent = 'Entrar al panel';
    }
  }

  function abrirPanel() {
    ui.chip.textContent = sesion.nombre;
    ui.chip.hidden = false;
    ui.quien.textContent = sesion.nombre;
    ui.vistaLogin.hidden = true;
    ui.vistaPanel.hidden = false;
    ui.qrTexto.value = '';
    ui.resultado.hidden = true;
    ui.codigo.value = '';
    pintarContadores();
    ui.qrTexto.focus({ preventScroll: true });
  }

  function salir() {
    detenerCamara();
    localStorage.removeItem(CLAVE_SESION);
    sesion = null;
    escaneosSesion = 0;
    ultimoTexto = '';
    ui.chip.hidden = true;
    ui.vistaPanel.hidden = true;
    ui.vistaLogin.hidden = false;
    ui.resultado.hidden = true;
    ui.nombre.value = '';
    ui.codigo.value = '';
    limpiarError();
    ui.nombre.focus();
  }

  /* ------------------------------------------------------------------ */
  /* 2. Cámara                                                          */
  /* ------------------------------------------------------------------ */

  function avisoCamara(texto) {
    ui.aviso.textContent = texto || '';
    ui.aviso.hidden = !texto;
  }

  async function alternarCamara() {
    if (camaraActiva) { detenerCamara(); return; }

    if (!('BarcodeDetector' in window)) {
      avisoCamara('Este navegador no puede leer QR con la cámara. Escribe el código de la entrada (por ejemplo ENTRY001).');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      avisoCamara('La cámara no está disponible aquí. Escribe el código de la entrada.');
      return;
    }

    try {
      streamCamara = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      ui.video.srcObject = streamCamara;
      ui.video.hidden = false;
      ui.cam.classList.add('is-live');
      await ui.video.play();

      camaraActiva = true;
      ui.btnCamara.textContent = 'Detener cámara';
      avisoCamara('');

      detector = new BarcodeDetector({ formats: ['qr_code'] });
      bucleEscaneo().catch(() => avisoCamara('La lectura de la cámara se detuvo.'));
    } catch (e) {
      avisoCamara('No se pudo abrir la cámara (' + (e.name || 'error') + '). Escribe el código de la entrada.');
      detenerCamara();
    }
  }

  async function bucleEscaneo() {
    if (!camaraActiva) return;
    try {
      const codigos = await detector.detect(ui.video);
      if (codigos.length && codigos[0].rawValue) {
        const texto = codigos[0].rawValue;
        detenerCamara();
        ui.qrTexto.value = texto;
        await verificar(texto);
        return;
      }
    } catch (e) { /* fotograma sin QR: se reintenta */ }
    setTimeout(bucleEscaneo, 300);
  }

  function detenerCamara() {
    camaraActiva = false;
    if (streamCamara) {
      streamCamara.getTracks().forEach(t => t.stop());
      streamCamara = null;
    }
    ui.video.srcObject = null;
    ui.video.hidden = true;
    ui.cam.classList.remove('is-live');
    ui.btnCamara.textContent = 'Escanear con cámara';
  }

  /* ------------------------------------------------------------------ */
  /* 3. Verificación                                                    */
  /* ------------------------------------------------------------------ */

  async function verificar(textoLeido, registrar) {
    if (verificando || !sesion) return;

    const texto = String(textoLeido || ui.qrTexto.value || '').trim();
    if (!texto) {
      avisoCamara('Escribe el código de la entrada o escanea su QR.');
      return;
    }

    ultimoTexto = texto;
    verificando = true;
    ui.btnVerificar.disabled = true;
    ui.btnVerificar.textContent = 'Verificando…';
    escaneosSesion += 1;
    pintarContadores();

    const cuerpo = {
      encargado: sesion.nombre,
      codigo: sesion.codigo,
      registrar: !!registrar
    };

    // El QR del prototipo es "JSP|CODIGO|NONCE|HORA": si empieza por JSP se
    // envía como token firmado; si no, se busca por código de entrada.
    if (/^JSP/i.test(texto)) cuerpo.token = texto;
    else cuerpo.entrada = texto;

    try {
      const { status, datos } = await pedir('/encargados/validar', cuerpo);

      if (status === 401) {
        salir();
        mostrarError(datos.error || 'Tu sesión de encargado expiró: vuelve a entrar.');
        return;
      }

      if (datos.registrado) sumarIngreso();
      pintarResultado(datos);
    } catch (e) {
      pasarResultado(MOTIVOS.error, 'No se pudo conectar con el servidor.');
    } finally {
      verificando = false;
      ui.btnVerificar.disabled = false;
      ui.btnVerificar.textContent = 'Verificar';
    }
  }

  function pintarDatos(entrada) {
    ui.resDatos.innerHTML = '';
    if (!entrada) return;

    const ubicacion = [
      entrada.zona,
      entrada.fila && entrada.fila !== '-' ? 'Fila ' + entrada.fila : '',
      entrada.asiento ? 'Asiento ' + entrada.asiento : ''
    ].filter(Boolean).join(' · ');

    const filas = [
      ['Titular', entrada.titular],
      ['DNI', entrada.dniOculto],
      ['Evento', entrada.evento],
      ['Fecha', entrada.fecha ? entrada.fecha + ' · ' + entrada.hora : ''],
      ['Lugar', entrada.lugar],
      ['Ubicación', ubicacion],
      ['Código', entrada.codigo]
    ];

    filas.forEach(([etiqueta, valor]) => {
      if (valor == null || valor === '') return;
      const dt = document.createElement('dt');
      dt.textContent = etiqueta;
      const dd = document.createElement('dd');
      dd.textContent = String(valor);
      ui.resDatos.append(dt, dd);
    });
  }

  function pasarResultado(info, mensaje) {
    ui.resultado.hidden = false;
    ui.resultado.classList.remove('is-ok', 'is-bad', 'is-warn', 'is-nuevo');
    ui.resultado.classList.add(info.clase, 'is-nuevo');
    ui.resIcono.textContent = info.icono;
    ui.resTitulo.textContent = info.titulo;
    ui.resMotivo.textContent = mensaje || info.texto;
    ui.resDatos.innerHTML = '';
    ui.btnRegistrar.hidden = true;
    ui.resNota.hidden = true;
    ui.resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function pintarResultado(datos) {
    if (!datos.valido) {
      const info = MOTIVOS[datos.motivo] || MOTIVOS.error;
      pasarResultado(info, datos.error || info.texto);
      pintarDatos(datos.entrada);
      return;
    }

    ui.resultado.hidden = false;
    ui.resultado.classList.remove('is-ok', 'is-bad', 'is-warn', 'is-nuevo');
    ui.resultado.classList.add('is-ok', 'is-nuevo');

    if (datos.registrado) {
      ui.resIcono.textContent = '✅';
      ui.resTitulo.textContent = 'Ingreso registrado';
      ui.resMotivo.textContent = datos.mensaje || 'La entrada quedó marcada como usada.';
      ui.btnRegistrar.hidden = true;
      ui.resNota.hidden = false;
      ui.resNota.textContent = 'Quedó en el historial como validada por ' + (datos.encargado || sesion.nombre) + '.';
    } else {
      ui.resIcono.textContent = '🟢';
      ui.resTitulo.textContent = 'Entrada válida';
      ui.resMotivo.textContent = datos.mensaje || 'Acceso permitido.';
      ui.btnRegistrar.hidden = false;
      ui.btnRegistrar.disabled = false;
      ui.resNota.hidden = datos.conFirma !== false;
      ui.resNota.textContent = datos.conFirma === false
        ? 'Verificada por código, sin token firmado. Para la comprobación completa, escanea el QR.'
        : '';
    }

    pintarDatos(datos.entrada);
    ui.resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------------------------------------------ */
  /* 4. Arranque                                                        */
  /* ------------------------------------------------------------------ */

  ui.formLogin.addEventListener('submit', entrar);
  ui.btnSalir.addEventListener('click', salir);
  ui.btnCamara.addEventListener('click', alternarCamara);
  ui.formVerificar.addEventListener('submit', e => {
    e.preventDefault();
    verificar(ui.qrTexto.value, false)
      .catch(e => console.error('[staff] Error al verificar:', e));
  });
  ui.btnRegistrar.addEventListener('click', () => {
    ui.btnRegistrar.disabled = true;
    ui.btnRegistrar.textContent = 'Registrando…';
    verificar(ultimoTexto, true)
      .catch(e => console.error('[staff] Error al registrar:', e));
    setTimeout(() => {
      ui.btnRegistrar.textContent = 'Registrar ingreso';
      ui.btnRegistrar.disabled = false;
    }, 1200);
  });

  window.addEventListener('pagehide', detenerCamara);

  (function restaurarSesion() {
    try {
      const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
      if (guardada && guardada.nombre && guardada.codigo) {
        sesion = guardada;
        abrirPanel();
      }
    } catch (e) {
      localStorage.removeItem(CLAVE_SESION);
    }
    pintarContadores();
  })();
})();
