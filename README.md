# Joinnus Secure Pass

> **“Verifica, transfiere y protege tus entradas digitales.”**
> Prototipo académico universitario de seguridad para entradas digitales.

Sistema completo para reducir la reventa informal de entradas: **verificación en
tiempo real**, **códigos QR dinámicos** (rotan cada 15 segundos) y
**transferencia segura con trazabilidad total**.

Todo está dockerizado: una base de datos MySQL, una API REST en Node.js y el
frontend servido por nginx, orquestados con Docker Compose.

⚠️ **Todos los datos son ficticios.** Nombres, DNI, correos, eventos y precios
son de demostración. No hay ningún dato real ni conexión con servidores de
Joinnus.

---

## 1. Inicio rápido

```bash
# 1) Entrar en la carpeta del proyecto
cd joinnus-secure-pass

# 2) Crear el archivo de entorno (OBLIGATORIO: guarda el QR_SECRET)
copy .env.example .env        # Windows
cp .env.example .env          # Linux / macOS
#    Edita .env y pon tu propia clave de firma QR (mínimo 16 caracteres).
#    Si no existe, docker compose no arranca a propósito:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3) Levantar los tres contenedores
docker compose up --build     # Docker actual (Compose v2)

# 4) Abrir en el navegador
#    http://localhost:8080
```

> Si tu equipo tiene la versión antigua de Compose, los comandos son idénticos
> pero con guion: `docker-compose up --build` y `docker-compose down`.
> Todo lo demás es igual.

La primera vez tarda unos minutos (descarga de imágenes y `npm install` dentro
del contenedor del backend). Cuando los logs muestren
`Joinnus Secure Pass — API`, el sistema está listo.

**Requisitos:** Docker Desktop instalado (incluye Docker y `docker compose`).
No hace falta tener Node.js ni MySQL instalados en el equipo.

### Detener el proyecto

```bash
# Detener los contenedores (conserva los datos)
docker compose down

# Detener y además BORRAR la base de datos (vuelve a los datos ficticios)
docker compose down -v
```

### Comprobar que todo está arriba

```bash
docker compose ps            # los 3 servicios deben estar "running/healthy"
curl http://localhost:3000/api/health
```

---

## 2. Los tres contenedores

| Contenedor | Servicio | Imagen / Build | Puerto externo | Función |
|---|---|---|---|---|
| **frontend** | nginx | `Dockerfile` (raíz) → `nginx:1.27-alpine` | `8080:80` | Sirve las 7 páginas del prototipo y hace de **proxy inverso** de la API (`/api` → `backend:3000`). |
| **backend** | Node.js + Express | `backend/Dockerfile` → `node:20-alpine` | `3000:3000` | API REST: consulta, verificación, QR dinámico, transferencia, historial y validación de tokens. Firma los tokens con HMAC-SHA256. |
| **mysql** | MySQL 8.0 | `mysql:8.0` | `3307:3306` | Almacena usuarios, eventos, entradas, transferencias, historial y tokens QR. Se siembra con `database/init.sql`. |

Los tres se conectan en la red Docker **`jsp_net`** (bridge) y arrancan en orden:
```
frontend  ──(depends_on: healthy)──►  backend  ──(depends_on: healthy)──►  mysql
   │                                      │
   │  http://localhost:8080/api/...       │  DB_HOST=mysql:3306
   └──── proxy inverso (nginx) ──────────►└────────── mysql2 pool ─────────►
```

### Cómo se comunican

1. El navegador pide una página a **nginx** (`http://localhost:8080`).
2. Cuando una función necesita datos, `frontend/js/cliente-api.js` hace
   `fetch('/api/...')`. Al ser **mismo origen**, nginx reenvía la petición a
   `http://backend:3000/api/...`. No hay problemas de CORS.
3. El **backend** se conecta a MySQL por el nombre de servicio `mysql`
   (resuelto por Docker DNS) usando las variables `DB_HOST`, `DB_PORT`,
   `DB_NAME`, `DB_USER` y `DB_PASSWORD`.
4. `database/init.sql` se monta en `/docker-entrypoint-initdb.d/` y MySQL lo
   ejecuta **solo en el primer arranque** (cuando el volumen está vacío).

> **El puerto de MySQL en el host es 3307** (y no 3306) para no chocar con un
> MySQL local. El contenedor siempre usa 3306.

### Puertos

| Puerto (host) | Contenedor | Servicio | ¿Necesario para la demo? |
|---|---|---|---|
| **8080** | 80 | nginx / frontend | **Sí** — es la dirección que se abre |
| 3000 | 3000 | API Express | Opcional (para probar endpoints) — **sólo en `127.0.0.1`** |
| 3307 | 3306 | MySQL | No (sólo inspección SQL) — **sólo en `127.0.0.1`** |

Todos son configurables en `.env`: `FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`.

