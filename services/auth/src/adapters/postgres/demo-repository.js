'use strict';

const fs = require('fs');
const { AppError } = require('../../../../shared/errors');

class PostgresDemoRepository {
  constructor(pool, seedPath) {
    this.pool = pool;
    this.seedPath = seedPath;
  }

  async reiniciar() {
    await this.pool.query('TRUNCATE TABLE usuarios, encargados RESTART IDENTITY CASCADE');

    if (!this.seedPath || !fs.existsSync(this.seedPath)) {
      throw new AppError('No se encontró el archivo de semilla de auth.', 500, 'SEMILLA_NO_ENCONTRADA');
    }

    await this.pool.query(fs.readFileSync(this.seedPath, 'utf8'));

    const { rows } = await this.pool.query('SELECT COUNT(*) AS n FROM usuarios');
    return Number(rows[0].n || 0);
  }
}

module.exports = { PostgresDemoRepository };
