'use strict';

const { AppError } = require('../../../../shared/errors');
const { EntradaRepository } = require('../../ports/entrada-repository');

const SELECT_ENTRADA = `
  SELECT e.id, e.codigo, ev.nombre AS evento, ev.fecha, ev.hora, ev.lugar,
         e.zona, e.fila, e.asiento,
         e.titular_id, e.titular_nombre, e.titular_dni, e.titular_correo,
         e.estado, e.precio, e.motivo_anulacion,
         e.qr_ultimo_token, e.qr_anterior_token, e.qr_firma, e.qr_expira_en, e.qr_generado_en,
         e.creado_en, e.transferida_en, e.usada_en, e.anulada_en,
         t.nombre AS titular_anterior, t.dni AS dni_anterior
    FROM entradas e
    JOIN eventos ev ON ev.id = e.evento_id
    LEFT JOIN (
      SELECT te.entrada_id, te.titular_anterior_nombre AS nombre, te.titular_anterior_dni AS dni
        FROM transferencias te
        INNER JOIN (
          SELECT entrada_id, MAX(id) AS ultimo
            FROM transferencias
           GROUP BY entrada_id
        ) u ON u.ultimo = te.id
    ) t ON t.entrada_id = e.id
`;

class PostgresEntradaRepository extends EntradaRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listar() {
    const { rows } = await this.pool.query(`${SELECT_ENTRADA} ORDER BY e.codigo ASC`);
    return rows;
  }

  async obtenerPorCodigo(codigo) {
    const { rows } = await this.pool.query(
      `${SELECT_ENTRADA} WHERE e.codigo = $1 LIMIT 1`,
      [codigo]
    );
    return rows[0] || null;
  }

  async resumen(dni) {
    const { rows } = await this.pool.query(
      `SELECT
         SUM(CASE WHEN estado = 'valido'      THEN 1 ELSE 0 END) AS activas,
         SUM(CASE WHEN estado = 'usado'       THEN 1 ELSE 0 END) AS usadas,
         SUM(CASE WHEN estado = 'transferido' THEN 1 ELSE 0 END) AS transferidas,
         SUM(CASE WHEN estado = 'anulado'     THEN 1 ELSE 0 END) AS anuladas,
         COUNT(*) AS total,
         COUNT(*) AS mias
       FROM entradas
      WHERE titular_dni = $1`,
      [dni]
    );
    return rows[0] || {};
  }

  async contarHistorial(codigo) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) AS n
         FROM historial
        WHERE entrada_id = (SELECT id FROM entradas WHERE codigo = $1)`,
      [codigo]
    );
    return Number(rows[0].n || 0);
  }

  async transferir({
    codigo,
    usuarioNuevoId,
    nombre,
    dni,
    correo,
    precio,
    precioOriginal,
    codigoOperacion
  }) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const actual = await cliente.query(
        'SELECT id, titular_id, titular_nombre, titular_dni FROM entradas WHERE codigo = $1 FOR UPDATE',
        [codigo]
      );

      if (!actual.rows.length) {
        throw new AppError(`La entrada ${codigo} no existe.`, 404, 'ENTRADA_NO_ENCONTRADA');
      }

      const fila = actual.rows[0];

      await cliente.query(
        `UPDATE entradas
            SET titular_id = $1,
                titular_nombre = $2,
                titular_dni = $3,
                titular_correo = $4,
                estado = 'transferido',
                transferida_en = NOW(),
                qr_anterior_token = qr_ultimo_token,
                qr_ultimo_token = NULL,
                qr_firma = NULL,
                qr_expira_en = NULL
          WHERE codigo = $5`,
        [usuarioNuevoId, nombre, dni, correo, codigo]
      );

      await cliente.query(
        `INSERT INTO transferencias
           (entrada_id, titular_anterior_id, titular_anterior_nombre, titular_anterior_dni,
            titular_nuevo_id, titular_nuevo_nombre, titular_nuevo_dni, titular_nuevo_correo,
            precio, precio_original, codigo_operacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          fila.id,
          fila.titular_id,
          fila.titular_nombre,
          fila.titular_dni,
          usuarioNuevoId,
          nombre,
          dni,
          correo,
          precio,
          precioOriginal,
          codigoOperacion
        ]
      );

      await cliente.query(
        `INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado)
         VALUES ($1, 'transferida', $2, $3, 'transferido')`,
        [fila.id, nombre, `${fila.titular_nombre} → ${nombre} · S/ ${precio.toFixed(2)}`]
      );

      await cliente.query('COMMIT');

      return {
        entradaId: fila.id,
        titularAnteriorId: fila.titular_id,
        titularAnterior: fila.titular_nombre,
        dniAnterior: fila.titular_dni
      };
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async actualizarProyeccionQr(codigo, { token, anterior, firma, expiraEn }) {
    const { rowCount } = await this.pool.query(
      `UPDATE entradas
          SET qr_anterior_token = $1,
              qr_ultimo_token = $2,
              qr_firma = $3,
              qr_expira_en = $4,
              qr_generado_en = NOW()
        WHERE codigo = $5`,
      [anterior || null, token, firma, expiraEn, codigo]
    );
    return rowCount;
  }

  async marcarUsada(codigo) {
    const { rowCount } = await this.pool.query(
      `UPDATE entradas
          SET estado = 'usado', usada_en = NOW()
        WHERE codigo = $1 AND estado <> 'usado'`,
      [codigo]
    );
    return rowCount;
  }

  async cambiarEstado(codigo, estado) {
    const columnas = { usado: 'usada_en', anulado: 'anulada_en', valido: 'transferida_en' };
    const columna = columnas[estado];
    if (!columna) {
      throw new AppError(`Estado no permitido: ${estado}`, 400, 'ESTADO_NO_PERMITIDO');
    }

    if (estado === 'valido') {
      await this.pool.query(
        `UPDATE entradas
            SET estado = 'valido',
                transferida_en = NULL,
                qr_ultimo_token = NULL,
                qr_anterior_token = NULL,
                qr_firma = NULL,
                qr_expira_en = NULL
          WHERE codigo = $1`,
        [codigo]
      );
    } else if (estado === 'anulado') {
      await this.pool.query(
        `UPDATE entradas
            SET estado = 'anulado',
                anulada_en = NOW(),
                qr_ultimo_token = NULL,
                qr_anterior_token = NULL,
                qr_firma = NULL,
                qr_expira_en = NULL
          WHERE codigo = $1`,
        [codigo]
      );
    } else {
      await this.pool.query(
        `UPDATE entradas SET estado = $1, ${columna} = NOW() WHERE codigo = $2`,
        [estado, codigo]
      );
    }
  }
}

module.exports = { PostgresEntradaRepository };
