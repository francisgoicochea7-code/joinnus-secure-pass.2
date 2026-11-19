# Microservicios de Joinnus Secure Pass

Esta es la guía de la versión de microservicios. La versión monolítica
(`docker-compose.yml`, puertos 8081/3001/5433) sigue funcionando en paralelo:
no la toqué.

La idea de esta variante es la misma aplicación, el mismo frontend y los mismos
contratos de API, pero separada en cuatro piezas que se llaman por HTTP dentro
de una red privada. El navegador sólo habla con el gateway.

Para publicarla en internet con HTTPS válido y la base de datos en Aiven, ver
[DESPLIEGUE-RENDER.md](DESPLIEGUE-RENDER.md).

---

## 1. Arquitectura

```text
Navegador
   │  https://localhost:8444   (HTTP 8082 redirige a 8444)
   ▼
┌──────────────────────────────────────────────────────────────┐
│ gateway (Nginx, usuario nginx)                               │
│  /api/encargados/login, /api/usuarios...   -> auth:3101      │
│  /api/resumen, /api/entradas..., historial, puerta, reset    │
│                                             -> tickets:3102  │
│  /api/entradas/:codigo/qr, /api/qr/validar  -> qr:3103       │
└──────────────────────────────────────────────────────────────┘
          │                    │                     │
          ▼                    ▼                     ▼
     auth-service        tickets-service        qr-service
      auth_db              tickets_db             qr_db
          ▲                    │                     ▲
          └──── llamadas internas /internal/v1/* ────┘
                (X-Internal-Token compartido)
```

- Sólo el gateway publica puertos. `auth`, `tickets` y `qr` viven en la red
  interna `jsp2ms_net` y no son accesibles desde el host.
- PostgreSQL publica `127.0.0.1:5434` únicamente para inspección manual con
  `psql`; no está expuesto a la red.
- Las llamadas internas llevan `X-Internal-Token`. Sin ese token, los servicios
  responden `401`.

### Servicios

| Servicio | Contenedor | Puerto interno | Base de datos | Responsabilidad |
|---|---|---|---|---|
| gateway | `jsp2ms-gateway` | 8080 / 8443 | — | Sirve el frontend, aplica TLS/cabeceras/límites y enruta `/api/*` |
| auth | `jsp2ms-auth` | 3101 | `auth_db` | Usuarios y encargados de puerta |
| tickets | `jsp2ms-tickets` | 3102 | `tickets_db` | Eventos, entradas, transferencias, historial, validación de puerta y saga de transferencia |
| qr | `jsp2ms-qr` | 3103 | `qr_db` | Tokens QR dinámicos, firma HMAC, rotación e invalidación |
| postgres | `jsp2ms-postgres` | 5432 (host 5434) | 3 bases | Una instancia, tres bases separadas |

### Reparto de datos

- `auth_db`: `usuarios`, `encargados`.
- `tickets_db`: `eventos`, `entradas`, `transferencias`, `historial`.
- `qr_db`: `tokens_qr`.

`tickets_db` conserva columnas `qr_*` como proyección para que el frontend
reciba el token vigente sin una llamada extra. La fuente de verdad de los
tokens es `qr_db.tokens_qr`.

Las claves foráneas que cruzaban bases (`entradas.titular_id` y
`tokens_qr.entrada_id`) se quitaron a propósito; la integridad se mantiene en
los casos de uso.

---

## 2. Requisitos

- Docker Desktop con Docker Compose v2.
- Certificados locales en `.certs/`:
  - `.certs/localhost.pem`
  - `.certs/localhost-key.pem`
- Archivo `.env.micro` con secretos. **No se sube a git.**
- Node.js sólo hace falta para ejecutar las pruebas (`npm test` y
  `npm run test:micro`). La aplicación corre dentro de Docker.

### Si no tienes certificados