> Los puertos 3000 y 3307 quedan escuchando únicamente en `127.0.0.1`
> (la máquina local). Así, cuando el proyecto se publica en internet, de la
> máquina sólo se expone el 80 de nginx: ni la API ni MySQL son alcanzables
> desde fuera (ver sección 13).

---

## 3. Estructura del proyecto

```
joinnus-secure-pass/
│
├── frontend/                     CONTENEDOR 1  (nginx)
│   ├── index.html                Inicio
│   ├── dashboard.html            Panel con estadísticas y "Mis entradas"
│   ├── verificar.html            Verificador de entradas + escaneo simulado
│   ├── entrada.html              Entrada digital con QR dinámico
│   ├── transferencia.html        Formulario de transferencia segura
│   ├── historial.html            Línea de tiempo y tabla de trazabilidad
│   ├── sobre.html                Documentación del proyecto
│   ├── css/styles.css            Sistema de diseño completo
│   ├── js/
│   │   ├── qr.js                 Generador de QR (ISO/IEC 18004, sin CDN)
│   │   ├── cliente-api.js        Cliente HTTP (fetch) hacia el backend
│   │   ├── api.js                Fachada: API de Docker  ↔  localStorage
│   │   ├── app.js                UI compartida (iconos, toasts, modales…)
│   │   ├── home.js               QR animado de la portada
│   │   ├── dashboard.js          Panel de control
│   │   ├── verificar.js          Lógica del verificador
│   │   ├── entrada.js            Ciclo de rotación del QR
│   │   ├── transferencia.js      Validación y flujo de transferencia
│   │   ├── historial.js          Línea de tiempo y exportación CSV
│   │   └── sesion.js             Sesión de identificación por DNI
│   ├── staff/                    Panel del encargado de puerta (/staff/)
│   │   ├── index.html            Acceso con nombre + código y validación
│   │   ├── staff.css             Estilos del panel (oscuro, móvil)
│   │   └── staff.js              Login, cámara, verificación e ingreso
│   ├── assets/                   favicon.svg · logo.svg
│   └── nginx.conf                Servidor estático + proxy /api
│
├── backend/                      CONTENEDOR 2  (Node.js + Express)
│   ├── index.js                  API REST completa (helmet, CORS y límites)
│   ├── package.json              Dependencias (express, mysql2, cors, helmet…)
│   ├── Dockerfile                Imagen del servidor
│   └── .dockerignore
│
├── database/                     CONTENEDOR 3  (MySQL 8)
│   └── init.sql                  Esquema + datos ficticios
│
├── Dockerfile                    Build del frontend (contexto raíz)
├── docker-compose.yml            Orquestación de los 3 servicios
├── .env.example                  Plantilla de configuración de entorno
├── .env                          Tus valores reales (no se sube a git)
├── .gitignore                    Qué ignora git (.env, node_modules…)
├── .dockerignore
│
├── server.js                     Servidor estático local (sin Docker)
├── package.json                  Scripts de desarrollo y pruebas
│
├── .github/workflows/ci.yml      CI: npm test + docker compose config/build
│
├── test/                         Pruebas automáticas del prototipo
│   ├── qr-selftest.js            Verificación del generador de QR
│   ├── verificacion.js           Pruebas funcionales de todas las páginas
│   ├── dom-sim.js                Micro-DOM para ejecutar las páginas en Node
│   └── debug-tmp.js              Utilidad de depuración
│
├── scripts/                      Utilidades sobre la base de datos
│   ├── sembrar-remoto.js         Siembra una base remota desde init.sql
│   └── migrar-encargados.js      Añade la tabla encargados a una base ya creada
│
└── README.md
```

---

## 4. Endpoints de la API

Todos responden JSON. `ok: true` indica éxito.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio y de la conexión con MySQL |
| `GET` | `/api/resumen` | Tarjetas estadísticas del dashboard |
| `GET` | `/api/entradas` | Lista todas las entradas ficticias |
| `GET` | `/api/entradas/:codigo` | **Consultar entrada** |
| `GET` | `/api/verificar/:codigo` | **Verificar estado** (y registra el evento) |
| `POST` | `/api/entradas/:codigo/qr?log=0\|1` | **Generar token del QR** (`log=0` en rotaciones automáticas) |
| `POST` | `/api/qr/validar` | **Validar token** (recibe `{ "token": "JSP-ENTRY001-XXXXXXXX" }` o el payload `JSP\|CODIGO\|TOKEN\|HORA`) |
| `POST` | `/api/encargados/login` | **Acceso del encargado** (`{ "nombre", "codigo" }`; `401` si no coincide) |
| `POST` | `/api/encargados/validar` | **Validar el QR en la puerta** y registrar el ingreso (`{ "encargado", "codigo", "token" o "entrada", "registrar" }`) |
| `POST` | `/api/usuarios` | **Registrar usuario nuevo** (alta: `{ "dni", "nombre", "correo" }`; `409` si el DNI ya existe) |
| `GET` | `/api/usuarios/:dni` | **Comprobar identidad** (DNI de la persona que se identifica) |
| `POST` | `/api/entradas/:codigo/transferir` | **Transferir entrada** |
| `GET` | `/api/entradas/:codigo/historial` | **Obtener historial** |
| `POST` | `/api/entradas/:codigo/estado/:estado` | Marcar como `usado`, `anulado` o `valido` |
| `POST` | `/api/demo/reiniciar` | Reinicia los datos ficticios |

