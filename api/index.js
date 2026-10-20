/* =========================================================================
 * JOINNUS SECURE PASS — api/index.js
 * -------------------------------------------------------------------------
 * Punto de entrada UNICO de la API en Vercel (funcion serverless).
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
 * COMO LLEGAN LAS PETICIONES (/api/health, /api/entradas/ENTRY001/qr...)
 * -------------------------------------------------------------------------
 * El enrutado por ficheros de Vercel solo casa rutas SENCILLAS: api/index.js
 * atiende /api y un api/[...path].js casaba un unico tramo suelto
 * (/api/health si, /api/entradas/ENTRY001 NO: la plataforma respondia su
 * propio 404 en HTML sin llegar jamas a Express).
 *
 * La solucion es la rewrite de vercel.json:
 *
 *   /api/:path*  ->  /api?__ruta=/api/:path*
 *
 * Cualquier ruta bajo /api con uno o mas tramos se reenvia a ESTA funcion
 * guardando el camino original en el parametro de consulta __ruta. Solo
 * queda devolverselo a Express antes de llamarle, porque Express enruta
 * segun req.url:
 *
 *   /api?__ruta=/api/entradas/ENTRY001&dni=12345678
 *        ->  req.url = /api/entradas/ENTRY001?dni=12345678
 *
 * Express recibe asi la ruta COMPLETA (/api/entradas/ENTRY001...), que es
 * exactamente como estan declaradas las rutas en backend/index.js, y no hay
 * que tocar ese archivo. Ese archivo ya exporta `app` y solo llama a
 * `app.listen()` cuando se ejecuta como programa principal (node index.js en
 * Docker), de modo que el codigo fuente sigue siendo UNO solo para los dos
 * despliegues.
 * ========================================================================= */

'use strict';

/* Las funciones de Vercel corren en UTC y el entorno TZ esta reservado (no se
 * puede declarar en el panel), asi que la hora de Lima se fija aqui, antes de
 * cargar la app, para que las fechas del historial y de los QR se muestren
 * igual que en el despliegue local. */
if (!process.env.TZ) process.env.TZ = 'America/Lima';

const app = require('../backend/index');

/* Restaura en req.url el camino que el navegador pidio de verdad.
 *
 * La rewrite de vercel.json reenvia /api/a/b como /api?__ruta=/api/a/b; aqui
 * se recupera /api/a/b y se devuelven tambien el resto de parametros de
 * consulta (dni, log...), que Vercel conserva. Si la peticion no trae __ruta
 * (entrada directa a /api, sin rewrite) no se toca nada. */
function restaurarRuta(req) {
  const url = req.url || '';
  const corte = url.indexOf('?');
  const consulta = new URLSearchParams(corte >= 0 ? url.slice(corte + 1) : '');

  const ruta = consulta.get('__ruta');
  if (!ruta) return;

  consulta.delete('__ruta');
  const resto = consulta.toString();
  req.url = ruta + (resto ? '?' + resto : '');
}

/* Aridad 2 explicita: Vercel invoca el handler como (req, res). */
module.exports = (req, res) => {
  restaurarRuta(req);
  return app(req, res);
};
