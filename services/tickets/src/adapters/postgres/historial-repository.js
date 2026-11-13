'use strict';

const { HistorialRepository } = require('../../ports/historial-repository');

class PostgresHistorialRepository extends HistorialRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async registrar(codigo, accion, titular, detalle = '', estado = null) {
    const { rowCount } = await this.pool.query(
      `INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado)
       SELECT id, $1, $2, $3, $4
         FROM entradas
        WHERE codigo = $5`,
      [accion, titular, detalle, estado, codigo]
    );
    return rowCount;
  }

  async listarPorDni(dni) {
    const { rows } = await this.pool.query(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h
         JOIN entradas e ON e.id = h.entrada_id
        WHERE e.titular_dni = $1
           OR EXISTS (
                SELECT 1
                  FROM transferencias t
                 WHERE t.entrada_id = e.id
                   AND (t.titular_anterior_dni = $1 OR t.titular_nuevo_dni = $1)
              )
        ORDER BY h.creado_en ASC, h.id ASC`,
      [dni]
    );
    return rows;
  }

  async listarPorEntrada(codigo) {
    const { rows } = await this.pool.query(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h
         JOIN entradas e ON e.id = h.entrada_id
        WHERE e.codigo = $1
        ORDER BY h.creado_en ASC, h.id ASC`,
      [codigo]
    );
    return rows;
  }

  async listarTodo() {
    const { rows } = await this.pool.query(
      `SELECT h.id, e.codigo, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
         FROM historial h
         JOIN entradas e ON e.id = h.entrada_id
        ORDER BY h.creado_en ASC, h.id ASC`
    );
    return rows;
  }
}

module.exports = { PostgresHistorialRepository };