### Ejemplos

```bash
# Consultar una entrada
curl http://localhost:3000/api/entradas/ENTRY001

# Verificar su estado
curl http://localhost:3000/api/verificar/ENTRY001

# Generar un token de QR
curl -X POST "http://localhost:3000/api/entradas/ENTRY001/qr?log=1"

# Validar ese token (como el lector de la puerta)
curl -X POST http://localhost:3000/api/qr/validar \
     -H "Content-Type: application/json" \
     -d '{"token":"JSP-ENTRY001-XXXXXXXX"}'

# Transferir la entrada
curl -X POST http://localhost:3000/api/entradas/ENTRY001/transferir \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Andrea Torres","dni":"52311878","correo":"andrea.torres@demo.pe","precio":100}'

# Registrar una persona nueva (alta en la base de usuarios)
curl -X POST http://localhost:3000/api/usuarios \
     -H "Content-Type: application/json" \
     -d '{"dni":"77665544","nombre":"Ana Maria Gomez","correo":"ana@correo.pe"}'

# Ese DNI ya se puede usar para identificarse
curl http://localhost:3000/api/usuarios/77665544

# Historial
curl http://localhost:3000/api/entradas/ENTRY001/historial
```

### Panel de encargados (`/staff/`)

El personal de puerta tiene una página propia, pensada para el celular:
**http://localhost:8080/staff/**

| Encargado | Código de demostración |
|---|---|
| Ana Torres | `ANA2026` |
| Luis Paredes | `LUIS2026` |

1. El encargado entra con su **nombre y su código personal**.
2. Escanea el QR del asistente con la cámara (en Android/Chrome) o escribe el
   código de la entrada (`ENTRY001`).
3. El servidor recalcula la **firma HMAC** del token y responde si la entrada
   es válida, ya fue usada, está anulada o el QR caducó.
4. Si todo está bien, el encargado pulsa **Registrar ingreso**: la entrada pasa
   a `usado` y el historial guarda
   *“Ingreso registrado por Ana Torres (encargado)”*.

Los códigos **no se guardan en claro**: en la tabla `encargados` sólo vive el
SHA-256 de `nombre:codigo`. El login admite 12 intentos por minuto y el código
se revalida en cada validación (no basta con abrir la página).

```bash
# Acceso del encargado
curl -X POST http://localhost:3000/api/encargados/login \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Ana Torres","codigo":"ANA2026"}'

# Validar un QR y registrar el ingreso
curl -X POST http://localhost:3000/api/encargados/validar \
     -H "Content-Type: application/json" \
     -d '{"encargado":"Ana Torres","codigo":"ANA2026","token":"JSP-ENTRY001-XXXXXXXX","registrar":true}'
```

> En iPhone/Safari la cámara no puede leer QR desde la web (limitación del
> navegador): se usa la entrada manual, que valida igual el estado de la
> entrada. En Vercel siempre hay HTTPS, que es lo que exige la cámara.

#### Gestionar encargados (altas, cambios de nombre y de código)

Los códigos **no se guardan** (solo su hash SHA-256), así que no se pueden
consultar: se **reemplazan** por uno nuevo con estos comandos.

```bash
# Ver las cuentas (nunca muestra el código: no existe en la base)
npm run encargado -- --listar
npm run encargado -- --listar --remoto          # base de producción (Aiven)

# Crear una cuenta nueva o cambiar su código
npm run encargado -- "Rosa Quispe" "ROSA2026"
npm run encargado -- "Rosa Quispe" "ROSA2026" --remoto

# Cambiar el nombre (y de paso asignar un código nuevo)
npm run encargado -- --renombrar "Ana Torres" "Gabriela Paz" "GABI2026"
npm run encargado -- --renombrar "Ana Torres" "Gabriela Paz" "GABI2026" --remoto

# Dar de baja sin borrar (y volver a activar)
npm run encargado -- --desactivar "Luis Paredes"
npm run encargado -- --activar "Luis Paredes"
```

Sin `--remoto` trabaja sobre la base **local** del Docker; con `--remoto`,
sobre la de **producción**. Son bases independientes: un cambio en una no
afecta a la otra.