El proyecto ya trae el script que usé para el monolito:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/certificado-local.ps1
```

Genera un certificado autofirmado de 30 días. El navegador mostrará una
advertencia de confianza: es normal en desarrollo. No instala ninguna CA en el
sistema. Si el certificado caducó, vuelve a ejecutar el script y reinicia el
gateway.

---

## 3. Puesta en marcha paso a paso

### 3.1 Crear el archivo de secretos

```powershell
copy .env.micro.example .env.micro
```

Abre `.env.micro` y cambia todos los valores. Puedes generar secretos fuertes
con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Variables importantes:

| Variable | Para qué sirve |
|---|---|
| `POSTGRES_ADMIN_PASSWORD` | Administrador de PostgreSQL (sólo inicialización) |
| `AUTH_DB_PASSWORD` | Usuario `auth_user` |
| `TICKETS_DB_PASSWORD` | Usuario `tickets_user` |
| `QR_DB_PASSWORD` | Usuario `qr_user` |
| `INTERNAL_TOKEN` | Token de las rutas `/internal/v1/*` (mínimo 16 caracteres) |
| `QR_SECRET` | Firma HMAC de los tokens QR (mínimo 16 caracteres) |
| `QR_TTL_SECONDS` | Vigencia del QR (por defecto 15) |
| `DEMO_DNI` | DNI de la sesión de demostración (por defecto `45678945`) |

`.env.micro` ya está en `.gitignore`. No lo commitees.

### 3.2 Construir y arrancar

```powershell
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d --build
```

La primera vez descarga las imágenes e instala dependencias. Espera a que los
cinco contenedores queden `healthy`:

```powershell
docker compose --env-file .env.micro -f docker-compose.micro.yml ps
```

Deberías ver:

- `jsp2ms-postgres` healthy
- `jsp2ms-auth` healthy
- `jsp2ms-tickets` healthy
- `jsp2ms-qr` healthy
- `jsp2ms-gateway` healthy

### 3.3 Abrir la aplicación

- HTTPS: <https://localhost:8444>
- HTTP: <http://localhost:8082> (redirige a HTTPS)
- Salud: <https://localhost:8444/api/health>

Con certificado autofirmado, el navegador pedirá aceptar la excepción una vez.

### 3.4 Comprobar la salud por consola

```powershell
curl.exe -k https://localhost:8444/api/health
```

Respuesta esperada:

```json
{"ok":true,"servicio":"joinnus-secure-pass-gateway","version":"2.0.0-micro","baseDatos":"distribuida","hora":"..."}
```

### 3.5 Ejecutar la prueba de humo

Con la pila levantada:

```powershell
npm run test:micro
```

La prueba recorre salud, reset, QR propio/ajeno, validación pública, login de
encargado, validación en puerta, anulación/reactivación, alta de usuario,
transferencia con rotación de QR e invalidación del token anterior. Al final
deja la demo limpia. Debe terminar con **58 comprobaciones, 0 fallos**.

El gateway limita las escrituras a 30/min. La prueba reintenta cuando recibe
`429`; eso es normal y no es un fallo funcional.

### 3.6 Detener

```powershell
# Conserva los datos
docker compose --env-file .env.micro -f docker-compose.micro.yml down

# Borra el volumen de la demo y vuelve a sembrar en el próximo arranque
docker compose --env-file .env.micro -f docker-compose.micro.yml down -v
```

---

## 4. Flujos de demostración

### Login de encargado

- Ana Torres — `ANA2026`
- Luis Paredes — `LUIS2026`

### Generar y validar un QR

1. Entra como Carlos Pérez (DNI `45678945`).
2. Abre `ENTRY001` (Lima Music Fest).
3. El QR rota cada 15 segundos. El token se firma en `qr-service` y la
   proyección se guarda en `tickets_db`.
4. En el panel de encargado, pega el token o el código `ENTRY001` y valida.

La semilla no inventa tokens QR: la primera vez que abres una entrada se genera
uno real. Así nunca se muestra un token que no exista en `qr_db`.

### Transferencia

1. Entra como María Torres (DNI `43871264`).
2. Abre `ENTRY005` (Liga 1 - Final).
3. Transfiere a Pedro Castillo, DNI `41234567`, correo
   `pedro.castillo@demo.pe`, precio `50`.
4. El QR anterior queda invalidado. El destinatario puede abrir su pase al
   iniciar sesión.
5. Si intentas validar el token anterior, `qr-service` responde `invalidado`.

La transferencia es una saga orquestada por `tickets-service`:

1. `auth-service` conserva la cuenta del destinatario si existe o crea una
   cuenta pendiente de activación.
2. `tickets-service` actualiza la entrada, registra la transferencia y el
   historial en una transacción local.
3. `qr-service` rota el token (best-effort).
4. Si la rotación falla, la entrada queda transferida y el QR puede generarse
   después; no se pierde la transferencia.

### Reiniciar la demo

Desde la interfaz o con:

```powershell
curl.exe -k -X POST https://localhost:8444/api/demo/reiniciar -H "Content-Type: application/json" -d "{}"
```

`tickets-service` orquesta el reset: primero `auth`, después `qr` y al final
`tickets`. Deja 7 entradas, 6 usuarios y 0 tokens.

---

## 5. Seguridad aplicada

- **Superficie mínima:** sólo el gateway publica puertos. Los servicios no se
  pueden alcanzar desde el host.
- **Token interno:** las rutas `/internal/v1/*` exigen `X-Internal-Token`.
- **Secretos:** `INTERNAL_TOKEN` y `QR_SECRET` se leen del entorno; no hay
  credenciales en el código ni en git.
- **Usuarios no root:** los tres servicios Node corren como `node`; el gateway
  Nginx corre como `nginx` y escucha en 8080/8443 (puertos no privilegiados).
- **Base de datos:** un usuario por servicio, con permisos sólo sobre su base.
- **TLS:** TLS 1.2/1.3, redirección 308 de HTTP a HTTPS.
- **Cabeceras:** CSP estricta, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, COOP/COEP/CORP y cache-control.
- **HSTS:** se omite en `localhost` y `127.0.0.1` a propósito; en un host
  público se envía `max-age=31536000; includeSubDomains`.
- **CORS:** sólo orígenes locales o de exposición controlada.
- **Límites:** general 120/min, login 20/min, QR 60/min, escrituras 30/min.
  Al superarlos, el gateway devuelve `429` con un JSON claro.

---

### Activar una cuenta existente

El destinatario de una primera transferencia puede elegir su contraseña en
**Activar cuenta con un código**. Esa opción también sirve para perfiles
anteriores a la incorporación del inicio de sesión.

El administrador comprueba la identidad del titular y emite un código desde la
carpeta del proyecto. Sustituye el DNI del ejemplo por el del titular.

```powershell
docker compose --env-file .env.micro -f docker-compose.micro.yml exec auth node src/emitir-activacion.js 12345678
```

Entrega el código por privado. Vence a los 20 minutos y se consume al guardar la
nueva contraseña. Emitir otro código invalida el anterior. Después el titular
inicia sesión con su DNI y la contraseña que eligió.

Para el monolito, el comando equivalente es
`docker compose exec backend node emitir-activacion.js 12345678`.

## 6. Pruebas y calidad

```powershell
# Suite original del proyecto (monolito + frontend + unitarias)
npm test

# Prueba de humo de la pila de microservicios (requiere Docker arriba)
npm run test:micro
```

Resultados de esta entrega:

- `npm test`: 756 + 870 comprobaciones y 44 pruebas unitarias, **0 fallos**.
- `npm run test:micro`: **58 comprobaciones, 0 fallos**.
- SonarQube (`Joinnus Secure Pass`, key `joinnus-secure-pass`): quality gate
  **OK**, **0 issues nuevos**, **2,30 %** de duplicación en código nuevo.
  Panorama global: 8.130 ncloc, 0 bugs, 0 vulnerabilidades, 0 code smells,
  0 hotspots abiertos; 4,1 % de duplicación global (HTML del frontend que ya
  existía). Cobertura 0 % porque la suite no está instrumentada; no es una
  regresión de esta variante.
- ZAP: baseline contra `https://host.docker.internal:8444` sin autenticación,
  **0 alertas High / Medium / Low** y 4 avisos informativos. Informe separado
  en `docs/INFORME-ZAP-MICROSERVICIOS.md`.

---

## 7. Estructura de archivos

```text
services/
  shared/                 logger, errores, request-id, HTTP interno, tokens,
                          validaciones, health, pool PostgreSQL y arranque
  auth/                   usuarios y encargados
  tickets/                entradas, transferencias, historial y puerta
  qr/                     tokens QR, firma y rotación
  gateway/                Nginx, TLS, cabeceras y enrutamiento
  package.json            dependencias compartidas de los tres servicios Node

database/micro/
  00-init.sh              crea roles y las tres bases, y ejecuta las semillas
  auth.sql                esquema y datos de auth_db
  tickets.sql             esquema y datos de tickets_db
  qr.sql                  esquema de qr_db

docker-compose.micro.yml  pila completa (gateway, auth, tickets, qr, postgres)
.env.micro.example        plantilla de secretos
test/integration/         prueba de humo de la pila
```

---

## 8. Problemas frecuentes

### `permission denied for table entradas`

El volumen se inicializó con el usuario administrador en una versión anterior
del script. La versión actual ejecuta cada semilla con el dueño de su base.
Solución: borrar el volumen de la demo y volver a arrancar.

```powershell
docker compose --env-file .env.micro -f docker-compose.micro.yml down -v
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d
```

Esto borra sólo los datos de demostración de la pila de microservicios.

### `429 Too Many Requests`

Es el límite del gateway. Espera unos segundos y reintenta. La prueba de humo
lo hace automáticamente. Si estás haciendo una demostración con muchas
escrituras seguidas, puedes subir `api_write` en
`services/gateway/nginx.conf` y reconstruir el gateway.

### `ERR_CERT_AUTHORITY_INVALID`

El certificado es autofirmado. Acepta la excepción en el navegador o genera un
certificado de confianza local con mkcert, con aprobación del dueño del equipo.
No publiques la CA privada.

### El gateway no arranca

```powershell
docker logs jsp2ms-gateway
```

Comprueba que `.certs/localhost.pem` y `.certs/localhost-key.pem` existan y que
el usuario `nginx` pueda leerlos. Si cambiaste los puertos, revisa también la
redirección de `services/gateway/nginx.conf` (hoy apunta a `8444`).

### `Cannot find module 'express'`

Las dependencias compartidas se instalan en `/app/services/node_modules` desde
`services/package.json`. Si modificaste los Dockerfiles, reconstruye:

```powershell
docker compose --env-file .env.micro -f docker-compose.micro.yml build auth tickets qr gateway
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d
```

### Puerto 8082 u 8444 ocupado

El laboratorio ZAP usaba 8082 para su interfaz. Si lo tienes levantado, cambia
`MICRO_HTTP_PORT`/`MICRO_HTTPS_PORT` en `.env.micro` o detén el otro servicio.
Si cambias el puerto HTTPS, actualiza también la redirección del gateway y el
objetivo de ZAP.

---

## 9. Limitaciones y pendientes

- **Sin broker:** la comunicación es HTTP síncrona con reintentos e
  idempotencia. Si el profesor exige RabbitMQ o Kafka, queda como extensión.
- **ZAP sin autenticación:** el baseline no cubre rutas privadas ni permisos
  por usuario. Para una cobertura completa hace falta un escaneo autenticado o
  un plan de API con contexto.
- **Certificado autofirmado:** sirve para demostrar cifrado, no confianza
  pública. En producción se usa un certificado real.
- **Cobertura 0 %:** la suite no está instrumentada. El quality gate se apoya
  en el código nuevo, no en cobertura.
- **Token de Sonar expuesto:** si el token `Analyze "nuevo joinnus" 1` sigue
  activo, revócalo desde la interfaz de SonarQube. No lo pegues en documentos.
- **Sin commit ni push:** los cambios están en la rama `feat/microservicios`
  sin commit. Cualquier commit o push requiere tu aprobación.

---

## 10. Comandos útiles

```powershell
# Ver logs de un servicio
docker logs -f jsp2ms-tickets

# Entrar a PostgreSQL y revisar las bases
docker exec -it jsp2ms-postgres psql -U postgres_admin -d postgres

# Ver el estado de la pila
docker compose --env-file .env.micro -f docker-compose.micro.yml ps

# Reconstruir sólo el gateway
docker compose --env-file .env.micro -f docker-compose.micro.yml build gateway
docker compose --env-file .env.micro -f docker-compose.micro.yml up -d gateway

# Volver al monolito (sigue intacto)
docker compose up -d
```
