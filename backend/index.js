/* =========================================================================
 * JOINNUS SECURE PASS — backend/index.js
 * -------------------------------------------------------------------------
 * API REST del prototipo. Expone los mismos metodos que la simulacion local
 * (js/api.js) para que el frontend funcione igual con o sin Docker.
 *
 *   GET    /api/health                       estado del servicio y de la BD
 *   GET    /api/resumen                      tarjetas estadisticas del panel
 *   GET    /api/entradas                     listar entradas ficticias
 *   GET    /api/entradas/:codigo             CONSULTAR entrada
 *   GET    /api/verificar/:codigo            VERIFICAR estado (+ registra)
 *   POST   /api/entradas/:codigo/qr          GENERAR token del QR dinamico
 *   POST   /api/qr/validar                   VALIDAR token (simula el lector)
 *   POST   /api/entradas/:codigo/transferir   TRANSFERIR entrada
 *   GET    /api/entradas/:codigo/historial   OBTENER historial
 *   POST   /api/entradas/:codigo/estado      Marcar como usada / anulada
 *   POST   /api/demo/reiniciar               Reinicia los datos ficticios
 *
 * Todos los datos son FICTICIOS. En produccion, la firma HMAC y la
 * validacion se ejecutan siempre del lado del servidor (nunca en el cliente).
 * ========================================================================= */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '128kb' }));

/* ---------------------------------------------------------------------
 * 1. Configuracion (variables de entorno)
 * ------------------------------------------------------------------- */
const CFG = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'joinnus',
    password: process.env.DB_PASSWORD || 'joinnus_pass',
    database: process.env.DB_NAME || 'joinnus_secure_pass'
  },
  /* Secreto de firma de los tokens QR */
  qrSecret: process.env.QR_SECRET || 'joinnus-secure-pass-clave-de-demostracion',
  /* Vigencia de cada token dinamico, en segundos */
  qrTtl: Number(process.env.QR_TTL_SECONDS || 15),
  /* DNI del usuario de la sesion demo (para "Mis entradas") */
  demoDni: process.env.DEMO_DNI || '45678945'
};

/* ---------------------------------------------------------------------
 * 2. Pool de conexiones a MySQL
 * ------------------------------------------------------------------- */
const pool = mysql.createPool({
  host: CFG.db.host,
  port: CFG.db.port,
  user: CFG.db.user,
  password: CFG.db.password,
  database: CFG.db.database,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  /* 'local' = zona del proceso (TZ=America/Lima en docker-compose), la misma
   * que usa MySQL. Con 'Z' los DATETIME/TIMESTAMP se leian como UTC y la
   * interfaz mostraba las horas 5 atrasadas; las columnas DATE ademas hay
   * que devolverlas con los componentes locales (ver fechaCorta). */
  timezone: 'local',
  namedPlaceholders: true
});

