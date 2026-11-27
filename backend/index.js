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
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { Pool, types, Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  passwordValida,
  hashPassword,
  verifyPassword,
  HASH_RELLENO,
  secretoDeEntorno,
  firmarSesion,
  verificarSesion,
  TTL_DEFECTO
} = require('./auth');
const { FORMATO_CODIGO, asegurarColumnasActivacion, consumirCodigoActivacion } = require('./activacion');

const app = express();

// Detrás de nginx (proxy inverso). Sin esto, express-rate-limit ve siempre la
// IP del contenedor y denuncia el X-Forwarded-For que añade nginx como un
// error de configuración; con '1' se toma la IP real del navegador.
app.set('trust proxy', 1);

/* ---------------------------------------------------------------------
 * Cabeceras de seguridad (helmet): nosniff, X-Frame-Options, etc.
 * ------------------------------------------------------------------ */
app.use(helmet());

/* ---------------------------------------------------------------------
 * CORS: s\u00f3lo respondemos a los origenes declarados. Ademas del
 * frontend propio (nginx en :8080) se admiten las redes privadas, para
 * poder proyectar la demo desde otro equipo de la sala. Se amplia con
 * CORS_ORIGINS en .env (ver .env.example).
 * ------------------------------------------------------------------ */
const ORIGENES = new Set(
  String(process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',').map(o => o.trim()).filter(Boolean)
);

function esRedPrivada(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
}

/* En Vercel la web se sirve desde un dominio *.vercel.app que no puede
 * preverse en el repositorio (sale con un sufijo aleatorio al desplegar).
 * Se admite ese sufijo para que los POST (QR, transferencia, registro)
 * funcionen desde la propia web publicada: no hay cookies ni credenciales
 * que robar, el DNI viaja en una cabecera que cualquier navegador podría
 * enviar, y las rutas de escritura siguen con su limite de peticiones.
 * Para restringirlo de nuevo basta declararlo en CORS_ORIGINS (.env). */
function esDominioVercel(host) {
  return typeof host === 'string' && host.endsWith('.vercel.app');
}

app.use(cors({
  origin: (origen, cb) => {
    if (!origen) return cb(null, true);            // mismo origen, curl o Postman
    let url;
    try { url = new URL(origen); } catch (e) { return cb(null, false); }
    cb(null, ORIGENES.has(origen) || esRedPrivada(url.hostname) ||
      esDominioVercel(url.hostname));
  }
}));

app.use(express.json({ limit: '128kb' }));

/* ---------------------------------------------------------------------
 * Limitador de peticiones: nadie puede martillear la generacion ni la
 * validacion de QR. Los topes se ajustan con RATE_LIMIT_* (.env.example).
 * ------------------------------------------------------------------ */
function limitador(cantidad, mensaje) {
  return rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    limit: cantidad,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: mensaje }
  });
}

const limiteQR = limitador(Number(process.env.RATE_LIMIT_QR || 30),
  'Demasiadas peticiones de QR: espera un minuto y vuelve a intentarlo.');
const limiteValidar = limitador(Number(process.env.RATE_LIMIT_VALIDAR || 60),
  'Demasiadas validaciones: espera un minuto y vuelve a intentarlo.');
const limiteEscritura = limitador(Number(process.env.RATE_LIMIT_ESCRITURA || 20),
  'Demasiadas operaciones: espera un minuto y vuelve a intentarlo.');
const limiteEncargado = limitador(Number(process.env.RATE_LIMIT_ENCARGADO || 12),
  'Demasiados intentos de acceso: espera un minuto y vuelve a intentarlo.');

/* ---------------------------------------------------------------------
 * 1. Configuracion (variables de entorno)
 * ------------------------------------------------------------------- */
/* El secreto de firma QR es OBLIGATORIO y no tiene valor por defecto en el
 * repositorio (para que no se publique). Se define en .env —copia
 * .env.example— y docker-compose se lo pasa al contenedor. */
const QR_SECRET = String(process.env.QR_SECRET || '').trim();
if (QR_SECRET.length < 16) {
  console.error('[CFG] QR_SECRET ausente o demasiado corto (minimo 16 caracteres).');
  console.error('[CFG] Copia .env.example a .env y pon ahi tu propia clave de firma.');
  process.exit(1);
}

/* Firma de las sesiones (login con contraseña). Si no se define
 * SESSION_SECRET se deriva de QR_SECRET, que ya es obligatorio. */
const SESSION_SECRET = secretoDeEntorno(process.env, QR_SECRET);
const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS || 8 * 60 * 60);

const CFG = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'joinnus',
    password: process.env.DB_PASSWORD || 'joinnus_pass',
    database: process.env.DB_NAME || 'joinnus_secure_pass'
  },
  /* Secreto de firma de los tokens QR (obligatorio, ver arriba) */
  qrSecret: QR_SECRET,
  /* Vigencia de cada token dinamico, en segundos */
  qrTtl: Number(process.env.QR_TTL_SECONDS || 15),
  /* DNI del usuario de la sesion demo (para "Mis entradas") */
  demoDni: process.env.DEMO_DNI || '45678945'
};

/* ---------------------------------------------------------------------
 * 2. Pool de conexiones a PostgreSQL
 * ------------------------------------------------------------------- */
