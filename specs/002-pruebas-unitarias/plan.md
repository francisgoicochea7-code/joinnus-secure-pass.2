# 002 — Plan técnico

## 1. Estructura

```
test/
  unit/
    seguridad.test.js      ocultarDNI, hashEncargado, firma de tokens
    fechas.test.js         fechaCorta, formatos
    transferencia.test.js  validaciones de la transferencia
```

## 2. Cómo se prueban funciones de `backend/index.js`

El archivo ya exporta la app, pero al cargarse exige `QR_SECRET` y crea el
Pool. Solución sin tocar la lógica:

1. Al final del archivo se añade:

```js
module.exports.util = { ocultarDNI, fechaCorta, hashEncargado, firmar, validarFirma, validarTransferencia };
```

   (la propiedad `util` no afecta a Express: `app` sigue siendo invocable).

2. Cada archivo de prueba hace:

```js
process.env.QR_SECRET = 'secreto-de-pruebas-con-mas-de-16-caracteres';
const { util } = require('../../backend/index');
```

3. No se llama a `listen()` porque `require.main !== module`.

## 3. Casos previstos

### seguridad.test.js
- `ocultarDNI('45678945')` oculta el centro y conserva la longitud.
- DNI vacío o inválido devuelve el valor de reserva.
- `hashEncargado('Ana Torres', 'ANA2026')` = hash de la semilla.
- `hashEncargado` distingue mayúsculas del código y minúsculas del nombre.
- `firmar` + `validarFirma`: ida y vuelta válida.
- Token alterado: inválido.
- Token expirado: inválido.

### fechas.test.js
- `fechaCorta(new Date(2026, 8, 29))` → `2026-09-29`.
- `fechaCorta('2026-09-29T10:00:00')` → `2026-09-29`.
- Valor nulo no rompe.

### transferencia.test.js
- Nombre vacío, DNI de 7 dígitos, correo sin `@`, precio vacío, precio
  negativo, precio mayor al original.
- Caso válido: `ok: true`.
- El límite permitido (`precio_maximo`) se respeta.

## 4. Scripts

```json
"test:unit": "node --test test/unit",
"test": "node test/qr-selftest.js && node test/verificacion.js && node --test test/unit"
```

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| `node --test` en versiones viejas de Node | el proyecto exige Node ≥ 18 y `engines` ya lo declara |
| Salida distinta en Windows | se usa `node --test` (compatible desde 18.13) |
| Cargar el backend ralentiza | se mide: debe ser < 5 s |
