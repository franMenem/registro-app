import db from '../db/database';
import { Deposito, DepositoCreate, DepositoUpdate, DepositoFilters } from '../types/deposito.types';

/**
 * Servicio para gestión de depósitos
 * Aplicando Single Responsibility Principle
 */
export class DepositosService {
  /**
   * Obtiene todos los depósitos con filtros opcionales
   */
  getDepositos(filters?: DepositoFilters): Deposito[] {
    let query = `
      SELECT d.*, cc.nombre as cuenta_nombre
      FROM depositos d
      LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.estado) {
      query += ' AND d.estado = ?';
      params.push(filters.estado);
    }

    if (filters?.cuenta_id) {
      query += ' AND d.cuenta_id = ?';
      params.push(filters.cuenta_id);
    }

    if (filters?.fecha_desde) {
      query += ' AND d.fecha_ingreso >= ?';
      params.push(filters.fecha_desde);
    }

    if (filters?.fecha_hasta) {
      query += ' AND d.fecha_ingreso <= ?';
      params.push(filters.fecha_hasta);
    }

    query += ' ORDER BY d.fecha_ingreso DESC, d.created_at DESC';

    return db.prepare(query).all(...params) as Deposito[];
  }

  /**
   * Obtiene un depósito por ID
   */
  getDepositoById(id: number): Deposito | null {
    const deposito = db
      .prepare(
        `SELECT d.*, cc.nombre as cuenta_nombre
         FROM depositos d
         LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
         WHERE d.id = ?`
      )
      .get(id) as Deposito | undefined;

    return deposito || null;
  }

  /**
   * Crea un nuevo depósito
   */
  crear(data: DepositoCreate): Deposito {
    const result = db
      .prepare(
        `INSERT INTO depositos
         (monto_original, saldo_actual, fecha_ingreso, titular, observaciones, cuenta_id, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')`
      )
      .run(
        data.monto_original,
        data.monto_original, // saldo_actual inicial = monto_original
        data.fecha_ingreso,
        data.titular,
        data.observaciones || null,
        data.cuenta_id || null
      );

    const deposito = this.getDepositoById(result.lastInsertRowid as number);

    if (!deposito) {
      throw new Error('Error al crear el depósito');
    }

    return deposito;
  }

