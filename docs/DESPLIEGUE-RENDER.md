# Publicar en Render + Aiven

Guía paso a paso para dejar la versión de microservicios en internet con un
certificado válido (sin el aviso del navegador) y la base de datos en Aiven.

- **Render** ejecuta la aplicación: un solo contenedor con `auth`, `tickets`,
  `qr` y el gateway Nginx.
- **Aiven** guarda los datos: un PostgreSQL con las tres bases
  (`auth_db`, `tickets_db`, `qr_db`).

```text
Navegador
   │  https://joinnus-secure-pass.onrender.com   (HTTPS válido, lo pone Render)
   ▼
┌───────────────────────────────────────────────────────────┐
│ Contenedor en Render  (Dockerfile.render)                 │
│  Nginx :$PORT  ->  auth :3101  tickets :3102  qr :3103    │
└───────────────────────────────────────────────────────────┘
                     │  conexión cifrada (sslmode=require)
                     ▼
             Aiven PostgreSQL
        auth_db · tickets_db · qr_db
```

> Render termina el cifrado en su balanceador. El contenedor habla HTTP por
> dentro, así que **no hay certificados propios ni advertencias del navegador**.

---

## 1. Antes de empezar

1. La rama `feat/microservicios` tiene que estar subida a GitHub.
2. Cuenta en [Render](https://render.com) (se puede entrar con GitHub).
3. Cuenta en [Aiven](https://aiven.io) con el plan gratuito de PostgreSQL.

Archivos que participan (ya están en el repositorio):

| Archivo | Para qué sirve |
|---|---|
| `Dockerfile.render` | Imagen única con los 4 servicios |
| `render.yaml` | Blueprint opcional de Render |
| `render/start.sh` | Arranca la base, los servicios y Nginx |
| `render/nginx-main.conf` | Nginx sin TLS propio |
| `render/gateway.conf.template` | Rutas `/api/*` y puerto dinámico |
| `services/scripts/init-render-db.js` | Crea las 3 bases y carga el esquema |

---

## 2. Crear el PostgreSQL en Aiven

1. Entra a la consola de Aiven y pulsa **Create service**.
2. Elige **PostgreSQL**.
3. En *Plan*, elige **Free**.
4. Elige la región más cercana (por ejemplo, la de EE. UU. que te ofrezca).
5. Pulsa **Create service** y espera a que quede en estado **Running**.
6. En la página del servicio, abre **Connection information** y copia la
   **Service URI**. Se ve así:

   ```text
   postgres://avnadmin:AVNS_xxxxxxxx@pg-abc123-proyecto.a.aivencloud.com:23456/defaultdb?sslmode=require
   ```

   - El puerto **no** es 5432: usa el que aparece en tu URI.
   - El `?sslmode=require` es obligatorio y el código ya lo entiende.
   - La base `defaultdb` sólo se usa para crear las otras tres.

No hace falta crear las bases a mano: el contenedor las crea al arrancar.

> Si Aiven te muestra el servicio **powered off** (los planes gratuitos se
> apagan tras un tiempo sin uso), enciéndelo desde la consola antes de la demo.

---

## 3. Crear el servicio web en Render

1. En Render, pulsa **New +** → **Web Service**.
2. Conecta tu repositorio `joinnus-secure-pass.2`.
3. Rellena:
   - **Name**: `joinnus-secure-pass`
   - **Branch**: `feat/microservicios`
   - **Language**: `Docker`
   - **Dockerfile Path**: `./Dockerfile.render`
   - **Instance Type**: `Free`
   - **Health Check Path**: `/api/health`
4. En **Environment Variables** agrega una por una:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La *Service URI* de Aiven (pegada tal cual) |
| `DB_SSL` | `true` |
| `QR_SECRET` | Una frase secreta larga, mínimo 16 caracteres (el Blueprint la genera sola) |
| `INTERNAL_TOKEN` | Otra frase secreta larga |
| `DB_POOL_MAX` | `3` |
| `NODE_ENV` | `production` |
| `TZ` | `America/Lima` |
| `SEED_ON_START` | `true` |

5. Pulsa **Deploy Web Service** y espera el despliegue (la primera vez tarda
   unos 5 minutos porque compila la imagen).

**Importante:** `QR_SECRET` no debe cambiar entre despliegues. Si cambia, los
QR ya emitidos dejan de validar. `INTERNAL_TOKEN` tampoco debería cambiar.

### Alternativa: Blueprint

Si prefieres que Render lea `render.yaml`, usa **New +** → **Blueprint**,
elige el repositorio y pega `DATABASE_URL` y `QR_SECRET` cuando los pida.

---

## 4. Comprobar que quedó bien

1. Abre `https://TU-SERVICIO.onrender.com/api/health`. Debe responder:

   ```json
   {"ok":true,"servicio":"joinnus-secure-pass-gateway",...}
   ```

2. Abre `https://TU-SERVICIO.onrender.com/`. Debe cargar el frontend sin aviso
   de certificado.
3. Genera un QR de una entrada y valídalo en la pantalla de verificación.
4. En los **Logs** de Render deben aparecer estas líneas:

   ```text
   [render] preparando la base de datos
   [init-db] auth_db creada
   [init-db] tickets_db creada
   [init-db] qr_db creada
   [init-db] base de datos lista
   [render] auth listo
   [render] tickets listo
   [render] qr listo
   ```

---

## 5. Qué hace el contenedor al arrancar

1. Ejecuta `services/scripts/init-render-db.js`:
   - se conecta a la base de `DATABASE_URL`;
   - crea `auth_db`, `tickets_db` y `qr_db` si no existen;
   - carga el esquema y los datos de ejemplo **sólo** si la base está vacía
     (así reiniciar no duplica entradas ni historial).
2. Genera la configuración de Nginx con el puerto que asigna Render.
3. Arranca `auth` (3101), `tickets` (3102) y `qr` (3103) y espera su `/ready`.
4. Deja Nginx al frente y reinicia el contenedor si algún proceso muere.

### Diferencias con la versión local

| Tema | Local (`docker-compose.micro.yml`) | Render |
|---|---|---|
| TLS | Certificado autofirmado en `.certs` | Lo pone Render, el contenedor usa HTTP |
| Puertos | 8082 / 8444 | `$PORT` (10000 por defecto) |
| Servicios | 5 contenedores separados | 1 contenedor con 4 procesos |
| Base de datos | Contenedor PostgreSQL propio | Aiven (TLS obligatorio) |
| `/api/demo/reiniciar` | Disponible | **Bloqueado** (responde 403) |

---

## 6. Problemas típicos

| Síntoma | Causa probable | Solución |
|---|---|---|
| El deploy queda en *unhealthy* | Falta `DATABASE_URL` o `QR_SECRET` | Revisar **Logs**; `QR_SECRET` exige 16+ caracteres |
| `conexión fallida` en el log | URI mal copiada, puerto equivocado o Aiven apagado | Copiar la URI completa y encender el servicio en Aiven |
| `password authentication failed` | Contraseña con caracteres especiales sin codificar | Usar la URI tal como la entrega Aiven |
| Primera visita tarda ~1 minuto | El plan gratuito de Render se duerme a los 15 min | Entrar 2 minutos antes de la demo |
| `403 DEMO_DESHABILITADO` | Es intencional | El reinicio de demo está apagado en la versión publicada |
| Error 502 en `/api/...` | Un microservicio no arrancó | Buscar `servicio_iniciado` en los logs |

### Límites del plan gratuito

- El servicio web se duerme tras 15 minutos sin visitas.
- 512 MB de memoria: el contenedor usa unos 250 MB con los 4 procesos.
- Un solo servicio gratuito por cuenta (si ya tienes otro, usa otro plan).

---

## 7. Alternativa sin Aiven

Si prefieres no usar Aiven, `render.yaml` trae comentada la opción de que
Render cree su PostgreSQL gratuito. En ese caso:

- `DATABASE_URL` se toma de la base de Render (`fromDatabase`);
- `DB_SSL` se pone en `false`.

Ojo: la base gratuita de Render **se suspende a los 30 días**, mientras que la
de Aiven no caduca. Por eso la recomendación es Aiven.

---

## 8. Después de publicar

- **ZAP**: el escaneo se puede repetir contra la URL pública
  (`zap-baseline.py -t https://TU-SERVICIO.onrender.com`). Sirve como evidencia
  real de la versión desplegada, mejor que `host.docker.internal`.
- **Sonar**: el análisis no cambia; se sigue ejecutando en local.
- **Actualizaciones**: cada `git push` a `feat/microservicios` vuelve a
  desplegar automáticamente (`autoDeploy: true`).
