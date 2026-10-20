/* =========================================================================
 * JOINNUS SECURE PASS — api/index.js
 * -------------------------------------------------------------------------
 * Punto de entrada de la API en Vercel (funciones serverless).
 *
 * Vercel no levanta un servidor Node permanente: cada peticion ejecuta una
 * funcion. Aqui no hay logica, solo se enchufa la MISMA app Express del
 * backend (backend/index.js) con serverless-http. Ese archivo ya exporta
 * `app` y solo llama a `app.listen()` cuando se ejecuta como programa
 * principal (node index.js en Docker), de modo que el codigo fuente sigue
 * siendo UNO solo para los dos despliegues.
 *
 *   api/index.js       ->  /api
 *   api/[...path].js   ->  /api/*   (health, entradas, qr, transferir...)
 * ========================================================================= */

'use strict';

/* Las funciones de Vercel corren en UTC y el entorno TZ esta reservado (no se
 * puede declarar en el panel), asi que la hora de Lima se fija aqui, antes de
 * cargar la app, para que las fechas del historial y de los QR se muestren
 * igual que en el despliegue local. */
if (!process.env.TZ) process.env.TZ = 'America/Lima';

const serverless = require('serverless-http');
const app = require('../backend/index');

module.exports = serverless(app);