  /**
   * Actualiza un depósito
   */
  actualizar(id: number, data: DepositoUpdate): Deposito {
    const deposito = this.getDepositoById(id);

    if (!deposito) {
      throw new Error('Depósito no encontrado');
    }

    const updates: string[] = [];
    const params: any[] = [];

    // Si se está asociando a una cuenta, marcarlo como A_CUENTA
    if (data.cuenta_id !== undefined && data.cuenta_id !== null &&
        (deposito.estado === 'PENDIENTE' || deposito.estado === 'A_FAVOR')) {
      updates.push('cuenta_id = ?');
      params.push(data.cuenta_id);
      updates.push('estado = ?');
      params.push('A_CUENTA');
      updates.push('tipo_uso = ?');
      params.push('A_CUENTA');
      updates.push('fecha_uso = ?');
      params.push(new Date().toISOString().split('T')[0]);
      updates.push('saldo_actual = ?');
      params.push(0);
    } else {
      // Comportamiento normal
      if (data.saldo_actual !== undefined) {
        updates.push('saldo_actual = ?');
        params.push(data.saldo_actual);
      }

      if (data.fecha_uso !== undefined) {
        updates.push('fecha_uso = ?');
        params.push(data.fecha_uso);
      }

      if (data.fecha_devolucion !== undefined) {
        updates.push('fecha_devolucion = ?');
        params.push(data.fecha_devolucion);
      }

      if (data.estado !== undefined) {
        updates.push('estado = ?');
        params.push(data.estado);
      }

      if (data.observaciones !== undefined) {
        updates.push('observaciones = ?');
        params.push(data.observaciones);
      }

      if (data.cuenta_id !== undefined) {
        updates.push('cuenta_id = ?');
        params.push(data.cuenta_id);
      }
    }

    if (updates.length === 0) {
      return deposito;
    }

    params.push(id);

    db.prepare(`UPDATE depositos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const depositoActualizado = this.getDepositoById(id);

    if (!depositoActualizado) {
      throw new Error('Error al actualizar el depósito');
    }

    return depositoActualizado;
  }

  /**
   * Elimina un depósito
   */
  eliminar(id: number): void {
    const deposito = this.getDepositoById(id);

    if (!deposito) {
      throw new Error('Depósito no encontrado');
    }

    // Verificar que no esté asociado a un movimiento
    if (deposito.movimiento_origen_id) {
      throw new Error('No se puede eliminar un depósito asociado a un movimiento');
    }

    db.prepare('DELETE FROM depositos WHERE id = ?').run(id);
  }

  /**
   * Marca un depósito como liquidado
   */
  marcarComoLiquidado(id: number, fechaUso: string): Deposito {
    return this.actualizar(id, {
      estado: 'LIQUIDADO',
      fecha_uso: fechaUso,
      saldo_actual: 0,
    });
  }

  /**
   * Marca un depósito con saldo a favor
   */
  marcarComoAFavor(id: number, saldoRestante: number): Deposito {
    const deposito = this.getDepositoById(id);

    if (!deposito) {
      throw new Error('Depósito no encontrado');
    }

    if (saldoRestante < 0 || saldoRestante > deposito.monto_original) {
      throw new Error('Saldo a favor inválido');
    }

    return this.actualizar(id, {
      estado: 'A_FAVOR',
      saldo_actual: saldoRestante,
    });
  }

  /**
   * Marca un depósito como devuelto
   */
  marcarComoDevuelto(id: number, fechaDevolucion: string): Deposito {
    // Obtener el depósito actual para guardar cuánto se devolvió
    const deposito = this.getDepositoById(id);
    if (!deposito) {
      throw new Error('Depósito no encontrado');
    }

    return this.actualizar(id, {
      estado: 'DEVUELTO',
      fecha_devolucion: fechaDevolucion,
      monto_devuelto: deposito.saldo_actual, // Guardar cuánto se devolvió
      saldo_actual: 0,
    });
  }

  /**
   * Asocia un depósito a una cuenta corriente
   * Automáticamente marca como A_CUENTA (no se devuelve)
   */
  asociarACuenta(depositoId: number, cuentaId: number): Deposito {
    // El método actualizar() ya maneja la lógica de cambiar a A_CUENTA
    return this.actualizar(depositoId, {
      cuenta_id: cuentaId,
    });
  }

  /**
   * Usa saldo de un depósito
   */
  usarSaldo(id: number, montoAUsar: number, tipoUso: 'CAJA' | 'RENTAS', descripcion?: string): Deposito {
    const deposito = this.getDepositoById(id);

    if (!deposito) {
      throw new Error('Depósito no encontrado');
    }

    if (montoAUsar > deposito.saldo_actual) {
      throw new Error('Monto a usar supera el saldo disponible');
    }

    const nuevoSaldo = deposito.saldo_actual - montoAUsar;
    const fechaUso = deposito.fecha_uso || new Date().toISOString().split('T')[0];

    // Preparar updates
    const updates = [
      'saldo_actual = ?',
      'estado = ?',
      'fecha_uso = ?',
      'tipo_uso = ?'
    ];
    const params = [
      nuevoSaldo,
      nuevoSaldo > 0 ? 'A_FAVOR' : 'LIQUIDADO',
      fechaUso,
      tipoUso
    ];

    if (descripcion) {
      updates.push('descripcion_uso = ?');
      params.push(descripcion);
    }

    params.push(id);

    db.prepare(`UPDATE depositos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const depositoActualizado = this.getDepositoById(id);

    if (!depositoActualizado) {
      throw new Error('Error al actualizar el depósito');
    }

    return depositoActualizado;
  }

  /**
   * Obtiene depósitos no asociados a movimientos (contenedor de no asociados)
   */
  getDepositosNoAsociados(): Deposito[] {
    return db
      .prepare(
        `SELECT d.*, cc.nombre as cuenta_nombre
         FROM depositos d
         LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
         WHERE d.movimiento_origen_id IS NULL
         AND d.estado IN ('PENDIENTE', 'A_FAVOR')
         ORDER BY d.fecha_ingreso DESC`
      )
      .all() as Deposito[];
  }

  /**
   * Obtiene estadísticas de depósitos
   */
  getEstadisticas() {
    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN estado = 'LIQUIDADO' THEN 1 ELSE 0 END) as liquidados,
          SUM(CASE WHEN estado = 'A_FAVOR' THEN 1 ELSE 0 END) as a_favor,
          SUM(CASE WHEN estado = 'A_CUENTA' THEN 1 ELSE 0 END) as a_cuenta,
          SUM(CASE WHEN estado = 'DEVUELTO' THEN 1 ELSE 0 END) as devueltos,
          COALESCE(SUM(saldo_actual), 0) as saldo_total_disponible
         FROM depositos`
      )
      .get() as any;

    return {
      total: stats.total || 0,
      pendientes: stats.pendientes || 0,
      liquidados: stats.liquidados || 0,
      a_favor: stats.a_favor || 0,
      a_cuenta: stats.a_cuenta || 0,
      devueltos: stats.devueltos || 0,
      saldo_total_disponible: stats.saldo_total_disponible || 0,
    };
  }
}

export default new DepositosService();
