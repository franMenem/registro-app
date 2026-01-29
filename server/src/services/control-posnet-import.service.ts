import db, { transaction } from '../db/database';

interface RegistroPosnetImport {
  fecha: string;
  monto_rentas: number;
  monto_caja: number;
  monto_ingresado_banco: number;
}

interface ImportResult {
  insertados: number;
  actualizados: number;
  errores: string[];
  registros_procesados: number;
}

/**
 * Limpia un string de número removiendo símbolos y convirtiendo formato argentino
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-' || valor.includes('$                     -')) {
    return 0;
  }

  // Remover símbolos de moneda, espacios y guiones
  let limpio = valor.replace(/[$\s-]/g, '').trim();

  if (!limpio || limpio === '') return 0;

  // Detectar si usa formato argentino (coma como decimal)
  const tieneComaDecimal = /,\d{1,2}$/.test(limpio);

  if (tieneComaDecimal) {
    // Formato argentino: 1.030.461,93
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato internacional o sin puntos: 1871,7 o 1871.7
    // Primero remover puntos de miles si existen
    const partes = limpio.split(',');
    if (partes.length === 2) {
      // Tiene coma, podría ser decimal
      limpio = limpio.replace(',', '.');
    } else {
      // No tiene coma, solo puntos (si los hay)
      // Si tiene múltiples puntos, son separadores de miles
      const puntos = (limpio.match(/\./g) || []).length;
      if (puntos > 1) {
        limpio = limpio.replace(/\./g, '');
      }
      // Si tiene un solo punto, es decimal (ya está bien)
    }
  }

  const numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}

/**
 * Parsea fecha en formato D/M/YY o DD/MM/YYYY
 */
function parsearFecha(fechaStr: string): string {
  fechaStr = fechaStr.trim();

  // Si ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return fechaStr;
  }

  // Parsear DD/MM/YYYY, D/M/YY, etc.
  const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if (match) {
    let dia = parseInt(match[1]);
    let mes = parseInt(match[2]);
    let anio = parseInt(match[3]);

    // Si el año es de 2 dígitos, completar
    if (anio < 100) {
      anio += 2000;
    }

    // Validar y retornar en formato YYYY-MM-DD
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio >= 2000) {
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  throw new Error(`Fecha inválida: ${fechaStr}`);
}

/**
 * Inserta o actualiza un registro de control POSNET
 */
function insertarOActualizarRegistro(registro: RegistroPosnetImport): void {
  const total_posnet = registro.monto_rentas + registro.monto_caja;
  const diferencia = total_posnet - registro.monto_ingresado_banco;

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
      registro.monto_ingresado_banco,
      diferencia,
      registro.fecha
    );
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
      registro.monto_ingresado_banco,
      diferencia
    );
  }
}

/**
 * Procesa un archivo CSV y retorna los registros parseados
 */
export function procesarCSV(contenido: string): RegistroPosnetImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const registros: RegistroPosnetImport[] = [];

  // Buscar la línea del header (fecha;posnet_rentas;posnet_caja;monto_ingresado)
  let indexHeader = -1;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].toLowerCase();
    if (linea.includes('fecha') && (linea.includes('posnet') || linea.includes('rentas'))) {
      indexHeader = i;
      break;
    }
  }

  // Si no encontramos header, empezar desde línea 0
  const startIndex = indexHeader >= 0 ? indexHeader + 1 : 0;

  // Procesar líneas de datos
  for (let i = startIndex; i < lineas.length; i++) {
    const linea = lineas[i];

    // Detectar separador (punto y coma o coma)
    const separador = linea.includes(';') ? ';' : ',';
    const campos = linea.split(separador).map(c => c.trim());

    // Necesitamos al menos fecha
    if (campos.length < 1 || !campos[0]) continue;

    try {
      const fecha = parsearFecha(campos[0]);
      const monto_rentas = campos[1] ? limpiarNumero(campos[1]) : 0;
      const monto_caja = campos[2] ? limpiarNumero(campos[2]) : 0;
      const monto_ingresado_banco = campos[3] ? limpiarNumero(campos[3]) : 0;

      // Solo agregar si al menos uno de los montos no es cero
      if (monto_rentas > 0 || monto_caja > 0 || monto_ingresado_banco > 0) {
        registros.push({
          fecha,
          monto_rentas,
          monto_caja,
          monto_ingresado_banco
        });
      }
    } catch (error: any) {
      // Ignorar líneas que no se pueden parsear
      console.warn(`Línea ${i + 1} ignorada: ${error.message}`);
    }
  }

  return registros;
}

/**
 * Importa registros desde CSV
 */
export function importarCSV(contenido: string): ImportResult {
  const registros = procesarCSV(contenido);

  const result: ImportResult = {
    insertados: 0,
    actualizados: 0,
    errores: [],
    registros_procesados: 0
  };

  transaction(() => {
    for (const registro of registros) {
      try {
        const existeAntes = db
          .prepare('SELECT id FROM control_posnet_diario WHERE fecha = ?')
          .get(registro.fecha);

        insertarOActualizarRegistro(registro);

        if (existeAntes) {
          result.actualizados++;
        } else {
          result.insertados++;
        }
        result.registros_procesados++;
      } catch (error: any) {
        result.errores.push(`${registro.fecha}: ${error.message}`);
      }
    }
  });

  return result;
}
