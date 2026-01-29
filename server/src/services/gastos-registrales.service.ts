import db from '../db/database';
import {
  GastoRegistral,
  GastoRegistralCreate,
  GastoRegistralUpdate,
  GastoRegistralFilters,
  ResumenMensualGR,
  CONCEPTOS_CONFIG,
  ConceptoGastoRegistral,
} from '../types/gastos-registrales.types';

/**
 * Servicio para gestionar Gastos Registrales
 * Principio Single Responsibility: Solo maneja la lógica de gastos registrales
 */
export class GastosRegistralesService {
  /**
   * Obtener todos los gastos con filtros opcionales
   */
  obtenerTodos(filtros?: GastoRegistralFilters): GastoRegistral[] {
    let query = 'SELECT * FROM gastos_registrales WHERE 1=1';
    const params: any[] = [];

    if (filtros?.mes && filtros?.anio) {
      query += ` AND strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?`;
      params.push(filtros.mes.toString().padStart(2, '0'), filtros.anio.toString());
    }

    if (filtros?.concepto) {
      query += ' AND concepto = ?';
      params.push(filtros.concepto);
    }

    if (filtros?.estado) {
      query += ' AND estado = ?';
      params.push(filtros.estado);
    }

    query += ' ORDER BY fecha DESC';

    return db.prepare(query).all(...params) as GastoRegistral[];
  }

  /**
   * Obtener gasto por ID
   */
  obtenerPorId(id: number): GastoRegistral | undefined {
    return db
      .prepare('SELECT * FROM gastos_registrales WHERE id = ?')
      .get(id) as GastoRegistral | undefined;
  }

