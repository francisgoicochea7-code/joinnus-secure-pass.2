'use strict';

require('dotenv').config();

const { construirDb } = require('../../shared/db-config');

module.exports = {
  puerto: Number(process.env.PORT || 3101),
  db: construirDb({ database: 'auth_db', user: 'auth_user' }),
  internalToken: process.env.INTERNAL_TOKEN || '',
  demoDni: process.env.DEMO_DNI || '45678945',
  seedSql: process.env.SEED_SQL || ''
};
