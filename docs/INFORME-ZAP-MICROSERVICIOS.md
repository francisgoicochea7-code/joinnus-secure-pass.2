# Informe ZAP — microservicios

**Fecha:** 13/11/2026
**Objetivo:** `https://host.docker.internal:8444`
**Tipo de escaneo:** baseline (pasivo, sin autenticación)
**Aplicación:** Joinnus Secure Pass — arquitectura de microservicios
**Informe completo:** `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-MICROSERVICIOS.html`

## Lo que hice

Repetí el escaneo contra el gateway nuevo, no contra el monolito. Usé un nombre
de informe distinto para no mezclar historiales:

```powershell
docker run --rm -v "C:\Users\LENOVO\workspace\owasp\reportes:/zap/wrk:rw" -t zaproxy/zap-stable `
  zap-baseline.py -t https://host.docker.internal:8444 `
  -r INFORME-ZAP-JOINNUS-MICROSERVICIOS.html `
  -J INFORME-ZAP-JOINNUS-MICROSERVICIOS.json `
  -w INFORME-ZAP-JOINNUS-MICROSERVICIOS.md -I
```

El gateway usa un certificado autofirmado local. ZAP no valida la cadena por
defecto, así que el escaneo comprueba la configuración TLS y las cabeceras, no
la confianza pública del certificado.

## Resultado

| Riesgo | Cantidad |
|---|---:|
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informativo | 4 tipos |

No hay alertas de riesgo alto, medio ni bajo. Quedan cuatro avisos
informativos, todos esperados por las decisiones del prototipo:

| Alerta | Instancias | Por qué queda |
|---|---:|---|
| `10015 Re-examine Cache-control Directives` | 5 | El frontend usa `no-store` a propósito para que el navegador no guarde HTML, JS ni CSS del prototipo. |
| `10049 Non-Storable Content` | 4 | Es la otra cara de la misma decisión: `no-store` en páginas y en respuestas 404 de `robots.txt`/`sitemap.xml`. |
| `10109 Modern Web Application` | 2 | Detección informativa de que la página usa enlaces/enrutado tipo SPA. No es una vulnerabilidad. |
| `Storable and Cacheable Content` | 1 | El favicon sí se cachea, que es lo deseado para un recurso estático. |

ZAP también marcó 65 reglas pasivas como `PASS`, entre ellas CSP, HSTS,
`X-Powered-By`, `X-Content-Type-Options`, divulgación de código fuente,
divulgación de PII y transiciones HTTP/HTTPS.

## Qué cubre y qué no

**Cubre:**

- Páginas estáticas servidas por el gateway.
- Cabeceras de seguridad y caché.
- Configuración TLS local.
- Respuestas 404 y recursos estáticos.

**No cubre:**

- Rutas privadas ni permisos por usuario.
- Peticiones `POST` de negocio (login, QR, transferencia, puerta). El baseline
  fue 100 % `GET` sobre 33 endpoints.
- Inyección SQL, XSS almacenado ni ataques activos. Para eso hace falta un
  escaneo full o un plan de API autenticado.
- Confianza del certificado. El certificado es autofirmado y local.

Por eso no declaro que “ZAP está resuelto” para toda la aplicación. Lo que
puedo afirmar es más concreto: **el gateway y el frontend pasaron un baseline
sin alertas High, Medium ni Low**. Las rutas internas y los flujos autenticados
quedan pendientes de una prueba específica.

## Evidencia

- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-MICROSERVICIOS.html`
- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-MICROSERVICIOS.json`
- `C:\Users\LENOVO\workspace\owasp\reportes\INFORME-ZAP-JOINNUS-MICROSERVICIOS.md`

El informe del monolito (`INFORME-ZAP-JOINNUS-HTTPS-FINAL2.*`) sigue separado y
no se tocó.

## Siguiente paso recomendado

Si el profesor pide una cobertura más completa:

1. Preparar un contexto autenticado con un usuario de demo.
2. Importar las rutas de la API (o usar el plan YAML con `OpenAPI`/`GraphQL`).
3. Ejecutar un full scan o un API scan sólo contra la pila de microservicios.
4. Revisar el nuevo informe y no dar por resueltas las alertas anteriores hasta
   tener ese resultado.
