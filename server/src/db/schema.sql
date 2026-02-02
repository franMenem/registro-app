-- ========================================
-- CLIENTES
-- ========================================
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuit TEXT NOT NULL UNIQUE,
  razon_social TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsqueda rápida por CUIT
CREATE INDEX IF NOT EXISTS idx_clientes_cuit ON clientes(cuit);

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

-- Control POSNET diario (Fase 2)
CREATE TABLE IF NOT EXISTS control_posnet_diario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL UNIQUE,
  monto_rentas DECIMAL(12,2) DEFAULT 0,
  monto_caja DECIMAL(12,2) DEFAULT 0,
  total_posnet DECIMAL(12,2) DEFAULT 0,
  monto_ingresado_banco DECIMAL(12,2) DEFAULT 0,
  diferencia DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Formularios (Fase 3)
CREATE TABLE IF NOT EXISTS formularios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  monto DECIMAL(12,2) NOT NULL,
  fecha_compra DATE NOT NULL,
  proveedor TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vencimientos de formularios (3 por formulario)
CREATE TABLE IF NOT EXISTS formularios_vencimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  formulario_id INTEGER NOT NULL,
  numero_vencimiento INTEGER NOT NULL CHECK(numero_vencimiento IN (1, 2, 3)),
  fecha_vencimiento DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'PAGADO')),
  fecha_pago DATE,
  gasto_registral_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE CASCADE,
  FOREIGN KEY (gasto_registral_id) REFERENCES gastos_registrales(id),
  UNIQUE(formulario_id, numero_vencimiento)
);

-- Gastos Registrales (Sistema completo de 25 conceptos mensuales)
CREATE TABLE IF NOT EXISTS gastos_registrales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  origen TEXT DEFAULT 'MANUAL', -- 'MANUAL', 'CAJA', 'FORMULARIOS'
  estado TEXT DEFAULT 'Pagado', -- 'Pagado', 'Pendiente'
  -- Campos especiales para ABL (3 boletas) y AYSA (4 boletas)
  boleta1 DECIMAL(12,2) DEFAULT 0,
  boleta2 DECIMAL(12,2) DEFAULT 0,
  boleta3 DECIMAL(12,2) DEFAULT 0,
  boleta4 DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Gastos Registrales
CREATE INDEX IF NOT EXISTS idx_gastos_registrales_fecha ON gastos_registrales(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_registrales_concepto ON gastos_registrales(concepto);
CREATE INDEX IF NOT EXISTS idx_gastos_registrales_estado ON gastos_registrales(estado);

-- Adelantos empleados (Actualizado con más campos)
CREATE TABLE IF NOT EXISTS adelantos_empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado TEXT NOT NULL, -- 'DAMI', 'MUMI'
  fecha_adelanto DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  estado TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Descontado'
  fecha_descuento DATE,
  observaciones TEXT,
  origen TEXT DEFAULT 'MANUAL', -- 'MANUAL', 'CAJA'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Adelantos
CREATE INDEX IF NOT EXISTS idx_adelantos_empleado ON adelantos_empleados(empleado);
CREATE INDEX IF NOT EXISTS idx_adelantos_estado ON adelantos_empleados(estado);

-- Depósitos
CREATE TABLE IF NOT EXISTS depositos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monto_original DECIMAL(12,2) NOT NULL,
  saldo_actual DECIMAL(12,2) NOT NULL,
  fecha_ingreso DATE NOT NULL,
  fecha_uso DATE,
  fecha_devolucion DATE,
  estado TEXT NOT NULL CHECK(estado IN ('PENDIENTE', 'LIQUIDADO', 'A_FAVOR', 'A_CUENTA', 'DEVUELTO')) DEFAULT 'PENDIENTE',
  tipo_uso TEXT CHECK(tipo_uso IN ('CAJA', 'RENTAS', 'A_CUENTA', 'DEVUELTO')),
  descripcion_uso TEXT,
  monto_devuelto DECIMAL(12,2) DEFAULT 0,
  titular TEXT NOT NULL,
  observaciones TEXT,
  cuenta_id INTEGER,
  movimiento_origen_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id) REFERENCES cuentas_corrientes(id),
  FOREIGN KEY (movimiento_origen_id) REFERENCES movimientos(id)
);

-- Índices para depósitos
CREATE INDEX IF NOT EXISTS idx_depositos_estado ON depositos(estado);
CREATE INDEX IF NOT EXISTS idx_depositos_fecha_ingreso ON depositos(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_depositos_cuenta ON depositos(cuenta_id);

-- ========================================
-- GASTOS PERSONALES (JEFA)
-- ========================================
-- 5 conceptos: Gaspar, Nacion, Efectivo, Patagonia, Credicoop
CREATE TABLE IF NOT EXISTS gastos_personales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL CHECK(concepto IN ('Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop')),
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  estado TEXT DEFAULT 'Pagado' CHECK(estado IN ('Pagado', 'Pendiente')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para gastos personales
CREATE INDEX IF NOT EXISTS idx_gastos_personales_fecha ON gastos_personales(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_personales_concepto ON gastos_personales(concepto);
CREATE INDEX IF NOT EXISTS idx_gastos_personales_estado ON gastos_personales(estado);

-- ========================================
-- CONTROL VEPs
-- ========================================
CREATE TABLE IF NOT EXISTS control_veps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para VEPs
CREATE INDEX IF NOT EXISTS idx_control_veps_fecha ON control_veps(fecha);

-- ========================================
-- CONTROL ePAGOS
-- ========================================
CREATE TABLE IF NOT EXISTS control_epagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para ePagos
CREATE INDEX IF NOT EXISTS idx_control_epagos_fecha ON control_epagos(fecha);

-- ========================================
-- CONTROL DE EFECTIVO
-- ========================================
-- Configuración de efectivo (saldo inicial)
CREATE TABLE IF NOT EXISTS control_efectivo_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insertar registro único de configuración
INSERT OR IGNORE INTO control_efectivo_config (id, saldo_inicial) VALUES (1, 0);

-- Movimientos de efectivo (ingresos, gastos y depósitos)
CREATE TABLE IF NOT EXISTS movimientos_efectivo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('INGRESO', 'GASTO', 'DEPOSITO')),
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  cuenta_id INTEGER,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id) REFERENCES cuentas_corrientes(id)
);

-- Índices para movimientos de efectivo
CREATE INDEX IF NOT EXISTS idx_movimientos_efectivo_fecha ON movimientos_efectivo(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_efectivo_tipo ON movimientos_efectivo(tipo);

-- ========================================
-- GASTOS MIOS (Gastos personales de Efi)
-- ========================================
CREATE TABLE IF NOT EXISTS gastos_mios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  categoria TEXT NOT NULL CHECK(categoria IN ('GASTO', 'INGRESO', 'AHORRO')),
  tipo TEXT NOT NULL CHECK(tipo IN ('FIJO', 'VARIABLE')),
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para gastos mios
CREATE INDEX IF NOT EXISTS idx_gastos_mios_fecha ON gastos_mios(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_mios_concepto ON gastos_mios(concepto);
CREATE INDEX IF NOT EXISTS idx_gastos_mios_categoria ON gastos_mios(categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_mios_tipo ON gastos_mios(tipo);
