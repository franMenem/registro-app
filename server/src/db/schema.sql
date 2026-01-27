-- Conceptos (GIT, SUAT, ARBA, etc.)
CREATE TABLE IF NOT EXISTS conceptos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK(tipo IN ('RENTAS', 'CAJA')),
  frecuencia_pago TEXT CHECK(frecuencia_pago IN ('SEMANAL', 'QUINCENAL', 'MENSUAL', 'NINGUNA')),
  descripcion TEXT
);

-- Movimientos generales (RENTAS y CAJA)
CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('RENTAS', 'CAJA')),
  cuit TEXT NOT NULL,
  concepto_id INTEGER NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (concepto_id) REFERENCES conceptos(id)
);

-- Índices para movimientos
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_concepto ON movimientos(concepto_id);

-- Cuentas Corrientes (8 cuentas)
CREATE TABLE IF NOT EXISTS cuentas_corrientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK(tipo IN ('RENTAS', 'CAJA', 'GASTOS_REGISTRO', 'GASTOS_PERSONALES', 'ADELANTOS')),
  saldo_actual DECIMAL(12,2) DEFAULT 0
);

-- Movimientos de cuentas corrientes
CREATE TABLE IF NOT EXISTS movimientos_cc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuenta_id INTEGER NOT NULL,
  fecha DATE NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('INGRESO', 'EGRESO')),
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  saldo_resultante DECIMAL(12,2) NOT NULL,
  movimiento_origen_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id) REFERENCES cuentas_corrientes(id),
  FOREIGN KEY (movimiento_origen_id) REFERENCES movimientos(id)
);

-- Índices para movimientos_cc
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_cuenta ON movimientos_cc(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_fecha ON movimientos_cc(fecha);

-- Controles semanales (GIT, SUAT Alta, SUAT Patentes, etc.)
CREATE TABLE IF NOT EXISTS controles_semanales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto_id INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_recaudado DECIMAL(12,2) DEFAULT 0,
  fecha_pago_programada DATE NOT NULL,
  pagado BOOLEAN DEFAULT 0,
  fecha_pago_real DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (concepto_id) REFERENCES conceptos(id),
  UNIQUE(concepto_id, fecha_inicio, fecha_fin)
);

-- Controles quincenales (ARBA)
CREATE TABLE IF NOT EXISTS controles_quincenales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto_id INTEGER NOT NULL,
  quincena TEXT NOT NULL CHECK(quincena IN ('PRIMERA', 'SEGUNDA')),
  mes INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_recaudado DECIMAL(12,2) DEFAULT 0,
  fecha_pago_programada DATE NOT NULL,
  pagado BOOLEAN DEFAULT 0,
  fecha_pago_real DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (concepto_id) REFERENCES conceptos(id),
  UNIQUE(concepto_id, mes, anio, quincena)
);

-- Control POSNET mensual
CREATE TABLE IF NOT EXISTS control_posnet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mes INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  total_rentas DECIMAL(12,2) DEFAULT 0,
  total_caja DECIMAL(12,2) DEFAULT 0,
  total_general DECIMAL(12,2) DEFAULT 0,
  fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mes, anio)
);

-- Gastos mensuales registro (Librería, María, Agua, etc.)
CREATE TABLE IF NOT EXISTS gastos_mensuales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  mes INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  pagado BOOLEAN DEFAULT 0,
  fecha_pago DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Adelantos empleados
CREATE TABLE IF NOT EXISTS adelantos_empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_nombre TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  fecha DATE NOT NULL,
  mes_descuento INTEGER NOT NULL,
  anio_descuento INTEGER NOT NULL,
  descontado BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
