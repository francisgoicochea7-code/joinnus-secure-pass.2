-- =========================================================================
--  auth_db — usuarios y encargados
-- =========================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  dni         CHAR(8)      NOT NULL,
  correo      VARCHAR(160) NOT NULL,
  telefono    VARCHAR(30)  NULL,
  creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_dni UNIQUE (dni)
);

-- Personal autorizado para validar entradas en la puerta.
-- El código NUNCA se guarda en claro: SHA-256("nombre:codigo").
CREATE TABLE IF NOT EXISTS encargados (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  codigo_hash CHAR(64)     NOT NULL,
  activo      SMALLINT     NOT NULL DEFAULT 1,
  creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_encargados_nombre UNIQUE (nombre),
  CONSTRAINT uq_encargados_codigo UNIQUE (codigo_hash)
);

INSERT INTO usuarios (nombre, dni, correo, telefono) VALUES
  ('Carlos Pérez',  '45678945', 'carlos.perez@demo.pe',  '900111222'),
  ('Andrea Torres', '52311878', 'andrea.torres@demo.pe', '900222333'),
  ('Luis Ramírez',  '40125678', 'luis.ramirez@demo.pe',  '900333444'),
  ('Diego Vargas',  '47258963', 'diego.vargas@demo.pe',  '900444555'),
  ('María Torres',  '43871264', 'maria.torres@demo.pe',  '900555666'),
  ('Renato Silva',  '39521478', 'renato.silva@demo.pe',  '900666777')
ON CONFLICT (dni) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  correo = EXCLUDED.correo;

INSERT INTO encargados (nombre, codigo_hash, activo) VALUES
  ('Ana Torres',   '05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083', 1),
  ('Luis Paredes', '0e1a8938b8da063e695a1a93c11eb3c61fbf78788269d0689f5b96fabd5df65b', 1)
ON CONFLICT (nombre) DO UPDATE SET
  codigo_hash = EXCLUDED.codigo_hash,
  activo = EXCLUDED.activo;
