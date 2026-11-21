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
    const existente = await this.pool.query(
      'SELECT id, nombre, dni, correo, password_hash FROM usuarios WHERE dni = $1',
      [dni]
    );
    const usuario = existente.rows[0];
    if (!usuario || !usuario.password_hash) {
      throw new AppError('El destinatario debe registrarse e iniciar sesión antes de recibir una entrada. Si ya figura su DNI sin contraseña, necesita activar su cuenta.',
        409, 'DESTINATARIO_SIN_CUENTA_ACTIVA');
    }
    // Estos datos solo ayudan a evitar errores al elegir la cuenta; NO
    // verifican que el DNI pertenezca realmente a quien se registró.
    if (usuario.correo.toLowerCase() !== correo.toLowerCase()) {
      throw new AppError('El correo no coincide con el perfil existente del destinatario.', 409, 'CORREO_DESTINATARIO_NO_COINCIDE');
    }
    const normalizarNombre = valor => String(valor).trim().replace(/\s+/g, ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalizarNombre(usuario.nombre) !== normalizarNombre(nombre)) {
      throw new AppError('El nombre no coincide con el perfil existente del destinatario.', 409, 'NOMBRE_DESTINATARIO_NO_COINCIDE');
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
