import fs from 'fs';
import path from 'path';
import db, { transaction } from '../db/database';

/**
 * Script de migración para Control POSNET Diario
 *
 * Acepta dos formatos:
 * 1. CSV: control_posnet.csv
 * 2. JSON: control_posnet.json
 *
 * Uso:
 *   npm run migrate:posnet csv ruta/al/archivo.csv
 *   npm run migrate:posnet json ruta/al/archivo.json
 */

interface RegistroPosnet {
  fecha: string;
  monto_rentas: number;
  monto_caja: number;
  monto_ingresado_banco?: number;
}

function parseCsvLine(line: string): string[] {
  return line.split(',').map(field => field.trim());
}

function leerCSV(filePath: string): RegistroPosnet[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Verificar header
  const header = lines[0].toLowerCase();
  if (!header.includes('fecha') || !header.includes('monto_rentas') || !header.includes('monto_caja')) {
    throw new Error('CSV debe tener columnas: fecha, monto_rentas, monto_caja, monto_ingresado_banco');
  }

  const registros: RegistroPosnet[] = [];

  // Procesar líneas (saltear header)
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 3) continue;

    registros.push({
      fecha: fields[0],
      monto_rentas: parseFloat(fields[1]) || 0,
      monto_caja: parseFloat(fields[2]) || 0,
      monto_ingresado_banco: fields[3] ? parseFloat(fields[3]) : 0,
    });
  }

  return registros;
}

function leerJSON(filePath: string): RegistroPosnet[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function validarFecha(fecha: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fecha)) return false;

  const date = new Date(fecha);
  return date instanceof Date && !isNaN(date.getTime());
}

function insertarRegistro(registro: RegistroPosnet): void {
  // Validar fecha
  if (!validarFecha(registro.fecha)) {
    throw new Error(`Fecha inválida: ${registro.fecha}. Formato esperado: YYYY-MM-DD`);
  }

  // Calcular totales
  const total_posnet = registro.monto_rentas + registro.monto_caja;
  const monto_ingresado = registro.monto_ingresado_banco || 0;
  const diferencia = total_posnet - monto_ingresado;

  // Verificar si ya existe
  const existe = db
    .prepare('SELECT id FROM control_posnet_diario WHERE fecha = ?')
    .get(registro.fecha);

  if (existe) {
    // Actualizar
    db.prepare(
      `UPDATE control_posnet_diario
       SET monto_rentas = ?, monto_caja = ?, total_posnet = ?,
           monto_ingresado_banco = ?, diferencia = ?, updated_at = CURRENT_TIMESTAMP
       WHERE fecha = ?`
    ).run(
      registro.monto_rentas,
      registro.monto_caja,
      total_posnet,
      monto_ingresado,
      diferencia,
      registro.fecha
    );
    console.log(`✓ Actualizado: ${registro.fecha}`);
  } else {
    // Insertar
    db.prepare(
      `INSERT INTO control_posnet_diario
       (fecha, monto_rentas, monto_caja, total_posnet, monto_ingresado_banco, diferencia)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      registro.fecha,
      registro.monto_rentas,
      registro.monto_caja,
      total_posnet,
      monto_ingresado,
      diferencia
    );
    console.log(`✓ Insertado: ${registro.fecha}`);
  }
}

function migrar(tipo: 'csv' | 'json', filePath: string): void {
  try {
    console.log('\n📊 Iniciando migración de Control POSNET Diario...\n');

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    // Leer registros según el tipo
    let registros: RegistroPosnet[];
    if (tipo === 'csv') {
      console.log(`📄 Leyendo archivo CSV: ${filePath}`);
      registros = leerCSV(filePath);
    } else {
      console.log(`📄 Leyendo archivo JSON: ${filePath}`);
      registros = leerJSON(filePath);
    }

    console.log(`✓ Se encontraron ${registros.length} registros\n`);

    // Insertar en transacción
    transaction(() => {
      let insertados = 0;
      let actualizados = 0;
      let errores = 0;

      for (const registro of registros) {
        try {
          const existeAntes = db
            .prepare('SELECT id FROM control_posnet_diario WHERE fecha = ?')
            .get(registro.fecha);

          insertarRegistro(registro);

          if (existeAntes) {
            actualizados++;
          } else {
            insertados++;
          }
        } catch (error: any) {
          console.error(`✗ Error en ${registro.fecha}: ${error.message}`);
          errores++;
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log('📈 Resumen de migración:');
      console.log('='.repeat(50));
      console.log(`✓ Registros insertados:  ${insertados}`);
      console.log(`✓ Registros actualizados: ${actualizados}`);
      if (errores > 0) {
        console.log(`✗ Errores:                ${errores}`);
      }
      console.log('='.repeat(50) + '\n');
    });

    console.log('✅ Migración completada exitosamente!\n');
  } catch (error: any) {
    console.error('\n❌ Error en la migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
const args = process.argv.slice(2);
const tipo = args[0] as 'csv' | 'json';
const filePath = args[1];

if (!tipo || !filePath) {
  console.log(`
📊 Script de Migración - Control POSNET Diario

Uso:
  npm run migrate:posnet csv ruta/al/archivo.csv
  npm run migrate:posnet json ruta/al/archivo.json

Formato CSV:
  fecha,monto_rentas,monto_caja,monto_ingresado_banco
  2026-01-15,12500.50,8300.00,20800.50
  2026-01-16,15200.00,9450.75,24650.75

Formato JSON:
  [
    {
      "fecha": "2026-01-15",
      "monto_rentas": 12500.50,
      "monto_caja": 8300.00,
      "monto_ingresado_banco": 20800.50
    }
  ]
  `);
  process.exit(0);
}

if (tipo !== 'csv' && tipo !== 'json') {
  console.error('❌ Tipo debe ser "csv" o "json"');
  process.exit(1);
}

migrar(tipo, filePath);
