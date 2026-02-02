import db, { transaction } from '../db/database';
import {
  GastoMio,
  GastoMioCreate,
  GastoMioUpdate,
  GastoMioFilters,
  ResumenGastosMios,
  ConceptoGastoMio,
  CategoriaGastoMio,
  TipoGastoMio,
  CONCEPTOS_GASTOS_MIOS,
} from '../types/gastos-mios.types';

/**
 * Service para Gastos Mios (Gastos personales de Efi)
 * Sistema independiente para control de gastos personales
 */
export class GastosMiosService {
  /**
   * Obtener todos los gastos con filtros opcionales
   */
  obtenerTodos(filtros: GastoMioFilters = {}): GastoMio[] {
    let query = 'SELECT * FROM gastos_mios WHERE 1=1';
    const params: any[] = [];

    if (filtros.mes && filtros.anio) {
      query += " AND strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?";
      params.push(filtros.mes.toString().padStart(2, '0'), filtros.anio.toString());
    }

    if (filtros.concepto) {
      query += ' AND concepto = ?';
      params.push(filtros.concepto);
    }

    if (filtros.categoria) {
      query += ' AND categoria = ?';
      params.push(filtros.categoria);
    }

    if (filtros.tipo) {
      query += ' AND tipo = ?';
      params.push(filtros.tipo);
    }

    query += ' ORDER BY fecha DESC, created_at DESC';

    return db.prepare(query).all(...params) as GastoMio[];
  }

  /**
   * Obtener un gasto por ID
   */
  obtenerPorId(id: number): GastoMio | undefined {
    return db
      .prepare('SELECT * FROM gastos_mios WHERE id = ?')
      .get(id) as GastoMio | undefined;
  }