> El nombre forma parte del hash (`nombre:codigo`). Si cambias el nombre con
> SQL a mano, la cuenta deja de funcionar: usa `--renombrar`, que recalcula el
> hash. Las cuentas de la base de producción pueden no coincidir con las de
> `init.sql`; consúltalas con `--listar --remoto`.

> **El ingreso en puerta solo lo registra un encargado.** El endpoint que usaba
> el asistente para marcar su propia entrada como usada ahora responde `403`:
> el botón "Simular ingreso" quedó retirado de la web. Si el encargado registra
> escribiendo el código (sin escanear), se invalida el QR vigente de esa
> entrada, para que no quede ninguno "vivo" en el celular.

---

## 5. Base de datos

`database/init.sql` crea siete tablas y las llena con datos ficticios:

| Tabla | Contenido |
|---|---|
| `usuarios` | Titulares ficticios (nombre, DNI, correo) |
| `eventos` | Eventos con fecha, hora, lugar, zona y precios |
| `entradas` | Entradas con código, estado, zona, fila, asiento y token vigente |
| `transferencias` | Histórico de cambios de titularidad |
| `historial` | Trazabilidad: creación, verificación, QR, transferencia, ingreso |
| `tokens_qr` | Tokens emitidos, con firma, vencimiento y estado de invalidación |
| `encargados` | Personal de puerta: nombre y **código hasheado** (SHA-256) |

> Si la base ya estaba creada (por ejemplo la de Aiven en producción),
> `npm run db:encargados` añade la tabla `encargados` y sus cuentas demo
> **sin borrar** el resto de los datos.

### Entradas ficticias de prueba

| Código | Evento | Titular | Estado |
|---|---|---|---|
| `ENTRY001` | Lima Music Fest | Carlos Pérez | 🟢 Válido |
| `ENTRY002` | Lima Music Fest | Andrea Torres | 🔴 Usado |
| `ENTRY003` | Festival Lima 2026 | Luis Ramírez | 🟠 Anulado |
| `ENTRY004` | Concierto Lima Rock | Diego Vargas | 🔵 Transferido |
| `ENTRY005` | Liga 1 - Final | María Torres | 🟢 Válido |
| `ENTRY006` | Liga 1 - Partido de Exhibición | Carlos Pérez | 🟢 Válido |
| `ENTRY007` | Liga 1 - Final | Renato Silva | 🟢 Válido |

> Si modificaste los datos durante una demo y quieres volver al estado
> original: botón **“Reiniciar datos de demostración”** en el dashboard, o
> `docker compose down -v && docker compose up --build`.

### Variables de entorno

