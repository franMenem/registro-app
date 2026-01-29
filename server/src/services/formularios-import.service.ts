import db, { transaction } from '../db/database';

interface FormularioImport {
  tipo: string;
  numero: string;
  pagado: boolean;
  vencimientos: {
    numero_vencimiento: number;
    monto: number;
    fecha_vencimiento: string;
  }[];
}

/**
 * Parsear fecha en formato DD/MM/YY o D/M/YY
 */
function parsearFecha(fechaStr: string): string {
  const partes = fechaStr.trim().split('/');
  if (partes.length !== 3) {
    throw new Error(`Formato de fecha inválido: ${fechaStr}`);
  }

  let [dia, mes, anio] = partes;

  // Pad dia y mes con 0 si es necesario
  dia = dia.padStart(2, '0');
  mes = mes.padStart(2, '0');

  // Convertir año de 2 dígitos a 4 dígitos
  if (anio.length === 2) {
    const anioNum = parseInt(anio);
    anio = anioNum >= 50 ? `19${anio}` : `20${anio}`;
  }

  return `${anio}-${mes}-${dia}`;
}

/**
 * Limpiar número en formato argentino: $3.500,00 o $3.727,50 → 3500.00
 */
function limpiarNumero(valor: string): number {
  if (!valor || valor.trim() === '' || valor.trim() === '-') {
    return 0;
  }

  // Remover $, espacios
  let limpio = valor.replace(/[$\s]/g, '').trim();

  // Detectar si tiene coma decimal
  const tieneComaDecimal = /,\d{1,2}$/.test(limpio);

  if (tieneComaDecimal) {
    // Formato argentino: 1.234,56
    // Remover puntos (separadores de miles) y reemplazar coma por punto
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    // Ya está en formato correcto o no tiene decimales
  }

  const numero = parseFloat(limpio);
  if (isNaN(numero)) {
    throw new Error(`Valor numérico inválido: ${valor}`);
  }

  return numero;
}

/**
 * Parsear una línea CSV considerando que los montos usan coma como decimal
 * Formato esperado:
 * Tipo,Factura,1er Monto,1er Fecha,2do Monto,2da Fecha,3er Monto,3er Fecha,Pagado
 * 3,49496,$ 3.500,00,2/7/21,$ 3.727,50,12/7/21,$ 3.832,50,1/8/21,SI
 *
 * Estrategia: Los montos siempre empiezan con $ y las fechas tienen formato D/M/YY
 * Agrupamos los campos correctamente después del split
 */
function parsearLineaCSV(linea: string): string[] {
  const partes = linea.split(',');
  const campos: string[] = [];

  let i = 0;
  while (i < partes.length) {
    const parte = partes[i].trim();

    // Si empieza con $, es un monto que fue partido por la coma decimal
    if (parte.startsWith('$')) {
      // El siguiente elemento es la parte decimal
      if (i + 1 < partes.length) {
        campos.push(parte + ',' + partes[i + 1]);
        i += 2; // Saltar dos elementos
      } else {
        campos.push(parte);
        i++;
      }
    } else {
      campos.push(parte);
      i++;
    }
  }

  return campos;
}

/**
 * Procesar CSV de formularios
 * Formato esperado:
 * Tipo,Factura,1er Monto,1er Fecha,2do Monto,2da Fecha,3er Monto,3er Fecha,Pagado
 * 3,49496,$ 3.500,00,2/7/21,$ 3.727,50,12/7/21,$ 3.832,50,1/8/21,SI
 *
 * La columna "Pagado" es opcional. Si contiene SI/PAGADO, marca los vencimientos como pagados.
 */
