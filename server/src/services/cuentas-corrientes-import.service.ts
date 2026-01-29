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
 * Limpiar número en múltiples formatos:
 * - Formato argentino: 1.094.165,58 → 1094165.58
 * - Formato internacional: 1,094,165.58 → 1094165.58
 * - Formato simple: 1094165.58 → 1094165.58
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-') {
    return 0;
  }

  let limpio = valor.replace(/\s/g, '').trim();

  // Detectar el formato según el separador decimal
  const tieneComaDecimal = /,\d{1,2}$/.test(limpio); // Termina en ,XX o ,X
  const tienePuntoDecimal = /\.\d{1,2}$/.test(limpio); // Termina en .XX o .X

  if (tieneComaDecimal) {
    // Formato argentino: 1.234,56
    // Remover puntos (separadores de miles) y reemplazar coma por punto
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (tienePuntoDecimal) {
    // Formato internacional: 1,234.56 o 1234.56
    // Remover comas (separadores de miles), el punto ya es decimal
    limpio = limpio.replace(/,/g, '');
  } else {
    // Sin decimales o formato ambiguo: remover todo excepto dígitos
    limpio = limpio.replace(/[^\d]/g, '');
  }

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
      // RUBRO (campos[0]) - determina el concepto del movimiento
      const rubro = campos[0]?.trim().toUpperCase();
      const fechaEgreso = campos[1]?.trim();
      const gasto = campos[2]?.trim();
      // Total (campos[3]) - se ignora, es el saldo acumulado
      const deposito = campos[4]?.trim();
      const fechaIngreso = campos[5]?.trim();

      // Determinar concepto según el rubro
      let conceptoEgreso = 'Gastos del día';
      let conceptoIngreso = 'Depósito';

      if (rubro === 'CAJA') {
        conceptoEgreso = 'Gastos de CAJA';
        conceptoIngreso = 'Depósito CAJA';
      } else if (rubro === 'RENTAS') {
        conceptoEgreso = 'Gastos de RENTAS';
        conceptoIngreso = 'Depósito RENTAS';
      }

      // IMPORTANTE: Crear primero INGRESOS, luego EGRESOS
      // Esto evita saldos negativos cuando hay depósito y gasto el mismo día

      // Si hay DEPOSITO, crear ingreso PRIMERO
      if (deposito && deposito !== '' && deposito !== '0') {
        const montoDeposito = limpiarNumero(deposito);

        if (montoDeposito > 0) {
          // Si no hay fecha de ingreso, usar la fecha de egreso
          const fechaParaIngreso = fechaIngreso && fechaIngreso !== '' ? fechaIngreso : fechaEgreso;

          if (fechaParaIngreso && fechaParaIngreso !== '') {
            movimientos.push({
              fecha: parsearFecha(fechaParaIngreso),
              tipo_movimiento: 'INGRESO',
              concepto: conceptoIngreso,
              monto: montoDeposito,
            });
          }
        }
      }

      // Si hay GASTO, crear egreso DESPUÉS
      if (gasto && gasto !== '' && gasto !== '0') {
        const montoGasto = limpiarNumero(gasto);

        if (montoGasto > 0 && fechaEgreso && fechaEgreso !== '') {
          movimientos.push({
            fecha: parsearFecha(fechaEgreso),
            tipo_movimiento: 'EGRESO',
            concepto: conceptoEgreso,
            monto: montoGasto,
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
