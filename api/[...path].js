/* =========================================================================
 * JOINNUS SECURE PASS — api/[...path].js
 * -------------------------------------------------------------------------
 * Comodin de Vercel para todas las rutas bajo /api/... :
 *
 *   GET  /api/health                  -> esta funcion
 *   GET  /api/entradas/ENTRY001       -> esta funcion
 *   POST /api/entradas/ENTRY001/qr    -> esta funcion
 *   ...
 *
 * serverless-http entrega a Express la ruta COMPLETA de la peticion
 * (/api/entradas/ENTRY001...), que es exactamente como estan declaradas
 * las rutas en backend/index.js, asi que no hay que reescribir nada.
 * ========================================================================= */

'use strict';

/* Ver api/index.js: la zona horaria de Lima se fija aqui porque en Vercel el
 * entorno TZ esta reservado y las funciones corren en UTC. */
if (!process.env.TZ) process.env.TZ = 'America/Lima';

const serverless = require('serverless-http');
const app = require('../backend/index');

module.exports = serverless(app);
