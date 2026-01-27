-- Conceptos RENTAS
INSERT OR IGNORE INTO conceptos (nombre, tipo, frecuencia_pago) VALUES
('GIT', 'RENTAS', 'SEMANAL'),
('SUAT - Alta', 'RENTAS', 'SEMANAL'),
('SUAT - Patentes', 'RENTAS', 'SEMANAL'),
('SUAT - Infracciones', 'RENTAS', 'SEMANAL'),
('SUCERP', 'RENTAS', 'SEMANAL'),
('SUGIT', 'RENTAS', 'SEMANAL'),
('PROVINCIA (ARBA)', 'RENTAS', 'QUINCENAL'),
('Consulta', 'RENTAS', 'NINGUNA'),
('POSNET', 'RENTAS', 'NINGUNA'),
('ICBC', 'RENTAS', 'NINGUNA');

-- Conceptos CAJA
INSERT OR IGNORE INTO conceptos (nombre, tipo, frecuencia_pago) VALUES
('Arancel', 'CAJA', 'MENSUAL'),
('SUAT - Sellado', 'CAJA', 'SEMANAL'),
('SUCERP - Sellado', 'CAJA', 'SEMANAL'),
('Formularios', 'CAJA', 'NINGUNA'),
('POSNET CAJA', 'CAJA', 'NINGUNA'),
('DEPOSITOS', 'CAJA', 'NINGUNA');

-- Cuentas Corrientes
INSERT OR IGNORE INTO cuentas_corrientes (nombre, tipo, saldo_actual) VALUES
('Gastos Bancarios', 'RENTAS', 0),
('Gastos Link', 'RENTAS', 0),
('Gastos Bancarios CAJA', 'CAJA', 0),
('Gastos Formularios', 'CAJA', 0),
('Librería', 'GASTOS_REGISTRO', 0),
('María', 'GASTOS_REGISTRO', 0),
('Agua', 'GASTOS_REGISTRO', 0),
('Edesur', 'GASTOS_REGISTRO', 0);
