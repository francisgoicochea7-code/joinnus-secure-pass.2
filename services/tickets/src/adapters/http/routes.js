'use strict';

const express = require('express');
const { AppError, asyncHandler } = require('../../../../shared/errors');
const { dniDePeticion, requerirDniDeSesion } = require('../../../../shared/validaciones');
const { enriquecer, datosInternos } = require('../../domain/entrada');

function crearRutas({
  config,
  consultas,
  transferirEntrada,
  validarPuerta,
  cambiarEstado,
  reiniciarDemo,
  entradaRepo,
  historialRepo,
  demoRepo,
  internalAuth
}) {
  const router = express.Router();

  /* --------------------------------------------------------------------
   * Consultas
   * ------------------------------------------------------------------ */
  router.get('/api/resumen', asyncHandler(async (req, res) => {
    const dni = dniDePeticion(req, config.demoDni, config.sessionSecret);
    const resumen = await consultas.resumen(dni);
    res.json({ ok: true, resumen });
  }));

  router.get('/api/entradas', asyncHandler(async (req, res) => {
    const dni = dniDePeticion(req, null, config.sessionSecret);
    const entradas = await consultas.listar(dni);
    res.json({ ok: true, entradas });
  }));

  router.get('/api/entradas/:codigo', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const dni = dniDePeticion(req, null, config.sessionSecret);
    const entrada = await consultas.obtener(codigo, dni);
    res.json({ ok: true, entrada });
  }));

  router.get('/api/verificar/:codigo', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const dni = dniDePeticion(req, null, config.sessionSecret);
    const resultado = await consultas.verificar(codigo, dni);
    res.json({ ok: true, ...resultado });
  }));

  router.get('/api/historial', asyncHandler(async (req, res) => {
    const dni = String(req.query.dni || '').trim();
    const historial = await consultas.historial(/^\d{8}$/.test(dni) ? dni : '');
    res.json({ ok: true, historial });
  }));

  router.get('/api/entradas/:codigo/historial', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const historial = await consultas.historialEntrada(codigo);
    res.json({ ok: true, historial });
  }));

  /* --------------------------------------------------------------------
   * Escrituras
   * ------------------------------------------------------------------ */
  router.post('/api/entradas/:codigo/transferir', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const dni = requerirDniDeSesion(req, config.sessionSecret);
    const resultado = await transferirEntrada({
      codigo,
      datos: req.body || {},
      dniSolicitante: dni,
      requestId: req.id
    });
    res.json({ ok: true, ...resultado });
  }));

  router.post('/api/entradas/:codigo/estado/:estado', asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const estado = String(req.params.estado).toLowerCase();
    const dni = requerirDniDeSesion(req, config.sessionSecret);
    const entrada = await cambiarEstado({
      codigo,
      estado,
      dni,
      requestId: req.id
    });
    res.json({ ok: true, entrada });
  }));

  router.post('/api/encargados/validar', asyncHandler(async (req, res) => {
    const resultado = await validarPuerta({
      datos: req.body || {},
      requestId: req.id
    });

    if (resultado.valido === false) {
      return res.json({ ok: false, ...resultado });
    }
    return res.json({ ok: true, ...resultado });
  }));

  router.post('/api/demo/reiniciar', asyncHandler(async (req, res) => {
    const resultado = await reiniciarDemo(req.id);
    res.json({ ok: true, ...resultado });
  }));

  /* --------------------------------------------------------------------
   * Internos
   * ------------------------------------------------------------------ */
  router.get('/internal/v1/entradas/:codigo', internalAuth, asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const dni = String(req.get('X-Usuario-DNI') || '').trim();
    const esDni = /^\d{8}$/.test(dni) ? dni : null;
    const fila = await entradaRepo.obtenerPorCodigo(codigo);
    if (!fila) {
      throw new AppError(`La entrada ${codigo} no existe.`, 404, 'ENTRADA_NO_ENCONTRADA');
    }

    res.json({
      ok: true,
      entrada: enriquecer(fila, esDni),
      datos: datosInternos(fila)
    });
  }));

  router.post('/internal/v1/entradas/:codigo/usar', internalAuth, asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const fila = await entradaRepo.obtenerPorCodigo(codigo);
    if (!fila) {
      throw new AppError(`La entrada ${codigo} no existe.`, 404, 'ENTRADA_NO_ENCONTRADA');
    }

    await entradaRepo.marcarUsada(codigo);
    await historialRepo.registrar(
      codigo,
      'usada',
      fila.titular_nombre,
      'Ingreso registrado en el evento',
      'usado'
    );

    const actualizada = await entradaRepo.obtenerPorCodigo(codigo);
    res.json({
      ok: true,
      entrada: enriquecer(actualizada, null)
    });
  }));

  router.patch('/internal/v1/entradas/:codigo/qr', internalAuth, asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const { token, anterior, firma, expiraEn } = req.body || {};
    if (!token || !firma || !expiraEn) {
      throw new AppError('Faltan token, firma o expiraEn.', 400, 'DATOS_INCOMPLETOS');
    }

    await entradaRepo.actualizarProyeccionQr(codigo, {
      token,
      anterior,
      firma,
      expiraEn
    });

    res.json({ ok: true });
  }));

  router.post('/internal/v1/entradas/:codigo/historial', internalAuth, asyncHandler(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const { accion, titular, detalle, estado } = req.body || {};
    if (!accion) {
      throw new AppError('Falta accion.', 400, 'DATOS_INCOMPLETOS');
    }

    await historialRepo.registrar(
      codigo,
      accion,
      titular || '-',
      detalle || '',
      estado || null
    );

    res.json({ ok: true });
  }));

  router.post('/internal/v1/demo/reiniciar', internalAuth, asyncHandler(async (req, res) => {
    const entradas = await demoRepo.reiniciar();
    res.json({ ok: true, entradas });
  }));

  return router;
}

module.exports = { crearRutas };
