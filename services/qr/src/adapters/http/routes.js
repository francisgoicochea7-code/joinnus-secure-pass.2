'use strict';

const express = require('express');
const { AppError, asyncHandler } = require('../../../../shared/errors');
const { requerirDniDeSesion } = require('../../../../shared/validaciones');
const { extraerToken } = require('../../domain/qr');

function crearRutas({
  config,
  logger,
  internalAuth,
  rotarToken,
  validarToken,
  invalidarTokens,
  marcarUsado,
  reiniciarDemo,
  ticketsClient
}) {
  const router = express.Router();

  async function obtenerDatosEntrada(codigo, requestId, dni) {
    const respuesta = await ticketsClient.obtenerEntrada(codigo, requestId, dni);
    if (!respuesta || !respuesta.datos) {
      throw new AppError(`La entrada ${codigo} no existe.`, 404, 'ENTRADA_NO_ENCONTRADA');
    }
    return respuesta;
  }

  /* --------------------------------------------------------------------
   * Público: generar un QR para la entrada del titular.
   * ------------------------------------------------------------------ */
  router.post('/api/entradas/:codigo/qr', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const dni = requerirDniDeSesion(req, config.sessionSecret);
    const respuesta = await obtenerDatosEntrada(codigo, req.id, dni);
    const datos = respuesta.datos;

    if (datos.titular_dni !== dni) {
      throw new AppError(
        `La entrada ${codigo} pertenece a otra persona: sólo su titular puede generar su QR.`,
        403,
        'NO_ES_TUYA',
        { motivo: 'no-es-tuya', esMia: false }
      );
    }

    if (datos.estado === 'usado' || datos.estado === 'anulado') {
      throw new AppError(
        `Una entrada en estado "${datos.estado}" no emite nuevos códigos QR.`,
        409,
        'ESTADO_INVALIDO'
      );
    }

    const rotado = await rotarToken({
      codigo,
      entradaId: datos.id,
      titularDni: datos.titular_dni,
      secret: config.qrSecret,
      ttlSegundos: config.qrTtl
    });

    // La proyección en tickets_db es una caché para el frontend. Si falla,
    // el token ya existe en qr_db y sigue siendo válido.
    try {
      await ticketsClient.actualizarProyeccionQr(codigo, {
        token: rotado.token,
        anterior: rotado.tokenAnterior,
        firma: rotado.firma,
        expiraEn: rotado.expiraEn,
        generadoEn: new Date()
      }, req.id);
    } catch (err) {
      logger.warn('proyeccion_qr_fallo', { codigo, error: err.message });
    }

    if (String(req.query.log ?? '1') !== '0') {
      try {
        await ticketsClient.registrarHistorial(codigo, {
          accion: 'qr',
          titular: datos.titular_nombre,
          detalle: rotado.tokenAnterior
            ? `Nuevo QR generado (se invalidó ${rotado.tokenAnterior})`
            : 'Nuevo QR generado',
          estado: datos.estado
        }, req.id);
      } catch (err) {
        logger.warn('historial_qr_fallo', { codigo, error: err.message });
      }
    }

    const actualizada = await ticketsClient.obtenerEntrada(codigo, req.id, dni);

    res.json({
      ok: true,
      codigo,
      token: rotado.token,
      tokenAnterior: rotado.tokenAnterior,
      payload: rotado.payload,
      expiraEn: rotado.expiraEn,
      ttl: config.qrTtl,
      id: rotado.id,
      entrada: actualizada.entrada
    });
  }));

  /* --------------------------------------------------------------------
   * Público: validar un token sin registrar ingreso.
   * ------------------------------------------------------------------ */
  router.post('/api/qr/validar', asyncHandler(async (req, res) => {
    const token = extraerToken((req.body && (req.body.token || req.body.payload)) || '');
    if (!token) {
      throw new AppError('Token de QR con formato inválido.', 400, 'TOKEN_INVALIDO');
    }

    const evaluacion = await validarToken({
      token,
      secret: config.qrSecret,
      ttlSegundos: config.qrTtl
    });

    if (!evaluacion.valido) {
      return res.json({
        ok: false,
        valido: false,
        motivo: evaluacion.motivo,
        error: evaluacion.mensaje,
        mensaje: evaluacion.mensaje
      });
    }

    let respuesta;
    try {
      respuesta = await ticketsClient.obtenerEntrada(evaluacion.codigo, req.id);
    } catch (err) {
      if (err.status === 404) {
        return res.json({
          ok: false,
          valido: false,
          motivo: 'desconocido',
          error: 'El código QR no pertenece a ninguna entrada emitida.',
          mensaje: 'El código QR no pertenece a ninguna entrada emitida.'
        });
      }
      throw err;
    }

    const datos = respuesta.datos;
    if (datos.estado === 'usado') {
      return res.json({ ok: false, valido: false, motivo: 'usada', error: 'La entrada ya fue utilizada para ingresar al evento.', mensaje: 'La entrada ya fue utilizada para ingresar al evento.' });
    }
    if (datos.estado === 'anulado') {
      return res.json({ ok: false, valido: false, motivo: 'anulada', error: 'La entrada está anulada.', mensaje: 'La entrada está anulada.' });
    }
    if (datos.titular_dni !== evaluacion.titularDni) {
      return res.json({ ok: false, valido: false, motivo: 'titular', error: 'El token pertenece a un titular anterior.', mensaje: 'El token pertenece a un titular anterior.' });
    }

    return res.json({
      ok: true,
      valido: true,
      motivo: 'ok',
      codigo: evaluacion.codigo,
      titular: datos.titular_nombre,
      expiraEn: evaluacion.expiraEn,
      mensaje: 'Token vigente: acceso permitido.'
    });
  }));

  /* --------------------------------------------------------------------
   * Interno: rotar, validar, invalidar y marcar usado.
   * ------------------------------------------------------------------ */
  router.post('/internal/v1/qr/rotar', internalAuth, asyncHandler(async (req, res) => {
    const { codigo, entradaId, titularDni } = req.body || {};
    if (!codigo || !entradaId || !titularDni) {
      throw new AppError('Faltan codigo, entradaId o titularDni.', 400, 'DATOS_INCOMPLETOS');
    }

    const rotado = await rotarToken({
      codigo,
      entradaId,
      titularDni,
      secret: config.qrSecret,
      ttlSegundos: config.qrTtl
    });

    res.json({ ok: true, ...rotado });
  }));

  router.post('/internal/v1/qr/validar', internalAuth, asyncHandler(async (req, res) => {
    const token = extraerToken((req.body && (req.body.token || req.body.payload)) || '');
    if (!token) {
      throw new AppError('Token de QR con formato inválido.', 400, 'TOKEN_INVALIDO');
    }

    const evaluacion = await validarToken({
      token,
      secret: config.qrSecret,
      ttlSegundos: config.qrTtl
    });

    res.json({ ok: true, ...evaluacion });
  }));

  router.post('/internal/v1/qr/invalidar', internalAuth, asyncHandler(async (req, res) => {
    const { entradaId } = req.body || {};
    if (!entradaId) {
      throw new AppError('Falta entradaId.', 400, 'DATOS_INCOMPLETOS');
    }

    const resultado = await invalidarTokens({ entradaId });
    res.json({ ok: true, ...resultado });
  }));

  router.post('/internal/v1/qr/marcar-usado', internalAuth, asyncHandler(async (req, res) => {
    const token = extraerToken((req.body && (req.body.token || req.body.payload)) || '');
    if (!token) {
      throw new AppError('Token de QR con formato inválido.', 400, 'TOKEN_INVALIDO');
    }

    const resultado = await marcarUsado({ token });
    res.json({ ok: true, ...resultado });
  }));

  router.post('/internal/v1/demo/reiniciar', internalAuth, asyncHandler(async (req, res) => {
    const resultado = await reiniciarDemo();
    res.json({ ok: true, ...resultado });
  }));

  return router;
}

module.exports = { crearRutas };
