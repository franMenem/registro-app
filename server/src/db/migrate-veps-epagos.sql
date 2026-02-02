-- Migración: Eliminar columna tipo de control_veps y control_epagos
-- Ya que VEPs y ePagos son solo para CAJA

-- ===== CONTROL_VEPS =====

-- Crear tabla temporal sin columna tipo
CREATE TABLE control_veps_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos (siempre son CAJA, así que omitimos la columna tipo)
INSERT INTO control_veps_new (id, fecha, monto, observaciones, created_at)
SELECT id, fecha, monto, observaciones, created_at FROM control_veps;

-- Eliminar tabla vieja
DROP TABLE control_veps;

-- Renombrar tabla nueva
ALTER TABLE control_veps_new RENAME TO control_veps;

-- Recrear índices
CREATE INDEX idx_control_veps_fecha ON control_veps(fecha);

-- ===== CONTROL_EPAGOS =====

-- Crear tabla temporal sin columna tipo
CREATE TABLE control_epagos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos (siempre son CAJA, así que omitimos la columna tipo)
INSERT INTO control_epagos_new (id, fecha, monto, observaciones, created_at)
SELECT id, fecha, monto, observaciones, created_at FROM control_epagos;

-- Eliminar tabla vieja
DROP TABLE control_epagos;

-- Renombrar tabla nueva
ALTER TABLE control_epagos_new RENAME TO control_epagos;

-- Recrear índices
CREATE INDEX idx_control_epagos_fecha ON control_epagos(fecha);
