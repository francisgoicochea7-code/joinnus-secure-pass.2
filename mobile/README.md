# Joinnus Secure Pass - App movil

Aplicacion movil nativa (Expo + React Native + TypeScript) para reutilizar el
backend, la base de datos y las reglas de negocio del proyecto Joinnus Secure
Pass. **No es una WebView**: las pantallas, la navegacion, los formularios y el
lector de QR estan construidos con componentes moviles.

## 1. Funcionalidades

- Inicio con portada editorial, resumen de pases y accesos rapidos.
- Mis entradas con filtros por estado.
- Detalle del pase con QR dinamico, temporizador de 15 segundos y copia del token.
- Verificacion publica por codigo o escaneo de QR.
- Transferencia de entradas con validacion de DNI, correo y precio maximo.
- Historial de trazabilidad por persona.
- Modo puerta para encargados: login, escaneo y registro de ingreso.
- Tema oscuro y claro, tipografia Plus Jakarta Sans y animaciones nativas.
- Sesion guardada con `expo-secure-store`; el codigo de encargado no se guarda.
- Pantallas de carga, estados vacios, errores, reintentos y avisos visuales.

## 2. Arquitectura

```text
mobile/
  App.tsx                     proveedores globales y fuentes
  app.json                    configuracion Expo y permisos de camara
  eas.json                    perfiles para generar APK con EAS
  scripts/dev-api-proxy.mjs   proxy HTTP local para el gateway HTTPS
  src/
    api/client.ts             cliente de la API actual (fetch + Authorization: Bearer)
    api/types.ts              tipos de entradas, usuarios e historial
    auth/AuthContext.tsx      sesion con token, login/registro y SecureStore
    components/               botones, tarjetas, inputs, QR, toasts, estados
    navigation/               stack + barra inferior
    screens/                  Inicio, Entradas, Verificar, Historial, Perfil...
    theme/                    tokens y tema claro/oscuro
    utils/                    formatos, validaciones y posters locales
```

La app consume las mismas rutas del backend desplegado y del backend local:

| Metodo | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | comprobar conexion |
| GET | `/api/resumen` | estadisticas |
| GET | `/api/entradas` | listar entradas |
| GET | `/api/entradas/:codigo` | detalle |
| GET | `/api/verificar/:codigo` | verificacion publica |
| POST | `/api/entradas/:codigo/qr?log=0` | generar QR dinamico |
| POST | `/api/entradas/:codigo/transferir` | transferir |
| GET | `/api/historial?dni=` | historial |
| GET | `/api/usuarios/:dni` | datos publicos de una persona |
| POST | `/api/usuarios/login` | iniciar sesion (DNI + contrasena) |
| POST | `/api/usuarios` | registrar con contrasena |
| POST | `/api/encargados/login` | login de encargado |
| POST | `/api/encargados/validar` | validar QR en puerta |

## 3. Requisitos

- Node.js 20 o superior (el proyecto fue probado con Node 24).
- Un telefono Android con **Expo Go** instalado desde Play Store.
- El telefono y la computadora en la misma red Wi-Fi para usar el backend local.
- Para el backend local: Docker Desktop y el proyecto levantado con `docker compose`.
- Para generar el APK: una cuenta gratuita de Expo (EAS) o Android Studio + Android SDK.

## 4. Ejecutar en Android con Expo Go

### 4.1 Backend local

En la raiz del repositorio:

```powershell
docker compose up --build
curl.exe -k https://localhost:8444/api/health
```

Debe responder `200`. El gateway local usa HTTPS con certificado autofirmado y
el puerto **8444**.

### 4.2 Proxy para el telefono

El telefono no debe confiar en el certificado autofirmado, por eso incluimos un
proxy de desarrollo que convierte el gateway HTTPS local en HTTP dentro de la
red. En una terminal:

```powershell
cd mobile
npm run api:proxy
```

El proxy escucha en `0.0.0.0:8091` y reenvia a `https://localhost:8444`. Si
Windows pregunta por el firewall, permite la conexion en redes privadas.

### 4.3 Iniciar Expo

En otra terminal:

```powershell
cd mobile
npm install
npx expo start
```

Escanea el QR que muestra la terminal con **Expo Go** (Android). Expo Go debe
estar en la misma red que la computadora.

La app intenta detectar automaticamente la IP de la computadora a partir de
Expo y usa:

```text
http://<IP-DE-TU-PC>:8091/api
```

Si no conecta:

1. Abre **Perfil > Servidor de la API**.
2. Escribe `http://<IP-DE-TU-PC>:8091/api` (por ejemplo
   `http://192.168.1.50:8091/api`).
3. Pulsa **Guardar** y luego **Probar**.

Para conocer tu IP en Windows:

```powershell
ipconfig
```

