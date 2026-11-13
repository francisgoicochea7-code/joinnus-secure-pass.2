'use strict';

const { EncargadoRepository } = require('../../ports/encargado-repository');

class PostgresEncargadoRepository extends EncargadoRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async buscarPorHash(hash) {
    const { rows } = await this.pool.query(
      'SELECT id, nombre FROM encargados WHERE codigo_hash = $1 AND activo = 1 LIMIT 1',
      [hash]
    );
    return rows[0] || null;
  }
}

module.exports = { PostgresEncargadoRepository };
