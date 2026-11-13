# Documento de diseño — Joinnus Secure Pass (versión 2)

> Documento de apoyo a la metodología **SDD** (*Spec-Driven Development*).
> La especificación dice **qué** se necesita; este documento explica **cómo**
> está construido el sistema y **por qué** se tomaron las decisiones.

---

## 1. Resumen

Joinnus Secure Pass es un prototipo académico para reducir la reventa informal
de entradas. Cada entrada tiene un **QR dinámico** que caduca a los pocos
segundos y una **firma HMAC** que el servidor recalcula en cada validación. Las
transferencias entre personas quedan registradas con su trazabilidad completa.

La versión 2 conserva el comportamiento de la versión 1 y añade cuatro mejoras:

| Mejora | Resultado |
|---|---|
| Metodología SDD | `specs/001…003` + este documento |
| Base de datos PostgreSQL 16 | Sin dependencias de MySQL |
| Pruebas unitarias | 35 casos con `node:test` |
| SonarQube local | 0 bugs, 0 vulnerabilidades, 0 code smells |

---

## 2. Arquitectura

```
 Navegador
    │  HTTP :8081
    ▼
┌──────────────────────────┐
│ frontend (nginx)         │  sirve las 8 páginas y hace de proxy /api
│ contenedor jsp2-frontend │
└────────────┬─────────────┘
             │ red interna jsp2_net
             ▼
┌──────────────────────────┐
│ backend (Node.js 20)     │  Express + pg (node-postgres)
│ contenedor jsp2-backend  │  puerto interno 3000
└────────────┬─────────────┘
             │ SQL
             ▼
┌──────────────────────────┐
│ PostgreSQL 16            │  volumen jsp2_postgres_data
│ contenedor jsp2-postgres │  127.0.0.1:5433 → 5432
└──────────────────────────┘
```

**Por qué así:**

- El navegador solo habla con nginx. nginx reenvía `/api` al backend por la red
  interna, así que no hay problemas de CORS ni se expone la base de datos.
- PostgreSQL solo se publica en `127.0.0.1`: sirve para inspeccionarlo con una
  herramienta SQL, pero no queda abierto a la red local.
- La versión 2 usa contenedores `jsp2-*`, red `jsp2_net` y puertos
  **8081 / 3001 / 5433**, de modo que puede convivir con la versión 1
  (`jsp-*`, 8080 / 3000 / 3307).

### Componentes

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| `frontend/` | HTML, CSS y JavaScript sin frameworks | Interfaz, QR en canvas, panel `/staff/` |
| `backend/index.js` | Node.js 20 + Express | 16 endpoints REST, validaciones, firma HMAC |
| `database/init.sql` | SQL PostgreSQL 16 | Esquema, índices y datos ficticios idempotentes |
| `api/index.js` | Función serverless | Reutiliza la misma app Express en Vercel |
| `test/` | Node sin dependencias | QR, flujos de las páginas y unitarias |

---

## 3. Modelo de datos

Siete tablas, todas con claves e índices con nombre:

| Tabla | Para qué |
|---|---|
| `usuarios` | Personas (DNI único, nombre, correo, teléfono) |
| `eventos` | Evento, fecha, hora, lugar y precio base |
| `entradas` | Entrada, titular, estado y QR vigente |
| `transferencias` | Historial de cada traspaso y su código de operación |
| `historial` | Trazabilidad de todas las acciones |
| `tokens_qr` | Tokens emitidos, firma, nonce, vencimiento e invalidación |
| `encargados` | Personal de puerta; solo se guarda el hash de su código |

### Decisiones de migración