export function procesarFormulariosCSV(contenido: string): FormularioImport[] {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const formularios: FormularioImport[] = [];

  // Primera línea es el header, saltarla
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    const campos = parsearLineaCSV(linea);

    if (campos.length < 8) {
      console.warn(`Línea ${i + 1} ignorada (columnas insuficientes: ${campos.length}): ${linea}`);
      continue;
    }

    try {
      const tipo = campos[0].trim();
      const numero = campos[1].trim();

      // Si no tiene fecha en ninguna columna, descartar la línea
      if (!campos[3] || campos[3].trim() === '') {
        console.warn(`Línea ${i + 1} ignorada (sin fecha): ${linea}`);
        continue;
      }

      // Columna 8 (opcional): Pagado
      const pagadoStr = campos[8] ? campos[8].trim().toUpperCase() : '';
      const pagado = ['SI', 'PAGADO', 'YES', 'TRUE', 'S', 'Y'].includes(pagadoStr);

      // Parsear primer vencimiento (siempre debe existir)
      const monto1 = limpiarNumero(campos[2]);
      const fecha1 = parsearFecha(campos[3]);

      // Parsear segundo vencimiento (usar primero como fallback si está vacío)
      let monto2 = limpiarNumero(campos[4]);
      let fecha2: string;
      if (!campos[5] || campos[5].trim() === '') {
        fecha2 = fecha1;
        if (monto2 === 0) monto2 = monto1;
      } else {
        fecha2 = parsearFecha(campos[5]);
      }

      // Parsear tercer vencimiento (usar primero como fallback si está vacío)
      let monto3 = limpiarNumero(campos[6]);
      let fecha3: string;
      if (!campos[7] || campos[7].trim() === '') {
        fecha3 = fecha1;
        if (monto3 === 0) monto3 = monto1;
      } else {
        fecha3 = parsearFecha(campos[7]);
      }

      const vencimientos = [
        {
          numero_vencimiento: 1,
          monto: monto1,
          fecha_vencimiento: fecha1,
        },
        {
          numero_vencimiento: 2,
          monto: monto2,
          fecha_vencimiento: fecha2,
        },
        {
          numero_vencimiento: 3,
          monto: monto3,
          fecha_vencimiento: fecha3,
        },
      ];

      formularios.push({
        tipo,
        numero,
        pagado,
        vencimientos,
      });
    } catch (error: any) {
      console.error(`Error en línea ${i + 1}: ${error.message}`);
      throw new Error(`Error en línea ${i + 1}: ${error.message}`);
    }
  }

  return formularios;
}

/**
 * Importar formularios desde CSV
 */
export function importarFormulariosCSV(contenido: string): {
  insertados: number;
  errores: string[];
} {
  const formularios = procesarFormulariosCSV(contenido);
  const errores: string[] = [];
  let insertados = 0;

  // Validar números únicos en el CSV
  const numerosEnCSV = new Set<string>();
  for (const formulario of formularios) {
    if (numerosEnCSV.has(formulario.numero)) {
      errores.push(`El número de formulario ${formulario.numero} está duplicado en el CSV`);
    }
    numerosEnCSV.add(formulario.numero);
  }

  transaction(() => {
    for (const formulario of formularios) {
      try {
        // El monto total es el del primer vencimiento (monto base sin recargos)
        const montoTotal = formulario.vencimientos[0].monto;

        // Usar la fecha del primer vencimiento como fecha_compra
        const fechaCompra = formulario.vencimientos[0].fecha_vencimiento;

        // Crear descripción basada en el tipo
        let descripcion = '';
        if (formulario.tipo === '3') {
          descripcion = 'CARCOS';
        } else if (formulario.tipo === '9') {
          descripcion = 'EX-LIBRIS';
        } else {
          descripcion = `Formulario tipo ${formulario.tipo}`;
        }

        // Insertar formulario
        const resultFormulario = db
          .prepare(
            `INSERT INTO formularios (numero, descripcion, monto, fecha_compra, proveedor)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(
            formulario.numero,
            descripcion,
            montoTotal,
            fechaCompra,
            'IMPORTADO'
          );

        const formularioId = resultFormulario.lastInsertRowid as number;

        // Insertar vencimientos
        for (const venc of formulario.vencimientos) {
          // Si está marcado como pagado, solo el 3er vencimiento se marca como PAGADO
          // Los otros 2 quedan como VENCIDO
          let estado: string;
          let fechaPago: string | null = null;

          if (formulario.pagado) {
            if (venc.numero_vencimiento === 3) {
              estado = 'PAGADO';
              fechaPago = venc.fecha_vencimiento;
            } else {
              estado = 'VENCIDO';
            }
          } else {
            estado = 'PENDIENTE';
          }

          db.prepare(
            `INSERT INTO formularios_vencimientos
             (formulario_id, numero_vencimiento, fecha_vencimiento, monto, estado, fecha_pago)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(
            formularioId,
            venc.numero_vencimiento,
            venc.fecha_vencimiento,
            venc.monto,
            estado,
            fechaPago
          );
        }

        insertados++;
      } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
          errores.push(
            `Formulario ${formulario.numero} ya existe (duplicado)`
          );
        } else {
          errores.push(
            `Error al insertar formulario ${formulario.numero}: ${error.message}`
          );
        }
      }
    }
  });

  return { insertados, errores };
}

export default {
  procesarFormulariosCSV,
  importarFormulariosCSV,
};