Se definen en `.env` (copia de `.env.example`):

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `FRONTEND_PORT` | `8080` | Puerto del frontend en tu equipo |
| `BACKEND_PORT` | `3000` | Puerto de la API en tu equipo |
| `MYSQL_PORT` | `3307` | Puerto de MySQL en tu equipo |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `joinnus_secure_pass` / `joinnus` / `joinnus_pass` | Credenciales de MySQL |
| `MYSQL_ROOT_PASSWORD` | `root_pass_demo` | Contraseña root de MySQL |
| `QR_SECRET` | *(ninguno, es obligatorio)* | **Clave de firma HMAC-SHA256 de los tokens QR. Sin ella el backend no arranca** |
| `QR_TTL_SECONDS` | `15` | Vigencia de cada token (y ritmo de rotación del QR) |
| `CORS_ORIGINS` | `http://localhost:8080,http://127.0.0.1:8080` | Orígenes con permiso para llamar a la API (amplíalos si la demo va en red local) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_QR` / `RATE_LIMIT_VALIDAR` / `RATE_LIMIT_ESCRITURA` | `60000` / `30` / `60` / `20` | Ventana en ms y máximo de peticiones: generar QR, validar token y operaciones de escritura |
| `RATE_LIMIT_ENCARGADO` | `12` | Intentos de acceso al panel de encargados por ventana |
| `DEMO_DNI` | `45678945` | DNI del usuario de la sesión (“Mis entradas”) |
| `TZ` | `America/Lima` | Zona horaria de los contenedores |

---

## 6. Cómo funciona el sistema

### QR dinámico

1. El navegador pide un token nuevo cada **15 segundos**:
   `POST /api/entradas/ENTRY001/qr`.
2. El servidor genera un *nonce* aleatorio, calcula
   `HMAC-SHA256(codigo | nonce | vencimiento)` y guarda el token en
   `tokens_qr` con su fecha de expiración.
3. El token anterior se marca como **invalidado**: deja de servir.
4. El frontend codifica `JSP|CODIGO|NONCE|HORA` dentro de una imagen QR
   **generada en el navegador** (`js/qr.js`, sin CDN ni librerías externas).
5. Cuando el lector escanea, envía el token a `POST /api/qr/validar`, que
   recalcula la firma y comprueba vigencia, invalidación y estado de la entrada.

El vencimiento se **redondea al segundo entero antes de firmarlo**, porque
MySQL `DATETIME` no guarda milisegundos: si se firmara con los milisegundos
exactos, la firma recalculada al validar nunca coincidiría con la guardada.

Por eso una captura de pantalla deja de funcionar en pocos segundos.

### Transferencia segura

La transferencia ocurre en **dos pasos**, para que siempre se sepa quién
transfiere y a quién:

1. **Paso 1 · Quién transfiere** — se elige la entrada en el desplegable y se
   escribe el DNI del titular actual. Mientras ese DNI no coincida con el
   titular real de la entrada, el botón **Transferir entrada** permanece
   bloqueado y aparece *“El DNI no coincide con el titular de la entrada”*.
2. **Paso 2 · A quién** — sólo entonces se abre el formulario del nuevo
   titular, que valida en el cliente nombre completo, DNI de exactamente
   8 dígitos, correo válido y precio que no supere el original.
3. Si el precio es mayor, aparece 🔴 *“El precio de transferencia supera el
   límite permitido”* y no se puede continuar.
4. El servidor **vuelve a validar todo** (nunca confía en el navegador) y
   ejecuta la transferencia en una transacción: cambia el titular, invalida
   los tokens anteriores, genera uno nuevo y escribe en `transferencias` e
   `historial`.

### Seguridad aplicada

- **Firma HMAC-SHA256 con `QR_SECRET`**: la clave vive en `.env` (fuera del
  repositorio, ignorada por `.gitignore`) y el backend no arranca sin ella.
- **Limitador de peticiones** (`express-rate-limit`): 30 generaciones de QR,
  60 validaciones y 20 operaciones de escritura por minuto, para que nadie
  pueda martillear los endpoints.
- **CORS restringido**: sólo el frontend propio y las redes privadas de la
  sala (ampliable con `CORS_ORIGINS`) pueden llamar a la API.
- **Helmet** añade las cabeceras de seguridad estándar (nosniff,
  X-Frame-Options, etc.).
- **Validación en dos capas**: cliente y servidor, sin confiar en el navegador.
- **Propiedad de la entrada**: generar un QR o transferir devuelve `403` si el
  DNI identificado no es el titular de esa entrada; el detalle de una entrada
  ajena tampoco entrega el token vigente (el estado sigue siendo consultable,
  como en el verificador de la puerta).
- **Códigos de encargado hasheados**: la tabla `encargados` sólo guarda
  SHA-256 de `nombre:codigo`; el login tiene su propio límite (12/min) y cada
  validación vuelve a comprobar el código contra la base.
- **Trazabilidad del portero**: cada ingreso registrado desde `/staff/` queda
  en `historial` con el nombre de quien lo validó.

---

## 7. Presentar el proyecto ante los jurados

### Opción A — En el propio equipo (la más sencilla)

1. Deja el proyecto dockerizado y funcionando antes de la exposición.
2. Abre `http://localhost:8080` y ten una segunda pestaña con
   `http://localhost:3000/api/health` para enseñar que la API responde.
3. Deja el proyecto corriendo durante toda la sesión.

### Opción B — Desde otra máquina de la red local (sala de exposición)

Los puertos ya se publican en `0.0.0.0`, así que basta con conocer la IP del
equipo:

```bash
# Windows
ipconfig                       # busca "Dirección IPv4", p.ej. 192.168.1.25
# Linux / macOS
ip addr  |  hostname -I
```

Luego, en cualquier dispositivo conectado a la **misma red**:

```
http://192.168.1.25:8080
```

> Si el firewall del equipo bloquea el puerto, permite el 8080 entrante
> (PowerShell como administrador):
> `New-NetFirewallRule -DisplayName "JSP 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow`

> La **cámara** del celular sólo funciona en HTTPS (Vercel) o en `localhost`.
> Si abres el panel por la IP de la red (`http://192.168.x.x:8080/staff/`),
> el propio panel avisa y se usa la **entrada manual** del código.

### Opción C — Proyectar la pantalla

- Duplica la pantalla (`Win + P`) o conecta el proyector.
- Todo el diseño es responsive: también se ve bien en tablet o celular.

### Guion de demostración sugerido (5 minutos)

1. **Inicio** — mostrar el QR rotando en vivo en la portada.
2. **Dashboard** — “Hola, Carlos”: 2 activas, 1 usada, 1 transferida.
3. **Verificar entrada** — consultar `ENTRY001` (🟢 válida), `ENTRY002`
   (🔴 utilizada), `ENTRY003` (🟠 anulada) y `ENTRY004` (🔵 transferida).
   Probar **“Simular escaneo QR”**.
4. **Mi entrada** — señalar el contador de 15 s y cómo el token y la imagen
   cambian. Pulsar **“Validar token en el servidor”**.
