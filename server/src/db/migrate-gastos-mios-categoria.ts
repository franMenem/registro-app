import db from './database';

console.log('🔄 Ejecutando migración de gastos_mios - agregar campo categoria...');

try {
  // Check if categoria column already exists
  const tableInfo = db.prepare("PRAGMA table_info(gastos_mios)").all() as any[];
  const categoriaExists = tableInfo.some(col => col.name === 'categoria');

  if (!categoriaExists) {
    console.log('Agregando columna categoria...');

    // Add categoria column with default value
    db.exec(`
      ALTER TABLE gastos_mios ADD COLUMN categoria TEXT NOT NULL DEFAULT 'GASTO' CHECK(categoria IN ('GASTO', 'INGRESO', 'AHORRO'));
    `);

    // Create index for categoria
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_gastos_mios_categoria ON gastos_mios(categoria);
    `);

    console.log('✅ Columna categoria agregada exitosamente');
  } else {
    console.log('ℹ️  Columna categoria ya existe, saltando migración');
  }

  console.log('✅ Migración completada exitosamente');
} catch (error) {
  console.error('❌ Error en migración:', error);
  process.exit(1);
}
