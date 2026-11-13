# Informe SonarQube — microservicios

**Fecha:** 13/11/2026
**Proyecto:** Joinnus Secure Pass
**Key:** `joinnus-secure-pass`
**Tablero:** <http://localhost:9000/dashboard?id=joinnus-secure-pass>

## Lo que hice

Ejecuté el escáner de SonarQube con los microservicios incluidos en el análisis.
Antes el proyecto sólo miraba `backend`, `frontend`, `api` y `scripts`; ahora
también mira `services`. La prueba de humo de integración quedó como prueba,
no como código de producción.

```powershell
$env:SONAR_TOKEN = (Get-Content .sonar-token -Raw).Trim()
docker compose -f docker-compose.sonar.yml --profile scan run --rm scanner
```

El primer análisis con microservicios falló el quality gate por dos motivos:
4 avisos menores en los Dockerfiles (imágenes corriendo como root) y 5,29 % de
duplicación en código nuevo. No lo dejé así: corregí ambos.

## Resultado final

**Quality gate: OK.**

| Condición | Umbral | Valor | Estado |
|---|---:|---:|---|
| Issues nuevos | 0 | 0 | OK |
| Duplicación en código nuevo | ≤ 3 % | 2,30 % | OK |

### Panorama global del proyecto

| Métrica | Valor |
|---|---:|
| Líneas de código (ncloc) | 8.130 |
| Bugs | 0 |
| Vulnerabilidades | 0 |
| Code smells | 0 |
| Security hotspots abiertos | 0 |
| Issues abiertos | 0 |
| Duplicación global | 4,1 % (536 líneas, 35 bloques) |
| Cobertura | 0,0 % |
| Reliability / Security / Maintainability | A / A / A |

La duplicación global del 4,1 % viene sobre todo de HTML y scripts del frontend
que ya existían antes de esta variante. Lo que importa para el quality gate es
el código nuevo: quedó en **2,30 %**, por debajo del 3 %.

La cobertura sigue en 0 % porque la suite actual es un script propio que no
genera `lcov`. No es una regresión de los microservicios; es una limitación
conocida del proyecto.

## Qué cambié para dejar el gate en verde

1. **Dockerfiles sin root.** Añadí `USER node` a los tres servicios Node y
   `USER nginx` al gateway. El gateway ahora escucha en 8080/8443 dentro del
   contenedor y Docker publica 8082/8444, así no necesita privilegios.
2. **Pool de PostgreSQL compartido.** Moví la creación del pool y los
   `setTypeParser` a `services/shared/pg.js`. Los tres servicios lo reutilizan.
3. **Arranque Express compartido.** Moví el JSON, `request-id`, `/health`,
   `/ready`, 404, middleware de errores y apagado ordenado a
   `services/shared/server.js`. Cada `main.js` sólo declara sus rutas y sus
   dependencias.
4. **Dependencias compartidas.** Los tres servicios usan el mismo
   `services/package.json` (`express`, `pg`, `dotenv`) y lo instalan una vez en
   `/app/services/node_modules`. Así `services/shared` también resuelve los
   módulos.

Con esos cambios la duplicación nueva bajó de 5,29 % a 2,30 % y desaparecieron
los 4 avisos de Docker.

## Lectura honesta

- 0 issues abiertos no significa que el sistema sea perfecto: significa que el
  analizador estático no encontró problemas en las reglas activas.
- La cobertura 0 % es una deuda real. Para mejorarla habría que instrumentar la
  suite o añadir pruebas con cobertura.
- El quality gate compara contra la versión anterior (`1.0.0`). Si se cambia el
  periodo de referencia, las cifras pueden variar.
- El token del escáner está en `.sonar-token`, que está ignorado por git. No se
  commitea.

## Evidencia

- Tablero: <http://localhost:9000/dashboard?id=joinnus-secure-pass>
- Configuración: `sonar-project.properties`
- Comando: `docker compose -f docker-compose.sonar.yml --profile scan run --rm scanner`
