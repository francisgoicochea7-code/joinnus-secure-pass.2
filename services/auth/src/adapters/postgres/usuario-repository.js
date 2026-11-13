'use strict';

const { UsuarioRepository } = require('../../ports/usuario-repository');

class PostgresUsuarioRepository extends UsuarioRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async crear({ nombre, dni, correo, telefono }) {
    const { rows } = await this.pool.query(
      `INSERT INTO usuarios (nombre, dni, correo, telefono)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, dni, correo`,
      [nombre, dni, correo, telefono]
    );
    return rows[0];
  }

  async upsert({ nombre, dni, correo }) {
    const { rows } = await this.pool.query(
      `INSERT INTO usuarios (nombre, dni, correo)
       VALUES ($1, $2, $3)
       ON CONFLICT (dni) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             correo = EXCLUDED.correo
       RETURNING id, nombre, dni, correo`,
      [nombre, dni, correo]
    );
    return rows[0];
  }

  async buscarPorDni(dni) {
    const { rows } = await this.pool.query(
      'SELECT id, nombre, dni, correo FROM usuarios WHERE dni = $1 LIMIT 1',
      [dni]
    );
    return rows[0] || null;
  }
}

module.exports = { PostgresUsuarioRepository };
