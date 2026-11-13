'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const leer = ruta => fs.readFileSync(path.join(raiz, ruta), 'utf8');

test('CSP restringe scripts y conexiones al propio origen', () => {
  const headers = leer('frontend/security-headers.conf');
  assert.match(headers, /script-src 'self';/);
  assert.match(headers, /connect-src 'self';/);
  assert.match(headers, /object-src 'none';/);
  assert.match(headers, /frame-ancestors 'none';/);
  assert.match(headers, /style-src 'self';/);
  assert.match(headers, /style-src-attr 'unsafe-inline';/);
  assert.doesNotMatch(headers, /style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(headers, /script-src[^;]*(?:unsafe-inline|unsafe-eval|https:|\*)/);
  assert.match(headers, /camera=\(self\)/);
});

test('las locations con caché no pierden las cabeceras de seguridad', () => {
  const sitio = leer('frontend/site.conf');
  const bloques = sitio.match(/location[^{}]+\{[^{}]*\}/g) || [];
  assert.ok(bloques.length >= 4);
  for (const bloque of bloques) {
    if (bloque.includes('add_header')) {
      assert.match(bloque, /include \/etc\/nginx\/security-headers.conf;/);
    }
  }
  assert.match(leer('Dockerfile'), /COPY frontend\/security-headers.conf \/etc\/nginx\/security-headers.conf/);
  assert.match(leer('Dockerfile'), /COPY frontend\/site.conf \/etc\/nginx\/site.conf/);
  assert.match(leer('Dockerfile'), /COPY frontend\/hsts-map.conf \/etc\/nginx\/conf\.d\/00-hsts-map\.conf/);
});

test('HSTS y aislamiento de origen están configurados sin romper localhost', () => {
  const headers = leer('frontend/security-headers.conf');
  assert.match(headers, /Cross-Origin-Embedder-Policy "require-corp"/);
  assert.match(headers, /Cross-Origin-Opener-Policy "same-origin"/);
  assert.match(headers, /Cross-Origin-Resource-Policy "same-origin"/);
  assert.match(headers, /Strict-Transport-Security \$hsts_value/);

  const mapa = leer('frontend/hsts-map.conf');
  assert.match(mapa, /map \$host \$hsts_value/);
  assert.match(mapa, /localhost\s+"";/);
  assert.match(mapa, /default\s+"max-age=31536000; includeSubDomains"/);
});

test('páginas sin fuentes o scripts externos y sin scripts inline', () => {
  const paginas = fs.readdirSync(path.join(raiz, 'frontend')).filter(x => x.endsWith('.html'));
  paginas.push('staff/index.html');
  for (const pagina of paginas) {
    const html = leer('frontend/' + pagina);
    assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/);
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i);
    assert.doesNotMatch(html, /\son(?:click|load|error|change|submit)\s*=/i);
    assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//i);
    if (!pagina.startsWith('staff/')) assert.match(html, /assets\/fonts\/fonts.css/);
  }
});

test('fuente local válida con licencia y ruta coincidente en CSS', () => {
  const fuente = fs.readFileSync(path.join(raiz, 'frontend/assets/fonts/PlusJakartaSans.ttf'));
  assert.equal(fuente.readUInt32BE(0), 0x00010000);
  assert.match(leer('frontend/assets/fonts/fonts.css'), /PlusJakartaSans\.ttf/);
  assert.match(leer('frontend/assets/fonts/OFL.txt'), /SIL OPEN FONT LICENSE Version 1.1/);
});

test('HTTPS usa claves externas, TLS moderno y redirección', () => {
  const tls = leer('frontend/nginx-https.conf');
  assert.match(tls, /listen 443 ssl/);
  assert.match(tls, /ssl_protocols TLSv1.2 TLSv1.3;/);
  assert.match(tls, /return 308 https:\/\/\$host:8443\$request_uri;/);
  assert.match(leer('docker-compose.https.yml'), /\.\/\.certs:\/etc\/nginx\/certs:ro/);
  assert.match(leer('.gitignore'), /\.certs\//);
  assert.match(leer('.dockerignore'), /\.certs/);
});