5. **Transferir entrada** — primero elegir la entrada y escribir el DNI del
   titular actual (`45678945`): el botón sigue bloqueado si no coincide.
   En el formulario, `S/ 150` muestra el bloqueo; luego `S/ 100` y completa la
   transferencia. Señalar que el QR anterior queda invalidado.
6. **Historial** — buscar `ENTRY001` en el desplegable: la línea de tiempo ya
   refleja la transferencia y el nuevo QR.
7. **Panel de encargados** — abrir `/staff/` desde el celular (o la misma
   pantalla), entrar como **Ana Torres · ANA2026**, escanear el QR de la
   entrada y pulsar **Registrar ingreso**: la entrada pasa a 🔴 usada y el
   historial muestra *“Ingreso registrado por Ana Torres (encargado)”*.
8. **Sobre el proyecto** — explicar qué es real y qué está simulado.

### Si algo falla durante la demo

```bash
docker compose ps             # ¿todos "Up"?
docker compose logs -f backend
docker compose restart backend
docker compose down -v && docker compose up --build   # reconstrucción total
```

---

## 8. Sin Docker (modo local)

El prototipo **también funciona sin Docker**, abriendo
`frontend/index.html` con doble clic:

- `js/api.js` detecta que no hay API y usa automáticamente la simulación con
  `localStorage` (mismos datos ficticios, mismos flujos, mismas validaciones).
- En la parte superior de cada página se muestra una etiqueta:
  🟢 *“API conectada (Docker)”* o ⚪ *“Modo local (localStorage)”*.
- Sin servidor tampoco hace falta Internet: el generador de QR está escrito a
  mano y no usa CDN. (Las tipografías vienen de Google Fonts y degradan a las
  del sistema si no hay red.)

Opcionalmente, un servidor estático con Node:

```bash
node server.js          # http://localhost:8080
```

---

## 9. Variables de entorno del backend

Definidas en `docker-compose.yml` (y personalizables en `.env`):

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `DB_HOST` | `mysql` | Host de MySQL (nombre del servicio) |
| `DB_PORT` | `3306` | Puerto interno de MySQL |
| `DB_NAME` | `joinnus_secure_pass` | Base de datos |
| `DB_USER` / `DB_PASSWORD` | `joinnus` / `joinnus_pass` | Credenciales |
| `QR_SECRET` | *(demo)* | Clave del HMAC-SHA256 |
| `QR_TTL_SECONDS` | `15` | Vigencia del token QR |
| `DEMO_DNI` | `45678945` | Usuario de la sesión |
| `NODE_ENV` | `production` | Entorno de ejecución |

---

## 10. Qué es real y qué está simulado

### ✅ Funciona de verdad

- Códigos **QR reales** generados en el navegador (Reed-Solomon, máscaras,
  información de formato y versión, estándar ISO/IEC 18004).
- Rotación del token **cada 15 segundos** con contador regresivo.
- **Firma HMAC-SHA256** de los tokens en el servidor y su validación.
- **Persistencia real en MySQL** (o en `localStorage` si no hay Docker).
- Validaciones de DNI, correo, nombre y límite de precio (cliente **y**
  servidor).
- Trazabilidad completa con línea de tiempo, tabla y exportación a CSV.
- **Panel de encargados** en `/staff/`: acceso con nombre + código,
  escaneo del QR desde el celular y registro del ingreso con el nombre de
  quien lo validó.

### ⚠️ Simulado (pendiente para un sistema productivo)

- Autenticación de usuarios: hay **identificación** (DNI + nombres + apellidos,
  comprobados contra la base) disponible desde el panel y desde la píldora
  *Identifícate* que aparece en todas las páginas; el servidor exige además que
  la entrada sea de esa persona para emitir el QR o transferirla (devuelve
  `403`). Lo que sigue faltando es la **contraseña**: quien conozca los datos de
  una persona puede identificarse como ella, y eso es identificación, no
  autenticación.
- Lector de QR físico dedicado (torniquete): la validación en puerta ya existe,
  pero se hace desde el celular del encargado en `/staff/`.
- Pagos reales y validación de identidad contra RENIEC.
- Cifrado en reposo de los datos personales y cifrado TLS (en producción hay
  que terminar TLS delante de nginx).
- Alta disponibilidad: una sola instancia de cada servicio, sin réplicas.
- Claves y contraseñas por defecto: **cámbialas** antes de usar esto fuera de
  una clase.

---

## 11. Pruebas automáticas

El proyecto incluye pruebas en Node (no requieren Docker ni navegador):

```bash
npm test              # todas
npm run test:qr       # solo el generador de QR
npm run test:app      # solo los flujos de la aplicación
```

