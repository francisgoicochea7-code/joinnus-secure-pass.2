# Traspaso a Codex — Joinnus Secure Pass v2

> Archivo de contexto para continuar el trabajo en una terminal con Codex.
> No contiene contraseñas, tokens ni valores de `.env`.
> **No hacer commit ni push sin aprobación explícita del usuario.**

## 1. Ubicación y rama

- Proyecto: `C:\Users\LENOVO\joinnus-secure-pass.2`
- Rama: `feat/microservicios`
- Último commit: `2e99b9d Agregar resumen del proyecto para la exposicion`
- App local: `https://localhost:8444`
- Salud: `https://localhost:8444/api/health` → 200
- HTTP local: `http://localhost:8082` redirige a HTTPS.
- Base local PostgreSQL: `127.0.0.1:5434`

## 2. Arquitectura actual (v2)

La app que se está trabajando es la de **microservicios**:

- `services/gateway` — Nginx público, TLS, cabeceras, límites y rutas `/api/*`.
- `services/auth` — usuarios y encargados.
- `services/tickets` — entradas, transferencias, historial y validación de puerta.
- `services/qr` — tokens QR dinámicos y validación HMAC.
- `services/shared` — utilidades comunes.
- `database/micro/` — `auth.sql`, `tickets.sql`, `qr.sql`.
- `docker-compose.micro.yml` — stack local completo.
- `Dockerfile.render`, `render/` y `render.yaml` — despliegue en Render.
- `frontend/` — frontend compartido por la app local y Render.

La versión monolítica (`backend/`, `api/`, `database/init.sql`, `docker-compose.yml`, `docker-compose.https.yml`, `Dockerfile` raíz, `vercel.json`) sigue existiendo como respaldo. **No borrarla sin autorización**: `npm test` y CI todavía dependen de parte de ella.

## 3. Estado de la app

- `npm test`: **64/64** tests unitarios y **0 fallos** en las comprobaciones funcionales
  (756 del autotest QR + 887 de `test/verificacion.js`). Última ejecución: correcta.
- `npm run test:micro`: **68/68** contra el stack Docker reconstruido (login con
  contraseña, tokens, permisos de QR/transferencia y rechazo de `X-Usuario-DNI`).
- App móvil (`mobile/`): `npm run typecheck` sin errores y `npm run export:android` genera el bundle.
- `/api/health`: **200**.
- Auditoría responsive por CDP (320/360/390/1440 px, 7 páginas): **sin desbordes horizontales**.
  Los únicos errores de consola son `ERR_CONNECTION_REFUSED` al sondear
  `localhost:3000` / `127.0.0.1:3000` cuando se abre con `node server.js`; es el
  comportamiento esperado (cae a modo local).
- Contenedores actuales `jsp2ms-*`: sanos.
- Gateway local reconstruido después de los últimos cambios de frontend.
- ZAP Desktop y SonarQube local estuvieron levantados; ZAP Docker `jsp-zap` sigue disponible en `http://localhost:8090`.

## 4. Cambios visuales ya hechos (sin commit)

Archivos modificados:

- `frontend/index.html`
- `frontend/dashboard.html`
- `frontend/entrada.html`
- `frontend/historial.html`
- `frontend/sobre.html`
- `frontend/transferencia.html`
- `frontend/verificar.html`
- `frontend/js/dashboard.js`
- `frontend/js/entrada.js`
- `frontend/js/historial.js`
- `frontend/js/transferencia.js`
- `.gitignore`
- `README.md` (solo se quitó la referencia a `debug-tmp.js`)

Archivos nuevos:

- `frontend/css/home.css`
- `frontend/css/theme.css`
- `frontend/assets/music-fest.svg`
- `frontend/assets/poster-festival.svg`
- `frontend/assets/poster-liga.svg`
- `frontend/assets/poster-lima.svg`
- `test/unit/home.test.js`
- `test/unit/theme.test.js`

Última mejora visual:

