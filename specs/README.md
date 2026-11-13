# Especificaciones — metodología SDD

Este repositorio (versión **2**) se trabaja con **Spec-Driven Development**
(SDD): primero se escribe *qué* debe hacer el sistema y *cómo se va a
comprobar*; recién después se escribe el código.

## Flujo de trabajo

```
spec.md  →  plan.md  →  tasks.md  →  código  →  verificación
 (qué)      (cómo)       (pasos)                  (pruebas)
```

1. **spec.md** — problema, alcance, requisitos y criterios de aceptación.
2. **plan.md** — decisiones técnicas, archivos que se tocan y riesgos.
3. **tasks.md** — lista ordenada y marcable de pasos.
4. **Código** — se implementa sólo lo que dice la especificación.
5. **Verificación** — `npm test` + comprobaciones manuales del criterio.

## Estados

| Estado | Significado |
|---|---|
| `borrador` | se está escribiendo, todavía no se implementa |
| `aprobado` | el usuario dio el visto bueno; se puede implementar |
| `en curso` | hay código escrito, faltan verificaciones |
| `hecho` | criterios de aceptación cumplidos y pruebas en verde |

## Reglas

- Una carpeta por mejora: `specs/NNN-nombre/`.
- Todo criterio de aceptación debe poder verificarse (prueba, comando o
  revisión concreta). Nada de "debe funcionar bien".
- Si el alcance cambia durante la implementación, se anota en `spec.md`
  (sección *Cambios de alcance*) y se vuelve a aprobar.
- La documentación de diseño vive en `docs/DISENO.md` (visión general,
  modelo de datos y decisiones de arquitectura).

## Índice

| Carpeta | Mejora | Estado |
|---|---|---|
| `001-postgresql/` | Migrar la base de datos de MySQL a PostgreSQL (local) | hecho |
| `002-pruebas-unitarias/` | Pruebas unitarias con `node:test` | hecho |
| `003-sonarqube/` | Análisis estático con SonarQube | hecho |
