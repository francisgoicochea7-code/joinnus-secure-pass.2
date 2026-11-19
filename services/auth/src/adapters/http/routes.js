'use strict';

const express = require('express');
const { AppError, asyncHandler } = require('../../../../shared/errors');
const { requerirDniDeSesion } = require('../../../../shared/validaciones');

function crearRutas({
  loginEncargado,
  verificarEncargado,
  crearUsuario,
  upsertUsuario,
  obtenerUsuario,
  loginUsuario,
  activarUsuario,
  sessionSecret,
  demoRepo,
  internalAuth
}) {
  const router = express.Router();

  router.post('/api/encargados/login', asyncHandler(async (req, res) => {
    const resultado = await loginEncargado(req.body || {});
    res.json({ ok: true, ...resultado });
  }));

  /* Inicio de sesión de una persona (DNI + contraseña). Devuelve un token
   * firmado que el resto de servicios verifican; nunca devuelve el hash. */
  router.post('/api/usuarios/login', asyncHandler(async (req, res) => {
    const resultado = await loginUsuario(req.body || {});
    res.json({ ok: true, ...resultado });
  }));

  router.post('/api/usuarios', asyncHandler(async (req, res) => {
    const usuario = await crearUsuario(req.body || {});
    res.status(201).json({ ok: true, usuario });
  }));

  router.post('/api/usuarios/activar', asyncHandler(async (req, res) => {
    await activarUsuario(req.body || {});
    res.set('Cache-Control', 'no-store').json({ ok: true });
  }));

  router.get('/api/usuarios/:dni', asyncHandler(async (req, res) => {
    const dni = requerirDniDeSesion(req, sessionSecret);
    if (dni !== req.params.dni) {
      throw new AppError('Solo puedes consultar tu propio perfil.', 403, 'PERFIL_AJENO');
    }
    const usuario = await obtenerUsuario(dni);
    res.set('Cache-Control', 'no-store').json({ ok: true, usuario });
  }));

  router.post('/internal/v1/usuarios/upsert', internalAuth, asyncHandler(async (req, res) => {
    const usuario = await upsertUsuario(req.body || {});
    res.json({ ok: true, usuario });
  }));

  router.post('/internal/v1/encargados/verificar', internalAuth, asyncHandler(async (req, res) => {
    const encargado = await verificarEncargado(req.body || {});
    res.json({ ok: true, encargado });
  }));

  router.get('/internal/v1/usuarios/:dni', internalAuth, asyncHandler(async (req, res) => {
    const usuario = await obtenerUsuario(req.params.dni);
    res.json({ ok: true, usuario });
  }));

  router.post('/internal/v1/demo/reiniciar', internalAuth, asyncHandler(async (req, res) => {
    const usuarios = await demoRepo.reiniciar();
    res.json({ ok: true, usuarios });
  }));

  return router;
}

module.exports = { crearRutas };
