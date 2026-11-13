# 003 — Análisis estático con SonarQube

- **Estado:** en curso
- **Fecha:** 2026-11-03

## 1. Contexto

El proyecto no tenía análisis estático. Se instaló SonarQube Community en un
compose aparte (`docker-compose.sonar.yml`) para no alterar la demo, y se
ejecutó un primer análisis sobre la versión 1.

## 2. Objetivo

Tener un tablero reproducible que mida bugs, vulnerabilidades, *code smells*,
duplicación y hotspots, y usar sus hallazgos para mejorar el código antes de
la exposición.

## 3. Alcance

**Incluye**

- SonarQube 26.10 Community + PostgreSQL 16 en `docker-compose.sonar.yml`.
- Escáner oficial `sonarsource/sonar-scanner-cli` (sin instalar Java).
- `sonar-project.properties` con inclusiones y exclusiones.
- Análisis de la versión 2 y corrección de los hallazgos reales.
- Captura del tablero y resumen en el README.

**No incluye**

- SonarQube en producción (es una herramienta de desarrollo).
- Cobertura instrumentada (la suite es propia y no genera `lcov`).
- Quality gate obligatorio en CI.

## 4. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | `docker compose -f docker-compose.sonar.yml up -d` levanta el servidor en 9000 |
| RF-2 | El escáner se ejecuta en un contenedor y no necesita Java local |
| RF-3 | El análisis no debe analizar `node_modules`, binarios ni `.scannerwork` |
| RF-4 | Al terminar: 0 bugs, 0 vulnerabilidades y 0 *code smells* abiertos |
| RF-5 | Los hotspots que sean de demo se revisan y justifican, no se ocultan |
| RF-6 | El README explica cómo repetir el análisis |

## 5. Criterios de aceptación

```
Dado el servidor de SonarQube arriba
Cuando ejecuto el escáner con un token válido
Entonces el análisis termina en SUCCESS
Y el tablero muestra 0 bugs y 0 vulnerabilidades
```

```
Dado un `Math.random` en el modo demo del frontend
Cuando SonarQube lo marca
Entonces se reemplaza por una fuente criptográfica (o se justifica si no aplica)
```

## 6. Hallazgos del primer análisis (versión 1)

| Tipo | Cantidad | Detalle |
|---|---|---|
| Bugs | 8 | 7 promesas sin manejar + 1 `<select>` sin etiqueta |
| Vulnerabilidades | 2 | `Math.random` en el modo demo |
| Code smells | 8 | `isNaN` y `NaN` sin `Number.` |
| Duplicación | 3.8 % | |
| Líneas de código | 5 777 | |

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| La imagen consume ~2 GB de RAM | se levanta sólo para analizar y se apaga después |
| Versión LTS 9.9 marcada como obsoleta | se usa la imagen `sonarqube:community` (26.x) |
| El volumen de datos se pierde al recrear | es aceptable: el análisis se repite en 2 minutos |
| Falsos positivos en `innerHTML` | se revisan uno a uno; no se silencian sin justificar |