Busca la direccion IPv4 de tu adaptador Wi-Fi. No uses `localhost` en el
telefono: `localhost` seria el propio telefono.

### 4.4 Probar contra Render

Si no quieres levantar el backend local, usa la API publica:

```text
https://joinnus-secure-pass2.onrender.com/api
```

En una build de produccion esa es la URL por defecto. En Expo Go tambien puedes
cambiarla desde **Perfil > Servidor de la API**. Ten en cuenta que Render puede
tener datos distintos a tu base local.

### 4.5 Si la red bloquea la conexion

```powershell
cd mobile
npm run start:tunnel
```

El tunel resuelve la conexion entre Expo Go y Metro, pero la API debe seguir
siendo accesible (usa Render o un tunel propio para el proxy/backend).

## 5. Cuenta de demostracion

La app inicia sesion con **DNI + contrasena**, igual que la web:

```text
DNI:        45678945
Contrasena: Carlos2026!
```

Otras cuentas ficticias: `52311878` / `Andrea2026!`, `43871264` / `Maria2026!`,
`39521478` / `Renato2026!`.

Tambien puedes crear una cuenta desde **Crear cuenta** con un DNI nuevo, tu
nombre, un correo y una contrasena de al menos 8 caracteres. El servidor
guarda solo el hash scrypt y devuelve un token firmado de 8 horas.

## 6. Verificaciones de calidad

```powershell
cd mobile
npm run typecheck
npm run doctor
npm run export:android
```

- `typecheck` no debe mostrar errores.
- `doctor` debe aprobar la configuracion de Expo.
- `export:android` genera un bundle Android de prueba en `dist/`.

El proyecto fue validado con:

- `tsc --noEmit`: correcto.
- `expo export --platform android`: bundle generado.
- Prueba funcional en navegador movil emulado: inicio, login, detalle y QR.
- Proxy local contra `/api/health` y `/api/resumen`: `200`.

## 7. Generar un APK instalable

### Opcion recomendada: EAS Build

```powershell
cd mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

La primera vez EAS pedira vincular el proyecto a tu cuenta y creara un
`projectId`. El perfil `preview` de `eas.json` genera un **APK** (no AAB) para
instalarlo directamente. Al terminar, descarga el archivo desde el enlace que
muestra la terminal.

Instalar por USB (con Android Debug Bridge):

```powershell
adb install ruta\al\archivo.apk
```

O copia el APK al telefono y abrelo permitiendo la instalacion de apps de
origen desconocido.

### Opcion local con Android Studio

Requiere Android Studio, Android SDK y un emulador o telefono conectado:

```powershell
cd mobile
npx expo prebuild --platform android
cd android
.\gradlew assembleRelease
```

El APK queda en `android/app/build/outputs/apk/release/`. Para publicar en Play
Store se necesita firmar el APK/AAB con una keystore propia; EAS simplifica ese
proceso.

## 8. Configuracion de la API

La URL se puede definir con una variable publica de Expo:

```powershell
$env:EXPO_PUBLIC_API_URL="https://joinnus-secure-pass2.onrender.com/api"
npx expo start
```

Tambien puedes crear `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://joinnus-secure-pass2.onrender.com/api
```

No guardes secretos en `.env` ni en el repositorio. `EXPO_PUBLIC_*` es visible
para el cliente; solo debe contener una URL publica, nunca claves.

## 9. Seguridad y limites actuales

- La sesion usa un token firmado (HMAC-SHA256) que viaja en
  `Authorization: Bearer`; la contrasena se comprueba contra un hash scrypt en
  el servidor y nunca viaja de vuelta.
- La sesion se guarda con `expo-secure-store` en Android/iOS. En web se usa
  `AsyncStorage` como respaldo de desarrollo.
- El QR lo firma el backend y rota cada 15 segundos; la app no genera secretos.
- El codigo de encargado no se persiste en el telefono.
- El endpoint publico `/api/entradas` del backend actual devuelve datos
  personales de todas las entradas. Es un hallazgo previo del proyecto y debe
  corregirse en el backend antes de considerar la app lista para produccion.
- No se debe usar el usuario demo ni los datos ficticios en un entorno real.
- `QR_SECRET`, `INTERNAL_API_TOKEN` y cualquier clave del backend viven solo en
  el servidor. Nunca deben copiarse a `mobile/.env`, a `EXPO_PUBLIC_*` ni al APK.

## 10. Comandos utiles

```powershell
cd mobile
npm run start          # Expo en red local
npm run start:tunnel   # Expo por tunel
npm run android        # abrir en emulador Android
npm run typecheck      # TypeScript
npm run doctor         # diagnostico de Expo
npm run export:android # bundle Android
npm run build:apk      # APK con EAS (perfil preview)
npm run api:proxy      # proxy local hacia https://localhost:8444
```
