import db, { transaction } from '../db/database';
import depositosService from './depositos.service';

interface DepositoImport {
  monto_deposito: number;
  fecha_deposito: string;
  fecha_registro?: string;
  estado: string;
  cuit_denominacion: string;
  titular: string;
}

/**
 * Parsear fecha en formato dd/mm/yyyy o dd-mm-yyyy
 */
function parsearFecha(fechaStr: string): string {
  if (!fechaStr || fechaStr.trim() === '') {
    return new Date().toISOString().split('T')[0];
  }

  // Si ya está en formato ISO (yyyy-mm-dd), retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
    return fechaStr.trim();
  }

  // Parsear formato dd/mm/yyyy o dd-mm-yyyy
  const partes = fechaStr.trim().split(/[-/]/);

  if (partes.length === 3) {
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
 * Limpiar número en múltiples formatos
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-') {
    return 0;
  }

  let limpio = valor.replace(/\s/g, '').trim();

  // Detectar el formato según el separador decimal
  const tieneComaDecimal = /,\d{1,2}$/.test(limpio);
  const tienePuntoDecimal = /\.\d{1,2}$/.test(limpio);

  if (tieneComaDecimal) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (tienePuntoDecimal) {
    limpio = limpio.replace(/,/g, '');
  } else {
    limpio = limpio.replace(/[^\d]/g, '');
  }

  const numero = parseFloat(limpio);
  if (isNaN(numero)) {
    throw new Error(`Valor numérico inválido: ${valor}`);
  }

  return numero;
}

/**
 * Determinar el estado del depósito según las reglas:
 * - Si Estado es número → A_FAVOR (con saldo_actual = ese número)
 * - Si Estado es texto → LIQUIDADO
 * - Si Estado es vacío → PENDIENTE
 * - Si CUIT_Denominacion está vacío → PENDIENTE
 */
function determinarEstado(estado: string, cuitDenominacion: string): {
  estadoFinal: 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR';
  saldoActual: number;
} {
  // Si CUIT está vacío, es PENDIENTE
  if (!cuitDenominacion || cuitDenominacion.trim() === '') {
    return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
  }

  // Si Estado está vacío, es PENDIENTE
  if (!estado || estado.trim() === '') {
    return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
  }

  // Si Estado es un número, es A_FAVOR con ese saldo
  const estadoLimpio = estado.replace(/\s/g, '').trim();
  const esNumero = /^[\d.,\-]+$/.test(estadoLimpio);

  if (esNumero) {
    try {
      const saldo = limpiarNumero(estadoLimpio);
      return { estadoFinal: 'A_FAVOR', saldoActual: saldo };
    } catch {
      // Si falla al parsear como número, tratarlo como texto
      return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
    }
  }

  // Si Estado es texto, es LIQUIDADO
  return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
}

/**
 * Verificar si el estado menciona una cuenta específica (ALRA, ICBC, IVECO)
 * Estas NO deben asignarse automáticamente para no romper las cuentas actuales
 */
function mencionaCuentaEspecifica(estado: string): boolean {
  if (!estado) return false;

  const estadoLower = estado.toLowerCase();
  return (
    estadoLower.includes('a cuenta de alra') ||
    estadoLower.includes('a cuenta de icbc') ||
    estadoLower.includes('a cuenta de iveco')
  );
}

/**
 * Procesar CSV de depósitos
 * Formato esperado:
 * Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion
 */
