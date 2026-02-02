import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database(path.join(__dirname, '../../registro.db'));

console.log('🔄 Iniciando migración de control_veps y control_epagos...');
console.log('📝 Eliminando columna "tipo" (solo son para CAJA)');

try {
  // Leer el archivo de migración
  const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrate-veps-epagos.sql'), 'utf8');

  // Ejecutar la migración en una transacción
  db.exec('BEGIN TRANSACTION;');
  db.exec(migrationSQL);
  db.exec('COMMIT;');

  console.log('✅ Migración completada exitosamente');

  // Verificar que funcionó
  const vepsCount = db.prepare('SELECT COUNT(*) as count FROM control_veps').get() as any;
  const epagosCount = db.prepare('SELECT COUNT(*) as count FROM control_epagos').get() as any;

  console.log(`✅ VEPs existentes: ${vepsCount.count}`);
  console.log(`✅ ePagos existentes: ${epagosCount.count}`);
  console.log('✅ Columna "tipo" eliminada de ambas tablas');

} catch (error) {
  console.error('❌ Error durante la migración:', error);
  db.exec('ROLLBACK;');
  process.exit(1);
}

db.close();