- Pase de portada con perspectiva 3D y reflejo.
- En escritorio, el pase reacciona al hover.
- En móvil queda plano y los botones tienen mejor área táctil.
- Se agregó `manifest.json` y los iconos `assets/pass-192.png` y `assets/pass-512.png`.
- La portada incluye una guía desplegable para añadir la web a la pantalla de inicio del celular (Android/iPhone).
- Probado en Chrome simulando 375 px: sin desbordamiento horizontal.

### 4b. Correcciones de esta sesión (sin commit)

- `frontend/entrada.html` + `frontend/js/entrada.js`: la tarjeta
  `#ticket-bloqueado` (“Identifícate para abrir tu pase”) existía en el HTML pero
  ninguna lógica la mostraba u ocultaba, así que podía quedar visible junto al
  pase real. Ahora arranca oculta, se muestra solo cuando falta identificación
  (`pintarIdentificacionRequerida`) y se oculta al cargar la entrada o cuando la
  persona no tiene compras.
- `frontend/js/cliente-api.js`: `comprobar()` daba la API por conectada con
  cualquier respuesta HTTP 200. Con `node server.js` (servidor estático que
  devuelve `index.html` para `/api/*`), el cliente creía estar en modo API pero
  todas las consultas devolvían vacío: el dashboard mostraba estadísticas y a la
  vez “Ninguna entrada para este filtro”. Ahora solo acepta una respuesta JSON;
  si no, cae a modo local. Probado: dashboard y entrada vuelven a mostrar datos.

### 4c. App móvil nativa (`mobile/`)

- Expo + React Native + TypeScript, **sin WebView**.
- Pantallas: Inicio, Entradas, detalle con QR (ampliable), Verificar, Transferir,
  Historial, Perfil y Modo puerta.
- Sesión con `expo-secure-store`, tema claro/oscuro, toasts, loaders y estados vacíos.
- `mobile/scripts/dev-api-proxy.mjs` para probar en teléfono físico contra la API local.
- `mobile/eas.json` listo para compilar el APK (requiere cuenta EAS autenticada).
- Pendiente de pulir: `VerifyScreen` y `TransferScreen`.

## 5. Seguridad: hallazgos y decisiones

### ZAP

El informe HTML está en:

`C:\Users\LENOVO\2026-11-18-ZAP-Report-.html`

El escaneo incluyó dos sitios:

- `http://localhost:8080` → interfaz propia de ZAP.
- `https://localhost:8444` → app real.

Conclusiones:

- **PII (Alto)**: falso positivo de ZAP sobre su propia UI (`/UI/oast/...`).
- **CSP (Medio)**: falso positivo de ZAP sobre `localhost:8080`; la app sí tiene CSP.
- **HSTS (Bajo)**: aparece en `8444` porque en localhost se omite a propósito. En producción el gateway sí envía HSTS.
- **Aplicación Web Moderna**: informativo.
- **Cache-Control**: informativo; la página afectada ya usa `no-store`.
- **User Agent Fuzzer**: falso positivo; `/api/health` cambia por la hora en cada petición.

### Hallazgo real detectado manualmente

`GET /api/entradas` devuelve **DNI y correo completos de todos los titulares**
a quien no inicia sesión. En el demo son datos ficticios, pero es una
exposición de datos personales. ZAP no lo marcó porque su alerta PII era de su
propia UI.

Mitigado en parte con el login real: la cabecera `X-Usuario-DNI` ya **no**
autentica y, sin token, sólo se ven los datos de la cuenta de demostración.
Sigue pendiente:

- No devolver DNI/correo completos de terceros en las listas públicas.
- Guardar el token en una cookie `httpOnly`, `Secure` y `SameSite`.
- Limitar `/api/historial?dni=` al DNI de la sesión.
- Validar la sesión también en las lecturas públicas o moverlas a otro endpoint.

## 6. Login con contraseña: implementado

Cada cuenta tiene contraseña guardada en la base como hash **scrypt** con sal
aleatoria (`scrypt$N$r$p$sal$hash`). El login devuelve un **token HMAC-SHA256**
de 8 horas que viaja en `Authorization: Bearer ...`.

