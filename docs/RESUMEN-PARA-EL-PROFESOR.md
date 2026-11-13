# Resumen para el profesor — Joinnus Secure Pass (v2)

## En cinco frases

1. El repositorio 2 es la evolución del proyecto: misma aplicación y mismo
   frontend, pero con seguridad reforzada, pruebas automatizadas, análisis
   estático con SonarQube y análisis dinámico con OWASP ZAP.
2. Además lo migré a una arquitectura de microservicios (auth, tickets, qr y un
   gateway Nginx), cada servicio con su propia base de datos y su propia capa de
   dominio, aplicación y adaptadores.
3. SonarQube primero falló el quality gate por dos motivos concretos: imágenes
   Docker ejecutándose como root y 5,29 % de duplicación en código nuevo; ambos
   corregidos, y hoy el gate está en verde.
4. ZAP encontró debilidades de cabeceras y de cifrado en la versión inicial; las
   corregí y el reescaneo quedó con 0 alertas de riesgo alto, medio o bajo.
5. La versión final está publicada con HTTPS válido en Render y la base de datos
   en Aiven, y la verifiqué en vivo: genera y valida QR, y conserva los datos.

## Qué mejoró el repositorio 2 frente al repositorio 1

| Tema | Repositorio 1 | Repositorio 2 |
|---|---|---|
| Arquitectura | monolito Node/Express | 3 microservicios + gateway Nginx |
| Base de datos | una sola base | 3 bases: `auth_db`, `tickets_db`, `qr_db` |
| Cabeceras | básicas | CSP estricta, HSTS, COEP/COOP/CORP, Permissions-Policy |
| Dependencias externas | Google Fonts | fuente oficial autoalojada (SIL OFL) |
| HTTPS | no | local opcional (TLS 1.2/1.3) y público en Render |
| Análisis estático | no | SonarQube integrado |
| Análisis dinámico | no | OWASP ZAP, un informe separado por aplicación |
| Pruebas | script propio | 44 unitarias + 58 de integración automatizadas |
| Publicación | solo local | Render + Aiven, con URL HTTPS válida |

También corregí dos fallos funcionales: el ingreso en puerta ahora solo lo puede
registrar un encargado, y la validación del QR evita la condición de carrera que
permitía usar dos veces el mismo código.

## Qué falló en SonarQube y cómo se corrigió

**Primer análisis: quality gate en rojo.**

| Problema | Detalle | Corrección |
|---|---|---|
| 4 avisos de seguridad en Dockerfiles | los contenedores corrían como root | `USER node` en los tres servicios Node y `USER nginx` en el gateway; el gateway escucha en 8080/8443 y Docker publica 8082/8444 |
| Duplicación de código nuevo 5,29 % (máximo 3 %) | los tres servicios repetían el pool de PostgreSQL y el arranque de Express | pool compartido (`services/shared/pg.js`), arranque compartido (`services/shared/server.js`) y dependencias comunes (`services/package.json`) |

**Resultado final:**

- Quality gate: **OK**
- Issues nuevos: **0** · Duplicación nueva: **2,30 %**
- Global: 8.130 líneas, **0 bugs, 0 vulnerabilidades, 0 code smells, 0 security hotspots, 0 issues abiertos**
- Duplicación global: 4,1 % · Cobertura: 0 %

La cobertura sigue en 0 % porque la suite actual es un script propio que no
genera `lcov`; es una deuda técnica conocida, no una regresión.

## Qué falló en ZAP y cómo se corrigió

**Primer escaneo (versión monolítica):**

| Hallazgo | Corrección aplicada |
|---|---|
| CSP con `style-src unsafe-inline` | CSP estricta: solo scripts del propio origen, sin inline ni `eval` |
| Sin aislamiento de origen | `Cross-Origin-Embedder-Policy`, `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy` |
| Sin HSTS | HSTS (`max-age=31536000; includeSubDomains`) en hosts públicos; se omite en `localhost` a propósito |
| Directivas de caché cuestionadas | `Cache-Control: no-store` en HTML, JS y CSS; el favicon y la fuente sí se cachean |
| Recursos de Google Fonts | fuente Plus Jakarta Sans autoalojada con su licencia |
| Sin HTTPS | modo HTTPS local con TLS 1.2/1.3 (certificado autofirmado, no se instala confianza) |

**Resultado del reescaneo (monolito y luego microservicios):**

- **0 alertas High, Medium y Low**
- Solo 4 tipos informativos: `10015` (directivas de caché), `10049` (contenido no
  almacenable), `10109` (detección de aplicación web moderna) y el favicon
  cacheable. Ninguno es una vulnerabilidad.
- 65 reglas pasivas en `PASS`, entre ellas CSP, HSTS, `X-Powered-By`,
  `X-Content-Type-Options` y transiciones HTTP/HTTPS.

**Lo que ZAP todavía no cubre (dicho con honestidad):** el escaneo es *baseline*
(pasivo, sin autenticación, solo `GET` sobre 33 endpoints). No prueba los `POST`
de negocio (login, QR, transferencia, puerta) ni inyección SQL o XSS almacenado.
Para eso hace falta un escaneo *full* o un plan de API autenticado.

## Estado actual

- Aplicación publicada: `https://joinnus-secure-pass2.onrender.com` (HTTPS válido,
  sin advertencia del navegador).
- Base de datos: PostgreSQL en Aiven, con las tres bases creadas por la propia
  aplicación al arrancar.
- Verificado en vivo: 7 entradas, 6 usuarios, login de encargado, generación de QR,
  validación del QR y bloqueo del reinicio de demo en la versión pública.
- Pruebas locales: `npm test` 44/44 y `npm run test:micro` 58/58.

## Limitaciones que declaro

1. Cobertura de pruebas en 0 % en SonarQube (la suite no genera `lcov`).
2. ZAP no cubre rutas autenticadas ni `POST` de negocio.
3. El plan gratuito de Render duerme el servicio a los 15 minutos de inactividad.
4. La contraseña de la base quedó expuesta durante la demo; debe rotarse.
