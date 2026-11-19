'use strict';

const { pool } = require('./adapters/postgres/pool');
const { ejecutarEmision } = require('../../../backend/emitir-activacion');

ejecutarEmision(pool, process.argv[2]);