Implementado:

1. `password_hash` en `database/micro/auth.sql` y `database/init.sql`, con
   semillas para las seis cuentas de demostración.
2. `services/shared/password.js` (scrypt) y `services/shared/session.js`
   (firma/verificación de tokens) + copia autocontenida `backend/auth.js`.
3. `POST /api/usuarios/login` en auth-service y en el monolito.
4. Registro con contraseña obligatoria (mínimo 8 caracteres) en ambos stacks.
5. La cabecera `X-Usuario-DNI` ya no se acepta: `dniDePeticion` sólo usa el
   token; sin token se atiende como la cuenta de demostración.
6. Modal y panel del dashboard con DNI + contraseña; registro con contraseña
   y confirmación. La app móvil (Expo) también inicia sesión con contraseña y
   guarda el token en SecureStore.
7. Migración idempotente al arrancar auth-service: añade `password_hash` a
   bases existentes y da contraseña a las cuentas demo que no tengan.
8. `SESSION_SECRET` (mínimo 32 caracteres). Si falta, se deriva de
   `INTERNAL_TOKEN` (micro) o `QR_SECRET` (monolito). En Render se genera solo.
   En microservicios la firma debe ser **la misma** en auth, tickets y qr; el
   compose y el arranque de Render ya la comparten.
9. Documentación y contraseñas ficticias en el README.
10. Pruebas: `test/unit/password.test.js`, `test/unit/session.test.js`, grupo
    `5f` de `test/verificacion.js` y `test:micro` con login/tokens.

Decisiones tomadas:

- Login con **DNI + contraseña** (no correo).
- Contraseñas demo individuales (`Carlos2026!`, `Andrea2026!`, ...).
- Login de encargados separado (`/api/encargados/login`).
- El token se guarda en `localStorage` por ahora (pendiente cookie `httpOnly`).

Pendiente de producto:

- Recuperación/cambio de contraseña.
- Verificación de correo y activación de cuentas creadas por transferencia
  (hoy reciben una contraseña aleatoria que nadie conoce).
- Cookie `httpOnly`/`Secure` y rotación de `SESSION_SECRET`.
- Ruta de logout que invalide el token en el servidor (hoy el token caduca solo).

## 7. Limpieza ya realizada

Eliminados:

- Copias duplicadas en la raíz de `INFORME-ERRORES-SONAR-JOINNUS*.docx/.pdf` (se conservan en `docs/`).
- `language-stats.html`.
- `test/debug-tmp.js`.
- Contenedor viejo `owasp-zap-1`.
- Imagen `joinnus-render-test`.
- Imagen `sonarqube:lts-community`.

No tocar:

- `jsp2ms-*` (app actual).
- `jsp2ms_postgres_data` (base de datos).
- `jsp-zap`, `jsp-sonarqube`, `jsp-sonar-db`.
- Versión monolítica y sus imágenes/contenedores de respaldo.
- `.env`, `.env.micro`, `.certs/`, `.sonar-token`.

## 8. Comandos útiles

```powershell
# Pruebas
npm test
npm run test:micro

# Levantar/actualizar el stack local
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d --build

# Reconstruir solo el gateway tras cambios de frontend
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d --no-deps --build gateway

# Salud
curl.exe -k -sS https://localhost:8444/api/health

# Ver cambios
git status --short
git diff
```

Nunca ejecutar:

```powershell
docker compose down -v
docker system prune --volumes
```

porque se perdería la base de datos local.

## 9. Reglas para continuar

- No hacer commit ni push sin aprobación explícita.
- No debilitar la seguridad para que pase un escaneo.
- No guardar contraseñas, tokens ni credenciales en el repositorio.
- Mantener `npm test` en verde.
- Probar primero en localhost; no escanear Render/Aiven con ZAP activo sin autorización.
- Mantener los cambios visuales consistentes con el diseño editorial actual.
- No borrar la versión monolítica sin actualizar tests, CI y README.

## 10. Siguiente paso sugerido

