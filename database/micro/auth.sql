-- =========================================================================
--  auth_db — usuarios y encargados
-- =========================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  dni           CHAR(8)      NOT NULL,
  correo        VARCHAR(160) NOT NULL,
  telefono      VARCHAR(30)  NULL,
  -- scrypt$N$r$p$sal$hash (sal aleatoria por usuario). Nunca se guarda la
  -- contraseña en claro. Las cuentas antiguas sin contraseña se migran al
  -- arrancar auth-service (sólo para los DNI de demostración).
  password_hash TEXT         NULL,
  activacion_hash TEXT       NULL,
  activacion_expira_en TIMESTAMPTZ NULL,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- Contraseñas de demostración (ficticias, sólo para la maqueta):
--   45678945 Carlos2026! · 52311878 Andrea2026! · 40125678 Luis2026!
--   47258963 Diego2026!  · 43871264 Maria2026!  · 39521478 Renato2026!
INSERT INTO usuarios (nombre, dni, correo, telefono, password_hash) VALUES
  ('Carlos Pérez',  '45678945', 'carlos.perez@demo.pe',  '900111222', 'scrypt$16384$8$1$MLkhByupLKVhaC8a08NyHw$tZt0xqQKM8Q9xtknOz85UDxp2RTQNZWwAwuVbYyTSSNBk8UZkGajtAL3UvDd_2ighImAPxzs7LzwrIdSzX494A'),
  ('Andrea Torres', '52311878', 'andrea.torres@demo.pe', '900222333', 'scrypt$16384$8$1$RP9eyhelXIKs-irSmD9zkA$8M-44wT6SPz6rnoukju93TMdEeXWUiH01k3tQ4HyBn4xncHOK4kcwVA1eFWFWwUpIeHkv-lXk9lYxsFYuEzyDg'),
  ('Luis Ramírez',  '40125678', 'luis.ramirez@demo.pe',  '900333444', 'scrypt$16384$8$1$iNpiKEjohgs739e6bkzwWQ$kxrww3jeQfyKHKAGYLVun3Am0ykngleDo8SULkL671ANv-FI9OTGNpijHJd9SOjg3_G3so6KEiI4SSzcdfVDNA'),
  ('Diego Vargas',  '47258963', 'diego.vargas@demo.pe',  '900444555', 'scrypt$16384$8$1$ngaorYEIYo-CT4HA-kWWkA$7p-gIjQDn8m_j3lHHllJPzsUD-MeVsr40pMXwJDFRB7FXfuDQ4WcNGFxFc0HAkVw8gbhNj4YCq_iXvLhuCAjqQ'),
  ('María Torres',  '43871264', 'maria.torres@demo.pe',  '900555666', 'scrypt$16384$8$1$-e8Rn5eU-B5YFOpaQLGiAg$uPu1PYufQJIXYGG8HCOmxwN4XYmkEmowXo6hYLYqHEIeKi9m2fJomLZIxKyeX1U0qveL8JoFtJSwt4kr293YLA'),
  ('Renato Silva',  '39521478', 'renato.silva@demo.pe',  '900666777', 'scrypt$16384$8$1$dcSIByvRfRAD8sDPvmsYuA$_iLVByn-z7fME3F5FOUF2ZUG3uwmLVBR-SqDz2aMcltX_imbqWhFUdTa7LaUbqT70HY5W1NlmfdO9vBbDr35zQ')
ON CONFLICT (dni) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  correo = EXCLUDED.correo,
  -- Al reiniciar la demo se restauran también las contraseñas de ejemplo.
  password_hash = EXCLUDED.password_hash;

INSERT INTO encargados (nombre, codigo_hash, activo) VALUES
  ('Ana Torres',   '05d26f322c3fa365dd96e0621e98f86a7b91b3ba1b4a11f9cec8272041414083', 1),
  ('Luis Paredes', '0e1a8938b8da063e695a1a93c11eb3c61fbf78788269d0689f5b96fabd5df65b', 1)
ON CONFLICT (nombre) DO UPDATE SET
  codigo_hash = EXCLUDED.codigo_hash,
  activo = EXCLUDED.activo;
