/* =========================================================================
 * JOINNUS SECURE PASS — server.js
 * -------------------------------------------------------------------------
 * Servidor estático opcional, sin dependencias externas (sólo Node.js).
 * Sirve la carpeta frontend/ sin necesidad de Docker ni de MySQL.
 *
 * En este modo SecurePassAPI no encuentra la API y trabaja automáticamente
 * con los datos ficticios de localStorage (ver frontend/js/api.js).
 *
 *   node server.js            → http://localhost:8080
 *   node server.js 3000       → http://localhost:3000
 * ========================================================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PUERTO = Number(process.argv[2]) || 8080;
// Las páginas viven en frontend/ desde la reorganización en contenedores
const RAIZ = path.join(__dirname, 'frontend');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const servidor = http.createServer((peticion, respuesta) => {
  let ruta = decodeURIComponent(url.parse(peticion.url).pathname);
  if (ruta === '/') ruta = '/index.html';

  // Evita salir de la carpeta del proyecto
  const destino = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
  if (!destino.startsWith(RAIZ)) {
    respuesta.writeHead(403).end('Acceso denegado');
    return;
  }

  fs.readFile(destino, (error, contenido) => {
    if (error) {
      // Redirección a index.html dentro de un subdirectorio
      if (error.code === 'ENOENT' && !path.extname(ruta)) {
        fs.readFile(path.join(RAIZ, 'index.html'), (e2, html) => {
          if (e2) return respuesta.writeHead(404).end('No encontrado');
          respuesta.writeHead(200, { 'Content-Type': TIPOS['.html'] }).end(html);
        });
        return;
      }
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('404 — ' + ruta + ' no encontrado');
      return;
    }
    const tipo = TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    respuesta.writeHead(200, {
      'Content-Type': tipo,
      'Cache-Control': 'no-cache'
    }).end(contenido);
  });
});

servidor.listen(PUERTO, () => {
  console.log('');
  console.log('  Joinnus Secure Pass — servidor de desarrollo');
  console.log('  ------------------------------------------');
  console.log('  Abre:  http://localhost:' + PUERTO);
  console.log('  Ctrl+C para detener el servidor');
  console.log('');
});
