import db, { transaction } from '../db/database';
import {
  GastoPersonal,
  GastoPersonalCreate,
  GastoPersonalUpdate,
  GastoPersonalFilters,
  ResumenGastosPersonales,
  ConceptoGastoPersonal,
} from '../types/gastos-personales.types';

/**
 * Service para Gastos Personales de la Jefa
 * Principios SOLID:
 * - Single Responsibility: Manejo exclusivo de gastos personales
 * - Open/Closed: Extensible para nuevos tipos de reportes
 * - Dependency Inversion: Trabaja con abstracciones (interfaces)
 */
export class GastosPersonalesService {
  private readonly CONCEPTOS: ConceptoGastoPersonal[] = [
    'Gaspar',
    'Nacion',
    'Efectivo',
    'Patagonia',
    'Credicoop',
    'TERE',
  ];

  /**
   * Obtener todos los gastos con filtros opcionales
   */
  obtenerTodos(filtros: GastoPersonalFilters = {}): GastoPersonal[] {
    let query = 'SELECT * FROM gastos_personales WHERE 1=1';
    const params: any[] = [];

    if (filtros.mes && filtros.anio) {
      query += " AND strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?";
      params.push(filtros.mes.toString().padStart(2, '0'), filtros.anio.toString());
    }

    if (filtros.concepto) {
      query += ' AND concepto = ?';
      params.push(filtros.concepto);
    }

    if (filtros.estado) {
      query += ' AND estado = ?';
      params.push(filtros.estado);
    }

    query += ' ORDER BY fecha DESC, created_at DESC';

    return db.prepare(query).all(...params) as GastoPersonal[];
  }

  /**
   * Obtener un gasto por ID
   */
  obtenerPorId(id: number): GastoPersonal | undefined {
    return db
      .prepare('SELECT * FROM gastos_personales WHERE id = ?')
      .get(id) as GastoPersonal | undefined;
  }

  /**
   * Crear un nuevo gasto personal
   */
  crear(data: GastoPersonalCreate): GastoPersonal {
    return transaction(() => {
      // Validación de monto
      if (data.monto <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Validación de concepto
      if (!this.CONCEPTOS.includes(data.concepto)) {
        throw new Error('Concepto inválido');
      }

      const result = db
        .prepare(
          `
          INSERT INTO gastos_personales (fecha, concepto, monto, observaciones, estado)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .run(
          data.fecha,
          data.concepto,
          data.monto,
          data.observaciones || null,
          data.estado || 'Pagado'
        );

      const gastoCreado = this.obtenerPorId(result.lastInsertRowid as number);
      if (!gastoCreado) {
        throw new Error('Error al crear el gasto personal');
      }

      return gastoCreado;
    });
  }

  /**
   * Actualizar un gasto personal existente
   */
  actualizar(id: number, data: GastoPersonalUpdate): GastoPersonal {
    return transaction(() => {
      const gastoExistente = this.obtenerPorId(id);
      if (!gastoExistente) {
        throw new Error('Gasto personal no encontrado');
      }

      // Validar monto si se proporciona
      if (data.monto !== undefined && data.monto <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Validar concepto si se proporciona
      if (data.concepto && !this.CONCEPTOS.includes(data.concepto)) {
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
      if (data.observaciones !== undefined) {
        campos.push('observaciones = ?');
        valores.push(data.observaciones || null);
      }
      if (data.estado !== undefined) {
        campos.push('estado = ?');
        valores.push(data.estado);
      }

      if (campos.length === 0) {
        return gastoExistente;
      }

      campos.push('updated_at = CURRENT_TIMESTAMP');
      valores.push(id);

      db.prepare(
        `UPDATE gastos_personales SET ${campos.join(', ')} WHERE id = ?`
      ).run(...valores);

      const gastoActualizado = this.obtenerPorId(id);
      if (!gastoActualizado) {
        throw new Error('Error al actualizar el gasto personal');
      }

      return gastoActualizado;
    });
  }

  /**
   * Eliminar un gasto personal
   */
  eliminar(id: number): void {
    transaction(() => {
      const gasto = this.obtenerPorId(id);
      if (!gasto) {
        throw new Error('Gasto personal no encontrado');
      }

      // Buscar y eliminar el movimiento relacionado en efectivo (si existe)
      const movimientoEfectivo = db
        .prepare(
          `SELECT id FROM movimientos_efectivo
           WHERE fecha = ? AND monto = ? AND tipo = 'GASTO'
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(gasto.fecha, gasto.monto) as any;

      if (movimientoEfectivo) {
        db.prepare('DELETE FROM movimientos_efectivo WHERE id = ?').run(movimientoEfectivo.id);
        console.log(`✅ Movimiento de efectivo ${movimientoEfectivo.id} eliminado automáticamente`);
      }

      db.prepare('DELETE FROM gastos_personales WHERE id = ?').run(id);
    });
  }

  /**
   * Obtener resumen mensual de gastos personales
   */
  obtenerResumenMensual(mes: number, anio: number): ResumenGastosPersonales {
    // Total general del mes
    const totalQuery = db
      .prepare(
        `
        SELECT COALESCE(SUM(monto), 0) as total
        FROM gastos_personales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      `
      )
      .get(mes.toString().padStart(2, '0'), anio.toString()) as { total: number };

    // Gastos por concepto
    const gastosPorConcepto = db
      .prepare(
        `
        SELECT
          concepto,
          SUM(monto) as monto,
          MAX(CASE WHEN estado = 'Pagado' THEN 1 ELSE 0 END) as pagado
        FROM gastos_personales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
        GROUP BY concepto
      `
      )
      .all(
        mes.toString().padStart(2, '0'),
        anio.toString()
      ) as Array<{ concepto: ConceptoGastoPersonal; monto: number; pagado: number }>;

    // Conceptos que tienen al menos un gasto pagado en el mes
    const conceptosPagados = gastosPorConcepto
      .filter((g) => g.pagado === 1)
      .map((g) => g.concepto);

    // Conceptos pendientes (que NO tienen ningún gasto pagado en el mes)
    const pendientes = this.CONCEPTOS.filter((c) => !conceptosPagados.includes(c));

    return {
      mes,
      anio,
      total_general: totalQuery.total,
      gastos_por_concepto: gastosPorConcepto.map((g) => ({
        concepto: g.concepto,
        monto: g.monto,
        pagado: g.pagado === 1,
      })),
      pendientes,
    };
  }

  /**
   * Obtener conceptos pendientes del mes
   */
  obtenerConceptosPendientesMes(mes: number, anio: number): ConceptoGastoPersonal[] {
    const conceptosPagados = db
      .prepare(
        `
        SELECT DISTINCT concepto
        FROM gastos_personales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
        AND estado = 'Pagado'
      `
      )
      .all(mes.toString().padStart(2, '0'), anio.toString()) as Array<{
      concepto: ConceptoGastoPersonal;
    }>;

    const pagados = conceptosPagados.map((c) => c.concepto);
    return this.CONCEPTOS.filter((c) => !pagados.includes(c));
  }
}

export default new GastosPersonalesService();