- `test/qr-selftest.js` — 756 comprobaciones del codificador QR: patrones de
  detección, temporización, alineación, información de formato y versión
  (BCH), consistencia de máscara, síndromes de Reed-Solomon y viaje redondo
  del contenido en los cuatro niveles de corrección de errores.
- `test/verificacion.js` — ejecuta las páginas reales dentro de un micro-DOM y
  comprueba la estructura, los cuatro estados de las entradas, la rotación del
  QR, las validaciones del formulario de transferencia, el historial, la
  persistencia, la integración con la API de Docker mediante un `fetch`
  simulado, el **enrutado de la API en Vercel** (rewrite de rutas de dos y más
  segmentos), la **firma de los tokens QR** (válida, rotada, caducada y
  alterada) y el **panel de encargados** (archivos, ids, cámara, endpoints y
  códigos hasheados).

En total, `npm test` ejecuta **1618 comprobaciones** (756 del QR + 862 de la
aplicación) con 0 fallos.

### Integración continua (GitHub Actions)

`.github/workflows/ci.yml` corre en cada *push* y *pull request*:

1. `npm test` — QR selftest + verificación de las 7 páginas.
2. `docker compose config -q` — falla si la configuración es inválida o si
   falta `QR_SECRET`.
3. `docker compose build` — comprueba que las imágenes compilan.

### Análisis estático con SonarQube (opcional, local)

SonarQube revisa el código en busca de bugs, vulnerabilidades, *code smells* y
duplicación. **No forma parte de la demo**: vive en su propio
`docker-compose.sonar.yml` (SonarQube + PostgreSQL) y solo se usa en desarrollo.

```bash
# 1) Levantar el servidor (puerto 9000)
docker compose -f docker-compose.sonar.yml up -d

# 2) Abrir http://localhost:9000 (usuario inicial: admin) y crear un token
#    en My Account → Security → Generate Tokens

# 3) Analizar el proyecto
$env:SONAR_TOKEN = "el-token-que-generaste"
docker compose -f docker-compose.sonar.yml --profile scan run --rm scanner

# 4) Apagar el servidor cuando ya no se use
docker compose -f docker-compose.sonar.yml down
```

El análisis se configura en `sonar-project.properties` (qué carpetas entran,
qué se excluye y dónde están las pruebas). La cobertura no se envía porque la
suite actual es un script propio sin instrumentar: el *quality gate* de Sonar
se evalúa sobre el código nuevo.

---

## 12. Autoría

Proyecto académico universitario. Datos, eventos y personas son ficticios.

---

## 13. Publicarla en internet (24/7)

Hasta aquí el proyecto vive en tu equipo (`localhost:8080`). Para que otras
personas entren con un link hacen falta dos cosas: un servidor encendido todo
el rato y la web servida desde un dominio público. Hay tres caminos:

### Opción A — Vercel (web + API + MySQL externa)

Vercel sirve la **web** (los estáticos de `frontend/`) y también la **API**,
pero como *función serverless*: `api/index.js` le pasa las peticiones
`(req, res)` directamente a la app Express de `backend/index.js` (ese archivo
ya exporta `app`, que **es** una función de esas características, y sólo hace
`listen()` al ejecutarse como programa principal, así que **el código fuente
sigue siendo uno solo**). *Notas: usar `serverless-http` aquí —pensado para
AWS Lambda, devuelve la respuesta como objeto en vez de escribirla en `res`—
dejaba toda petición a `/api` colgada sin respuesta; y el enrutado por
ficheros de Vercel sólo casa rutas sencillas (`/api/health`), de modo que
`/api/entradas/ENTRY001` devolvía el 404 de la plataforma. La rewrite de
`vercel.json` (`/api/:path*` → `/api?__ruta=/api/:path*`) reenvía cualquier
ruta bajo `/api` a la única función, que restaura la ruta original en
`req.url` antes de llamar a Express.*
Vercel **no tiene MySQL**, así que la base de datos vive en un servicio
externo gratuito.

