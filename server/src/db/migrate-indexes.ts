import db from './database';

console.log('🔄 Ejecutando migración de índices de performance...');

const migration = `
  -- Índice compuesto para queries frecuentes en movimientos_cc
  -- Optimiza búsquedas por cuenta + fecha y ordenamiento
  DROP INDEX IF EXISTS idx_movimientos_cc_cuenta_fecha;
  CREATE INDEX idx_movimientos_cc_cuenta_fecha
    ON movimientos_cc(cuenta_id, fecha, id);

  -- Índice para búsquedas por cliente en depósitos
  -- Optimiza filtros por cliente
  DROP INDEX IF EXISTS idx_depositos_cliente;
  CREATE INDEX idx_depositos_cliente
    ON depositos(cliente_id);

  -- Índice para búsquedas por concepto en movimientos_cc
  -- Optimiza filtros y agrupaciones por concepto
  DROP INDEX IF EXISTS idx_movimientos_cc_concepto;
  CREATE INDEX idx_movimientos_cc_concepto
    ON movimientos_cc(concepto);
`;

try {
  db.exec(migration);
  console.log('✅ Índices creados exitosamente');

  // Verificar índices creados
  const indexes = db
    .prepare(
      `SELECT name, tbl_name, sql
       FROM sqlite_master
       WHERE type = 'index'
       AND name LIKE 'idx_%'
       ORDER BY tbl_name, name`
    )
    .all() as Array<{ name: string; tbl_name: string; sql: string }>;

  console.log('\n📊 Índices de performance creados:');
  for (const idx of indexes) {
    console.log(`  - ${idx.name} en tabla ${idx.tbl_name}`);
  }
} catch (error) {
  console.error('❌ Error al crear índices:', error);
  process.exit(1);
}
