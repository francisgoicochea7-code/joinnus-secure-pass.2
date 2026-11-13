'use strict';

require('dotenv').config();

const { construirDb } = require('../../shared/db-config');

module.exports = {
  puerto: Number(process.env.PORT || 3102),
  db: construirDb({
    database: 'tickets_db',
    user: 'tickets_user',
    opciones: '-c timezone=America/Lima'
  }),
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3101',
  qrServiceUrl: process.env.QR_SERVICE_URL || 'http://localhost:3103',
  internalToken: process.env.INTERNAL_TOKEN || '',
  demoDni: process.env.DEMO_DNI || '45678945',
  seedSql: process.env.SEED_SQL || ''
};
