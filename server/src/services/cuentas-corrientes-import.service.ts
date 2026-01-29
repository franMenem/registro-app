import db, { transaction } from '../db/database';
import cuentasCorrientesService from './cuentas-corrientes.service';

interface MovimientoImport {
  fecha: string;
  tipo_movimiento: 'INGRESO' | 'EGRESO';
  concepto: string;
  monto: number;
}

/**
 * Parsear fecha en formato dd-mmm (ej: 20-mar, 21-mar)
 * Asume año actual si no se especifica
 */
function parsearFecha(fechaStr: string): string {
  const meses: { [key: string]: string } = {
    ene: '01', feb: '02', mar: '03', abr: '04',
    may: '05', jun: '06', jul: '07', ago: '08',
    sep: '09', oct: '10', nov: '11', dic: '12',
  };

  // Si ya está en formato ISO (yyyy-mm-dd), retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
    return fechaStr.trim();
  }

  // Parsear formato dd-mmm (ej: 20-mar) o dd/mm/yyyy
  const partes = fechaStr.trim().split(/[-/]/);

  if (partes.length === 2) {
    // Formato: dd-mmm
    let dia = partes[0].padStart(2, '0');
    const mesStr = partes[1].toLowerCase();
    const mes = meses[mesStr];

    if (!mes) {
      throw new Error(`Mes inválido: ${mesStr}`);
    }

    // Usar año actual
    const anio = new Date().getFullYear();
    return `${anio}-${mes}-${dia}`;
  } else if (partes.length === 3) {
    // Formato: dd/mm/yyyy o dd-mm-yyyy
    let dia = partes[0].padStart(2, '0');
    let mes = partes[1].padStart(2, '0');
    let anio = partes[2];

    // Si el año es de 2 dígitos, convertir a 4
    if (anio.length === 2) {
      const anioNum = parseInt(anio);
      anio = anioNum >= 50 ? `19${anio}` : `20${anio}`;
    }

    return `${anio}-${mes}-${dia}`;
  }

  throw new Error(`Formato de fecha inválido: ${fechaStr}`);
}

/**
 * Limpiar número en formato argentino: 1094165,58 → 1094165.58
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-') {
    return 0;
  }

  // Remover espacios y puntos (separadores de miles)
  let limpio = valor.replace(/[\s.]/g, '').trim();

  // Reemplazar coma por punto (decimal)
  limpio = limpio.replace(',', '.');

  const numero = parseFloat(limpio);
  if (isNaN(numero)) {
    throw new Error(`Valor numérico inválido: ${valor}`);
  }

  return numero;
}

/**
 * Procesar CSV de movimientos de cuenta corriente
 * Formato esperado:
 * RUBRO,FECHA,GASTO,Total,Deposito,Fecha de Ingreso
 * caja,20-mar,1094165,58,1305834,42,2400000,20-mar
 */
export function procesarMovimientosCSV(contenido: string): MovimientoImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const movimientos: MovimientoImport[] = [];

  // Primera línea es el header, saltarla
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    const campos = linea.split(',');

    if (campos.length < 4) {
      console.warn(`Línea ${i + 1} ignorada (columnas insuficientes: ${campos.length}): ${linea}`);
      continue;
    }

    try {
      // RUBRO (campos[0]) - se ignora
      const fechaEgreso = campos[1]?.trim();
      const gasto = campos[2]?.trim();
      const gastoDecimal = campos[3]?.trim(); // parte decimal del gasto
      // Total (campos[4]) - se ignora, es para verificación
      const deposito = campos[5]?.trim();
      const depositoDecimal = campos[6]?.trim(); // parte decimal del deposito
      const fechaIngreso = campos[7]?.trim();

      // Si hay GASTO, crear egreso
      if (gasto && gasto !== '' && gasto !== '0') {
        const montoGasto = limpiarNumero(`${gasto}${gastoDecimal ? ',' + gastoDecimal : ''}`);

        if (montoGasto > 0 && fechaEgreso && fechaEgreso !== '') {
          movimientos.push({
            fecha: parsearFecha(fechaEgreso),
            tipo_movimiento: 'EGRESO',
            concepto: 'Gastos del día',
            monto: montoGasto,
          });
        }
      }

      // Si hay DEPOSITO, crear ingreso
      if (deposito && deposito !== '' && deposito !== '0') {
        const montoDeposito = limpiarNumero(`${deposito}${depositoDecimal ? ',' + depositoDecimal : ''}`);

        if (montoDeposito > 0 && fechaIngreso && fechaIngreso !== '') {
          movimientos.push({
            fecha: parsearFecha(fechaIngreso),
            tipo_movimiento: 'INGRESO',
            concepto: 'Depósito',
            monto: montoDeposito,
          });
        }
      }
    } catch (error: any) {
      console.error(`Error en línea ${i + 1}: ${error.message}`);
      throw new Error(`Error en línea ${i + 1}: ${error.message}`);
    }
  }

  return movimientos;
}

/**
 * Importar movimientos desde CSV a una cuenta corriente
 */
export function importarMovimientosCSV(
  cuentaId: number,
  contenido: string
): {
  insertados: number;
  errores: string[];
} {
  const movimientos = procesarMovimientosCSV(contenido);
  const errores: string[] = [];
  let insertados = 0;

  transaction(() => {
    for (const movimiento of movimientos) {
      try {
        cuentasCorrientesService.crearMovimiento({
          cuenta_id: cuentaId,
          fecha: movimiento.fecha,
          tipo_movimiento: movimiento.tipo_movimiento,
          concepto: movimiento.concepto,
          monto: movimiento.monto,
        });
        insertados++;
      } catch (error: any) {
        errores.push(
          `Error al insertar movimiento del ${movimiento.fecha}: ${error.message}`
        );
      }
    }
  });

  return { insertados, errores };
}

export default {
  procesarMovimientosCSV,
  importarMovimientosCSV,
};
