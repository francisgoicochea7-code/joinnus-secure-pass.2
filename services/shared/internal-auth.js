'use strict';

/** Middleware para endpoints internos: exige el token compartido. */
function internalAuth(token) {
  return (req, res, next) => {
    const recibido = req.get('X-Internal-Token');
    if (!token || recibido !== token) {
      return res.status(401).json({
        ok: false,
        error: 'Token interno inválido.',
        codigo: 'INTERNO_NO_AUTORIZADO',
        requestId: req.id
      });
    }
    return next();
  };
}

module.exports = { internalAuth };
