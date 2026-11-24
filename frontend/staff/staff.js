/* =========================================================================
 *  JOINNUS SECURE PASS — staff/staff.js
 * -------------------------------------------------------------------------
 *  Panel del encargado de puerta:
 *    1. Entra con su nombre + código (el servidor comprueba el hash).
 *    2. Escanea el QR con la cámara del celular (BarcodeDetector) o escribe
 *       el código de la entrada.
   *    3. Si es válido, registra el ingreso en PostgreSQL. El
 *       historial guarda que lo validó él/ella.
 *
   *  El código permanece en memoria hasta cerrar o recargar la pestaña;
   *  nunca se guarda en localStorage. El servidor lo revalida en cada petición.
 * ========================================================================= */

'use strict';

(function () {
  const API = '/api';

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
    resSello: el('res-sello'),
    resTitulo: el('res-titulo'),
    resMotivo: el('res-motivo'),
    resDatos: el('res-datos'),
    resNota: el('res-nota'),
    contador: el('contador'),
    escaneos: el('escaneos'),
    recientes: el('ingresos-recientes'),
    quien: el('quien')
  };

  let sesion = null;
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
    usado: {
      icono: '🔴', titulo: 'Entrada ya utilizada', clase: 'is-bad',
      texto: 'Esta entrada ya ingresó al evento. No se permite un segundo ingreso.'
    },
    titular: {
      icono: '🔁', titulo: 'QR de un titular anterior', clase: 'is-warn',
      texto: 'La entrada cambió de titular. Pide el QR actual.'
    },
    estado: {
      icono: '⚠️', titulo: 'Entrada no vigente', clase: 'is-warn',
      texto: 'Esta entrada no puede ingresar en su estado actual.'
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

  function pintarContadores() {
    ui.escaneos.textContent = String(escaneosSesion);
  }

  async function refrescarResumen() {
    const actual = sesion;
    if (!actual) return;
    try {
      const { status, datos } = await pedir('/encargados/resumen', {
        encargado: actual.nombre, codigo: actual.codigo
      });
      if (sesion !== actual) return;
      if (status === 401) { salir(); mostrarError('Vuelve a iniciar sesión.'); return; }
      if (!datos.ok) throw new Error('Resumen no disponible');
      ui.contador.textContent = String(datos.ingresos);
      ui.recientes.replaceChildren();
      if (!datos.recientes.length) {
        ui.recientes.textContent = 'Todavía no hay ingresos hoy.';
      } else {
        datos.recientes.forEach(ingreso => {
          const fila = document.createElement('div');
          fila.className = 'st-reciente';

          const marca = document.createElement('span');
          marca.className = 'st-reciente-mark';
          marca.setAttribute('aria-hidden', 'true');
          marca.textContent = '✓';

          const cuerpo = document.createElement('div');
          cuerpo.className = 'st-reciente-body';

          const cabecera = document.createElement('div');
          cabecera.className = 'st-reciente-top';
          const codigo = document.createElement('strong');
          codigo.textContent = ingreso.codigo;
          const hora = document.createElement('time');
          hora.textContent = ingreso.hora + ' h';
          cabecera.append(codigo, hora);

          const titular = document.createElement('span');
          titular.className = 'st-reciente-titular';
          titular.textContent = ingreso.titular;

          const evento = document.createElement('span');
          evento.className = 'st-reciente-evento';
          evento.textContent = ingreso.evento;

          cuerpo.append(cabecera, titular, evento);
          fila.append(marca, cuerpo);
          ui.recientes.append(fila);
        });
      }
    } catch (_) {
      if (sesion === actual) ui.recientes.textContent = 'No se pudo consultar el resumen. Revisa la conexión.';
    }
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
    ui.contador.textContent = '—';
    ui.recientes.textContent = 'Consultando la base de datos…';
    refrescarResumen();
    ui.qrTexto.focus({ preventScroll: true });
  }

  function salir() {
    detenerCamara();
    sesion = null;
    escaneosSesion = 0;
    ui.contador.textContent = '—';
    ui.recientes.textContent = '';
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
         await verificar(texto, true);
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

    const sesionAlInicio = sesion;
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
      if (sesion !== sesionAlInicio) return;

      if (status === 401) {
        salir();
        mostrarError(datos.error || 'Tu sesión de encargado expiró: vuelve a entrar.');
        return;
      }

      pintarResultado(datos);
      if (datos.registrado) await refrescarResumen();
    } catch (e) {
      pasarResultado(MOTIVOS.error, 'No se pudo conectar con el servidor.');
    } finally {
      verificando = false;
      ui.btnVerificar.disabled = false;
      ui.btnVerificar.textContent = 'Validar e ingresar';
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
    ui.resSello.textContent = info.clase === 'is-ok' ? 'Acceso permitido'
      : info.clase === 'is-bad' ? 'Acceso denegado' : 'Revisar antes de ingresar';
    ui.resTitulo.textContent = info.titulo;
    ui.resMotivo.textContent = mensaje || info.texto;
    ui.resDatos.innerHTML = '';
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
      ui.resSello.textContent = 'Acceso permitido';
      ui.resTitulo.textContent = 'Ingreso registrado';
      ui.resMotivo.textContent = datos.mensaje || 'La entrada quedó marcada como usada.';
      ui.resNota.hidden = false;
      ui.resNota.textContent = 'Quedó en el historial como validada por ' + (datos.encargado || sesion.nombre) + '.' +
        (datos.conFirma === false ? ' Registro manual sin QR firmado: comprueba la identidad del asistente.' : '');
    } else {
      ui.resultado.classList.remove('is-ok');
      ui.resultado.classList.add('is-warn');
      ui.resIcono.textContent = '⚠️';
      ui.resSello.textContent = 'Revisar antes de ingresar';
      ui.resTitulo.textContent = 'Ingreso no registrado';
      ui.resMotivo.textContent = 'No permitas el acceso hasta confirmar el ingreso en el sistema.';
      ui.resNota.hidden = true;
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
    verificar(ui.qrTexto.value, true)
      .catch(e => console.error('[staff] Error al verificar:', e));
  });

  window.addEventListener('pagehide', detenerCamara);

  pintarContadores();
})();