1. **Base de datos gratis (una sola vez)** — por ejemplo [Aiven](https://aiven.io)
   (*Create service → MySQL → Free plan*) o [TiDB Serverless](https://tidbcloud.com).
   Copia `.env.remota.example` a `.env.remota` con los datos que te den
   (host, puerto, usuario, contraseña, `DB_SSL=true`). Si el proveedor sólo
   exige TLS sin verificar la cadena (el `ssl-mode=REQUIRED` de la *Service
   URI* de Aiven), basta `DB_SSL_INSECURE=true`; si en cambio pide la CA
   del proveedor, añade `DB_SSL_CA` con la ruta a su `.pem` (Aiven: *Service
   settings → CA Cert*). Con TiDB no hace falta ninguna de las dos.
2. **Sembrar la base** con el esquema y la demo:
   ```bash
   npm run db:remoto             # crea tablas y usuarios/entradas ficticios
   npm run db:remoto -- --reset  # …o empieza de cero
   ```
3. **Variables de entorno en Vercel** (Dashboard → *Settings → Environment
   Variables*, o `vercel env add`): `QR_SECRET`, `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true` y, si se quiere
   restringir el origen, `CORS_ORIGINS`. (`TZ` **no** puede declararse ahí:
   Vercel la reserva; la fija `api/index.js`.)
4. **Desplegar**:
   ```bash
   npm i -g vercel     # una sola vez
   vercel login        # abre un enlace y confirma el correo
   vercel link         # crea el proyecto (p. ej. joinnus-secure-pass)
   vercel --prod       # sube la web y la API
   ```
   La web queda en `https://NOMBRE.vercel.app` y la API responde en
   `https://NOMBRE.vercel.app/api/health`.

La configuración del despliegue está en el repositorio: `vercel.json`
(los estáticos salen de `frontend/`) y `api/`.

**Límites propios de serverless** (documentados, no son fallos):

- El límite de peticiones está en memoria de la función: en Vercel cada
  instancia tiene el suyo, así que protege menos que en Docker.
- El primer arranque de una función puede tardar 1-2 s más (arranque en frío).
- `TZ=America/Lima` evita que las horas se muestren en UTC (zona de Vercel).
  En Vercel esa variable está **reservada** y no se puede declarar en el
  panel, así que se fija en el código, al principio de `api/index.js`.

### Opción B — Oracle Cloud Always Free (gratis para siempre)

1. **Cuenta**: <https://cloud.oracle.com/free>. Piden tarjeta sólo para
   verificar identidad; el plan *Always Free* no cobra nada.
2. **Máquina**: *Create a VM* → imagen **Ubuntu 24.04** (o 22.04) →
   `VM.Standard.E2.1.Micro` (AMD, 1 GB) o `VM.Standard.A1.Flex` (ARM, hasta
   24 GB). Al terminar, anota la **IP pública**.
3. **Abrir el puerto 80**: *Subnet → Security Lists → Add Ingress Rules*,
   *Destination Port* `80`, *Source* `0.0.0.0/0`.
4. **Entrar por SSH** (la clave privada se descarga al crear la VM):
   ```bash
   ssh -i clave.pem ubuntu@IP_PUBLICA
   ```
5. **Instalar Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```
6. **Bajar el proyecto y configurarlo**:
   ```bash
   git clone https://github.com/francisgoicochea7-code/joinnus-secure-pass.git
   cd joinnus-secure-pass
   cp .env.example .env
   nano .env      # QR_SECRET, DB_PASSWORD y MYSQL_ROOT_PASSWORD fuertes
   ```
7. **Arrancar**:
   ```bash
   docker compose up -d --build
   docker compose ps        # los tres deben aparecer "Up (healthy)"
   ```
8. **Probar**: abre `http://IP_PUBLICA` desde cualquier navegador y registra
   una cuenta nueva en la píldora de identificación.

Los datos (entradas, historial y usuarios registrados) viven en el volumen
`jsp_mysql_data`: sobreviven a los reinicios (`sudo reboot` y después
`docker compose up -d`). Para actualizar el código:

```bash
cd joinnus-secure-pass && git pull && docker compose up -d --build
```

### Opción C — Un link en 5 minutos (mientras tu PC está encendida)

No se instala nada en la nube; tu equipo sigue sirviendo la app:

```bash
# Windows (una sola vez): winget install cloudflared
cloudflared tunnel --url http://localhost:8080
```

Te da una dirección tipo `https://xxxx.trycloudflare.com` que puedes pasar por
WhatsApp. Sólo funciona mientras esa terminal y Docker siguen abiertas.
Alternativa: `ngrok http 8080` (cuenta gratuita).

### Recomendaciones al salir a internet

- Cambia `QR_SECRET`, `DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` en `.env`
  (ese fichero **nunca** se sube a git: sólo existe en el servidor).
- Los puertos 3000 (API) y 3307 (MySQL) sólo escuchan en `127.0.0.1`, así que
  de la máquina sólo se expone el 80 de nginx.
- En Vercel los secretos (`QR_SECRET`, `DB_*`) viven en las variables de
  entorno del proyecto, nunca en el repositorio; el CORS admite el sufijo
  `*.vercel.app` para que la web publicada pueda llamar a su propia API.
- Las rutas de escritura tienen límite de peticiones (20/min), el QR rota cada
  15 s y se firma con HMAC en el servidor; la transferencia exige además que
  la entrada sea del DNI que la pide.
- **Límite a recordar (sección 10): no hay contraseña.** Cualquiera que conozca
  un DNI y un nombre puede identificarse como esa persona. Para compartir con
  conocidos está bien; si algún día es público de verdad, habría que añadir
  contraseña (bcrypt) y HTTPS con certificado (por ejemplo Caddy delante de
  nginx, o certbot).
