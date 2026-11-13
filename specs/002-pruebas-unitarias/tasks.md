# 002 — Tareas

- [x] T1. Exportar las funciones puras al final de `backend/index.js`.
- [x] T2. Crear `test/unit/seguridad.test.js`.
- [x] T3. Crear `test/unit/fechas.test.js`.
- [x] T4. Crear `test/unit/transferencia.test.js`.
- [x] T5. Agregar `test:unit` a `package.json` e incluirlo en `test`.
- [x] T6. Ejecutar `npm run test:unit` y comprobar que no se conecta a la base.
- [x] T7. Ejecutar `npm test` completo.
- [x] T8. Documentar en el README cómo añadir una prueba nueva.

## Resultado

- `npm run test:unit`: **35 pruebas, 0 fallos** en la verificación inicial.
- `npm test`: 756 + 863 comprobaciones y 35 unitarias, 0 fallos en la verificación inicial.
- Las unitarias no abren conexiones: sólo importan ackend/index.js y usan
  module.exports.util.
