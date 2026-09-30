-- =========================================================================
--  JOINNUS SECURE PASS — database/init.sql
-- -------------------------------------------------------------------------
--  Esquema y datos ficticios de demostracion.
--  Se ejecuta automaticamente la primera vez que arranca el contenedor MySQL
--  (montado en /docker-entrypoint-initdb.d).
--
--  IMPORTANTE: todos los nombres, DNI, correos y eventos son FICTICIOS.
-- =========================================================================

-- =========================================================================
-- IMPORTANTE — CODIFICACION DE CARACTERES
-- El cliente `mysql` del contenedor no hereda LANG/LC_* y resuelve
-- `default-character-set` a `auto` -> latin1. Sin este comando, la importacion
-- de este archivo (que esta en UTF-8) interpretaria los bytes como latin1 y
-- guardaria "Pérez" como "PÃ©riz" en las columnas utf8mb4.
-- `SET NAMES` cambia el juego de caracteres de toda la sesion: ejecutarlo como
-- PRIMERA instruccion garantiza que todo lo que sigue se lea como UTF-8.
-- (Verificado: HEX(nombre) = 50C3A972657A, no 50C383C2A972657A)
-- =========================================================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS joinnus_secure_pass
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE joinnus_secure_pass;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  dni         CHAR(8)     NOT NULL,
  correo      VARCHAR(160) NOT NULL,
  telefono    VARCHAR(30)  NULL,
  creado_en   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(160)  NOT NULL,
  fecha           DATE          NOT NULL,
  hora            TIME          NOT NULL,
  lugar           VARCHAR(160)  NOT NULL,
  zona            VARCHAR(80)   NOT NULL,
  precio_original DECIMAL(10,2) NOT NULL,
  precio_maximo   DECIMAL(10,2) NOT NULL,
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_eventos_nombre (nombre),
  KEY idx_eventos_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entradas (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo            VARCHAR(24)  NOT NULL,
  evento_id         INT UNSIGNED NOT NULL,
  titular_id        INT UNSIGNED NULL,
  titular_nombre    VARCHAR(120) NOT NULL,
  titular_dni       CHAR(8)     NOT NULL,
  titular_correo    VARCHAR(160) NULL,
  zona              VARCHAR(80)  NOT NULL,
  fila              VARCHAR(8)   NOT NULL DEFAULT '-',
  asiento           VARCHAR(12)  NOT NULL,
  estado            ENUM('valido','usado','anulado','transferido') NOT NULL DEFAULT 'valido',
  precio            DECIMAL(10,2) NOT NULL,
  motivo_anulacion  VARCHAR(160) NULL,
  qr_ultimo_token   VARCHAR(64)  NULL,
  qr_anterior_token VARCHAR(64)  NULL,
  qr_firma          CHAR(32)     NULL,
  qr_expira_en      DATETIME     NULL,
  qr_generado_en    DATETIME     NULL,
  creado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  transferida_en    DATETIME     NULL,
  usada_en          DATETIME     NULL,
  anulada_en        DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entradas_codigo (codigo),
  KEY idx_entradas_estado (estado),
  KEY idx_entradas_titular (titular_dni),
  CONSTRAINT fk_entradas_evento  FOREIGN KEY (evento_id)  REFERENCES eventos(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_entradas_titular FOREIGN KEY (titular_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transferencias (
  id                       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  entrada_id               INT UNSIGNED  NOT NULL,
  titular_anterior_id      INT UNSIGNED  NULL,
  titular_anterior_nombre  VARCHAR(120)  NOT NULL,
  titular_anterior_dni     CHAR(8)      NOT NULL,
  titular_nuevo_id         INT UNSIGNED  NULL,
  titular_nuevo_nombre     VARCHAR(120)  NOT NULL,
  titular_nuevo_dni        CHAR(8)      NOT NULL,
  titular_nuevo_correo     VARCHAR(160)  NOT NULL,
  precio                   DECIMAL(10,2) NOT NULL,
  precio_original          DECIMAL(10,2) NOT NULL,
  codigo_operacion         CHAR(12)      NOT NULL,
  creado_en                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transf_entrada (entrada_id),
  CONSTRAINT fk_transf_entrada FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  entrada_id        INT UNSIGNED NOT NULL,
  accion            ENUM('creada','verificada','transferida','qr','usada','anulada') NOT NULL,
  titular           VARCHAR(120) NOT NULL DEFAULT '-',
  detalle           VARCHAR(255) NOT NULL DEFAULT '',
  estado_registrado VARCHAR(20)  NULL,
  creado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_entrada (entrada_id),
  KEY idx_hist_fecha (creado_en),
  CONSTRAINT fk_hist_entrada FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tokens_qr (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  entrada_id INT UNSIGNED NOT NULL,
  token      VARCHAR(64)  NOT NULL,
  nonce      VARCHAR(16)  NOT NULL,
  firma      CHAR(32)     NOT NULL,
  payload    VARCHAR(160) NOT NULL,
  expira_en  DATETIME     NOT NULL,
  invalidado TINYINT(1)   NOT NULL DEFAULT 0,
  usado_en   DATETIME     NULL,
  creado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tokens_token (token),
  KEY idx_tokens_entrada (entrada_id),
  CONSTRAINT fk_tokens_entrada FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Datos ficticios de demostracion
-- (idempotente: se puede reejecutar sin duplicar informacion)
-- ---------------------------------------------------------------------------

INSERT INTO usuarios (nombre, dni, correo, telefono) VALUES
  ('Carlos Pérez',  '45678945', 'carlos.perez@demo.pe',    '900111222'),
  ('Andrea Torres', '52311878', 'andrea.torres@demo.pe',   '900222333'),
  ('Luis Ramírez',  '40125678', 'luis.ramirez@demo.pe',    '900333444'),
  ('Diego Vargas',  '47258963', 'diego.vargas@demo.pe',    '900444555'),
  ('María Torres',  '43871264', 'maria.torres@demo.pe',    '900555666'),
  ('Renato Silva',  '39521478', 'renato.silva@demo.pe',    '900666777')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), correo = VALUES(correo);

INSERT INTO eventos (nombre, fecha, hora, lugar, zona, precio_original, precio_maximo) VALUES
  ('Lima Music Fest',                 '2026-09-29', '20:00:00', 'Estadio Nacional',            'Preferencial', 120.00, 120.00),
  ('Festival Lima 2026',              '2026-10-17', '17:00:00', 'Parque de la Exposición',     'General',       90.00,  90.00),
  ('Concierto Lima Rock',             '2026-11-07', '21:00:00', 'Estadio Alejandro Villanueva','Tribuna',      150.00, 150.00),
  ('Liga 1 - Final',                  '2026-11-22', '16:00:00', 'Estadio Nacional',            'Popular',       110.00, 110.00),
  ('Liga 1 - Partido de Exhibición',  '2026-10-03', '19:30:00', 'Estadio Alejandro Villanueva','Tribuna',      120.00, 120.00)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Las entradas replican la base de datos simulada del prototipo:
-- ENTRY001 valida (se transfiere durante la demo), ENTRY002 usada,
-- ENTRY003 anulada, ENTRY004 transferida, ENTRY005 y ENTRY006 validas.
INSERT INTO entradas
  (codigo, evento_id, titular_id, titular_nombre, titular_dni, titular_correo,
   zona, fila, asiento, estado, precio, motivo_anulacion,
   qr_ultimo_token, qr_anterior_token, qr_expira_en, creado_en, transferida_en, usada_en, anulada_en)
SELECT s.codigo, ev.id, u.id, s.titular_nombre, s.titular_dni, s.titular_correo,
       s.zona, s.fila, s.asiento, s.estado, s.precio, s.motivo_anulacion,
       s.qr_ultimo_token, s.qr_anterior_token, NULL, s.creado_en, s.transferida_en, s.usada_en, s.anulada_en
FROM (
  SELECT 'ENTRY001' AS codigo, 'Lima Music Fest' AS evento_nombre, 1 AS ev_orden,
         'Carlos Pérez' AS titular_nombre, '45678945' AS titular_dni, 'carlos.perez@demo.pe' AS titular_correo,
         'Preferencial' AS zona, 'B' AS fila, '24' AS asiento, 'valido' AS estado,
         120.00 AS precio, NULL AS motivo_anulacion,
         'JSP-ENTRY001-8F42A91C' AS qr_ultimo_token, NULL AS qr_anterior_token,
         '2026-09-29 10:00:00' AS creado_en, NULL AS transferida_en, NULL AS usada_en, NULL AS anulada_en
  UNION ALL SELECT 'ENTRY002','Lima Music Fest',1,
         'Andrea Torres','52311878','andrea.torres@demo.pe',
         'Platea','P','112','usado',180.00,NULL,
         'JSP-ENTRY002-B31D07E2',NULL,'2026-09-12 09:30:00',NULL,'2026-09-29 18:12:00',NULL
  UNION ALL SELECT 'ENTRY003','Festival Lima 2026',2,
         'Luis Ramírez','40125678','luis.ramirez@demo.pe',
         'General','—','G-120','anulado',90.00,'Solicitud del titular (devolución)',
         'JSP-ENTRY003-77AC0D55',NULL,'2026-09-05 11:15:00',NULL,NULL,'2026-09-20 09:00:00'
  UNION ALL SELECT 'ENTRY004','Concierto Lima Rock',3,
         'Diego Vargas','47258963','diego.vargas@demo.pe',
         'Tribuna','T','18','transferido',150.00,NULL,
         'JSP-ENTRY004-D00F1234','JSP-ENTRY004-11AA22BB','2026-09-15 16:45:00','2026-09-22 15:20:00',NULL,NULL
  UNION ALL SELECT 'ENTRY005','Liga 1 - Final',4,
         'María Torres','43871264','maria.torres@demo.pe',
         'Popular','N','55','valido',110.00,NULL,
         'JSP-ENTRY005-C55D99AB',NULL,'2026-09-18 08:20:00',NULL,NULL,NULL
  UNION ALL SELECT 'ENTRY006','Liga 1 - Partido de Exhibición',5,
         'Carlos Pérez','45678945','carlos.perez@demo.pe',
         'Tribuna','A','9','valido',120.00,NULL,
         'JSP-ENTRY006-5A2E77C1',NULL,'2026-09-20 10:10:00',NULL,NULL,NULL
  UNION ALL SELECT 'ENTRY007','Liga 1 - Final',4,
         'Renato Silva','39521478','renato.silva@demo.pe',
         'Popular','N','56','valido',110.00,NULL,
         'JSP-ENTRY007-90BB3F6D',NULL,'2026-09-21 13:40:00',NULL,NULL,NULL
) s
JOIN eventos ev ON ev.nombre = s.evento_nombre
JOIN usuarios u ON u.dni = s.titular_dni
WHERE NOT EXISTS (SELECT 1 FROM entradas e WHERE e.codigo = s.codigo);

-- Transferencia historica de ENTRY004 (para mostrar el estado "Transferido")
INSERT INTO transferencias
  (entrada_id, titular_anterior_id, titular_anterior_nombre, titular_anterior_dni,
   titular_nuevo_id, titular_nuevo_nombre, titular_nuevo_dni, titular_nuevo_correo,
   precio, precio_original, codigo_operacion, creado_en)
SELECT e.id, ua.id, 'Renato Silva', '39521478',
       ud.id, 'Diego Vargas', '47258963', 'diego.vargas@demo.pe',
       150.00, 150.00, 'TRF-DEMO0001', '2026-09-22 15:20:00'
  FROM entradas e
  JOIN usuarios ua ON ua.dni = '39521478'
  JOIN usuarios ud ON ud.dni = '47258963'
 WHERE e.codigo = 'ENTRY004'
   AND NOT EXISTS (SELECT 1 FROM transferencias t WHERE t.entrada_id = e.id);

-- Historial inicial (trazabilidad de demostracion)
INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado, creado_en)
SELECT e.id, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
FROM (
  SELECT 'ENTRY001' codigo, 'creada' accion, 'Carlos Pérez' titular, 'Entrada emitida tras la compra' detalle, 'valido' estado_registrado, '2026-09-29 10:00:00' creado_en
  UNION ALL SELECT 'ENTRY001','verificada','Carlos Pérez','Consulta de estado desde el verificador','valido','2026-09-29 12:30:00'
  UNION ALL SELECT 'ENTRY001','qr','Carlos Pérez','Nuevo QR generado (se invalidó JSP-ENTRY001-77AA10B2)','valido','2026-09-29 12:30:00'
  UNION ALL SELECT 'ENTRY002','creada','Andrea Torres','Entrada emitida tras la compra','valido','2026-09-12 09:30:00'
  UNION ALL SELECT 'ENTRY002','usada','Andrea Torres','Ingreso registrado en el evento','usado','2026-09-29 18:12:00'
  UNION ALL SELECT 'ENTRY003','creada','Luis Ramírez','Entrada emitida tras la compra','valido','2026-09-05 11:15:00'
  UNION ALL SELECT 'ENTRY003','anulada','Luis Ramírez','Entrada anulada por el organizador','anulado','2026-09-20 09:00:00'
  UNION ALL SELECT 'ENTRY004','creada','Renato Silva','Entrada emitida tras la compra','valido','2026-09-15 16:45:00'
  UNION ALL SELECT 'ENTRY004','transferida','Diego Vargas','Renato Silva → Diego Vargas · S/ 150.00','transferido','2026-09-22 15:20:00'
  UNION ALL SELECT 'ENTRY004','qr','Diego Vargas','Nuevo QR generado (se invalidó JSP-ENTRY004-11AA22BB)','transferido','2026-09-22 15:20:00'
  UNION ALL SELECT 'ENTRY005','creada','María Torres','Entrada emitida tras la compra','valido','2026-09-18 08:20:00'
  UNION ALL SELECT 'ENTRY006','creada','Carlos Pérez','Entrada emitida tras la compra','valido','2026-09-20 10:10:00'
  UNION ALL SELECT 'ENTRY007','creada','Renato Silva','Entrada emitida tras la compra','valido','2026-09-21 13:40:00'
) h
JOIN entradas e ON e.codigo = h.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM historial x WHERE x.entrada_id = e.id AND x.accion = h.accion AND x.creado_en = h.creado_en
);
