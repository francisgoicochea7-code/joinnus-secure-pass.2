'use strict';

const express = require('express');
const { asyncHandler } = require('../../../../shared/errors');

function crearRutas({
  loginEncargado,
  verificarEncargado,
  crearUsuario,
  upsertUsuario,
  obtenerUsuario,
  demoRepo,
  internalAuth
}) {
  const router = express.Router();

  router.post('/api/encargados/login', asyncHandler(async (req, res) => {
    const resultado = await loginEncargado(req.body || {});
    res.json({ ok: true, ...resultado });
  }));

  router.post('/api/usuarios', asyncHandler(async (req, res) => {
    const usuario = await crearUsuario(req.body || {});
    res.status(201).json({ ok: true, usuario });
  }));

  router.get('/api/usuarios/:dni', asyncHandler(async (req, res) => {
    const usuario = await obtenerUsuario(req.params.dni);
    res.json({ ok: true, usuario });
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
