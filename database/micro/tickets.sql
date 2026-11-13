-- =========================================================================
--  tickets_db — eventos, entradas, transferencias e historial
--  titular_id es una referencia lógica a auth_db.usuarios: no hay FK entre
--  bases. Los datos del titular se conservan desnormalizados en entradas.
-- =========================================================================

CREATE TABLE IF NOT EXISTS eventos (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(160)  NOT NULL,
  fecha           DATE          NOT NULL,
  hora            TIME          NOT NULL,
  lugar           VARCHAR(160)  NOT NULL,
  zona            VARCHAR(80)   NOT NULL,
  precio_original NUMERIC(10,2) NOT NULL,
  precio_maximo   NUMERIC(10,2) NOT NULL,
  activo          SMALLINT      NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_eventos_nombre UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos (fecha);

CREATE TABLE IF NOT EXISTS entradas (
  id                SERIAL PRIMARY KEY,
  codigo            VARCHAR(24)   NOT NULL,
  evento_id         INTEGER       NOT NULL,
  titular_id        INTEGER       NULL,
  titular_nombre    VARCHAR(120)  NOT NULL,
  titular_dni       CHAR(8)       NOT NULL,
  titular_correo    VARCHAR(160)  NULL,
  zona              VARCHAR(80)   NOT NULL,
  fila              VARCHAR(8)    NOT NULL DEFAULT '-',
  asiento           VARCHAR(12)   NOT NULL,
  estado            VARCHAR(20)   NOT NULL DEFAULT 'valido',
  precio            NUMERIC(10,2) NOT NULL,
  motivo_anulacion  VARCHAR(160)  NULL,
  qr_ultimo_token   VARCHAR(64)   NULL,
  qr_anterior_token VARCHAR(64)   NULL,
  qr_firma          CHAR(32)      NULL,
  qr_expira_en      TIMESTAMP     NULL,
  qr_generado_en    TIMESTAMP     NULL,
  creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  transferida_en    TIMESTAMP     NULL,
  usada_en          TIMESTAMP     NULL,
  anulada_en        TIMESTAMP     NULL,
  CONSTRAINT uq_entradas_codigo UNIQUE (codigo),
  CONSTRAINT ck_entradas_estado
    CHECK (estado IN ('valido', 'usado', 'anulado', 'transferido')),
  CONSTRAINT fk_entradas_evento
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_entradas_estado ON entradas (estado);
CREATE INDEX IF NOT EXISTS idx_entradas_titular ON entradas (titular_dni);

CREATE TABLE IF NOT EXISTS transferencias (
  id                       SERIAL PRIMARY KEY,
  entrada_id               INTEGER       NOT NULL,
  titular_anterior_id      INTEGER       NULL,
  titular_anterior_nombre  VARCHAR(120)  NOT NULL,
  titular_anterior_dni     CHAR(8)       NOT NULL,
  titular_nuevo_id         INTEGER       NULL,
  titular_nuevo_nombre     VARCHAR(120)  NOT NULL,
  titular_nuevo_dni        CHAR(8)       NOT NULL,
  titular_nuevo_correo     VARCHAR(160)  NOT NULL,
  precio                   NUMERIC(10,2) NOT NULL,
  precio_original          NUMERIC(10,2) NOT NULL,
  codigo_operacion         CHAR(12)      NOT NULL,
  creado_en                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transf_entrada
    FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transf_entrada ON transferencias (entrada_id);

CREATE TABLE IF NOT EXISTS historial (
  id                SERIAL PRIMARY KEY,
  entrada_id        INTEGER      NOT NULL,
  accion            VARCHAR(20)  NOT NULL,
  titular           VARCHAR(120) NOT NULL DEFAULT '-',
  detalle           VARCHAR(255) NOT NULL DEFAULT '',
  estado_registrado VARCHAR(20)  NULL,
  creado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_historial_accion
    CHECK (accion IN ('creada', 'verificada', 'transferida', 'qr', 'usada', 'anulada')),
  CONSTRAINT fk_hist_entrada
    FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hist_entrada ON historial (entrada_id);
CREATE INDEX IF NOT EXISTS idx_hist_fecha ON historial (creado_en);

-- ---------------------------------------------------------------------------
-- Datos ficticios
-- ---------------------------------------------------------------------------
INSERT INTO eventos (nombre, fecha, hora, lugar, zona, precio_original, precio_maximo) VALUES
  ('Lima Music Fest',                 '2026-09-29', '20:00:00', 'Estadio Nacional',             'Preferencial', 120.00, 120.00),
  ('Festival Lima 2026',              '2026-10-17', '17:00:00', 'Parque de la Exposición',      'General',       90.00,  90.00),
  ('Concierto Lima Rock',             '2026-11-07', '21:00:00', 'Estadio Alejandro Villanueva', 'Tribuna',      150.00, 150.00),
  ('Liga 1 - Final',                  '2026-11-22', '16:00:00', 'Estadio Nacional',             'Popular',      110.00, 110.00),
  ('Liga 1 - Partido de Exhibición',  '2026-10-03', '19:30:00', 'Estadio Alejandro Villanueva', 'Tribuna',      120.00, 120.00)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO entradas
  (codigo, evento_id, titular_id, titular_nombre, titular_dni, titular_correo,
   zona, fila, asiento, estado, precio, motivo_anulacion,
   qr_ultimo_token, qr_anterior_token, qr_expira_en, creado_en,
   transferida_en, usada_en, anulada_en)
SELECT s.codigo, ev.id, s.titular_id, s.titular_nombre, s.titular_dni, s.titular_correo,
       s.zona, s.fila, s.asiento, s.estado, s.precio, s.motivo_anulacion,
       s.qr_ultimo_token, s.qr_anterior_token, NULL, s.creado_en,
       s.transferida_en, s.usada_en, s.anulada_en
FROM (VALUES
  ('ENTRY001', 'Lima Music Fest', 1, 'Carlos Pérez', '45678945', 'carlos.perez@demo.pe',
   'Preferencial', 'B', '24', 'valido', 120.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-29 10:00:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP),
  ('ENTRY002', 'Lima Music Fest', 2, 'Andrea Torres', '52311878', 'andrea.torres@demo.pe',
   'Platea', 'P', '112', 'usado', 180.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-12 09:30:00'::TIMESTAMP, NULL::TIMESTAMP, '2026-09-29 18:12:00'::TIMESTAMP, NULL::TIMESTAMP),
  ('ENTRY003', 'Festival Lima 2026', 3, 'Luis Ramírez', '40125678', 'luis.ramirez@demo.pe',
   'General', '-', 'G-120', 'anulado', 90.00, 'Solicitud del titular (devolución)',
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-05 11:15:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP, '2026-09-20 09:00:00'::TIMESTAMP),
  ('ENTRY004', 'Concierto Lima Rock', 4, 'Diego Vargas', '47258963', 'diego.vargas@demo.pe',
   'Tribuna', 'T', '18', 'transferido', 150.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-15 16:45:00'::TIMESTAMP, '2026-09-22 15:20:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP),
  ('ENTRY005', 'Liga 1 - Final', 5, 'María Torres', '43871264', 'maria.torres@demo.pe',
   'Popular', 'N', '55', 'valido', 110.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-18 08:20:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP),
  ('ENTRY006', 'Liga 1 - Partido de Exhibición', 1, 'Carlos Pérez', '45678945', 'carlos.perez@demo.pe',
   'Tribuna', 'A', '9', 'valido', 120.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-20 10:10:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP),
  ('ENTRY007', 'Liga 1 - Final', 6, 'Renato Silva', '39521478', 'renato.silva@demo.pe',
   'Popular', 'N', '56', 'valido', 110.00, NULL::VARCHAR,
   NULL::VARCHAR, NULL::VARCHAR,
   '2026-09-21 13:40:00'::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP, NULL::TIMESTAMP)
) AS s(codigo, evento_nombre, titular_id, titular_nombre, titular_dni, titular_correo,
       zona, fila, asiento, estado, precio, motivo_anulacion,
       qr_ultimo_token, qr_anterior_token,
       creado_en, transferida_en, usada_en, anulada_en)
JOIN eventos ev ON ev.nombre = s.evento_nombre
WHERE NOT EXISTS (SELECT 1 FROM entradas e WHERE e.codigo = s.codigo);

INSERT INTO transferencias
  (entrada_id, titular_anterior_id, titular_anterior_nombre, titular_anterior_dni,
   titular_nuevo_id, titular_nuevo_nombre, titular_nuevo_dni, titular_nuevo_correo,
   precio, precio_original, codigo_operacion, creado_en)
SELECT e.id, 6, 'Renato Silva', '39521478',
       4, 'Diego Vargas', '47258963', 'diego.vargas@demo.pe',
       150.00, 150.00, 'TRF-DEMO0001', '2026-09-22 15:20:00'::TIMESTAMP
  FROM entradas e
 WHERE e.codigo = 'ENTRY004'
   AND NOT EXISTS (SELECT 1 FROM transferencias t WHERE t.entrada_id = e.id);

INSERT INTO historial (entrada_id, accion, titular, detalle, estado_registrado, creado_en)
SELECT e.id, h.accion, h.titular, h.detalle, h.estado_registrado, h.creado_en
FROM (VALUES
  ('ENTRY001', 'creada',     'Carlos Pérez',  'Entrada emitida tras la compra',                         'valido',      '2026-09-29 10:00:00'::TIMESTAMP),
  ('ENTRY001', 'verificada', 'Carlos Pérez',  'Consulta de estado desde el verificador',                'valido',      '2026-09-29 12:30:00'::TIMESTAMP),
  ('ENTRY001', 'qr',         'Carlos Pérez',  'Nuevo QR generado (se invalidó JSP-ENTRY001-77AA10B2)',  'valido',      '2026-09-29 12:30:00'::TIMESTAMP),
  ('ENTRY002', 'creada',     'Andrea Torres', 'Entrada emitida tras la compra',                         'valido',      '2026-09-12 09:30:00'::TIMESTAMP),
  ('ENTRY002', 'usada',      'Andrea Torres', 'Ingreso registrado en el evento',                        'usado',       '2026-09-29 18:12:00'::TIMESTAMP),
  ('ENTRY003', 'creada',     'Luis Ramírez',  'Entrada emitida tras la compra',                         'valido',      '2026-09-05 11:15:00'::TIMESTAMP),
  ('ENTRY003', 'anulada',    'Luis Ramírez',  'Entrada anulada por el organizador',                     'anulado',     '2026-09-20 09:00:00'::TIMESTAMP),
  ('ENTRY004', 'creada',     'Renato Silva',  'Entrada emitida tras la compra',                         'valido',      '2026-09-15 16:45:00'::TIMESTAMP),
  ('ENTRY004', 'transferida','Diego Vargas',  'Renato Silva → Diego Vargas · S/ 150.00',                 'transferido', '2026-09-22 15:20:00'::TIMESTAMP),
  ('ENTRY004', 'qr',         'Diego Vargas',  'Nuevo QR generado (se invalidó JSP-ENTRY004-11AA22BB)',  'transferido', '2026-09-22 15:20:00'::TIMESTAMP),
  ('ENTRY005', 'creada',     'María Torres',  'Entrada emitida tras la compra',                         'valido',      '2026-09-18 08:20:00'::TIMESTAMP),
  ('ENTRY006', 'creada',     'Carlos Pérez',  'Entrada emitida tras la compra',                         'valido',      '2026-09-20 10:10:00'::TIMESTAMP),
  ('ENTRY007', 'creada',     'Renato Silva',  'Entrada emitida tras la compra',                         'valido',      '2026-09-21 13:40:00'::TIMESTAMP)
) AS h(codigo, accion, titular, detalle, estado_registrado, creado_en)
JOIN entradas e ON e.codigo = h.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM historial x
   WHERE x.entrada_id = e.id
     AND x.accion = h.accion
     AND x.creado_en = h.creado_en
);
