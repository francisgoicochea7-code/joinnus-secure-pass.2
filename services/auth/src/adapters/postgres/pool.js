'use strict';

const { crearPool } = require('../../../../shared/pg');
const config = require('../../config');

const pool = crearPool(config, 'auth');

module.exports = { pool };