/* TLS de PostgreSQL remoto (Aiven u otro proveedor): se activa con
 * DB_SSL=true. DB_SSL_CA admite la ruta de un fichero .pem o el propio
 * certificado pegado (con \n de salto). Sin CA, DB_SSL_INSECURE=true cifra
 * sin verificar el certificado del servidor. */
function sslDeLaBase() {
  const ca = String(process.env.DB_SSL_CA || '').trim();
  if (!ca) {
    return process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : {};
  }
  const pem = ca.includes('-----BEGIN')
    ? ca.replace(/\\n/g, '\n')
    : fs.readFileSync(ca, 'utf8');
  return { ca: pem };
}

/* PostgreSQL entrega COUNT(*) y las columnas NUMERIC como texto. El frontend
 * y los cálculos de precio esperan números: se convierten al leerlos. */
types.setTypeParser(20, v => Number.parseInt(v, 10));    // bigint  -> COUNT(*)
types.setTypeParser(1700, v => Number.parseFloat(v));    // numeric -> DECIMAL

const pool = new Pool({
  host: CFG.db.host,
  port: CFG.db.port,
  user: CFG.db.user,
  password: CFG.db.password,
  database: CFG.db.database,
  max: Number(process.env.DB_POOL || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  /* La aplicación trabaja en hora de Lima: se fija también en la sesión de la
   * base para que NOW() y las columnas TIMESTAMP coincidan con el navegador. */
  options: '-c timezone=America/Lima',
  ...(process.env.DB_SSL === 'true' ? { ssl: sslDeLaBase() } : {})
});

/* Las consultas se escribieron con marcadores '?' (estilo MySQL). En vez de
 * reescribir las 24 a mano, se traducen a $1, $2... en un solo lugar. */
function pgSql(sql) {
  let n = 0;
  return String(sql).replace(/\?/g, () => '$' + (++n));
}

/** Ejecuta un SELECT y devuelve las filas. */
async function consultar(sql, params = []) {
  const { rows } = await pool.query(pgSql(sql), params);
  return rows;
}

/** Ejecuta un INSERT/UPDATE/DELETE y devuelve el resultado completo
 *  (rowCount y rows; útil con RETURNING id). */
function ejecutar(sql, params = []) {
  return pool.query(pgSql(sql), params);
}

/** Espera a que PostgreSQL acepte conexiones (arranque de Docker) */
async function esperarBase(maxIntentos = 30) {
  for (let i = 1; i <= maxIntentos; i++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[BD] Conectado a ${CFG.db.host}:${CFG.db.port}/${CFG.db.database}`);
      await migrarPasswords();
      return true;
    } catch (e) {
      console.log(`[BD] PostgreSQL no disponible (intento ${i}/${maxIntentos}): ${e.code || e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[BD] No se pudo conectar con la base de datos.');
  return false;
}

/* Contraseñas de las cuentas ficticias (deben coincidir con database/init.sql). */
const DEMO_PASSWORDS = {
  '45678945': 'Carlos2026!',
  '52311878': 'Andrea2026!',
  '40125678': 'Luis2026!',
  '47258963': 'Diego2026!',
  '43871264': 'Maria2026!',
  '39521478': 'Renato2026!'
};

/** Bases creadas antes de existir las contraseñas: añade la columna y da
 *  contraseña a las cuentas de demostración que aún no tengan. No toca a
 *  quien ya la cambió. */
async function migrarPasswords() {
  try {
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT');
    await asegurarColumnasActivacion(pool);
    const dnis = Object.keys(DEMO_PASSWORDS);
    const { rows } = await pool.query(
      'SELECT dni FROM usuarios WHERE dni = ANY($1) AND password_hash IS NULL', [dnis]);
    for (const fila of rows) {
      const clave = DEMO_PASSWORDS[String(fila.dni).trim()];
      if (!clave) continue;
      await pool.query(
        'UPDATE usuarios SET password_hash = $1 WHERE dni = $2 AND password_hash IS NULL',
        [hashPassword(clave), fila.dni]);
    }
    if (rows.length) console.log(`[BD] Contraseñas de demostración asignadas: ${rows.length}`);
  } catch (e) {
    console.warn('[BD] No se pudo migrar password_hash:', e.message);
  }
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

/** Huella del código de un encargado. En la base sólo vive este hash:
 *  SHA-256 de "nombre:codigo" (nombre sin mayúsculas, código en mayúsculas).
 *  Así, aunque alguien lea la tabla, no obtiene los códigos de acceso. */
function hashCodigoEncargado(nombre, codigo) {
  const n = String(nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const c = String(codigo || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(`${n}:${c}`).digest('hex');
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
 *  Viaja en un token firmado (Authorization: Bearer ...) que emite el login
 *  con contraseña. La antigua cabecera X-Usuario-DNI ya NO se acepta: cualquier
 *  navegador podía escribir el DNI de otra persona. */
function dniDePeticion(req) {
  const cabecera = String(req.get('Authorization') || '');
  const encontrado = /^Bearer\s+([^\s]+)$/i.exec(cabecera);
  const sesion = encontrado ? verificarSesion(encontrado[1], SESSION_SECRET) : null;
  return sesion ? sesion.dni : null;
}

/** Convierte una columna DATE de PostgreSQL a 'YYYY-MM-DD'.
 *  pg la entrega como objeto Date, así que `String(fecha).slice(0, 10)`
 *  producía "Mon Sep 28" y el navegador lo leía como el año 2001. Se usan
 *  los componentes locales, que son exactamente los que trae la columna. */
function fechaCorta(valor) {
  if (valor instanceof Date) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  return String(valor).slice(0, 10);
}

/** Convierte una fila de PostgreSQL al mismo formato que usa el frontend */
function enriquecer(fila, dni) {
  if (!fila) return null;
  const meta = ESTADOS[fila.estado] || ESTADOS.valido;
  const esMia = Boolean(dni) && fila.titular_dni === dni;
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
    dni: esMia ? fila.titular_dni : null,
    correo: esMia ? fila.titular_correo : null,
    estado: fila.estado,
    estadoEtiqueta: meta.etiqueta,
    estadoDetalle: meta,
    dniOculto: ocultarDNI(fila.titular_dni),
    dniAnteriorOculto: fila.dni_anterior ? ocultarDNI(fila.dni_anterior) : null,
    precioOriginal: Number(fila.precio),
    precio: Number(fila.precio),
    // El token vivo sólo lo entrega a su titular. El estado de la entrada es
    // consultable por cualquiera (eso es lo que mira el verificador de la
    // puerta), pero el QR en curso no se da de una entrada que no es tuya.
    qrToken: esMia ? fila.qr_ultimo_token : null,
    qrAnterior: esMia ? fila.qr_anterior_token : null,
    qrExpiraEn: esMia ? fila.qr_expira_en : null,
    qrGeneradoEn: esMia ? fila.qr_generado_en : null,
    creadoEn: fila.creado_en,
    transferidaEn: fila.transferida_en,
    usadoEn: fila.usada_en,
    anuladoEn: fila.anulada_en,
    motivoAnulacion: fila.motivo_anulacion,
    titularAnterior: fila.titular_anterior,
    dniAnterior: esMia ? fila.dni_anterior : null,
    puedeTransferir: esMia && fila.estado === 'valido',
    esMia
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
         e.creado_en, e.transferida_en, e.usada_en, e.anulada_en,
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
  const rows = await consultar(`${SELECT_ENTRADA} WHERE e.codigo = ? LIMIT 1`, [codigo]);
  return rows[0] || null;
}

/** Registra un evento en el historial (trazabilidad) */
async function registrar(codigo, accion, titular, detalle = '', estado = null) {
  await ejecutar(
    `INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado)
     SELECT id, ?, ?, ?, ? FROM entradas WHERE codigo = ?`,
    [accion, titular, detalle, estado, codigo]
  );
}

/* ---------------------------------------------------------------------
 * 5. Tokens dinamicos firmados (HMAC-SHA256)
 * ------------------------------------------------------------------- */

/** Firma HMAC-SHA256 (32 caracteres hex) de un token.
 *  Se usa al generarlo y al validarlo para que ambos lados calculen
 *  exactamente lo mismo. */
function firmarToken(codigo, nonce, expira) {
  const ms = expira instanceof Date ? expira.getTime() : new Date(expira).getTime();
  return crypto
    .createHmac('sha256', CFG.qrSecret)
    .update(`${codigo}|${nonce}|${ms}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Compara dos firmas en tiempo constante. Se comparan los SHA-256 de ambos
 * textos para que ni el contenido ni la longitud se deduzcan por latencia.
 */
function firmasIguales(recibida, esperada) {
  const a = crypto.createHash('sha256').update(String(recibida == null ? '' : recibida)).digest();
  const b = crypto.createHash('sha256').update(String(esperada == null ? '' : esperada)).digest();
  return crypto.timingSafeEqual(a, b);
}

function generarToken(codigo) {
  const nonce = crypto.randomBytes(4).toString('hex').toUpperCase();      // 8 hex
  /* expira_en es TIMESTAMP SIN milisegundos: PostgreSQL guarda el instante
   * redondeado al segundo, y al validar la firma se recalcula sobre ese valor
   * leido de la base. Si se firmase el instante con milisegundos, la firma
   * guardada NUNCA cuadraria al comprobarla y todo QR daria "firma no
   * valida". Por eso el instante se redondea ANTES de firmarlo. */
  const expira = new Date(Math.floor((Date.now() + CFG.qrTtl * 1000) / 1000) * 1000);
  const firma = firmarToken(codigo, nonce, expira);
  return {
    token: `JSP-${codigo}-${nonce}`,
    nonce,
    firma,
    expiraEn: expira
  };
}

/**
 * Código de operación de una transferencia: 'TRF-' + 8 caracteres (12 en
 * total, CHAR(12)). Es obligatorio en transferencias.codigo_operacion
 * (NOT NULL sin valor por defecto), igual que precio_original.
 */
function generarCodigoOperacion() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let salida = '';
  for (const b of bytes) salida += alfabeto[b % alfabeto.length];
  return `TRF-${salida}`;
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
  const precio = datos.precio === '' || datos.precio == null ? Number.NaN : Number(datos.precio);
  if (Number.isNaN(precio)) campos.precio = 'Indique el precio de transferencia.';
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

  const tablas = bd
    ? await consultar(
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('usuarios','eventos','entradas','transferencias','historial','tokens_qr')`)
    : [{ total: 0 }];

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
  const dni = dniDePeticion(req) || CFG.demoDni;
  const rows = await consultar(`
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
  const rows = await consultar(`${SELECT_ENTRADA} ORDER BY e.codigo ASC`);
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
  const hist = await consultar(
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
app.post('/api/entradas/:codigo/qr', limiteQR, ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const registrarEnHistorial = String(req.query.log ?? '1') !== '0';
  const dni = dniDePeticion(req);
  if (!dni) return fallo(res, 401, 'Inicia sesión para generar el QR.', { codigo: 'SESION_REQUERIDA' });

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, `La entrada ${codigo} no existe.`);

  // Sólo el titular puede emitir el QR de su entrada. Sin esta guarda, basta
  // con saber el código para regenerar el QR de una entrada ajena.
  if (fila.titular_dni !== dni) {
    return fallo(res, 403,
      `La entrada ${codigo} pertenece a otra persona: sólo su titular puede generar su QR.`,
      { motivo: 'no-es-tuya', esMia: false });
  }

  if (fila.estado === 'usado' || fila.estado === 'anulado') {
    return fallo(res, 409, `Una entrada en estado "${ESTADOS[fila.estado].etiqueta}" no emite nuevos códigos QR.`);
  }

  const { token, nonce, firma, expiraEn } = generarToken(codigo);

  // El QR anterior queda invalidado
  await ejecutar(
    `UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id =
       (SELECT id FROM entradas WHERE codigo = ?) AND invalidado = 0`,
    [codigo]);

  await ejecutar(
    `UPDATE entradas
        SET qr_anterior_token = qr_ultimo_token,
            qr_ultimo_token = ?, qr_firma = ?, qr_expira_en = ?, qr_generado_en = NOW()
      WHERE codigo = ?`,
    [token, firma, expiraEn, codigo]);

  const ins = await ejecutar(
    `INSERT INTO tokens_qr (entrada_id, token, nonce, firma, payload, expira_en)
     SELECT id, ?, ?, ?, ?, ? FROM entradas WHERE codigo = ?
     RETURNING id`,
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
    id: ins.rows[0].id,
    entrada: enriquecer(actualizada, dni)
  });
}));

/** VALIDAR token (lo que haria el lector fisico del evento) */
app.post('/api/qr/validar', limiteValidar, ruta(async (req, res) => {
  const recibido = req.body && (req.body.token || req.body.payload);
  const token = extraerToken(recibido);
  if (!token) return fallo(res, 400, 'Token de QR con formato inválido.');

  const rows = await consultar(
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
  const esperado = firmarToken(t.codigo, nonce, expiraEn);

  if (!firmasIguales(esperado, t.firma)) {
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

/* =====================================================================
 * ENCARGADOS DE PUERTA
 * Se identifican con nombre + código y validan el QR desde el celular.
 * El código viaja en cada petición (no hay sesión de servidor) y se
 * comprueba siempre contra el hash guardado en la base.
 * =================================================================== */

/** ACCESO del encargado: valida nombre + código */
app.post('/api/encargados/login', limiteEncargado, ruta(async (req, res) => {
  const datos = req.body || {};
  const nombre = String(datos.nombre || '').trim();
  const codigo = String(datos.codigo || '').trim();

  if (!nombre || !codigo) {
    return fallo(res, 400, 'Escribe tu nombre y tu código de encargado.');
  }

  const rows = await consultar(
    'SELECT id, nombre FROM encargados WHERE codigo_hash = ? AND activo = 1 LIMIT 1',
    [hashCodigoEncargado(nombre, codigo)]);

  if (!rows.length) {
    return fallo(res, 401, 'Nombre o código de encargado incorrecto.');
  }

  ok(res, {
    encargado: { id: rows[0].id, nombre: rows[0].nombre },
    mensaje: 'Bienvenido, ' + rows[0].nombre + '.'
  });
}));

/** VALIDAR un QR desde la puerta y, si se pide, registrar el ingreso.
 *  Acepta el payload firmado del QR (JSP|CODIGO|NONCE|HORA) o el token
 *  directo; sin token, permite buscar por código de entrada (sin firma). */
app.post('/api/encargados/validar', limiteValidar, ruta(async (req, res) => {
  const datos = req.body || {};
  const nombre = String(datos.encargado || datos.nombre || '').trim();
  const codigoEncargado = String(datos.codigo || '').trim();

  if (!nombre || !codigoEncargado) {
    return fallo(res, 401, 'Inicia sesión como encargado antes de validar entradas.');
  }

  const enc = await consultar(
    'SELECT id, nombre FROM encargados WHERE codigo_hash = ? AND activo = 1 LIMIT 1',
    [hashCodigoEncargado(nombre, codigoEncargado)]);

  if (!enc.length) {
    return fallo(res, 401, 'Tu código de encargado ya no es válido: vuelve a iniciar sesión.');
  }
  const encargado = enc[0];

  const token = extraerToken(datos.token || datos.payload);
  const codigoEntrada = String(datos.entrada || '').trim().toUpperCase();

  if (!token && !/^[A-Z0-9][A-Z0-9-]{3,23}$/.test(codigoEntrada)) {
    return fallo(res, 400, 'Escanea un QR o escribe el código de la entrada.',
      { valido: false, motivo: 'formato', encargado: encargado.nombre });
  }

  let fila = null;

  if (token) {
    const rows = await consultar(
      `SELECT t.id, t.token, t.nonce, t.firma, t.expira_en, t.invalidado, t.usado_en,
              e.codigo, e.estado, e.titular_nombre
         FROM tokens_qr t
         JOIN entradas e ON e.id = t.entrada_id
        WHERE t.token = ? LIMIT 1`, [token]);

    if (!rows.length) {
      return fallo(res, 200, 'El código QR no pertenece a ninguna entrada emitida.',
        { valido: false, motivo: 'desconocido', encargado: encargado.nombre });
    }

    const t = rows[0];

    // La firma se recalcula aquí: un QR alterado no pasa la puerta
    const esperado = firmarToken(t.codigo, t.nonce, t.expira_en);

    if (!firmasIguales(esperado, t.firma)) {
      return fallo(res, 200, 'La firma del token no es válida.',
        { valido: false, motivo: 'firma', encargado: encargado.nombre });
    }
    if (Number(t.invalidado) === 1) {
      return fallo(res, 200, 'El token fue invalidado al rotar el código QR.',
        { valido: false, motivo: 'invalidado', encargado: encargado.nombre });
    }
    if (new Date(t.expira_en).getTime() < Date.now()) {
      return fallo(res, 200, 'El token expiró: pide al asistente que refresque su QR.',
        { valido: false, motivo: 'expirado', encargado: encargado.nombre });
    }

    fila = await obtenerFila(t.codigo);
  } else {
    fila = await obtenerFila(codigoEntrada);
  }

  if (!fila) {
    return fallo(res, 404, `La entrada ${codigoEntrada || token} no existe en el sistema.`,
      { valido: false, motivo: 'desconocido', encargado: encargado.nombre });
  }

  // El encargado no es el titular: se enriquece con un DNI ajeno para que
  // la respuesta no incluya el QR vivo de la entrada.
  const entrada = enriquecer(fila, '00000000');

  if (fila.estado === 'usado') {
    return fallo(res, 200, 'La entrada ya fue utilizada para ingresar al evento.',
      { valido: false, motivo: 'usada', entrada, encargado: encargado.nombre });
  }
  if (fila.estado === 'anulado') {
    return fallo(res, 200, 'La entrada está anulada.',
      { valido: false, motivo: 'anulada', entrada, encargado: encargado.nombre });
  }

  const eraValida = true;
  const registrarIngreso = datos.registrar === true || datos.registrar === 'true';
  let registrado = false;

  if (registrarIngreso) {
    await ejecutar(
      "UPDATE entradas SET estado = 'usado', usada_en = NOW() WHERE codigo = ? AND estado <> 'usado'",
      [fila.codigo]);
    if (token) {
      await ejecutar('UPDATE tokens_qr SET usado_en = NOW() WHERE token = ?', [token]);
    } else {
      // Registro por codigo (sin QR escaneado): se cierra el token vigente
      // para que la entrada no deje un QR "vivo" en el celular del asistente.
      // No se marca usado_en porque ese QR no se escaneo en la puerta.
      await ejecutar(
        `UPDATE tokens_qr SET invalidado = 1
          WHERE invalidado = 0 AND entrada_id =
            (SELECT id FROM entradas WHERE codigo = ?)`, [fila.codigo]);
    }
    await registrar(fila.codigo, 'usada', fila.titular_nombre,
      `Ingreso registrado por ${encargado.nombre} (encargado)`, 'usado');
    registrado = true;
    fila = await obtenerFila(fila.codigo);
  }

  ok(res, {
    valido: eraValida,
    motivo: registrado ? 'registrado' : 'ok',
    registrado,
    conFirma: !!token,
    entrada: enriquecer(fila, '00000000'),
    encargado: encargado.nombre,
    mensaje: registrado
      ? `Ingreso registrado por ${encargado.nombre}.`
      : (token ? 'QR vigente: acceso permitido.' : 'Entrada válida (código sin token firmado).')
  });
}));

/** TRANSFERIR entrada */
app.post('/api/entradas/:codigo/transferir', limiteEscritura, ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const datos = req.body || {};
  const dni = dniDePeticion(req);
  if (!dni) return fallo(res, 401, 'Inicia sesión para transferir la entrada.', { codigo: 'SESION_REQUERIDA' });

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, 'La entrada no existe en el sistema.');

  // Sólo el titular actual puede transferir su entrada. El candado del DNI que
  // hay en el formulario vive en el navegador; esta es la comprobación del
  // servidor, la que en realidad vale.
  if (fila.titular_dni !== dni) {
    return fallo(res, 403,
      `La entrada ${codigo} pertenece a otra persona: sólo su titular puede transferirla.`,
      { motivo: 'no-es-tuya' });
  }

  if (fila.estado !== 'valido') {
    return fallo(res, 409,
      `No es posible transferir una entrada con estado "${ESTADOS[fila.estado].etiqueta}".`);
  }

  const v = validarTransferencia(datos, fila);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error, campos: v.campos });

  const titularAnterior = fila.titular_nombre;
  const dniAnterior = fila.titular_dni;
  const tokenAnterior = fila.qr_ultimo_token;

  // Ids de la entrada y del titular ACTUAL: se leen antes de cambiar la
  // titularidad, porque el registro de transferencia los necesita (si se
  // leyeran después, "titular_anterior_id" apuntaría al nuevo dueño).
  const ids = await consultar(
    'SELECT id, titular_id FROM entradas WHERE codigo = ? LIMIT 1', [codigo]);
  const entradaId = ids.length ? ids[0].id : null;
  const titularAnteriorId = ids.length ? ids[0].titular_id : null;
  if (!entradaId) return fallo(res, 404, 'La entrada no existe en el sistema.');

  // Usuario destino (se crea si no existe, para no romper la FK)
  const usr = await ejecutar(
    `INSERT INTO usuarios (nombre, dni, correo) VALUES (?, ?, ?)
     ON CONFLICT (dni) DO NOTHING
     RETURNING id, nombre, dni, correo`,
    [v.nombre, v.dni, v.correo]);
  const [usuarioNuevo] = usr.rows.length
    ? usr.rows
    : await consultar('SELECT id, nombre, dni, correo FROM usuarios WHERE dni = ?', [v.dni]);

  // Se actualiza la titularidad y el estado
  const cambio = await ejecutar(
    `UPDATE entradas
        SET titular_id = ?, titular_nombre = ?, titular_dni = ?, titular_correo = ?,
            estado = 'transferido', transferida_en = NOW(),
            qr_anterior_token = qr_ultimo_token, qr_ultimo_token = NULL,
            qr_firma = NULL, qr_expira_en = NULL
      WHERE codigo = ? AND titular_dni = ? AND estado = 'valido'`,
    [usuarioNuevo.id, usuarioNuevo.nombre, usuarioNuevo.dni, usuarioNuevo.correo, codigo, dni]);
  if (!cambio.rowCount) return fallo(res, 409, 'La entrada cambió. Vuelve a consultarla.');

  await ejecutar(
    'UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id = ? AND invalidado = 0',
    [entradaId]);

  // Registro de la transferencia. "precio_original" y "codigo_operacion" son
  // NOT NULL sin valor por defecto: sin enviarlos el INSERT fallaba con
  // "Field 'precio_original' doesn't have a default value" y la
  // transferencia devolvía 500.
  await ejecutar(
    `INSERT INTO transferencias
       (entrada_id, titular_anterior_id, titular_anterior_nombre, titular_anterior_dni,
        titular_nuevo_id, titular_nuevo_nombre, titular_nuevo_dni, titular_nuevo_correo,
        precio, precio_original, codigo_operacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entradaId, titularAnteriorId, titularAnterior, dniAnterior,
     usuarioNuevo.id, usuarioNuevo.nombre, usuarioNuevo.dni, usuarioNuevo.correo,
     v.precio, Number(fila.precio), generarCodigoOperacion()]);

  await registrar(codigo, 'transferida', usuarioNuevo.nombre,
    `${titularAnterior} → ${usuarioNuevo.nombre} · S/ ${v.precio.toFixed(2)}`, 'transferido');
  await registrar(codigo, 'qr', usuarioNuevo.nombre,
    tokenAnterior
      ? 'QR anterior invalidado y reemplazado'
      : 'Nuevo QR generado para el nuevo titular', 'transferido');

  // QR nuevo para el nuevo titular
  const nuevo = generarToken(codigo);
  await ejecutar(
    `UPDATE entradas
        SET qr_ultimo_token = ?, qr_firma = ?, qr_expira_en = ?, qr_generado_en = NOW()
      WHERE codigo = ?`, [nuevo.token, nuevo.firma, nuevo.expiraEn, codigo]);

  await ejecutar(
    `INSERT INTO tokens_qr (entrada_id, token, nonce, firma, payload, expira_en)
     SELECT id, ?, ?, ?, ?, ? FROM entradas WHERE codigo = ?`,
    [nuevo.token, nuevo.nonce, nuevo.firma, construirPayload(codigo, nuevo.nonce), nuevo.expiraEn, codigo]);

  const actualizada = await obtenerFila(codigo);

  ok(res, {
    codigo,
    titularAnterior,
    titularNuevo: usuarioNuevo.nombre,
    dniAnterior: ocultarDNI(dniAnterior),
    dniNuevo: ocultarDNI(v.dni),
    precio: v.precio,
    estado: 'transferido',
    estadoEtiqueta: ESTADOS.transferido.etiqueta,
    qrPendiente: false,
    entrada: enriquecer(actualizada, null)
  });
}));

/** INICIAR SESIÓN con DNI + contraseña. Devuelve un token firmado que el
 *  resto de rutas acepta en Authorization: Bearer ... */
app.post('/api/usuarios/login', limiteEncargado, ruta(async (req, res) => {
  const b = req.body || {};

  const dni = String(b.dni || '').trim();
  if (!/^\d{8}$/.test(dni)) {
    return fallo(res, 400, 'El DNI debe tener exactamente 8 números.', { campo: 'dni' });
  }

  const clave = String(b.password || '');
  if (!clave) return fallo(res, 400, 'Escribe tu contraseña.', { campo: 'password' });

  const rows = await consultar(
    'SELECT id, nombre, dni, correo, password_hash FROM usuarios WHERE dni = ? LIMIT 1', [dni]);
  const usuario = rows[0];

  // Se compara siempre (también con DNI inexistente) para no revelar por
  // tiempo de respuesta qué DNIs están registrados.
  const coincide = verifyPassword(clave, (usuario && usuario.password_hash) || HASH_RELLENO);
  if (!usuario || !usuario.password_hash || !coincide) {
    return fallo(res, 401, 'DNI o contraseña incorrectos.');
  }

  const { password_hash, ...publico } = usuario;
  const sesion = firmarSesion({ dni, secreto: SESSION_SECRET, ttlSegundos: SESSION_TTL });
  ok(res, { usuario: publico, token: sesion.token, expiraEn: sesion.expiraEn });
}));

/** REGISTRAR una persona nueva: la da de alta en la base para que a partir
 *  de ahí pueda iniciar sesión con su DNI y su contraseña. */
app.post('/api/usuarios', limiteEscritura, ruta(async (req, res) => {
  const b = req.body || {};

  const dni = String(b.dni || '').trim();
  if (!/^\d{8}$/.test(dni)) {
    return fallo(res, 400, 'El DNI debe tener exactamente 8 números.', { campo: 'dni' });
  }

  const nombre = String(b.nombre || '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 3 || nombre.length > 120 || !/^\p{L}[\p{L}\s'.-]*$/u.test(nombre)) {
    return fallo(res, 400, 'Escribe el nombre completo (sólo letras).', { campo: 'nombre' });
  }

  const correo = String(b.correo || '').trim().toLowerCase();
  if (correo.length > 160 || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(correo)) {
    return fallo(res, 400, 'El correo no tiene un formato válido (ej. ana@correo.com).',
      { campo: 'correo' });
  }

  const clave = passwordValida(b.password);
  if (!clave.ok) return fallo(res, 400, clave.mensaje, { campo: 'password' });

  // El DNI es la identidad del sistema: no puede repetirse. Si dos personas
  // se registran a la vez, la clave única uq_usuarios_dni decide (23505).
  const existe = await consultar('SELECT id FROM usuarios WHERE dni = ? LIMIT 1', [dni]);
  if (existe.length) {
    return fallo(res, 409, 'Ese DNI ya está registrado: identifícate con tu nombre.',
      { campo: 'dni' });
  }

  const telefono = String(b.telefono || '').trim().slice(0, 30) || null;
  try {
    const alta = await ejecutar(
      'INSERT INTO usuarios (nombre, dni, correo, telefono, password_hash) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [nombre, dni, correo, telefono, hashPassword(clave.valor)]);
    return res.status(201).json({
      ok: true,
      usuario: { id: alta.rows[0].id, nombre: nombre, dni: dni, correo: correo }
    });
  } catch (e) {
    if (e && e.code === '23505') {
      return fallo(res, 409, 'Ese DNI ya está registrado: identifícate con tu nombre.',
        { campo: 'dni' });
    }
    throw e;
  }
}));

app.post('/api/usuarios/activar', limiteEncargado, ruta(async (req, res) => {
  const datos = req.body || {};
  const dni = String(datos.dni || '').trim();
  const codigo = String(datos.codigo || '').trim();
  if (!/^\d{8}$/.test(dni) || !FORMATO_CODIGO.test(codigo)) {
    return fallo(res, 400, 'Revisa el DNI y el código de activación.');
  }
  const clave = passwordValida(datos.password);
  if (!clave.ok) return fallo(res, 400, clave.mensaje);

  const usuario = await consumirCodigoActivacion(pool, { dni, codigo, passwordHash: hashPassword(clave.valor) });
  if (!usuario) return fallo(res, 400, 'El código de activación es incorrecto o ya no está vigente.');
  res.set('Cache-Control', 'no-store');
  return ok(res, {});
}));

/** Consulta privada del perfil propio. */
app.get('/api/usuarios/:dni', ruta(async (req, res) => {
  const dni = String(req.params.dni).trim();
  const dniSesion = dniDePeticion(req);
  if (!dniSesion) return fallo(res, 401, 'Inicia sesión para consultar tu perfil.', { codigo: 'SESION_REQUERIDA' });
  if (dniSesion !== dni) return fallo(res, 403, 'Solo puedes consultar tu propio perfil.', { codigo: 'PERFIL_AJENO' });

  const rows = await consultar(
    'SELECT id, nombre, dni, correo FROM usuarios WHERE dni = ? LIMIT 1', [dni]);

  if (!rows.length) {
    return fallo(res, 404, 'No encontramos a ninguna persona con ese DNI.', { campo: 'dni' });
  }

  res.set('Cache-Control', 'no-store');
  ok(res, { usuario: rows[0] });
}));

/** OBTENER historial de trazabilidad.
 *  Con ?dni=XXXXXXXX devuelve solo los movimientos de esa persona: las
 *  entradas que tiene ahora mas aquellas que transfirio o le transfirieron
 *  (para que un traspaso no desaparezca del historial de quien lo hizo). */
app.get('/api/historial', ruta(async (req, res) => {
  const dni = String(req.query.dni || '').trim();

  const rows = /^\d{8}$/.test(dni)
    ? await consultar(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h JOIN entradas e ON e.id = h.entrada_id
        WHERE e.titular_dni = ?
           OR EXISTS (SELECT 1 FROM transferencias t
                       WHERE t.entrada_id = e.id
                         AND (t.titular_anterior_dni = ? OR t.titular_nuevo_dni = ?))
        ORDER BY h.creado_en ASC, h.id ASC`, [dni, dni, dni])
    : await consultar(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h JOIN entradas e ON e.id = h.entrada_id
        ORDER BY h.creado_en ASC, h.id ASC`);

  ok(res, { historial: mapearHistorial(rows) });
}));

app.get('/api/entradas/:codigo/historial', ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();

  const rows = await consultar(
    `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
       FROM historial h JOIN entradas e ON e.id = h.entrada_id
      WHERE e.codigo = ? ORDER BY h.creado_en ASC, h.id ASC`, [codigo]);

  ok(res, { historial: mapearHistorial(rows) });
}));

/** Marcar una entrada como usada o anulada (simula el control de acceso) */
app.post('/api/entradas/:codigo/estado/:estado', limiteEscritura, ruta(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const estado = String(req.params.estado).toLowerCase();
  const dni = dniDePeticion(req);
  if (!dni) return fallo(res, 401, 'Inicia sesión para cambiar el estado.', { codigo: 'SESION_REQUERIDA' });
  if (!['usado', 'anulado', 'valido'].includes(estado)) {
    return fallo(res, 400, 'Estado no permitido: ' + estado);
  }

  // El ingreso en puerta lo registra unicamente el panel de encargados
  // (/api/encargados/validar). Antes bastaba con conocer el codigo de una
  // entrada para marcarla como usada desde la web y saltarse la puerta.
  if (estado === 'usado') {
    return fallo(res, 403,
      'El ingreso en puerta solo lo registra un encargado desde /staff/.',
      { motivo: 'solo-encargado' });
  }

  const fila = await obtenerFila(codigo);
  if (!fila) return fallo(res, 404, 'La entrada no existe.');
  if (fila.titular_dni !== dni) return fallo(res, 403, 'Esta entrada pertenece a otro titular.');
  if (fila.estado === 'usado' || (estado === 'valido' && fila.estado !== 'anulado')) {
    return fallo(res, 409, 'La entrada no admite ese cambio de estado.');
  }

  const actualizado = await pool.query(
    `UPDATE entradas
        SET estado = $2::varchar,
            anulada_en = CASE WHEN $2::varchar = 'anulado' THEN NOW() ELSE NULL END,
            transferida_en = CASE WHEN $2::varchar = 'valido' THEN NULL ELSE transferida_en END,
            qr_ultimo_token = NULL, qr_anterior_token = NULL,
            qr_firma = NULL, qr_expira_en = NULL
      WHERE codigo = $1 AND titular_dni = $3 AND estado = $4`,
    [codigo, estado, dni, fila.estado]);
  if (!actualizado.rowCount) return fallo(res, 409, 'La entrada cambió. Vuelve a consultarla.');

  if (estado === 'anulado') {
    await ejecutar('UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id = ?', [fila.id]);
  }

  const accion = estado === 'anulado' ? 'anulada' : 'verificada';
  const detalle = estado === 'anulado' ? 'Entrada anulada por el titular' : 'Entrada reactivada';
  await registrar(codigo, accion, fila.titular_nombre, detalle, estado);

  const actualizada = await obtenerFila(codigo);
  ok(res, { entrada: enriquecer(actualizada, dni) });
}));

/** Reinicia los datos ficticios de la demo */
app.post('/api/demo/reiniciar', limiteEscritura, ruta(async (req, res) => {
  // El mismo archivo que usa PostgreSQL al arrancar (fuente única de verdad).
  // docker-compose.yml lo monta en /app/seed.sql
  const rutas = [
    process.env.SEED_SQL,
    path.join(__dirname, 'seed.sql'),
    path.join(__dirname, '..', 'database', 'init.sql')
  ].filter(Boolean);
  const semilla = rutas.find(r => fs.existsSync(r));

  const cliente = new Client({
    host: CFG.db.host,
    port: CFG.db.port,
    user: CFG.db.user,
    password: CFG.db.password,
    database: CFG.db.database,
    options: '-c timezone=America/Lima'
  });
  await cliente.connect();

  try {
    /* TRUNCATE ... CASCADE borra también las filas que dependen por clave
     * foránea; RESTART IDENTITY reinicia los contadores SERIAL. */
    await cliente.query(
      'TRUNCATE TABLE historial, tokens_qr, transferencias, entradas, eventos, usuarios '
      + 'RESTART IDENTITY CASCADE');

    if (semilla) {
      // El archivo de semilla es idempotente y no contiene CREATE DATABASE.
      await cliente.query(fs.readFileSync(semilla, 'utf8'));
      console.log('[DEMO] Datos reiniciados desde ' + semilla);
    }
  } finally {
    await cliente.end();
  }

  const total = await consultar('SELECT COUNT(*) AS n FROM entradas');
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
  if (err && err.code === '23505') {
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
  esperarBase()
    .then((conectado) => {
      if (!conectado) return process.exit(1);
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
    })
    .catch((e) => {
      console.error('[BD] No se pudo iniciar el servidor:', e);
      process.exit(1);
    });
}

module.exports = app;

/* Funciones puras exportadas para las pruebas unitarias (test/unit).
 * No alteran el comportamiento de la API: sólo quedan accesibles desde
 * `require('../backend/index').util`. */
module.exports.util = {
  ocultarDNI,
  fechaCorta,
  hashCodigoEncargado,
  firmarToken,
  firmasIguales,
  generarToken,
  validarTransferencia,
  extraerToken,
  pgSql
};
