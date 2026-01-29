import db, { transaction } from '../db/database';

interface GastoPersonalImport {
  fecha: string;
  concepto: string;
  monto: number;
}

interface ImportResult {
  insertados: number;
  errores: string[];
  registros_procesados: number;
}

/**
 * Limpia un string de número removiendo símbolos
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-') return 0;

  let limpio = valor.replace(/[$\s]/g, '').trim();
  if (!limpio) return 0;

  // Detectar formato argentino (coma como decimal)
  const tieneComaDecimal = /,\d{1,2}$/.test(limpio);

  if (tieneComaDecimal) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = limpio.split(',');
    if (partes.length === 2) {
      limpio = limpio.replace(',', '.');
    }
  }

  const numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}

/**
 * Parsea fecha en formato DD/MM/YYYY
 */
function parsearFecha(fechaStr: string): string {
  fechaStr = fechaStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return fechaStr;
  }

  const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if (match) {
    let dia = parseInt(match[1]);
    let mes = parseInt(match[2]);
    let anio = parseInt(match[3]);

    if (anio < 100) {
      anio += 2000;
    }

    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio >= 2000) {
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  throw new Error(`Fecha inválida: ${fechaStr}`);
}

/**
 * Valida que el concepto sea uno de los permitidos
 */
const CONCEPTOS_VALIDOS = ['Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop'];

function validarConcepto(concepto: string): string {
  // Normalizar: capitalizar primera letra, resto minúscula
  const conceptoNormalizado = concepto.charAt(0).toUpperCase() + concepto.slice(1).toLowerCase();

  if (CONCEPTOS_VALIDOS.includes(conceptoNormalizado)) {
    return conceptoNormalizado;
  }

  throw new Error(`Concepto inválido: ${concepto}. Debe ser uno de: ${CONCEPTOS_VALIDOS.join(', ')}`);
}

/**
 * Inserta un gasto personal
 */
function insertarGastoPersonal(gasto: GastoPersonalImport): void {
  db.prepare(
    `INSERT INTO gastos_personales (fecha, concepto, monto, estado)
     VALUES (?, ?, ?, 'Pagado')`
  ).run(gasto.fecha, gasto.concepto, gasto.monto);
}

/**
 * Procesa un archivo CSV
 */
export function procesarGastosPersonalesCSV(contenido: string): GastoPersonalImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const gastos: GastoPersonalImport[] = [];

  if (lineas.length === 0) {
    throw new Error('El archivo está vacío');
  }

  // Primera línea es el header
  const headerLinea = lineas[0];
  const headers = headerLinea.split(',').map(h => h.trim());

  // Primera columna debe ser "fecha"
  if (headers[0].toLowerCase() !== 'fecha') {
    throw new Error('La primera columna debe ser "fecha"');
  }

  // El resto son los conceptos
  const conceptos = headers.slice(1);

  // Procesar cada línea de datos
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    const campos = linea.split(',').map(c => c.trim());

    if (campos.length < 2 || !campos[0]) continue;

    try {
      const fecha = parsearFecha(campos[0]);

      // Procesar cada concepto
      for (let j = 0; j < conceptos.length; j++) {
        const conceptoRaw = conceptos[j];
        const montoStr = campos[j + 1] || '0';
        const monto = limpiarNumero(montoStr);

        // Solo agregar si el monto es mayor a 0
        if (monto > 0) {
          try {
            const conceptoValido = validarConcepto(conceptoRaw);
            gastos.push({
              fecha,
              concepto: conceptoValido,
              monto
            });
          } catch (error: any) {
            console.warn(`Concepto inválido ignorado: ${conceptoRaw}`);
          }
        }
      }
    } catch (error: any) {
      console.warn(`Línea ${i + 1} ignorada: ${error.message}`);
    }
  }

  return gastos;
}

/**
 * Importa gastos personales desde CSV
 */
export function importarGastosPersonalesCSV(contenido: string): ImportResult {
  const gastos = procesarGastosPersonalesCSV(contenido);

  const result: ImportResult = {
    insertados: 0,
    errores: [],
    registros_procesados: 0
  };

  transaction(() => {
    for (const gasto of gastos) {
      try {
        insertarGastoPersonal(gasto);
        result.insertados++;
        result.registros_procesados++;
      } catch (error: any) {
        result.errores.push(`${gasto.fecha} - ${gasto.concepto}: ${error.message}`);
      }
    }
  });

  return result;
}
