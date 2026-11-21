'use strict';

const { UsuarioRepository } = require('../../ports/usuario-repository');
const { consumirCodigoActivacion, emitirCodigoActivacion } = require('../../../../../backend/activacion');
const { AppError } = require('../../../../shared/errors');

class PostgresUsuarioRepository extends UsuarioRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async crear({ nombre, dni, correo, telefono, password_hash }) {
    const { rows } = await this.pool.query(
      `INSERT INTO usuarios (nombre, dni, correo, telefono, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, dni, correo`,
      [nombre, dni, correo, telefono, password_hash]
    );
    return rows[0];
  }

  async upsert({ nombre, dni, correo }) {
    const { rows } = await this.pool.query(
      `INSERT INTO usuarios (nombre, dni, correo)
       VALUES ($1, $2, $3)
       ON CONFLICT (dni) DO NOTHING
       RETURNING id, nombre, dni, correo`,
      [nombre, dni, correo]
    );
    if (rows.length) return rows[0];

    const existente = await this.pool.query(
      'SELECT id, nombre, dni, correo, password_hash FROM usuarios WHERE dni = $1',
      [dni]
    );
    const usuario = existente.rows[0];
    // No permita enviar un enlace a un correo distinto del registrado para
    // este DNI: tampoco se modifican perfiles existentes durante el upsert.
    if (usuario.correo.toLowerCase() !== correo.toLowerCase()) {
      throw new AppError('El correo no coincide con el perfil existente del destinatario.', 409, 'CORREO_DESTINATARIO_NO_COINCIDE');
    }
    const { password_hash, ...publico } = usuario;
    return publico;
  }

  async emitirActivacion(dni) {
    const { rows } = await this.pool.query(
      'SELECT correo FROM usuarios WHERE dni = $1 AND password_hash IS NULL', [dni]
    );
    if (!rows.length) return null;
    const codigo = await emitirCodigoActivacion(this.pool, dni);
    return codigo && { ...codigo, correo: rows[0].correo };
  }

  async activar(datos) {
    return consumirCodigoActivacion(this.pool, datos);
  }

  /** Uso interno: incluye el hash para poder comprobar la contraseña. */
  async buscarPorDni(dni) {
    const { rows } = await this.pool.query(
      'SELECT id, nombre, dni, correo, password_hash FROM usuarios WHERE dni = $1 LIMIT 1',
      [dni]
    );
    return rows[0] || null;
  }
}

module.exports = { PostgresUsuarioRepository };