  /**
   * Crear un nuevo gasto
   */
  crear(data: GastoMioCreate): GastoMio {
    return transaction(() => {
      // Validación de monto
      if (data.monto <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Validación de concepto
      if (!CONCEPTOS_GASTOS_MIOS.includes(data.concepto)) {
        throw new Error('Concepto inválido');
      }

      const result = db
        .prepare(
          `INSERT INTO gastos_mios (fecha, concepto, monto, categoria, tipo, observaciones)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.fecha,
          data.concepto,
          data.monto,
          data.categoria,
          data.tipo,
          data.observaciones || null
        );

      const gastoCreado = this.obtenerPorId(result.lastInsertRowid as number);
      if (!gastoCreado) {
        throw new Error('Error al crear el gasto');
      }

      return gastoCreado;
    });
  }

  /**
   * Actualizar un gasto existente
   */
  actualizar(id: number, data: GastoMioUpdate): GastoMio {
    return transaction(() => {
      const gastoExistente = this.obtenerPorId(id);
      if (!gastoExistente) {
        throw new Error('Gasto no encontrado');
      }

      // Validar monto si se proporciona
      if (data.monto !== undefined && data.monto <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Validar concepto si se proporciona
      if (data.concepto && !CONCEPTOS_GASTOS_MIOS.includes(data.concepto)) {
        throw new Error('Concepto inválido');
      }

      const campos: string[] = [];
      const valores: any[] = [];

      if (data.fecha !== undefined) {
        campos.push('fecha = ?');
        valores.push(data.fecha);
      }
      if (data.concepto !== undefined) {
        campos.push('concepto = ?');
        valores.push(data.concepto);
      }
      if (data.monto !== undefined) {
        campos.push('monto = ?');
        valores.push(data.monto);
      }
      if (data.categoria !== undefined) {
        campos.push('categoria = ?');
        valores.push(data.categoria);
      }
      if (data.tipo !== undefined) {
        campos.push('tipo = ?');
        valores.push(data.tipo);
      }
      if (data.observaciones !== undefined) {
        campos.push('observaciones = ?');
        valores.push(data.observaciones || null);
      }

      if (campos.length === 0) {
        return gastoExistente;
      }

      campos.push('updated_at = CURRENT_TIMESTAMP');
      valores.push(id);

      const query = `UPDATE gastos_mios SET ${campos.join(', ')} WHERE id = ?`;
      db.prepare(query).run(...valores);

      const gastoActualizado = this.obtenerPorId(id);
      if (!gastoActualizado) {
        throw new Error('Error al actualizar el gasto');
      }

      return gastoActualizado;
    });
  }

  /**
   * Eliminar un gasto
   */
  eliminar(id: number): void {
    transaction(() => {
      const gasto = this.obtenerPorId(id);
      if (!gasto) {
        throw new Error('Gasto no encontrado');
      }

      db.prepare('DELETE FROM gastos_mios WHERE id = ?').run(id);
    });
  }

  /**
   * Obtener resumen mensual de gastos
   */
  obtenerResumenMensual(mes: number, anio: number): ResumenGastosMios {
    const gastosDelMes = this.obtenerTodos({ mes, anio });

    // Calcular totales por categoría
    const total_gastos = gastosDelMes
      .filter((g) => g.categoria === 'GASTO')
      .reduce((sum, gasto) => sum + gasto.monto, 0);

    const total_ingresos = gastosDelMes
      .filter((g) => g.categoria === 'INGRESO')
      .reduce((sum, gasto) => sum + gasto.monto, 0);

    const total_ahorros = gastosDelMes
      .filter((g) => g.categoria === 'AHORRO')
      .reduce((sum, gasto) => sum + gasto.monto, 0);

    // Total mes = Ingresos - Gastos + Ahorros
    const total_mes = total_ingresos - total_gastos + total_ahorros;

    const total_fijos = gastosDelMes
      .filter((g) => g.tipo === 'FIJO')
      .reduce((sum, gasto) => sum + gasto.monto, 0);
    const total_variables = gastosDelMes
      .filter((g) => g.tipo === 'VARIABLE')
      .reduce((sum, gasto) => sum + gasto.monto, 0);

    // Agrupar por concepto
    const gastosPorConceptoMap = new Map<
      ConceptoGastoMio,
      { total: number; categoria: CategoriaGastoMio; tipo: TipoGastoMio }
    >();

    gastosDelMes.forEach((gasto) => {
      const existing = gastosPorConceptoMap.get(gasto.concepto);
      if (existing) {
        existing.total += gasto.monto;
      } else {
        gastosPorConceptoMap.set(gasto.concepto, {
          total: gasto.monto,
          categoria: gasto.categoria,
          tipo: gasto.tipo,
        });
      }
    });

    const gastos_por_concepto = Array.from(gastosPorConceptoMap.entries()).map(
      ([concepto, data]) => ({
        concepto,
        total: data.total,
        categoria: data.categoria,
        tipo: data.tipo,
      })
    );

    // Calcular promedio de los últimos 6 meses
    const fechaActual = new Date(anio, mes - 1);
    const hace6Meses = new Date(fechaActual);
    hace6Meses.setMonth(hace6Meses.getMonth() - 5);

    const gastosUltimos6Meses = db
      .prepare(
        `SELECT SUM(monto) as total, COUNT(DISTINCT strftime('%Y-%m', fecha)) as meses
         FROM gastos_mios
         WHERE fecha >= ? AND fecha <= ?`
      )
      .get(
        hace6Meses.toISOString().split('T')[0],
        new Date(anio, mes, 0).toISOString().split('T')[0]
      ) as any;

    const promedio_mensual =
      gastosUltimos6Meses && gastosUltimos6Meses.meses > 0
        ? gastosUltimos6Meses.total / gastosUltimos6Meses.meses
        : 0;

    return {
      total_mes,
      total_gastos,
      total_ingresos,
      total_ahorros,
      total_fijos,
      total_variables,
      gastos_por_concepto,
      promedio_mensual,
    };
  }

  /**
   * Obtener totales anuales
   */
  obtenerTotalesAnuales(anio: number): {
    total_anual: number;
    meses: Array<{ mes: number; total: number }>;
  } {
    const resultado = db
      .prepare(
        `SELECT
          CAST(strftime('%m', fecha) AS INTEGER) as mes,
          SUM(monto) as total
         FROM gastos_mios
         WHERE strftime('%Y', fecha) = ?
         GROUP BY strftime('%m', fecha)
         ORDER BY mes`
      )
      .all(anio.toString()) as any[];

    const total_anual = resultado.reduce((sum, row) => sum + row.total, 0);

    return {
      total_anual,
      meses: resultado.map((row) => ({
        mes: row.mes,
        total: row.total,
      })),
    };
  }
}

export default new GastosMiosService();
