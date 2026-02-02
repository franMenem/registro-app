-- Migración: Agregar estado 'A_CUENTA' a tabla depositos

-- Paso 1: Crear tabla temporal con constraint correcto
CREATE TABLE IF NOT EXISTS depositos_new (
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

-- Paso 2: Copiar todos los datos (mapeando columnas explícitamente)
INSERT INTO depositos_new (
  id, monto_original, saldo_actual, fecha_ingreso, fecha_uso, fecha_devolucion,
  estado, tipo_uso, descripcion_uso, monto_devuelto, titular, observaciones,
  cuenta_id, movimiento_origen_id, created_at
)
SELECT
  id, monto_original, saldo_actual, fecha_ingreso, fecha_uso, fecha_devolucion,
  estado, tipo_uso, descripcion_uso, monto_devuelto, titular, observaciones,
  cuenta_id, movimiento_origen_id, created_at
FROM depositos;

-- Paso 3: Eliminar tabla vieja
DROP TABLE depositos;

-- Paso 4: Renombrar tabla nueva
ALTER TABLE depositos_new RENAME TO depositos;

-- Paso 5: Recrear índices
CREATE INDEX IF NOT EXISTS idx_depositos_estado ON depositos(estado);
CREATE INDEX IF NOT EXISTS idx_depositos_cuenta ON depositos(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_depositos_fecha ON depositos(fecha_ingreso);
