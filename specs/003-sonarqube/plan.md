# 003 — Plan técnico

## 1. Infraestructura

```
docker-compose.sonar.yml
├── sonar-db      postgres:16-alpine (metadatos de SonarQube)
├── sonarqube     sonarqube:community (26.x), puerto 9000
└── scanner       sonarsource/sonar-scanner-cli (perfil "scan")
```

- Red propia `jsp_sonar_net`.
- Volúmenes `jsp_sonar_*` (se pueden borrar sin afectar la demo).
- `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` para Docker Desktop.

## 2. Configuración del análisis

`sonar-project.properties`:

- `sonar.sources = backend, frontend, api, scripts`
- `sonar.tests = test`
- exclusiones: `node_modules`, `*.min.js`, `vendor`, imágenes,
  `.scannerwork`, `database`, `docs`.

## 3. Flujo

```powershell
docker compose -f docker-compose.sonar.yml up -d
# crear token en http://localhost:9000  (admin → My Account → Security)
$env:SONAR_TOKEN = "…"
docker compose -f docker-compose.sonar.yml --profile scan run --rm scanner
```

## 4. Correcciones previstas

| Hallazgo | Archivo | Acción |
|---|---|---|
| Promesa sin manejar (7) | `staff.js`, `backend/index.js`, `app.js` | `await`, `.catch(...)` o `void` |
| `<select>` sin etiqueta | `historial.html` | `aria-label` |
| `Math.random` (2) | `api.js` | generador criptográfico con respaldo seguro para la demo |
| `isNaN` (6) | `app.js`, `api.js`, `backend/index.js` | `Number.isNaN` / `Number.NaN` |

## 5. Cierre

- Captura del tablero en `docs/sonarqube.png` (además de la copia en el
  escritorio).
- Tabla de resultados en el README.
- Se apaga el contenedor para liberar memoria:

```powershell
docker compose -f docker-compose.sonar.yml stop
```
