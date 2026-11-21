'use strict';

require('dotenv').config();

const { construirDb } = require('../../shared/db-config');
const { secretoDeEntorno } = require('../../shared/session');

module.exports = {
  puerto: Number(process.env.PORT || 3101),
  db: construirDb({ database: 'auth_db', user: 'auth_user' }),
  internalToken: process.env.INTERNAL_TOKEN || '',
  sessionSecret: secretoDeEntorno(process.env, process.env.INTERNAL_TOKEN),
  sessionTtl: Number(process.env.SESSION_TTL_SECONDS || 8 * 60 * 60),
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || '',
  publicUrl: process.env.PUBLIC_URL || '',
  demoDni: process.env.DEMO_DNI || '45678945',
  seedSql: process.env.SEED_SQL || ''
};