1. Corregir la exposición de DNI/correo en `/api/entradas` y `/api/historial`.
2. Migrar el token de `localStorage` a cookie `httpOnly` y añadir logout real.
3. Con aprobación: commit, push y verificación en Render.

## 11. App movil Expo (nueva)

Se creo una app nativa independiente en mobile/ con Expo SDK 58, React Native
y TypeScript. **No usa WebView** y consume la misma API del backend.

Incluye:

- Inicio, Mis entradas, detalle del pase con QR dinamico, Verificar, Transferir,
  Historial, Perfil y Modo puerta.
- Tema claro/oscuro persistente, tipografia Plus Jakarta Sans, navegacion
  inferior, toasts, loaders, estados vacios y manejo de errores.
- Sesion con expo-secure-store en Android/iOS (fallback de desarrollo en web).
- Lector de QR con expo-camera.
- Proxy local mobile/scripts/dev-api-proxy.mjs para que un telefono en la
  misma red use el gateway HTTPS autofirmado de https://localhost:8444.
- Configuracion EAS (mobile/eas.json) con perfil preview para generar APK.

Validaciones realizadas:

- mobile/npm run typecheck: correcto.
- mobile/npx expo-doctor: 20/20.
- mobile/npm run export:android: bundle Android generado.
- Flujo web emulado: inicio, login demo, detalle con QR y verificacion.
- Proxy local contra /api/health y /api/resumen: 200.
- `npm test` raiz: sigue en verde.

Pendiente:

- Generar el APK: hace falta una cuenta Expo/EAS o Android Studio + Android SDK;
  no estan disponibles en este entorno.
- Probar en un telefono Android fisico con Expo Go.
- La app movil ya inicia sesion con DNI + contrasena y guarda el token en
  SecureStore (web: AsyncStorage).
- Corregir la exposicion de datos de /api/entradas en el backend.

Documentacion detallada: mobile/README.md.
No se creo ningun commit ni push.

## 12. Verificacion de esta sesion (18 nov 2026)

- `npm test` (raiz): 756 comprobaciones del autotest QR + 887 funcionales + 64 tests
  unitarios, **0 fallos**.
- Login con contrasena implementado en microservicios y monolito: scrypt en la
  base, token HMAC, `POST /api/usuarios/login`, modal y dashboard actualizados.
- `X-Usuario-DNI` ya no autentica; sin token solo se ve la cuenta demo.
- `mobile > npm run typecheck`: sin errores.
- `mobile > npm run export:android`: bundle Android generado (3498 modulos).
- Integridad del frontend: sin CSS/JS/imagenes/fuentes rotas, sin IDs duplicados,
  sin anclas rotas y sin referencias de JS a elementos eliminados en el rediseno.
- Auditoria por CDP en 320/360/390/1440 px sobre index, dashboard, entrada,
  verificar, transferencia, historial y sobre: **sin desbordes horizontales**.
- Capturas de referencia en `%TEMP%\opencode\shots\` (no forman parte del repo).
- La web publica de Render sigue mostrando la version anterior: los cambios estan
  solo en local hasta que se apruebe commit y push.

## 13. Pendientes claros

Web:

- Revisar en un navegador real las paginas internas tras el rediseno (jerarquia,
  espaciado y menu movil); la revision automatica no sustituye la visual.
- Confirmar el modal de identificacion con teclado (foco, Tab, Escape) y el
  desplazamiento al resultado en Verificar.

Seguridad y datos:

- `/api/entradas` sigue devolviendo DNI y correo de todos los titulares (datos ficticios).
- `/api/historial?dni=` todavía permite consultar el historial de otro DNI sin token.
- El token se guarda en `localStorage` (pendiente cookie `httpOnly`) y no hay logout
  que lo invalide en el servidor.
- Escaneo de puerta depende de `BarcodeDetector`: en iOS/Safari solo hay ingreso manual.

Movil:

- Pulir `VerifyScreen` y `TransferScreen`.
- Generar el APK con EAS (requiere cuenta) y probar en un telefono Android fisico.

