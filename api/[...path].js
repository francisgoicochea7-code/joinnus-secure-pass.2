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
 * Vercel invoca la funcion como (req, res) de Node y espera la respuesta en
 * `res`. La app Express de backend/index.js ya es una funcion con esa firma,
 * asi que se le pasa la peticion tal cual (ver api/index.js): Express recibe
 * la ruta COMPLETA (/api/entradas/ENTRY001...), que es exactamente como estan
 * declaradas las rutas en backend/index.js, asi que no hay que reescribir
 * nada.
 * ========================================================================= */

'use strict';

/* Ver api/index.js: la zona horaria de Lima se fija aqui porque en Vercel el
 * entorno TZ esta reservado y las funciones corren en UTC. */
if (!process.env.TZ) process.env.TZ = 'America/Lima';

const app = require('../backend/index');

/* Aridad 2 explicita: Vercel invoca el handler como (req, res). */
module.exports = (req, res) => app(req, res);
