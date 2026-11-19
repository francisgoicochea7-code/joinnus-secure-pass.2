import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.env.PORT || 8091);
const TARGET_HOST = process.env.API_HOST || 'localhost';
const TARGET_PORT = Number(process.env.API_PORT || 8444);

// Proxy SOLO para desarrollo local. Permite que un telefono en la misma red
// consulte el gateway HTTPS autofirmado sin tener que instalar su certificado.
// No se usa en produccion: la app habla directamente con Render por HTTPS.
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, X-Usuario-DNI',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  const target = https.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
      rejectUnauthorized: false,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, {
        ...upstream.headers,
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'Content-Type, X-Usuario-DNI',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      });
      upstream.pipe(res);
    }
  );

  target.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: `Proxy sin conexion: ${error.message}` }));
  });

  req.pipe(target);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Secure Pass] Proxy de desarrollo en http://0.0.0.0:${PORT}/api`);
  console.log(`[Secure Pass] Destino: https://${TARGET_HOST}:${TARGET_PORT}`);
});