/** Espera a que MySQL acepte conexiones (arranque de Docker) */
async function esperarBase(maxIntentos = 30) {
  for (let i = 1; i <= maxIntentos; i++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[BD] Conectado a ${CFG.db.host}:${CFG.db.port}/${CFG.db.database}`);
      return true;
    } catch (e) {
      console.log(`[BD] MySQL no disponible (intento ${i}/${maxIntentos}): ${e.code || e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[BD] No se pudo conectar con la base de datos.');
  return false;
}

/* ---------------------------------------------------------------------
 * 3. Metadatos de estado (deben coincidir con js/api.js)
 * ------------------------------------------------------------------- */
const ESTADOS = {
  valido: {
    clave: 'valido', etiqueta: 'Válido / Sin usar', corta: 'Válido',
    clase: 'badge-valido', punto: 'st-valido', emoji: '🟢', icono: 'check-circle',
    color: '#22c55e',
    descripcion: 'La entrada está activa y puede utilizarse una sola vez.'
  },
  usado: {
    clave: 'usado', etiqueta: 'Usado / Ingresado', corta: 'Usado',
    clase: 'badge-usado', punto: 'st-usado', emoji: '🔴', icono: 'x-circle',
    color: '#f43f5e',
    descripcion: 'Esta entrada ya fue utilizada para ingresar al evento.'
  },
  anulado: {
    clave: 'anulado', etiqueta: 'Anulado', corta: 'Anulado',
    clase: 'badge-anulado', punto: 'st-anulado', emoji: '🟠', icono: 'ban',
    color: '#f59e0b',
    descripcion: 'Esta entrada ya no puede utilizarse.'
  },
  transferido: {
    clave: 'transferido', etiqueta: 'Transferido', corta: 'Transferido',
    clase: 'badge-transferido', punto: 'st-transferido', emoji: '🔵', icono: 'repeat',
    color: '#3b82f6',
    descripcion: 'Esta entrada fue transferida a un nuevo titular.'
  }
};

function ocultarDNI(dni) {
  const d = String(dni || '');
  if (d.length < 4) return '********';
  return '********' + d.slice(-2);
}

/* ---------------------------------------------------------------------
 * 4. Helpers
 * ------------------------------------------------------------------- */
const ok = (res, data) => res.json(Object.assign({ ok: true }, data));
const fallo = (res, codigo, mensaje, extra = {}) =>
  res.status(codigo).json(Object.assign({ ok: false, error: mensaje }, extra));

/** Envuelve un handler async para que los errores lleguen al middleware */
const ruta = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** DNI de la persona identificada en ESTA peticion.
 *  Viaja en la cabecera X-Usuario-DNI. Si no viene, se usa DEMO_DNI, que
 *  conserva el comportamiento anterior (sesion unica de Carlos).
 *
 *  OJO: esto NO es autenticacion. El DNI lo elige el navegador; el servidor
 *  solo lo usa para filtrar los datos que devuelve. */
function dniDePeticion(req) {
  const dni = String(req.get('X-Usuario-DNI') || '').trim();
  return /^\d{8}$/.test(dni) ? dni : CFG.demoDni;
}

/** Convierte una columna DATE de MySQL a 'YYYY-MM-DD'.
 *  mysql2 la entrega como objeto Date, así que `String(fecha).slice(0, 10)`
 *  producía "Mon Sep 28" y el navegador lo leía como el año 2001. Se usan
 *  los componentes locales, que son exactamente los que trae la columna. */
function fechaCorta(valor) {
  if (valor instanceof Date) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  return String(valor).slice(0, 10);
}

/** Convierte una fila de MySQL al mismo formato que usa el frontend */
function enriquecer(fila, dni) {
  if (!fila) return null;
  const meta = ESTADOS[fila.estado] || ESTADOS.valido;
  return {
    codigo: fila.codigo,
    evento: fila.evento,
    fecha: fechaCorta(fila.fecha),
    hora: String(fila.hora).slice(0, 5),
    lugar: fila.lugar,
    zona: fila.zona,
    fila: fila.fila,
    asiento: fila.asiento,
    titular: fila.titular_nombre,
    dni: fila.titular_dni,
    correo: fila.titular_correo,
    estado: fila.estado,
    estadoEtiqueta: meta.etiqueta,
    estadoDetalle: meta,
    dniOculto: ocultarDNI(fila.titular_dni),
    dniAnteriorOculto: fila.dni_anterior ? ocultarDNI(fila.dni_anterior) : null,
    precioOriginal: Number(fila.precio),
    precio: Number(fila.precio),
    qrToken: fila.qr_ultimo_token,
    qrAnterior: fila.qr_anterior_token,
    qrExpiraEn: fila.qr_expira_en,
    qrGeneradoEn: fila.qr_generado_en,
    creadoEn: fila.creado_en,
    transferidaEn: fila.transferida_en,
    usadoEn: fila.usada_en,
    anuladoEn: fila.anulada_en,
    motivoAnulacion: fila.motivo_anulacion,
    titularAnterior: fila.titular_anterior,
    dniAnterior: fila.dni_anterior,
    puedeTransferir: fila.estado === 'valido',
    esMia: fila.titular_dni === (dni || CFG.demoDni)
  };
}

/** Mapea filas de `historial` al formato que espera la interfaz.
 *  El ORDER BY siempre es ascendente: historial.js y dashboard.js usan
 *  `slice(-4)` y esperan el registro mas reciente al final. */
function mapearHistorial(rows) {
  return rows.map(r => ({
    id: 'H' + r.id,
    codigo: r.codigo,
    accion: r.accion,
    titular: r.titular,
    detalle: r.detalle,
    estado: r.estado_registrado,
    fecha: r.creado_en
  }));
}

const SELECT_ENTRADA = `
  SELECT e.codigo, ev.nombre AS evento, ev.fecha, ev.hora, ev.lugar,
         e.zona, e.fila, e.asiento,
         e.titular_nombre, e.titular_dni, e.titular_correo,
         e.estado, e.precio, e.motivo_anulacion,
         e.qr_ultimo_token, e.qr_anterior_token, e.qr_expira_en, e.qr_generado_en,
         e.creado_en, e.transferida_en, e.usada_en, e.anulado_en,
         t.nombre AS titular_anterior, t.dni AS dni_anterior
    FROM entradas e
    JOIN eventos ev ON ev.id = e.evento_id
    LEFT JOIN (
      SELECT te.entrada_id, te.titular_anterior_nombre AS nombre, te.titular_anterior_dni AS dni
      FROM transferencias te
      INNER JOIN (
        SELECT entrada_id, MAX(id) AS ultimo
        FROM transferencias GROUP BY entrada_id
      ) u ON u.ultimo = te.id
    ) t ON t.entrada_id = e.id
`;

async function obtenerFila(codigo) {
  const [rows] = await pool.execute(`${SELECT_ENTRADA} WHERE e.codigo = ? LIMIT 1`, [codigo]);
  return rows[0] || null;
}

/** Registra un evento en el historial (trazabilidad) */
async function registrar(codigo, accion, titular, detalle = '', estado = null) {
  await pool.execute(
    `INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado)
     SELECT id, ?, ?, ?, ? FROM entradas WHERE codigo = ?`,
    [accion, titular, detalle, estado, codigo]
  );
}

/* ---------------------------------------------------------------------
 * 5. Tokens dinamicos firmados (HMAC-SHA256)
 * ------------------------------------------------------------------- */
function generarToken(codigo) {
  const nonce = crypto.randomBytes(4).toString('hex').toUpperCase();      // 8 hex
  const expira = new Date(Date.now() + CFG.qrTtl * 1000);
  const firma = crypto
    .createHmac('sha256', CFG.qrSecret)
    .update(`${codigo}|${nonce}|${expira.getTime()}`)
    .digest('hex');                                                       // firma completa
  return {
    token: `JSP-${codigo}-${nonce}`,
    nonce,
    firma: firma.slice(0, 32),
    expiraEn: expira
  };
}

/** Extrae el token de un payload `JSP|CODIGO|NONCE|HORA` o de un token directo */
function extraerToken(entrada) {
  const texto = String(entrada || '').trim();
  const directo = /^JSP-[A-Z0-9]+-[0-9A-F]{8,}$/i.exec(texto);
  if (directo) return texto.toUpperCase();
  const partes = texto.split('|');
  if (partes.length >= 3 && /^JSP$/i.test(partes[0])) {
    return `JSP-${partes[1]}-${partes[2]}`.toUpperCase();
  }
  return null;
}

/* ---------------------------------------------------------------------
 * 6. Validadores (espejo de js/api.js)
 * ------------------------------------------------------------------- */
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function validarTransferencia(datos, entrada) {
  const campos = {};

  const nombre = String(datos.nombre || '').trim();
  if (!nombre) campos.nombre = 'El nombre del nuevo titular es obligatorio.';
  else if (nombre.length < 5) campos.nombre = 'El nombre debe tener al menos 5 caracteres.';
  else if (nombre.split(/\s+/).length < 2) campos.nombre = 'Ingrese el nombre y el apellido del nuevo titular.';
  else if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ' ]+$/.test(nombre)) campos.nombre = 'El nombre solo puede contener letras y espacios.';

  const dni = String(datos.dni || '').trim();
  if (!dni) campos.dni = 'El DNI es obligatorio.';
  else if (!/^\d{8}$/.test(dni)) campos.dni = 'El DNI debe tener exactamente 8 números.';

  const correo = String(datos.correo || '').trim();
  if (!correo) campos.correo = 'El correo electrónico es obligatorio.';
  else if (!RE_CORREO.test(correo)) campos.correo = 'Ingrese un correo electrónico válido (ejemplo@correo.com).';

  const precioMaximo = Number(entrada.precio);
  const precio = datos.precio === '' || datos.precio == null ? NaN : Number(datos.precio);
  if (isNaN(precio)) campos.precio = 'Indique el precio de transferencia.';
  else if (precio < 0) campos.precio = 'El precio debe ser un número válido en soles.';
  else if (precio > precioMaximo) campos.precio = 'El precio de transferencia supera el límite permitido.';

  if (Object.keys(campos).length) {
    return { ok: false, error: 'Revisa los datos del formulario.', campos };
  }
  return { ok: true, nombre, dni, correo, precio };
}

/* =====================================================================
 * 7. Endpoints
 * =================================================================== */

/** Estado del servicio y de la conexion con la base de datos */
app.get('/api/health', ruta(async (req, res) => {
  let bd = false;
  try {
    await pool.query('SELECT 1');
    bd = true;
  } catch (e) { /* sin base de datos */ }

  const [tablas] = bd
    ? await pool.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = ? AND table_name IN ('usuarios','eventos','entradas','transferencias','historial','tokens_qr')`,
      [CFG.db.database])
    : [[{ total: 0 }]];

  ok(res, {
    servicio: 'joinnus-secure-pass-api',
    version: '1.0.0',
    baseDatos: bd ? 'conectada' : 'sin conexion',
    tablas: Number(tablas[0].total),
    entorno: process.env.NODE_ENV || 'development',
    hora: new Date().toISOString()
  });
}));

/** Resumen para las tarjetas estadisticas del panel.
 *  Todo se acota a la persona identificada: asi el panel muestra "su"
 *  informacion y no la de los demas. */
app.get('/api/resumen', ruta(async (req, res) => {
  const dni = dniDePeticion(req);
  const [rows] = await pool.query(`
    SELECT
      SUM(CASE WHEN estado = 'valido'      THEN 1 ELSE 0 END) AS activas,
      SUM(CASE WHEN estado = 'usado'       THEN 1 ELSE 0 END) AS usadas,
      SUM(CASE WHEN estado = 'transferido' THEN 1 ELSE 0 END) AS transferidas,
      SUM(CASE WHEN estado = 'anulado'     THEN 1 ELSE 0 END) AS anuladas,
      COUNT(*)                                                   AS total,
      COUNT(*)                                                   AS mias
    FROM entradas WHERE titular_dni = ?`, [dni]);

  const r = rows[0] || {};
  ok(res, {
    resumen: {
      activas: Number(r.activas || 0),
      usadas: Number(r.usadas || 0),
      transferidas: Number(r.transferidas || 0),
      anuladas: Number(r.anuladas || 0),
      total: Number(r.total || 0),
      mias: Number(r.mias || 0)
    }
  });
}));

/** Listar todas las entradas ficticias */
app.get('/api/entradas', ruta(async (req, res) => {
  const dni = dniDePeticion(req);
  const [rows] = await pool.query(`${SELECT_ENTRADA} ORDER BY e.codigo ASC`);
  // Ojo: NO usar rows.map(enriquecer) — map pasa el indice como 2º argumento
  // y `dni` recibiria 0,1,2... en lugar del DNI de la sesion.
  ok(res, { entradas: rows.map(f => enriquecer(f, dni)) });
}));

/** CONSULTAR entrada por codigo */
app.get('/api/entradas/:codigo', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, `La entrada ${codigo} no existe en el sistema.`);
  ok(res, { entrada: enriquecer(fila, dniDePeticion(req)) });
}));

/** VERIFICAR estado (y deja constancia en el historial) */
app.get('/api/verificar/:codigo', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, `La entrada ${codigo} no existe en el sistema.`);

  await registrar(codigo, 'verificada', fila.titular_nombre,
    'Consulta de estado desde el verificador', fila.estado);

  const entrada = enriquecer(fila, dniDePeticion(req));
  const [hist] = await pool.query(
    'SELECT COUNT(*) AS n FROM historial WHERE entrada_id = (SELECT id FROM entradas WHERE codigo = ?)',
    [codigo]);

  ok(res, {
    entrada,
    verificacion: {
      fecha: new Date().toISOString(),
      consultas: Number(hist[0].n),
      mensaje: entrada.estadoDetalle.descripcion
    }
  });
}));

/** GENERAR token del QR dinamico (invalida el anterior) */
app.post('/api/entradas/:codigo/qr', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const registrarEnHistorial = String(req.query.log ?? '1') !== '0';

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, `La entrada ${codigo} no existe.`);

  if (fila.estado === 'usado' || fila.estado === 'anulado') {
    return fallo(res, 409, `Una entrada en estado "${ESTADOS[fila.estado].etiqueta}" no emite nuevos códigos QR.`);
  }

  const { token, nonce, firma, expiraEn } = generarToken(codigo);

  // El QR anterior queda invalidado
  await pool.execute(
    `UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id =
       (SELECT id FROM entradas WHERE codigo = ?) AND invalidado = 0`,
    [codigo]);

  await pool.execute(
    `UPDATE entradas
        SET qr_anterior_token = qr_ultimo_token,
            qr_ultimo_token = ?, qr_firma = ?, qr_expira_en = ?, qr_generado_en = NOW()
      WHERE codigo = ?`,
    [token, firma, expiraEn, codigo]);

  const [ins] = await pool.execute(
    `INSERT INTO tokens_qr (entrada_id, token, nonce, firma, payload, expira_en)
     SELECT id, ?, ?, ?, ?, ? FROM entradas WHERE codigo = ?`,
    [token, nonce, firma, construirPayload(codigo, nonce), expiraEn, codigo]);

  if (registrarEnHistorial) {
    const detalle = fila.qr_ultimo_token
      ? `Nuevo QR generado (se invalidó ${fila.qr_ultimo_token})`
      : 'Nuevo QR generado';
    await registrar(codigo, 'qr', fila.titular_nombre, detalle, fila.estado);
  }

  const actualizada = await obtenerFila(codigo);

  ok(res, {
    codigo,
    token,
    tokenAnterior: fila.qr_ultimo_token,
    payload: construirPayload(codigo, nonce),
    expiraEn,
    ttl: CFG.qrTtl,
    id: ins.insertId,
    entrada: enriquecer(actualizada, dniDePeticion(req))
  });
}));

/** VALIDAR token (lo que haria el lector fisico del evento) */
app.post('/api/qr/validar', ruta(async (req, res) => {
  const recibido = req.body && (req.body.token || req.body.payload);
  const token = extraerToken(recibido);
  if (!token) return fallo(res, 400, 'Token de QR con formato inválido.');

  const [rows] = await pool.query(
    `SELECT t.id, t.token, t.nonce, t.firma, t.expira_en, t.invalidado, t.usado_en,
            e.codigo, e.estado, e.titular_nombre
       FROM tokens_qr t
       JOIN entradas e ON e.id = t.entrada_id
      WHERE t.token = ? LIMIT 1`, [token]);

  if (!rows.length) {
    return fallo(res, 200, 'El código QR no pertenece a ninguna entrada emitida.', { valido: false, motivo: 'desconocido' });
  }

  const t = rows[0];

  // La firma se recalcula en el servidor: un token alterado no valida
  const { nonce, expiraEn } = { nonce: t.nonce, expiraEn: t.expira_en };
  const esperado = crypto
    .createHmac('sha256', CFG.qrSecret)
    .update(`${t.codigo}|${nonce}|${new Date(expiraEn).getTime()}`)
    .digest('hex').slice(0, 32);

  if (esperado !== t.firma) {
    return fallo(res, 200, 'La firma del token no es válida.', { valido: false, motivo: 'firma' });
  }
  if (Number(t.invalidado) === 1) {
    return fallo(res, 200, 'El token fue invalidado al rotar el código QR.', { valido: false, motivo: 'invalidado' });
  }
  if (new Date(t.expira_en).getTime() < Date.now()) {
    return fallo(res, 200, 'El token expiró (vigencia de ' + CFG.qrTtl + ' segundos).', { valido: false, motivo: 'expirado' });
  }
  if (t.estado === 'usado') {
    return fallo(res, 200, 'La entrada ya fue utilizada para ingresar al evento.', { valido: false, motivo: 'usada' });
  }
  if (t.estado === 'anulado') {
    return fallo(res, 200, 'La entrada está anulada.', { valido: false, motivo: 'anulada' });
  }

  ok(res, {
    valido: true,
    motivo: 'ok',
    codigo: t.codigo,
    titular: t.titular_nombre,
    expiraEn: t.expira_en,
    mensaje: 'Token vigente: acceso permitido.'
  });
}));

/** TRANSFERIR entrada */
app.post('/api/entradas/:codigo/transferir', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const datos = req.body || {};

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, 'La entrada no existe en el sistema.');

  if (fila.estado !== 'valido') {
    return fallo(res, 409,
      `No es posible transferir una entrada con estado "${ESTADOS[fila.estado].etiqueta}".`);
  }

  const v = validarTransferencia(datos, fila);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error, campos: v.campos });

  const titularAnterior = fila.titular_nombre;
  const dniAnterior = fila.titular_dni;
  const tokenAnterior = fila.qr_ultimo_token;

  // Usuario destino (se crea si no existe, para no romper la FK)
  const [usr] = await pool.execute(
    `INSERT INTO usuarios (nombre, dni, correo) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), correo = VALUES(correo)`,
    [v.nombre, v.dni, v.correo]);
  const usuarioNuevoId = usr.insertId || null;
  if (!usuarioNuevoId) {
    const [found] = await pool.execute('SELECT id FROM usuarios WHERE dni = ?', [v.dni]);
    usuarioNuevoId = found.length ? found[0].id : null;
  }

  // Se invalida el QR vigente
  await pool.execute(
    `UPDATE tokens_qr SET invalidado = 1
      WHERE entrada_id = (SELECT id FROM entradas WHERE codigo = ?) AND invalidado = 0`,
    [codigo]);

  // Se actualiza la titularidad y el estado
  await pool.execute(
    `UPDATE entradas
        SET titular_id = ?, titular_nombre = ?, titular_dni = ?, titular_correo = ?,
            estado = 'transferido', transferida_en = NOW(),
            qr_anterior_token = qr_ultimo_token, qr_ultimo_token = NULL,
            qr_firma = NULL, qr_expira_en = NULL
      WHERE codigo = ?`,
    [usuarioNuevoId, v.nombre, v.dni, v.correo, codigo]);

  // Registro de la transferencia
  await pool.execute(
    `INSERT INTO transferencias
       (entrada_id, titular_anterior_id, titular_anterior_nombre, titular_anterior_dni,
        titular_nuevo_id, titular_nuevo_nombre, titular_nuevo_dni, titular_nuevo_correo, precio)
     SELECT id, titular_id, ?, ?, ?, ?, ?, ?, ?
       FROM entradas WHERE codigo = ?`,
    [titularAnterior, dniAnterior, usuarioNuevoId, v.nombre, v.dni, v.correo, v.precio, codigo]);

  await registrar(codigo, 'transferida', v.nombre,
    `${titularAnterior} → ${v.nombre} · S/ ${v.precio.toFixed(2)}`, 'transferido');
  await registrar(codigo, 'qr', v.nombre,
    tokenAnterior
      ? `Nuevo QR generado (se invalidó ${tokenAnterior})`
      : 'Nuevo QR generado para el nuevo titular', 'transferido');

  // QR nuevo para el nuevo titular
  const nuevo = generarToken(codigo);
  await pool.execute(
    `UPDATE entradas
        SET qr_ultimo_token = ?, qr_firma = ?, qr_expira_en = ?, qr_generado_en = NOW()
      WHERE codigo = ?`, [nuevo.token, nuevo.firma, nuevo.expiraEn, codigo]);

  await pool.execute(
    `INSERT INTO tokens_qr (entrada_id, token, nonce, firma, payload, expira_en)
     SELECT id, ?, ?, ?, ?, ? FROM entradas WHERE codigo = ?`,
    [nuevo.token, nuevo.nonce, nuevo.firma, construirPayload(codigo, nuevo.nonce), nuevo.expiraEn, codigo]);

  const actualizada = await obtenerFila(codigo);

  ok(res, {
    codigo,
    titularAnterior,
    titularNuevo: v.nombre,
    dniAnterior: ocultarDNI(dniAnterior),
    dniNuevo: ocultarDNI(v.dni),
    correoNuevo: v.correo,
    precio: v.precio,
    estado: 'transferido',
    estadoEtiqueta: ESTADOS.transferido.etiqueta,
    tokenAnterior,
    tokenNuevo: nuevo.token,
    payload: construirPayload(codigo, nuevo.nonce),
    entrada: enriquecer(actualizada, dniDePeticion(req))
  });
}));

/** IDENTIFICAR a una persona: comprueba que el DNI existe y que el nombre
 *  escrito coincide con el registrado. NO es autenticacion (no hay
 *  contrasena): solo evita erratas y da un dato coherente que mostrar. */
app.get('/api/usuarios/:dni', ruta(async (req, res) => {
  const dni = String(req.params.dni).trim();
  if (!/^\d{8}$/.test(dni)) {
    return fallo(res, 400, 'El DNI debe tener exactamente 8 números.', { campo: 'dni' });
  }

  const [rows] = await pool.query(
    'SELECT id, nombre, dni, correo FROM usuarios WHERE dni = ? LIMIT 1', [dni]);

  if (!rows.length) {
    return fallo(res, 404, 'No encontramos a ninguna persona con ese DNI.', { campo: 'dni' });
  }

  ok(res, { usuario: rows[0] });
}));

/** OBTENER historial de trazabilidad.
 *  Con ?dni=XXXXXXXX devuelve solo los movimientos de esa persona: las
 *  entradas que tiene ahora mas aquellas que transfirio o le transfirieron
 *  (para que un traspaso no desaparezca del historial de quien lo hizo). */
app.get('/api/historial', ruta(async (req, res) => {
  const dni = String(req.query.dni || '').trim();

  const [rows] = /^\d{8}$/.test(dni)
    ? await pool.query(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h JOIN entradas e ON e.id = h.entrada_id
        WHERE e.titular_dni = ?
           OR EXISTS (SELECT 1 FROM transferencias t
                       WHERE t.entrada_id = e.id
                         AND (t.titular_anterior_dni = ? OR t.titular_nuevo_dni = ?))
        ORDER BY h.creado_en ASC, h.id ASC`, [dni, dni, dni])
    : await pool.query(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h JOIN entradas e ON e.id = h.entrada_id
        ORDER BY h.creado_en ASC, h.id ASC`);

  ok(res, { historial: mapearHistorial(rows) });
}));

app.get('/api/entradas/:codigo/historial', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();

  const [rows] = await pool.query(
    `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
       FROM historial h JOIN entradas e ON e.id = h.entrada_id
      WHERE e.codigo = ? ORDER BY h.creado_en ASC, h.id ASC`, [codigo]);

  ok(res, { historial: mapearHistorial(rows) });
}));

/** Marcar una entrada como usada o anulada (simula el control de acceso) */
app.post('/api/entradas/:codigo/estado/:estado', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const estado = String(req.params.estado).toLowerCase();
  if (!['usado', 'anulado', 'valido'].includes(estado)) {
    return fallo(res, 400, 'Estado no permitido: ' + estado);
  }

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, 'La entrada no existe.');

  const columna = estado === 'usado' ? 'usada_en' : estado === 'anulado' ? 'anulada_en' : 'transferida_en';
  const sql = estado === 'valido'
    ? `UPDATE entradas SET estado = 'valido', ${columna} = NULL WHERE codigo = ?`
    : `UPDATE entradas SET estado = ?, ${columna} = NOW() WHERE codigo = ?`;

  await pool.execute(sql, estado === 'valido' ? [codigo] : [estado, codigo]);

  const accion = estado === 'usado' ? 'usada' : estado === 'anulado' ? 'anulada' : 'verificada';
  const detalle = estado === 'usado' ? 'Ingreso registrado en el evento'
    : estado === 'anulado' ? 'Entrada anulada por el organizador' : 'Entrada reactivada';
  await registrar(codigo, accion, fila.titular_nombre, detalle, estado);

  const actualizada = await obtenerFila(codigo);
  ok(res, { entrada: enriquecer(actualizada, dniDePeticion(req)) });
}));

/** Reinicia los datos ficticios de la demo */
app.post('/api/demo/reiniciar', ruta(async (req, res) => {
  // El mismo archivo que usa MySQL al arrancar (fuente unica de verdad).
  // docker-compose.yml lo monta en /app/seed.sql
  const rutas = [
    process.env.SEED_SQL,
    path.join(__dirname, 'seed.sql'),
    path.join(__dirname, '..', 'database', 'init.sql')
  ].filter(Boolean);
  const semilla = rutas.find(r => fs.existsSync(r));

  const conn = await mysql.createConnection({
    host: CFG.db.host, port: CFG.db.port, user: CFG.db.user,
    password: CFG.db.password, database: CFG.db.database,
    multipleStatements: true
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of ['historial', 'tokens_qr', 'transferencias', 'entradas', 'eventos', 'usuarios']) {
      await conn.query('TRUNCATE TABLE ' + tabla);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    if (semilla) {
      await conn.query(fs.readFileSync(semilla, 'utf8'));
      console.log('[DEMO] Datos reiniciados desde ' + semilla);
    }
  } finally {
    conn.end();
  }

  const [total] = await pool.query('SELECT COUNT(*) AS n FROM entradas');
  ok(res, {
    mensaje: 'Datos de demostración reiniciados.',
    semilla: semilla || null,
    entradas: Number(total[0].n)
  });
}));

/* ---------------------------------------------------------------------
 * 8. Raiz y errores
 * ------------------------------------------------------------------- */
app.get('/', (req, res) => {
  res.json({
    servicio: 'Joinnus Secure Pass API',
    documentacion: [
      'GET    /api/health',
      'GET    /api/resumen',
      'GET    /api/entradas',
      'GET    /api/entradas/:codigo',
      'GET    /api/verificar/:codigo',
      'POST   /api/entradas/:codigo/qr?log=0|1',
      'POST   /api/qr/validar',
      'POST   /api/entradas/:codigo/transferir',
      'GET    /api/entradas/:codigo/historial',
      'POST   /api/entradas/:codigo/estado/:estado',
      'POST   /api/demo/reiniciar'
    ]
  });
});

app.use((req, res) => fallo(res, 404, 'Ruta no encontrada: ' + req.method + ' ' + req.path));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  if (err && err.code === 'ER_DUP_ENTRY') {
    return fallo(res, 409, 'Ya existe un registro con esos datos.');
  }
  fallo(res, 500, 'Error interno del servidor: ' + (err && err.message ? err.message : 'desconocido'));
});

/* ---------------------------------------------------------------------
 * 9. Arranque
 * ------------------------------------------------------------------- */
function construirPayload(codigo, nonce) {
  const d = new Date();
  const reloj = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `JSP|${codigo}|${nonce}|${reloj}`;
}

if (require.main === module) {
  esperarBase().then(() => {
    app.listen(CFG.port, '0.0.0.0', () => {
      console.log('');
      console.log('  ====================================================');
      console.log('   JOINNUS SECURE PASS — API');
      console.log('  ====================================================');
      console.log(`   URL:      http://localhost:${CFG.port}/api`);
      console.log(`   Salud:    http://localhost:${CFG.port}/api/health`);
      console.log(`   Base:     ${CFG.db.host}:${CFG.db.port}/${CFG.db.database}`);
      console.log(`   QR TTL:   ${CFG.qrTtl} segundos`);
      console.log('  ====================================================');
      console.log('');
    });
  });
}

module.exports = app;