export function procesarDepositosCSV(contenido: string): DepositoImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const depositos: DepositoImport[] = [];

  // Primera línea es el header, saltarla
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    const campos = linea.split(',');

    if (campos.length < 2) {
      console.warn(`Línea ${i + 1} ignorada (columnas insuficientes): ${linea}`);
      continue;
    }

    try {
      const montoDeposito = limpiarNumero(campos[0]?.trim() || '0');
      const fechaDeposito = parsearFecha(campos[1]?.trim() || '');
      const fechaRegistro = campos[2]?.trim() ? parsearFecha(campos[2].trim()) : undefined;
      const estado = campos[3]?.trim() || '';
      const cuitDenominacion = campos[4]?.trim() || '';

      if (montoDeposito <= 0) {
        console.warn(`Línea ${i + 1} ignorada (monto inválido): ${linea}`);
        continue;
      }

      // Determinar titular (usar CUIT_Denominacion o "Sin identificar")
      const titular = cuitDenominacion || 'Sin identificar';

      depositos.push({
        monto_deposito: montoDeposito,
        fecha_deposito: fechaDeposito,
        fecha_registro: fechaRegistro,
        estado,
        cuit_denominacion: cuitDenominacion,
        titular,
      });
    } catch (error: any) {
      console.error(`Error en línea ${i + 1}: ${error.message}`);
      throw new Error(`Error en línea ${i + 1}: ${error.message}`);
    }
  }

  return depositos;
}

/**
 * Importar depósitos desde CSV
 */
export function importarDepositosCSV(contenido: string): {
  insertados: number;
  errores: string[];
  procesados: number;
  pendientes: number;
  liquidados: number;
  aFavor: number;
} {
  const depositos = procesarDepositosCSV(contenido);
  const errores: string[] = [];
  let insertados = 0;
  let pendientes = 0;
  let liquidados = 0;
  let aFavor = 0;

  console.log(`📊 Total depósitos procesados del CSV: ${depositos.length}`);

  transaction(() => {
    for (const dep of depositos) {
      try {
        // Determinar estado y saldo
        const { estadoFinal, saldoActual } = determinarEstado(dep.estado, dep.cuit_denominacion);

        // Verificar si menciona cuenta específica
        const mencionaCuenta = mencionaCuentaEspecifica(dep.estado);

        // Preparar datos del depósito
        const depositoData: any = {
          monto_original: dep.monto_deposito,
          saldo_actual: estadoFinal === 'A_FAVOR' ? saldoActual : dep.monto_deposito,
          fecha_ingreso: dep.fecha_deposito,
          estado: estadoFinal,
          titular: dep.titular,
          observaciones: dep.estado || undefined,
        };

        // Si fue registrado/usado, agregar fecha
        if (dep.fecha_registro && estadoFinal !== 'PENDIENTE') {
          depositoData.fecha_uso = dep.fecha_registro;
        }

        // Si está liquidado, marcar monto devuelto
        if (estadoFinal === 'LIQUIDADO') {
          depositoData.monto_devuelto = dep.monto_deposito;
          depositoData.fecha_devolucion = dep.fecha_registro || dep.fecha_deposito;
        }

        // Insertar depósito
        const result = db.prepare(
          `INSERT INTO depositos
           (monto_original, saldo_actual, fecha_ingreso, fecha_uso, fecha_devolucion, estado, titular, observaciones, monto_devuelto, cuenta_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          depositoData.monto_original,
          depositoData.saldo_actual,
          depositoData.fecha_ingreso,
          depositoData.fecha_uso || null,
          depositoData.fecha_devolucion || null,
          depositoData.estado,
          depositoData.titular,
          depositoData.observaciones || null,
          depositoData.monto_devuelto || null,
          null // cuenta_id siempre null en importación (para no romper cuentas actuales)
        );

        insertados++;

        // Contar por estado
        if (estadoFinal === 'PENDIENTE') pendientes++;
        else if (estadoFinal === 'LIQUIDADO') liquidados++;
        else if (estadoFinal === 'A_FAVOR') aFavor++;

      } catch (error: any) {
        errores.push(
          `Error al insertar depósito de ${dep.titular} por $${dep.monto_deposito}: ${error.message}`
        );
      }
    }
  });

  console.log(`✅ Depósitos insertados: ${insertados}`);
  console.log(`   - PENDIENTES: ${pendientes}`);
  console.log(`   - LIQUIDADOS: ${liquidados}`);
  console.log(`   - A_FAVOR: ${aFavor}`);

  return { insertados, errores, procesados: depositos.length, pendientes, liquidados, aFavor };
}

export default {
  procesarDepositosCSV,
  importarDepositosCSV,
};
