-- =========================================================================
--  qr_db — tokens dinámicos
--  entrada_id es una referencia lógica a tickets_db.entradas: no hay FK
--  entre bases. titular_dni permite rechazar tokens de titulares anteriores
--  aunque la invalidación haya fallado.
-- =========================================================================

CREATE TABLE IF NOT EXISTS tokens_qr (
  id          SERIAL PRIMARY KEY,
  entrada_id  INTEGER      NOT NULL,
  codigo      VARCHAR(24)  NOT NULL,
  titular_dni CHAR(8)      NOT NULL,
  token       VARCHAR(64)  NOT NULL,
  nonce       VARCHAR(16)  NOT NULL,
  firma       CHAR(32)     NOT NULL,
  payload     VARCHAR(160) NOT NULL,
  expira_en   TIMESTAMP    NOT NULL,
  invalidado  SMALLINT     NOT NULL DEFAULT 0,
  usado_en    TIMESTAMP    NULL,
  creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tokens_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_tokens_entrada ON tokens_qr (entrada_id);
CREATE INDEX IF NOT EXISTS idx_tokens_titular ON tokens_qr (titular_dni);
