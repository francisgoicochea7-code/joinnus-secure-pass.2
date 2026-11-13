'use strict';

const { TokenRepository } = require('../../ports/token-repository');

class PostgresTokenRepository extends TokenRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async buscarPorToken(token) {
    const { rows } = await this.pool.query(
      `SELECT id, entrada_id, codigo, titular_dni, token, nonce, firma, payload,
              expira_en, invalidado, usado_en
         FROM tokens_qr
        WHERE token = $1
        LIMIT 1`,
      [token]
    );
    return rows[0] || null;
  }

  async ultimoPorEntrada(entradaId) {
    const { rows } = await this.pool.query(
      `SELECT id, token, nonce, firma, expira_en
         FROM tokens_qr
        WHERE entrada_id = $1 AND invalidado = 0
        ORDER BY id DESC
        LIMIT 1`,
      [entradaId]
    );
    return rows[0] || null;
  }

  async rotar({ entradaId, codigo, titularDni, token, nonce, firma, payload, expiraEn }) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const previos = await cliente.query(
        `SELECT token
           FROM tokens_qr
          WHERE entrada_id = $1 AND invalidado = 0
          ORDER BY id DESC`,
        [entradaId]
      );

      await cliente.query(
        'UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id = $1 AND invalidado = 0',
        [entradaId]
      );

      const insertado = await cliente.query(
        `INSERT INTO tokens_qr
           (entrada_id, codigo, titular_dni, token, nonce, firma, payload, expira_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [entradaId, codigo, titularDni, token, nonce, firma, payload, expiraEn]
      );

      await cliente.query('COMMIT');
      return {
        id: insertado.rows[0].id,
        tokenAnterior: previos.rows.length ? previos.rows[0].token : null
      };
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async invalidarPorEntrada(entradaId) {
    const { rowCount } = await this.pool.query(
      'UPDATE tokens_qr SET invalidado = 1 WHERE entrada_id = $1 AND invalidado = 0',
      [entradaId]
    );
    return rowCount;
  }

  async marcarUsado(token) {
    await this.pool.query(
      'UPDATE tokens_qr SET usado_en = NOW() WHERE token = $1 AND usado_en IS NULL',
      [token]
    );
  }

  async reiniciar() {
    await this.pool.query('TRUNCATE TABLE tokens_qr RESTART IDENTITY');
    const { rows } = await this.pool.query('SELECT COUNT(*) AS n FROM tokens_qr');
    return Number(rows[0].n || 0);
  }
}

module.exports = { PostgresTokenRepository };
