import db, { transaction } from '../db/database';
import { IMovimientoResult } from '../interfaces/control.interface';
import controlSemanalService from './controles-semanales.service';
import controlQuincenalService from './controles-quincenales.service';
import controlPOSNETService from './control-posnet.service';
import cuentasService from './cuentas.service';

/**
 * Servicio principal de movimientos
 * Orquesta las acciones según el concepto del movimiento
 * Aplicando Single Responsibility y Open/Closed Principles
 */
export class MovimientosService {
  /**
   * Crea un nuevo movimiento y ejecuta acciones automáticas según el concepto
   */
  async crear(movimiento: {
    fecha: string;
    tipo: 'RENTAS' | 'CAJA';
    cuit: string;
    concepto_id: number;
    monto: number;
    observaciones?: string;
  }): Promise<IMovimientoResult> {
    const alertas: string[] = [];

    // Validar concepto
    const concepto = db
      .prepare('SELECT * FROM conceptos WHERE id = ?')
      .get(movimiento.concepto_id) as any;

    if (!concepto) {
      throw new Error('Concepto no válido');
    }

    // Validar que el concepto corresponda al tipo
    if (concepto.tipo !== movimiento.tipo) {
      throw new Error(`El concepto ${concepto.nombre} no corresponde al tipo ${movimiento.tipo}`);
    }

    // Ejecutar en transacción
    const result = transaction(() => {
      // 1. Insertar movimiento
      const insertResult = db
        .prepare(
          `INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          movimiento.fecha,
          movimiento.tipo,
          movimiento.cuit,
          movimiento.concepto_id,
          movimiento.monto,
          movimiento.observaciones
        );

      const movimientoId = insertResult.lastInsertRowid as number;

      // 2. Aplicar lógica según frecuencia de pago y concepto
      const fecha = new Date(movimiento.fecha);

      if (concepto.frecuencia_pago === 'SEMANAL') {
        // Controles semanales
        controlSemanalService.actualizarControl(concepto.id, fecha, movimiento.monto);
        alertas.push(
          `Control semanal actualizado para ${concepto.nombre}. Pago programado para el próximo lunes.`
        );
      } else if (concepto.frecuencia_pago === 'QUINCENAL') {
        // Controles quincenales (ARBA)
        controlQuincenalService.actualizarControl(concepto.id, fecha, movimiento.monto);
        alertas.push(
          `Control quincenal actualizado para ${concepto.nombre}. Pago programado 5 días corridos después de fin de quincena.`
        );
      }

      // 3. Lógica específica por concepto
      if (concepto.nombre === 'POSNET' || concepto.nombre === 'POSNET CAJA') {
        // Control POSNET
        controlPOSNETService.actualizarControl(fecha, movimiento.monto, movimiento.tipo);
        alertas.push(
          `Control POSNET mensual actualizado. Este concepto requiere revisión manual.`
        );
      } else if (concepto.nombre === 'ICBC') {
        // Va a cuenta corriente "Gastos Bancarios"
        const cuenta = cuentasService.getCuentaByNombre('Gastos Bancarios');
        if (cuenta) {
          cuentasService.crearMovimiento(
            cuenta.id,
            movimiento.fecha,
            'EGRESO',
            `ICBC - CUIT ${movimiento.cuit}`,
            movimiento.monto,
            movimientoId
          );
          alertas.push(
            `Egreso registrado en cuenta corriente "Gastos Bancarios" por $${movimiento.monto.toFixed(
              2
            )}`
          );
        }
      } else if (concepto.nombre === 'Formularios') {
        // Va a cuenta corriente "Gastos Formularios"
        const cuenta = cuentasService.getCuentaByNombre('Gastos Formularios');
        if (cuenta) {
          cuentasService.crearMovimiento(
            cuenta.id,
            movimiento.fecha,
            'EGRESO',
            `Formularios - CUIT ${movimiento.cuit}`,
            movimiento.monto,
            movimientoId
          );
          alertas.push(
            `Egreso registrado en cuenta corriente "Gastos Formularios" por $${movimiento.monto.toFixed(
              2
            )}`
          );
        }
      }

      return { movimientoId, alertas };
    });

    return result;
  }

  /**
   * Obtiene todos los movimientos con filtros
   */
  getMovimientos(filters?: {
    tipo?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    conceptoId?: number;
    limit?: number;
    offset?: number;
  }): any[] {
    let query = `
      SELECT m.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo
      FROM movimientos m
      JOIN conceptos c ON m.concepto_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.tipo) {
      query += ' AND m.tipo = ?';
      params.push(filters.tipo);
    }

    if (filters?.fechaDesde) {
      query += ' AND m.fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND m.fecha <= ?';
      params.push(filters.fechaHasta);
    }

    if (filters?.conceptoId) {
      query += ' AND m.concepto_id = ?';
      params.push(filters.conceptoId);
    }

    query += ' ORDER BY m.fecha DESC, m.id DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Obtiene un movimiento por ID
   */
  getById(id: number): any {
    return db
      .prepare(
        `SELECT m.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo
         FROM movimientos m
         JOIN conceptos c ON m.concepto_id = c.id
         WHERE m.id = ?`
      )
      .get(id);
  }

  /**
   * Actualiza un movimiento
   */
  async actualizar(
    id: number,
    datos: Partial<{
      fecha: string;
      cuit: string;
      concepto_id: number;
      monto: number;
      observaciones: string;
    }>
  ): Promise<void> {
    const movimiento = this.getById(id);
    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    const campos = Object.keys(datos)
      .map((key) => `${key} = ?`)
      .join(', ');
    const valores = Object.values(datos);

    db.prepare(`UPDATE movimientos SET ${campos} WHERE id = ?`).run(...valores, id);
  }

  /**
   * Elimina un movimiento
   */
  async eliminar(id: number): Promise<void> {
    const movimiento = this.getById(id);
    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    db.prepare('DELETE FROM movimientos WHERE id = ?').run(id);
  }
}

export default new MovimientosService();
