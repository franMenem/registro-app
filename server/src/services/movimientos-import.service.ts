import db, { transaction } from '../db/database';

interface MovimientoImport {
  fecha: string;
  tipo: string;
  concepto: string;
  monto: number;
  cuit?: string;
  observaciones?: string;
}

interface ImportResult {
  insertados: number;
  errores: string[];
  registros_procesados: number;
}

/**
 * Mapeo de nombres de conceptos del CSV a nombres en la base de datos
 */
const MAPEO_CONCEPTOS: { [key: string]: string } = {
  'GIT': 'GIT',
  'SUAT - Alta': 'SUAT - Alta',
  'SUAT - Patentes': 'SUAT - Patentes',
  'SUAT - Infracciones': 'SUAT - Infracciones',
  'Sucerp': 'SUCERP',
  'Sugit': 'SUGIT',
  'PROVINCIA': 'PROVINCIA (ARBA)',
  'Consulta': 'Consulta',
  'POSNET': 'POSNET',
  'ICBC': 'ICBC',
  'DEPOSITOS': 'DEPOSITOS',
  'PATAGONIA': 'PATAGONIA',
  'SICARDI': 'SICARDI',
  'FORD': 'FORD',
  'GESTORIA FORD': 'GESTORIA FORD',

  // CAJA
  'Arancel': 'Arancel',
  'SUAT - Sellado': 'SUAT - Sellado',
  'SUCERP - Sellado': 'SUCERP - Sellado',
  'Formularios': 'Formularios',
  'POSNET CAJA': 'POSNET CAJA',
  'Consultas CAJA': 'Consultas CAJA',
  'VEP': 'VEP',
  'EPAGOS': 'EPAGOS',
};

/**
 * Cache de IDs de conceptos
 */
let conceptosCache: Map<string, number> | null = null;

function obtenerConceptosCache(): Map<string, number> {
  if (conceptosCache) return conceptosCache;

  conceptosCache = new Map();
  const conceptos = db.prepare('SELECT id, nombre FROM conceptos').all() as Array<{id: number, nombre: string}>;

  conceptos.forEach(c => {
    conceptosCache!.set(c.nombre.toLowerCase(), c.id);
  });

  return conceptosCache;
}

/**
 * Obtiene el ID de un concepto por nombre
 */
function obtenerConceptoId(nombreConcepto: string, tipo: string): number | null {
  const cache = obtenerConceptosCache();

  // Primero buscar el nombre mapeado
  const nombreMapeado = MAPEO_CONCEPTOS[nombreConcepto] || nombreConcepto;

  const id = cache.get(nombreMapeado.toLowerCase());
  if (id) return id;

  // Si no existe, crearlo
  try {
    const result = db.prepare(
      'INSERT INTO conceptos (nombre, tipo) VALUES (?, ?)'
    ).run(nombreMapeado, tipo);

    const nuevoId = result.lastInsertRowid as number;
    cache.set(nombreMapeado.toLowerCase(), nuevoId);

    console.log(`✓ Concepto creado: ${nombreMapeado} (${tipo}) - ID: ${nuevoId}`);
    return nuevoId;
  } catch (error: any) {
    console.error(`Error al crear concepto ${nombreMapeado}:`, error.message);
    return null;
  }
}

/**
 * Limpia un string de número removiendo símbolos
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '') return 0;

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
 * Inserta un movimiento
 */
function insertarMovimiento(movimiento: MovimientoImport): void {
  const conceptoId = obtenerConceptoId(movimiento.concepto, movimiento.tipo);

  if (!conceptoId) {
    throw new Error(`No se pudo obtener ID para concepto: ${movimiento.concepto}`);
  }

  db.prepare(
    `INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    movimiento.fecha,
    movimiento.tipo,
    movimiento.cuit || null,
    conceptoId,
    movimiento.monto,
    movimiento.observaciones || null
  );
}

/**
 * Procesa un archivo CSV
 */
export function procesarMovimientosCSV(contenido: string): MovimientoImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const movimientos: MovimientoImport[] = [];

  // Buscar header
  let indexHeader = -1;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].toLowerCase();
    if (linea.includes('fecha') && linea.includes('tipo') && linea.includes('concepto')) {
      indexHeader = i;
      break;
    }
  }

  const startIndex = indexHeader >= 0 ? indexHeader + 1 : 0;

  for (let i = startIndex; i < lineas.length; i++) {
    const linea = lineas[i];
    const campos = linea.split(',').map(c => c.trim());

    if (campos.length < 4 || !campos[0]) continue;

    try {
      const fecha = parsearFecha(campos[0]);
      const tipo = campos[1].toUpperCase();
      const concepto = campos[2];
      const monto = typeof campos[3] === 'string' ? limpiarNumero(campos[3]) : parseFloat(campos[3]);
      const cuit = campos[4] || undefined;
      const observaciones = campos[5] || undefined;

      if (monto > 0 && concepto) {
        movimientos.push({
          fecha,
          tipo,
          concepto,
          monto,
          cuit,
          observaciones
        });
      }
    } catch (error: any) {
      console.warn(`Línea ${i + 1} ignorada: ${error.message}`);
    }
  }

  return movimientos;
}

/**
 * Importa movimientos desde CSV
 */
export function importarMovimientosCSV(contenido: string): ImportResult {
  // Limpiar cache de conceptos antes de importar
  conceptosCache = null;

  const movimientos = procesarMovimientosCSV(contenido);

  const result: ImportResult = {
    insertados: 0,
    errores: [],
    registros_procesados: 0
  };

  transaction(() => {
    for (const movimiento of movimientos) {
      try {
        insertarMovimiento(movimiento);
        result.insertados++;
        result.registros_procesados++;
      } catch (error: any) {
        result.errores.push(`${movimiento.fecha} - ${movimiento.concepto}: ${error.message}`);
      }
    }
  });

  return result;
}
