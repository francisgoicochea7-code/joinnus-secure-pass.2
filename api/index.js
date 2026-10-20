/* =========================================================================
 * JOINNUS SECURE PASS — api/index.js
 * -------------------------------------------------------------------------
 * Punto de entrada de la API en Vercel (funciones serverless).
 *
 * Vercel no levanta un servidor Node permanente: cada peticion ejecuta una
 * funcion que recibe (req, res) de Node y espera que la respuesta se escriba
 * en `res`. La app Express de backend/index.js YA es una funcion con esa
 * firma, asi que se enchufa directamente, sin intermediarios:
 *
 *   module.exports = (req, res) => app(req, res);
 *
 * (Antes se usaba serverless-http, pensado para AWS Lambda: devuelve la
 * respuesta como objeto y nunca toca el `res` de Vercel, de modo que toda
 * peticion a /api quedaba colgada sin respuesta.)
 *
 *   api/index.js       ->  /api
 *   api/[...path].js   ->  /api/*   (health, entradas, qr, transferir...)
 *
 * Express recibe la ruta COMPLETA de la peticion (/api/entradas/ENTRY001...),
 * que es exactamente como estan declaradas las rutas en backend/index.js,
 * asi que no hay que reescribir nada. Ese archivo ya exporta `app` y solo
 * llama a `app.listen()` cuando se ejecuta como programa principal (node
 * index.js en Docker), de modo que el codigo fuente sigue siendo UNO solo
 * para los dos despliegues.
 * ========================================================================= */

'use strict';

/* Las funciones de Vercel corren en UTC y el entorno TZ esta reservado (no se
 * puede declarar en el panel), asi que la hora de Lima se fija aqui, antes de
 * cargar la app, para que las fechas del historial y de los QR se muestren
 * igual que en el despliegue local. */
if (!process.env.TZ) process.env.TZ = 'America/Lima';

const app = require('../backend/index');

/* Aridad 2 explicita: Vercel invoca el handler como (req, res). */
module.exports = (req, res) => app(req, res);