| MySQL | PostgreSQL | Motivo |
|---|---|---|
| `AUTO_INCREMENT` | `SERIAL` | Equivalente nativo |
| `ENUM` | `VARCHAR` + `CHECK` | Más fácil de modificar y de auditar |
| `TINYINT(1)` | `SMALLINT` con `CHECK (0,1)` | Conserva los valores 0/1 del código |
| `DATETIME` | `TIMESTAMP` sin zona + `TZ=America/Lima` | Fechas locales consistentes |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT … DO UPDATE … RETURNING id` | Devuelve el id en una sola consulta |
| Código de duplicado `ER_DUP_ENTRY` | `23505` | Código estándar de PostgreSQL |
| `information_schema` por nombre de BD | `table_schema = 'public'` | PostgreSQL separa esquemas |

Los datos de demostración se insertan con `ON CONFLICT DO NOTHING`, así que
`init.sql` se puede ejecutar más de una vez sin duplicar filas.

---

## 4. Flujos principales

### 4.1 Verificar una entrada

1. El navegador envía el código (`ENTRY001`) o el token del QR.
2. El backend busca la entrada y su token vigente.
3. Recalcula la firma HMAC con `codigo | nonce | vencimiento`.
4. Comprueba que la firma coincide, que no venció y que la entrada no está
   usada ni anulada.
5. Devuelve el estado y, si todo está bien, permite registrar el ingreso.

### 4.2 Generar un QR nuevo

1. Se invalida el token anterior de esa entrada.
2. Se genera un `nonce` con `crypto.randomBytes` y se firma con HMAC-SHA256.
3. Se guarda el token y su vencimiento (15 s por defecto).
4. El navegador dibuja el QR en un canvas (implementación propia, sin CDN).

La firma se calcula sobre el instante **redondeado al segundo**, porque la
columna `TIMESTAMP` no guarda milisegundos. Si se firmara con milisegundos, al
leerla de la base la firma nunca coincidiría y todo QR daría "firma no válida".

### 4.3 Transferir una entrada

1. Se valida el nombre, el DNI, el correo y el precio (0 ≤ precio ≤ original).
2. Se crea el usuario destino si no existe (`ON CONFLICT` + `RETURNING id`).
3. Se invalida el QR vigente y se actualiza el titular.
4. Se registra la transferencia y dos filas de historial.
5. Se emite un QR nuevo para el nuevo titular.

### 4.4 Panel de encargados (`/staff/`)

- Login con nombre y código; en la base solo vive el SHA-256 de
  `nombre:codigo`.
- Límite de intentos por minuto para dificultar la fuerza bruta.
- Cámara en Android/Chrome mediante `BarcodeDetector` o entrada manual.
- El servidor revalida el código del encargado en cada operación.

### 4.5 Reinicio de la demo

`POST /api/demo/reiniciar` abre una conexión `pg` independiente y ejecuta:

```sql
TRUNCATE TABLE historial, tokens_qr, transferencias, entradas, eventos, usuarios
RESTART IDENTITY CASCADE;
```

Después vuelve a ejecutar `init.sql`. `CASCADE` respeta las claves foráneas y
`RESTART IDENTITY` reinicia los contadores `SERIAL`.

---

## 5. Seguridad

| Riesgo | Medida |
|---|---|
| QR copiado o reenviado | Token dinámico de 15 s + firma HMAC + invalidación del anterior |
| Alteración del token | La firma se recalcula en el servidor; un token modificado no valida |
| Fuerza bruta en el login | Límite de peticiones por ventana (`express-rate-limit`) |
| Códigos de encargado en claro | Solo se almacena su hash SHA-256 |
| Inyección SQL | Consultas parametrizadas (`$1`, `$2`, …) |
| Datos personales | DNI oculto en la interfaz; datos ficticios en la demo |
| Secretos en el repositorio | `.env` ignorado por git; `QR_SECRET` obligatoria |

`QR_SECRET` no tiene valor por defecto: si falta, el backend **no arranca**.
Eso evita que un despliegue accidental use una clave conocida.

---

## 6. Pruebas

| Nivel | Archivo | Qué comprueba |
|---|---|---|
| QR | `test/qr-selftest.js` | 756 comprobaciones del codificador (ISO/IEC 18004) |
| Aplicación | `test/verificacion.js` | 863 comprobaciones de las páginas y la API simulada |
| Unitarias | `test/unit/*.test.js` | 35 casos de funciones puras del backend |

Las unitarias **no tocan la base de datos**: importan las funciones exportadas
en `backend/index.js` (`module.exports.util`) y comprueban entradas y salidas.

```bash
npm install --prefix backend   # una sola vez
npm test                       # todo
npm run test:unit              # solo unitarias
```

---

## 7. Análisis estático

SonarQube se ejecuta aparte (`docker-compose.sonar.yml`) para no mezclarlo con
la demo. El análisis de la versión 2 dio:

| Métrica | Valor |
|---|---|
| Bugs | 0 |
| Vulnerabilidades | 0 |
| Security hotspots | 0 |
| Code smells | 0 |
| Duplicación | 3.8 % |
| Líneas | 5 815 en 29 archivos |
| Quality gate | OK |

Hallazgos corregidos: promesas sin manejar, `<select>` sin etiqueta accesible,
`Math.random` en el modo demo, `isNaN`/`parseInt`/`parseFloat` sin `Number.`.

---

## 8. Riesgos y límites

- La identificación es por DNI/nombre; **no hay contraseña** para el asistente.
- Sin TLS en local; en producción hay que terminar TLS delante de nginx.
- Una sola instancia de cada servicio: no hay alta disponibilidad.
- La migración de **producción** a PostgreSQL queda pendiente; la versión 2 se
  valida primero en local.
- Los datos, eventos y personas son ficticios.

---

## 9. Cómo se comprobó

| Criterio | Evidencia |
|---|---|
| CA-1 Arranque limpio | `docker compose up -d --build` y `/api/health` en verde |
| CA-2 Datos iniciales | 7 entradas, 13 movimientos de historial, 2 encargados |
| CA-3 Reinicio de demo | 7 entradas de nuevo y contadores `SERIAL` en 1 |
| CA-4 Transferencia | ENTRY001 pasó a "transferido" con QR nuevo |
| CA-5 Encargados | Login correcto (200) e incorrecto (401) |
| CA-6 Pruebas | 756 + 863 + 35, 0 fallos |
| CA-7 Coexistencia | v1 en 8080/3000/3307 y v2 en 8081/3001/5433 |
