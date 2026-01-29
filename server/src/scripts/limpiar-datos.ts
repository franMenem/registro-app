import db, { transaction } from '../db/database';

/**
 * Script para limpiar SOLO movimientos (RENTAS y CAJA)
 * Deja POSNET intacto
 */

console.log('🧹 Limpiando SOLO movimientos de RENTAS y CAJA...\n');
console.log('⚠️  POSNET se mantiene intacto\n');

transaction(() => {
  // 1. Limpiar TODOS los movimientos de cuentas corrientes (tienen FK a movimientos)
  const ccResult = db.prepare('DELETE FROM movimientos_cc').run();
  console.log(`✓ Movimientos CC limpiados: ${ccResult.changes} registros eliminados`);

  // 2. Limpiar TODOS los controles semanales (RENTAS y CAJA)
  const semanalResult = db.prepare('DELETE FROM controles_semanales').run();
  console.log(`✓ Controles semanales limpiados: ${semanalResult.changes} registros eliminados`);

  // 3. Limpiar TODOS los controles quincenales
  const quincenalResult = db.prepare('DELETE FROM controles_quincenales').run();
  console.log(`✓ Controles quincenales limpiados: ${quincenalResult.changes} registros eliminados`);

  // 4. Limpiar TODOS los movimientos (RENTAS y CAJA)
  const movimientosResult = db.prepare('DELETE FROM movimientos').run();
  console.log(`✓ Movimientos limpiados: ${movimientosResult.changes} registros eliminados`);

  // 5. Resetear saldos de cuentas corrientes a 0
  const resetSaldosResult = db.prepare('UPDATE cuentas_corrientes SET saldo_actual = 0').run();
  console.log(`✓ Saldos de cuentas corrientes reseteados: ${resetSaldosResult.changes} cuentas`);
});

console.log('\n✅ Limpieza completada!\n');

// Mostrar estadísticas finales
const stats = {
  movimientos_rentas: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo = 'RENTAS'").get() as { count: number },
  movimientos_caja: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo = 'CAJA'").get() as { count: number },
  posnet: db.prepare('SELECT COUNT(*) as count FROM control_posnet_diario').get() as { count: number },
  controles_semanales: db.prepare('SELECT COUNT(*) as count FROM controles_semanales').get() as { count: number },
  controles_quincenales: db.prepare('SELECT COUNT(*) as count FROM controles_quincenales').get() as { count: number },
};

console.log('📊 Estado actual de la base de datos:');
console.log(`   • Movimientos RENTAS: ${stats.movimientos_rentas.count}`);
console.log(`   • Movimientos CAJA: ${stats.movimientos_caja.count}`);
console.log(`   • Control POSNET: ${stats.posnet.count}`);
console.log(`   • Controles semanales: ${stats.controles_semanales.count}`);
console.log(`   • Controles quincenales: ${stats.controles_quincenales.count}`);
console.log('');
