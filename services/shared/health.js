'use strict';

/** Monta /health y /ready en una app Express o router. */
function montarHealth(app, { servicio, pool }) {
  app.get('/health', (req, res) => {
    res.json({ ok: true, servicio, hora: new Date().toISOString() });
  });

  app.get('/ready', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, servicio, baseDatos: 'conectada' });
    } catch {
      res.status(503).json({ ok: false, servicio, baseDatos: 'sin conexion' });
    }
  });
}

module.exports = { montarHealth };
