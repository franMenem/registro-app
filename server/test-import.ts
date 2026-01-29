import fs from 'fs';
import { procesarCSV } from './src/services/control-posnet-import.service';

const contenido = fs.readFileSync('/Users/efmenem/Downloads/posnet_clean.csv', 'utf-8');

try {
  const registros = procesarCSV(contenido);
  console.log(`✅ Se procesaron ${registros.length} registros correctamente`);
  console.log('\n📋 Primeros 5 registros:');
  registros.slice(0, 5).forEach(r => {
    console.log(`  ${r.fecha}: RENTAS $${r.monto_rentas.toFixed(2)} | CAJA $${r.monto_caja.toFixed(2)} | Ingresado $${r.monto_ingresado_banco.toFixed(2)}`);
  });
} catch (error: any) {
  console.error('❌ Error:', error.message);
}
