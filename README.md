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

# 2) (Opcional) Copiar la configuración de entorno y ajustarla
copy .env.example .env        # Windows
cp .env.example .env          # Linux / macOS

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
| 3000 | 3000 | API Express | Opcional (para probar endpoints) |
| 3307 | 3306 | MySQL | No (sólo para inspección con un cliente SQL) |

Todos son configurables en `.env`: `FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`.

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
│   │   └── historial.js          Línea de tiempo y exportación CSV
│   ├── assets/                   favicon.svg · logo.svg
│   └── nginx.conf                Servidor estático + proxy /api
│
├── backend/                      CONTENEDOR 2  (Node.js + Express)
│   ├── index.js                  API REST completa
│   ├── package.json              Dependencias (express, mysql2, cors, dotenv)
│   ├── Dockerfile                Imagen del servidor
│   └── .dockerignore
│
├── database/                     CONTENEDOR 3  (MySQL 8)
│   └── init.sql                  Esquema + datos ficticios
│
├── Dockerfile                    Build del frontend (contexto raíz)
├── docker-compose.yml            Orquestación de los 3 servicios
├── .env.example                  Configuración de entorno
├── .dockerignore
│
├── server.js                     Servidor estático local (sin Docker)
├── package.json                  Scripts de desarrollo y pruebas
├── test/                         Pruebas automáticas del prototipo
│   ├── qr-selftest.js            Verificación del generador de QR
│   ├── verificacion.js           Pruebas funcionales de todas las páginas
│   ├── dom-sim.js                Micro-DOM para ejecutar las páginas en Node
│   └── debug-tmp.js              Utilidad de depuración
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

# Historial
curl http://localhost:3000/api/entradas/ENTRY001/historial
```

---

## 5. Base de datos

`database/init.sql` crea seis tablas y las llena con datos ficticios:

| Tabla | Contenido |
|---|---|
| `usuarios` | Titulares ficticios (nombre, DNI, correo) |
| `eventos` | Eventos con fecha, hora, lugar, zona y precios |
| `entradas` | Entradas con código, estado, zona, fila, asiento y token vigente |
| `transferencias` | Histórico de cambios de titularidad |
| `historial` | Trazabilidad: creación, verificación, QR, transferencia, ingreso |
| `tokens_qr` | Tokens emitidos, con firma, vencimiento y estado de invalidación |

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
| `QR_SECRET` | *(demo)* | **Clave de firma HMAC-SHA256 de los tokens QR** |
| `QR_TTL_SECONDS` | `15` | Vigencia de cada token (y ritmo de rotación del QR) |
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

Por eso una captura de pantalla deja de funcionar en pocos segundos.

### Transferencia segura

1. El formulario valida **en el cliente**: nombre completo, DNI de exactamente
   8 dígitos, correo válido y precio que no supere el original.
2. Si el precio es mayor, aparece 🔴 *“El precio de transferencia supera el
   límite permitido”* y no se puede continuar.
3. El servidor **vuelve a validar todo** (nunca confía en el navegador) y
   ejecuta la transferencia en una transacción: cambia el titular, invalida
   los tokens anteriores, genera uno nuevo y escribe en `transferencias` e
   `historial`.

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
5. **Transferir entrada** — Introduce un precio de `S/ 150` para mostrar el
   bloqueo; luego `S/ 100` y completa la transferencia. Mostrar que el QR
   anterior queda invalidado.
6. **Historial** — la línea de tiempo ya refleja la transferencia y el nuevo QR.
7. **Sobre el proyecto** — explicar qué es real y qué está simulado.

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

### ⚠️ Simulado (pendiente para un sistema productivo)

- Autenticación de usuarios: el usuario de la sesión está fijado por
  `DEMO_DNI`, no hay login ni contraseñas.
- Lector físico de QR y control de acceso en la puerta del evento.
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
  persistencia y la integración con la API de Docker mediante un `fetch`
  simulado.

---

## 12. Autoría

Proyecto académico universitario. Datos, eventos y personas son ficticios.
