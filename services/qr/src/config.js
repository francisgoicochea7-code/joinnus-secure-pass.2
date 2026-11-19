'use strict';

require('dotenv').config();

const { construirDb } = require('../../shared/db-config');
const { secretoDeEntorno } = require('../../shared/session');

const qrSecret = String(process.env.QR_SECRET || '').trim();
if (qrSecret.length < 16) {
  console.error('[CFG] QR_SECRET ausente o demasiado corto (mínimo 16 caracteres).');
  process.exit(1);
}

module.exports = {
  puerto: Number(process.env.PORT || 3103),
  db: construirDb({
    database: 'qr_db',
    user: 'qr_user',
    opciones: '-c timezone=America/Lima'
  }),
  qrSecret,
  qrTtl: Number(process.env.QR_TTL_SECONDS || 15),
  ticketsServiceUrl: process.env.TICKETS_SERVICE_URL || 'http://localhost:3102',
  internalToken: process.env.INTERNAL_TOKEN || '',
  sessionSecret: secretoDeEntorno(process.env, process.env.INTERNAL_TOKEN),
  demoDni: process.env.DEMO_DNI || '45678945'
};
