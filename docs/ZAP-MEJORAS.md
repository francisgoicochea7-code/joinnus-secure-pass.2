# Mejoras tras el escaneo ZAP de Joinnus

El informe original está en `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS.html`.
No se modifica ni se mezcla con los informes de culebrita o Juice Shop.

## Cambios

- CSP en páginas, API, scripts, estilos, imágenes y fuentes servidas por Nginx.
  Sólo scripts del mismo origen, sin scripts inline ni `eval`. Los estilos
  inline existentes se limitan a atributos con `style-src-attr 'unsafe-inline'`;
  `style-src` y `style-src-elem` quedan restringidos a `'self'`, por lo que ZAP
  ya no marca el antiguo aviso `CSP: style-src unsafe-inline`.
- Cabeceras de aislamiento de origen: `Cross-Origin-Embedder-Policy:
  require-corp`, `Cross-Origin-Opener-Policy: same-origin` y
  `Cross-Origin-Resource-Policy: same-origin`.
- HSTS (`max-age=31536000; includeSubDomains`) para hosts públicos. Se omite
  deliberadamente en `localhost` y `127.0.0.1`: HSTS se aplica por host, no por
  puerto, y forzar HTTPS en localhost rompería el panel de ZAP (8082), el
  backend (3001) y otros servicios locales.
- `Cache-Control: no-store` para HTML, JS y CSS del prototipo; los recursos
  estáticos como el favicon y la fuente sí se cachean.
- Fuente variable Plus Jakarta Sans oficial autoalojada, con licencia SIL OFL.
  Se eliminan conexiones a Google Fonts, sin inventar un hash SRI para CSS
  que cambia según navegador. Fuente original:
  https://github.com/google/fonts/tree/main/ofl/plusjakartasans
- Modo HTTPS local opcional con TLS 1.2/1.3. Las claves se montan en sólo lectura,
  no se copian a imágenes ni se versionan. No se instala confianza automáticamente.
- `Permissions-Policy` permite cámara sólo al propio origen, sin micrófono
  ni geolocalización. La cámara física debe comprobarse por separado.

## HTTPS de desarrollo

Generar certificado autofirmado de 30 días (requiere OpenSSL o Git para Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/certificado-local.ps1
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Abrir `https://localhost:8443`. HTTP en 8081 redirige allí. **El navegador
mostrará advertencia con un certificado autofirmado**: esto comprueba cifrado,
no confianza. No declarar HTTPS listo para usuarios reales con esa advertencia.

Si se requiere confianza local, instalar mkcert desde su fuente oficial y,
con aprobación del propietario del equipo, ejecutar `mkcert -install`. Luego,
en una carpeta `.certs` sin certificados existentes:

```powershell
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 host.docker.internal
```

Instalar confianza cambia el almacén del sistema: no lo hace este proyecto.
No publicar la CA privada de mkcert. En producción usar certificado válido
del proveedor, no certificados de desarrollo. El modo HTTP base sigue siendo
para desarrollo; activarlo no corrige la alerta de sitio sin HTTPS.

Para volver al modo HTTP:

```powershell
docker compose up -d --force-recreate frontend
```

## Verificación

```powershell
npm test
docker exec jsp2-frontend nginx -t
curl.exe -I http://localhost:8081
# -k sólo para diagnóstico del certificado autofirmado, no valida confianza:
curl.exe -kI https://localhost:8443
```

Comprobar CSP también en `/css/styles.css`, `/assets/fonts/PlusJakartaSans.ttf`,
`/staff/`, errores y `/api/health`. Probar navegación, QR, transferencias,
panel del encargado y consola del navegador sin bloqueos CSP inesperados.

Repetir ZAP contra `https://host.docker.internal:8443` exclusivamente para
Joinnus. Usar un contexto nuevo de HTTPS y no mezclar el historial antiguo
de HTTP. Guardar otro informe con fecha. Un resultado sin alertas altas no
demuestra seguridad completa: autenticación y permisos quedan fuera de estos
cambios y requieren pruebas específicas. No declarar las alertas resueltas
antes de generar y revisar ese nuevo informe.

## Resultado del reescaneo HTTPS

Informe final revisado:

- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-HTTPS-FINAL2.html`
- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-HTTPS-FINAL2.json`
- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-HTTPS-FINAL2.md`

Resultado: **0 alertas de riesgo High, Medium o Low**. Sólo quedan avisos
informativos:

- `10015 Re-examine Cache-control Directives`: el prototipo usa `no-store`
  a propósito para que el navegador no guarde HTML, JS ni CSS.
- `10049 Non-Storable Content` y `Storable and Cacheable Content`: reflejan esa
  misma decisión; el favicon sí es cacheable por ser un recurso estático.
- `10109 Modern Web Application`: detección informativa de tecnología, no una
  vulnerabilidad.

El escaneo se hizo contra el HTTPS local con certificado autofirmado. ZAP no
valida la cadena del certificado por defecto, así que el resultado demuestra
que las cabeceras y la configuración TLS local están presentes, no que el
certificado sea de confianza pública. Para producción hay que repetir el
escaneo con el dominio y el certificado reales.

El escaneo sigue siendo **sin autenticación**. No cubre rutas privadas ni
permisos por usuario; la falta de autenticación fuerte (DNI en cabecera) es una
limitación de diseño que requiere una prueba específica y no se declara resuelta
con este informe.
