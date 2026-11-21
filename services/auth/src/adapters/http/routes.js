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
  enviarActivacion,
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

  // Respuesta indistinguible para DNIs inexistentes, activos o pendientes.
  // Solo se envía al correo ya almacenado; el SQL limita a 1 envío/20 min.
  router.post('/api/usuarios/solicitar-activacion', asyncHandler(async (req, res) => {
    const dni = String(req.body?.dni || '');
    if (/^\d{8}$/.test(dni)) await enviarActivacion(dni);
    res.set('Cache-Control', 'no-store').json({ ok: true,
      mensaje: 'Si tu cuenta está pendiente y el correo está habilitado, recibirás un enlace en el correo registrado. Revisa también spam.' });
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

  // Solo tickets-service puede pedir este correo después de transferir la
  // entrada. No se expone una ruta pública para emitir códigos arbitrarios.
  router.post('/internal/v1/usuarios/avisar-transferencia', internalAuth, asyncHandler(async (req, res) => {
    const dni = String(req.body?.dni || '');
    if (!/^\d{8}$/.test(dni)) throw new AppError('DNI inválido.', 400, 'DNI_INVALIDO');
    res.set('Cache-Control', 'no-store').json({ ok: true, activacionCorreo: await enviarActivacion(dni) });
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
