import fs from 'fs';
import path from 'path';

/**
 * Script para convertir datos raw de Control POSNET a formato CSV limpio
 *
 * Maneja:
 * - Fechas en español (Lunes, Martes, etc.)
 * - Formatos de números variados ($, comas, espacios)
 * - Dos columnas POSNET (RENTAS y CAJA)
 * - Columnas "ok" con monto ingresado
 *
 * Uso:
 *   npm run parse:posnet data/posnet_raw.txt
 */

interface PosnetDiario {
  fecha: string;
  monto_rentas: number;
  monto_caja: number;
  monto_ingresado_banco: number;
}

// Mapeo de días en español a números
const DIAS_SEMANA: { [key: string]: number } = {
  'lunes': 1,
  'martes': 2,
  'miercoles': 3,
  'miércoles': 3,
  'jueves': 4,
  'viernes': 5,
  'sabado': 6,
  'sábado': 6,
  'domingo': 0
};

// Mapeo de meses en español
const MESES: { [key: string]: number } = {
  'enero': 0,
  'febrero': 1,
  'marzo': 2,
  'abril': 3,
  'mayo': 4,
  'junio': 5,
  'julio': 6,
  'agosto': 7,
  'septiembre': 8,
  'octubre': 9,
  'noviembre': 10,
  'diciembre': 11
};

/**
 * Limpia un string de número removiendo símbolos y convirtiendo formato argentino
 * Ejemplos:
 *   "$1.234,56" -> 1234.56
 *   "1 234.56" -> 1234.56
 *   "1234.56" -> 1234.56
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '') return 0;

  // Remover símbolos de moneda y espacios
  let limpio = valor.replace(/[$\s]/g, '');

  // Detectar si usa formato argentino (coma como decimal)
  const tieneComaDecimal = /,\d{2}$/.test(limpio);

  if (tieneComaDecimal) {
    // Formato argentino: 1.234,56
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato internacional: 1,234.56 o 1234.56
    limpio = limpio.replace(/,/g, '');
  }

  const numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}

/**
 * Parsea fecha en diferentes formatos españoles
 * Formatos soportados:
 *   - "Lunes 15/01/2026"
 *   - "15/01/2026"
 *   - "15-01-2026"
 *   - "2026-01-15" (ya en formato correcto)
 */
function parsearFecha(fechaStr: string, anioReferencia?: number): string {
  fechaStr = fechaStr.trim().toLowerCase();

  // Si ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return fechaStr;
  }

  // Remover día de la semana si existe
  Object.keys(DIAS_SEMANA).forEach(dia => {
    fechaStr = fechaStr.replace(new RegExp(`^${dia}\\s+`, 'i'), '');
  });

  // Intentar parsear DD/MM/YYYY o DD-MM-YYYY
  const match = fechaStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);

  if (match) {
    let dia = parseInt(match[1]);
    let mes = parseInt(match[2]);
    let anio = parseInt(match[3]);

    // Si el año es de 2 dígitos, completar
    if (anio < 100) {
      anio += 2000;
    }

    // Si no hay año, usar referencia
    if (!anio && anioReferencia) {
      anio = anioReferencia;
    }

    // Validar y retornar en formato YYYY-MM-DD
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio >= 2000) {
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  throw new Error(`No se pudo parsear la fecha: ${fechaStr}`);
}

/**
 * Procesa línea de datos raw
 * Espera formato aproximado:
 * Fecha | ... | POSNET_RENTAS | ... | POSNET_CAJA | ... | OK | MONTO_INGRESADO
 */
function procesarLinea(linea: string, config: ParseConfig): PosnetDiario | null {
  // Separar por tabulaciones o múltiples espacios
  const campos = linea.split(/\t+|\s{2,}/).map(c => c.trim()).filter(c => c);

  if (campos.length < 3) return null;

  try {
    // Primera columna: fecha
    const fecha = parsearFecha(campos[0], config.anioReferencia);

    // Buscar columnas POSNET (usando índices configurables)
    const monto_rentas = limpiarNumero(campos[config.columnaPosnetRentas] || '0');
    const monto_caja = limpiarNumero(campos[config.columnaPosnetCaja] || '0');

    // Buscar monto ingresado (última columna numérica o configurada)
    let monto_ingresado_banco = 0;
    if (config.columnaMontoIngresado !== undefined) {
      monto_ingresado_banco = limpiarNumero(campos[config.columnaMontoIngresado] || '0');
    } else {
      // Buscar última columna con número válido
      for (let i = campos.length - 1; i >= 0; i--) {
        const num = limpiarNumero(campos[i]);
        if (num > 0) {
          monto_ingresado_banco = num;
          break;
        }
      }
    }

    return {
      fecha,
      monto_rentas,
      monto_caja,
      monto_ingresado_banco
    };
  } catch (error: any) {
    console.warn(`⚠ Línea ignorada: ${error.message}`);
    return null;
  }
}

