import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database(path.join(__dirname, '../../registro.db'));

console.log('🔄 Iniciando migración de tabla depositos...');

try {
  // Leer el archivo de migración
  const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrate-depositos.sql'), 'utf8');

  // Ejecutar la migración en una transacción
  db.exec('BEGIN TRANSACTION;');
  db.exec(migrationSQL);
  db.exec('COMMIT;');

  console.log('✅ Migración completada exitosamente');
  console.log('✅ La tabla depositos ahora soporta el estado A_CUENTA');

  // Verificar que funcionó
  const result = db.prepare('SELECT COUNT(*) as count FROM depositos').get() as any;
  console.log(`✅ Depósitos existentes: ${result.count}`);

} catch (error) {
  console.error('❌ Error durante la migración:', error);
  db.exec('ROLLBACK;');
  process.exit(1);
}

db.close();