  /**
   * Crear un nuevo gasto
   */
  crear(data: GastoRegistralCreate): GastoRegistral {
    const stmt = db.prepare(`
      INSERT INTO gastos_registrales
      (fecha, concepto, monto, observaciones, origen, estado, boleta1, boleta2, boleta3, boleta4)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.fecha,
      data.concepto,
      data.monto,
      data.observaciones || null,
      data.origen || 'MANUAL',
      data.estado || 'Pagado',
      data.boleta1 || 0,
      data.boleta2 || 0,
      data.boleta3 || 0,
      data.boleta4 || 0
    );

    const gasto = this.obtenerPorId(result.lastInsertRowid as number);
    if (!gasto) {
      throw new Error('Error al crear el gasto registral');
    }

    return gasto;
  }

  /**
   * Actualizar un gasto existente
   */
  actualizar(id: number, data: GastoRegistralUpdate): GastoRegistral {
    const gasto = this.obtenerPorId(id);
    if (!gasto) {
      throw new Error('Gasto no encontrado');
    }

    const campos: string[] = [];
    const valores: any[] = [];

    if (data.fecha !== undefined) {
      campos.push('fecha = ?');
      valores.push(data.fecha);
    }
    if (data.monto !== undefined) {
      campos.push('monto = ?');
      valores.push(data.monto);
    }
    if (data.observaciones !== undefined) {
      campos.push('observaciones = ?');
      valores.push(data.observaciones);
    }
    if (data.estado !== undefined) {
      campos.push('estado = ?');
      valores.push(data.estado);
    }
    if (data.boleta1 !== undefined) {
      campos.push('boleta1 = ?');
      valores.push(data.boleta1);
    }
    if (data.boleta2 !== undefined) {
      campos.push('boleta2 = ?');
      valores.push(data.boleta2);
    }
    if (data.boleta3 !== undefined) {
      campos.push('boleta3 = ?');
      valores.push(data.boleta3);
    }
    if (data.boleta4 !== undefined) {
      campos.push('boleta4 = ?');
      valores.push(data.boleta4);
    }

    if (campos.length === 0) {
      return gasto;
    }

    valores.push(id);
    const query = `UPDATE gastos_registrales SET ${campos.join(', ')} WHERE id = ?`;

    db.prepare(query).run(...valores);

    const gastoActualizado = this.obtenerPorId(id);
    if (!gastoActualizado) {
      throw new Error('Error al actualizar el gasto');
    }

    return gastoActualizado;
  }

  /**
   * Eliminar un gasto
   */
  eliminar(id: number): void {
    const gasto = this.obtenerPorId(id);
    if (!gasto) {
      throw new Error('Gasto no encontrado');
    }

    db.prepare('DELETE FROM gastos_registrales WHERE id = ?').run(id);
  }

  /**
   * Obtener resumen mensual
   */
  obtenerResumenMensual(mes: number, anio: number): ResumenMensualGR {
    // Total de gastos del mes
    const gastosDelMes = this.obtenerTodos({ mes, anio, estado: 'Pagado' });

    // Total por concepto
    const gastosPorConcepto = gastosDelMes.reduce((acc, gasto) => {
      const existing = acc.find((g) => g.concepto === gasto.concepto);
      if (existing) {
        existing.monto += gasto.monto;
      } else {
        acc.push({
          concepto: gasto.concepto,
          monto: gasto.monto,
          pagado: gasto.estado === 'Pagado',
        });
      }
      return acc;
    }, [] as { concepto: string; monto: number; pagado: boolean }[]);

    // Gastos OTROS
    const otrosGastos =
      gastosDelMes
        .filter((g) => g.concepto === 'OTROS')
        .reduce((sum, g) => sum + g.monto, 0) || 0;

    // Adelantos (se calculan desde el servicio de adelantos)
    const adelantosDami = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = 'DAMI'
        AND strftime('%m', fecha_adelanto) = ?
        AND strftime('%Y', fecha_adelanto) = ?
    `
      )
      .get(mes.toString().padStart(2, '0'), anio.toString()) as { total: number };

    const adelantosMumi = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = 'MUMI'
        AND strftime('%m', fecha_adelanto) = ?
        AND strftime('%Y', fecha_adelanto) = ?
    `
      )
      .get(mes.toString().padStart(2, '0'), anio.toString()) as { total: number };

    const totalGastosFijos =
      gastosDelMes.filter((g) => g.concepto !== 'OTROS').reduce((sum, g) => sum + g.monto, 0) ||
      0;

    const totalGeneral =
      totalGastosFijos +
      adelantosDami.total +
      adelantosMumi.total +
      otrosGastos;

    return {
      mes,
      anio,
      total_gastos_fijos: totalGastosFijos,
      adelantos_dami: adelantosDami.total,
      adelantos_mumi: adelantosMumi.total,
      otros_gastos: otrosGastos,
      total_general: totalGeneral,
      gastos_por_concepto: gastosPorConcepto,
    };
  }

  /**
   * Obtener gastos pendientes del mes actual (para alertas)
   */
  obtenerGastosPendientesMes(mes: number, anio: number): ConceptoGastoRegistral[] {
    // Obtener todos los conceptos que requieren alerta
    const conceptosConAlerta = CONCEPTOS_CONFIG.filter((c) => c.requiere_alerta_mensual).map(
      (c) => c.nombre
    );

    // Obtener conceptos ya pagados este mes
    const gastosPagados = this.obtenerTodos({ mes, anio, estado: 'Pagado' });
    const conceptosPagados = gastosPagados.map((g) => g.concepto);

    // Retornar conceptos pendientes
    return conceptosConAlerta.filter(
      (concepto) => !conceptosPagados.includes(concepto)
    ) as ConceptoGastoRegistral[];
  }

  /**
   * Verificar si un concepto tiene modal especial
   */
  tieneModalEspecial(concepto: ConceptoGastoRegistral): 'ABL' | 'AYSA' | null {
    const config = CONCEPTOS_CONFIG.find((c) => c.nombre === concepto);
    return config?.modal_especial || null;
  }
}

export default new GastosRegistralesService();