interface ParseConfig {
  columnaPosnetRentas: number;
  columnaPosnetCaja: number;
  columnaMontoIngresado?: number;
  anioReferencia: number;
  saltarLineas: number; // Número de líneas de encabezado a saltar
}

/**
 * Configuración por defecto (ajustable por usuario)
 */
const CONFIG_DEFAULT: ParseConfig = {
  columnaPosnetRentas: 9,  // Ajustar según posición real
  columnaPosnetCaja: 10,   // Ajustar según posición real
  columnaMontoIngresado: undefined, // Auto-detectar
  anioReferencia: 2026,
  saltarLineas: 1
};

function parsearArchivo(filePath: string, config: ParseConfig = CONFIG_DEFAULT): PosnetDiario[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lineas = content.split('\n').map(l => l.trim()).filter(l => l);

  const registros: PosnetDiario[] = [];

  // Saltar encabezados
  for (let i = config.saltarLineas; i < lineas.length; i++) {
    const registro = procesarLinea(lineas[i], config);
    if (registro) {
      registros.push(registro);
    }
  }

  return registros;
}

function generarCSV(registros: PosnetDiario[], outputPath: string): void {
  const header = 'fecha,monto_rentas,monto_caja,monto_ingresado_banco\n';
  const rows = registros.map(r =>
    `${r.fecha},${r.monto_rentas},${r.monto_caja},${r.monto_ingresado_banco}`
  ).join('\n');

  const csv = header + rows;
  fs.writeFileSync(outputPath, csv, 'utf-8');
}

// Ejecutar script
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
📊 Script de Conversión - Control POSNET Raw

Uso:
  npm run parse:posnet <archivo_raw> [opciones]

Opciones:
  --rentas <col>    Índice de columna POSNET RENTAS (default: 9)
  --caja <col>      Índice de columna POSNET CAJA (default: 10)
  --ingresado <col> Índice de columna Monto Ingresado (default: auto)
  --anio <anio>     Año de referencia para fechas (default: 2026)
  --skip <n>        Líneas de encabezado a saltar (default: 1)

Ejemplo:
  npm run parse:posnet data/posnet_raw.txt --rentas 9 --caja 10

El resultado se guardará como: posnet_clean.csv
  `);
  process.exit(0);
}

const inputFile = args[0];
const config = { ...CONFIG_DEFAULT };

// Parsear opciones
for (let i = 1; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];

  switch (flag) {
    case '--rentas':
      config.columnaPosnetRentas = parseInt(value);
      break;
    case '--caja':
      config.columnaPosnetCaja = parseInt(value);
      break;
    case '--ingresado':
      config.columnaMontoIngresado = parseInt(value);
      break;
    case '--anio':
      config.anioReferencia = parseInt(value);
      break;
    case '--skip':
      config.saltarLineas = parseInt(value);
      break;
  }
}

try {
  console.log('\n📊 Iniciando conversión de datos raw...\n');
  console.log('Configuración:');
  console.log(`  - Columna POSNET RENTAS: ${config.columnaPosnetRentas}`);
  console.log(`  - Columna POSNET CAJA: ${config.columnaPosnetCaja}`);
  console.log(`  - Columna Monto Ingresado: ${config.columnaMontoIngresado || 'auto-detectar'}`);
  console.log(`  - Año referencia: ${config.anioReferencia}`);
  console.log(`  - Saltar líneas: ${config.saltarLineas}\n`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Archivo no encontrado: ${inputFile}`);
  }

  console.log(`📄 Leyendo archivo: ${inputFile}...`);
  const registros = parsearArchivo(inputFile, config);

  console.log(`✓ Se procesaron ${registros.length} registros\n`);

  if (registros.length === 0) {
    console.warn('⚠ No se encontraron registros válidos. Verificá la configuración de columnas.');
    process.exit(1);
  }

  // Mostrar primeros 5 registros como preview
  console.log('Vista previa (primeros 5 registros):');
  console.log('='.repeat(80));
  registros.slice(0, 5).forEach(r => {
    console.log(`${r.fecha} | RENTAS: $${r.monto_rentas.toFixed(2)} | CAJA: $${r.monto_caja.toFixed(2)} | Ingresado: $${r.monto_ingresado_banco.toFixed(2)}`);
  });
  console.log('='.repeat(80) + '\n');

  // Generar CSV
  const outputFile = 'posnet_clean.csv';
  const outputPath = path.join(process.cwd(), 'data', outputFile);

  // Crear directorio si no existe
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  generarCSV(registros, outputPath);

  console.log(`✅ Archivo CSV generado: ${outputPath}`);
  console.log('\nAhora podés ejecutar la migración:');
  console.log(`  npm run migrate:posnet csv ${path.relative(process.cwd(), outputPath)}\n`);

} catch (error: any) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
