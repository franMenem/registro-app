import db, { transaction } from '../db/database';
import { Deposito, DepositoCreate, DepositoUpdate, DepositoFilters } from '../types/deposito.types';

/**
 * Servicio para gestión de depósitos
 * Aplicando Single Responsibility Principle
 */
export class DepositosService {
  /**
   * Obtiene todos los depósitos con filtros opcionales y paginación
   */
  getDepositos(filters?: DepositoFilters): { depositos: Deposito[]; total: number } {
    let query = `
      SELECT d.*, cc.nombre as cuenta_nombre, cl.razon_social as cliente_nombre
      FROM depositos d
      LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
      LEFT JOIN clientes cl ON d.cliente_id = cl.id
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

    // Contar total antes de aplicar paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM depositos d
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (filters?.estado) {
      countQuery += ' AND d.estado = ?';
      countParams.push(filters.estado);
    }

    if (filters?.cuenta_id) {
      countQuery += ' AND d.cuenta_id = ?';
      countParams.push(filters.cuenta_id);
    }

    if (filters?.fecha_desde) {
      countQuery += ' AND d.fecha_ingreso >= ?';
      countParams.push(filters.fecha_desde);
    }

    if (filters?.fecha_hasta) {
      countQuery += ' AND d.fecha_ingreso <= ?';
      countParams.push(filters.fecha_hasta);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    // Ordenar primero por fecha_uso (más recientes primero), luego por fecha_ingreso
    // Los que tienen fecha_uso aparecen primero, ordenados por fecha_uso DESC
    // Los que NO tienen fecha_uso aparecen después, ordenados por fecha_ingreso DESC
    query += ' ORDER BY d.fecha_uso IS NULL ASC, d.fecha_uso DESC, d.fecha_ingreso DESC';

    // Aplicar paginación
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const depositos = db.prepare(query).all(...params) as Deposito[];

    return { depositos, total };
  }

  /**
   * Obtiene un depósito por ID
   */
  getDepositoById(id: number): Deposito | null {
    const deposito = db
      .prepare(
        `SELECT d.*, cc.nombre as cuenta_nombre, cl.razon_social as cliente_nombre
         FROM depositos d
         LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
         LEFT JOIN clientes cl ON d.cliente_id = cl.id
         WHERE d.id = ?`
      )
      .get(id) as Deposito | undefined;

    return deposito || null;
  }

  /**
   * Crea un nuevo depósito
   * Si se proporciona cuenta_id, asocia automáticamente el depósito a la cuenta
   */
  crear(data: DepositoCreate): Deposito {
    return transaction(() => {
      // Crear el depósito sin cuenta_id primero
      const result = db
        .prepare(
          `INSERT INTO depositos
           (monto_original, saldo_actual, fecha_ingreso, fecha_uso, titular, observaciones, cuenta_id, cliente_id, estado)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'PENDIENTE')`
        )
        .run(
          data.monto_original,
          data.monto_original, // saldo_actual inicial = monto_original
          data.fecha_ingreso,
          null, // fecha_uso is null on creation
          data.titular,
          data.observaciones || null,
          data.cliente_id || null
        );

      const depositoId = result.lastInsertRowid as number;

      // Si se proporcionó cuenta_id, asociar el depósito
      if (data.cuenta_id) {
        console.log(`🔗 Asociando depósito ${depositoId} a cuenta ${data.cuenta_id}`);
        return this.asociarACuenta(depositoId, data.cuenta_id);
      }

      // Si no hay cuenta_id, retornar el depósito sin asociar
      const deposito = this.getDepositoById(depositoId);

      if (!deposito) {
        throw new Error('Error al crear el depósito');
      }

      return deposito;
    });
  }

  /**
   * Actualiza un depósito
   */
  actualizar(id: number, data: DepositoUpdate): Deposito {
    return transaction(() => {
      const deposito = this.getDepositoById(id);

      if (!deposito) {
        throw new Error('Depósito no encontrado');
      }

      const updates: string[] = [];
      const params: any[] = [];

      // Si se está asociando a una cuenta POR PRIMERA VEZ, marcarlo como A_CUENTA
      // (solo si el depósito NO tenía cuenta_id antes y ahora se le asigna una)
      if (data.cuenta_id !== undefined && data.cuenta_id !== null &&
          !deposito.cuenta_id && // No tenía cuenta antes
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
        // Comportamiento normal - actualizar campos individuales
        if (data.titular !== undefined) {
          updates.push('titular = ?');
          params.push(data.titular);
        }

        if (data.fecha_ingreso !== undefined) {
          updates.push('fecha_ingreso = ?');
          params.push(data.fecha_ingreso);
        }

        if (data.monto_original !== undefined) {
          updates.push('monto_original = ?');
          params.push(data.monto_original);

          // Si el depósito está en PENDIENTE o A_FAVOR, actualizar también saldo_actual
          if (deposito.estado === 'PENDIENTE' || deposito.estado === 'A_FAVOR') {
            updates.push('saldo_actual = ?');
            params.push(data.monto_original);
          }

          // Si el depósito está asociado a una cuenta (A_CUENTA), actualizar el movimiento INGRESO
          if (deposito.cuenta_id && deposito.estado === 'A_CUENTA') {
            const movimiento = db.prepare(
              `SELECT id, monto FROM movimientos_cc
               WHERE cuenta_id = ? AND tipo_movimiento = 'INGRESO'
               AND concepto LIKE ?
               LIMIT 1`
            ).get(deposito.cuenta_id, `%ID: ${id})%`) as any;

            if (movimiento) {
              const diferencia = data.monto_original - deposito.monto_original;
              const nuevoMonto = data.monto_original;

              // Actualizar el monto del movimiento
              db.prepare(
                `UPDATE movimientos_cc SET monto = ? WHERE id = ?`
              ).run(nuevoMonto, movimiento.id);

              console.log(`💰 Actualizado movimiento ${movimiento.id}: $${movimiento.monto} → $${nuevoMonto}`);

              // Recalcular saldos de la cuenta
              const cuentasService = require('./cuentas.service').default;
              cuentasService.recalcularSaldos(deposito.cuenta_id);
              console.log(`✅ Saldos recalculados para cuenta ${deposito.cuenta_id}`);
            }
          }
        }

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

        if (data.cliente_id !== undefined) {
          updates.push('cliente_id = ?');
          params.push(data.cliente_id);
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
    });
  }

  /**
   * Elimina un depósito
   * Si está asociado a una cuenta corriente, elimina también el movimiento INGRESO
   */
  eliminar(id: number): void {
    return transaction(() => {
      const deposito = this.getDepositoById(id);

      if (!deposito) {
        throw new Error('Depósito no encontrado');
      }

      // Si está asociado a una cuenta, eliminar el movimiento INGRESO primero
      if (deposito.cuenta_id) {
        const movimiento = db.prepare(
          `SELECT id FROM movimientos_cc
           WHERE cuenta_id = ? AND tipo_movimiento = 'INGRESO'
           AND concepto LIKE ?
           LIMIT 1`
        ).get(deposito.cuenta_id, `%ID: ${id})%`) as any;

        if (movimiento) {
          console.log(`🗑️  Eliminando movimiento ${movimiento.id} de cuenta ${deposito.cuenta_id}`);
          db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(movimiento.id);

          // Recalcular saldos
          const cuentasService = require('./cuentas.service').default;
          cuentasService.recalcularSaldos(deposito.cuenta_id);
          console.log(`✅ Saldos recalculados para cuenta ${deposito.cuenta_id}`);
        }
      }

      // Eliminar el depósito
      db.prepare('DELETE FROM depositos WHERE id = ?').run(id);
      console.log(`✅ Depósito ${id} eliminado`);
    });
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
   * Crea un movimiento INGRESO en la cuenta corriente
   */
  asociarACuenta(depositoId: number, cuentaId: number): Deposito {
    return transaction(() => {
      // Obtener el depósito
      const deposito = this.getDepositoById(depositoId);
      if (!deposito) {
        throw new Error('Depósito no encontrado');
      }

      // Verificar que la cuenta exists
      const cuenta = db.prepare('SELECT * FROM cuentas_corrientes WHERE id = ?').get(cuentaId);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      // Usar el servicio de cuentas para crear el movimiento
      // Esto asegura que los saldos se recalculen correctamente
      const cuentasService = require('./cuentas.service').default;
      const fechaHoy = new Date().toISOString().split('T')[0];

      cuentasService.crearMovimiento(
        cuentaId,
        fechaHoy,
        'INGRESO',
        `Depósito asignado a cuenta - ${deposito.titular} (ID: ${depositoId})`,
        deposito.monto_original
        // No pasamos movimiento_origen_id porque apunta a tabla 'movimientos', no 'depositos'
      );

      // Actualizar el depósito (marca como A_CUENTA)
      return this.actualizar(depositoId, {
        cuenta_id: cuentaId,
      });
    });
  }

  /**
   * Desasocia un depósito de una cuenta corriente
   * Elimina el movimiento INGRESO asociado y recalcula saldos
   */
  desasociarDeCuenta(depositoId: number): Deposito {
    return transaction(() => {
      // Obtener el depósito
      const deposito = this.getDepositoById(depositoId);
      if (!deposito) {
        throw new Error('Depósito no encontrado');
      }

      if (!deposito.cuenta_id) {
        throw new Error('El depósito no está asociado a ninguna cuenta');
      }

      const cuentaId = deposito.cuenta_id;

      // Buscar el movimiento de INGRESO asociado a este depósito
      // Buscamos por concepto incluyendo el ID del depósito
      const movimiento = db.prepare(
        `SELECT id FROM movimientos_cc
         WHERE cuenta_id = ? AND tipo_movimiento = 'INGRESO'
         AND concepto LIKE ?
         LIMIT 1`
      ).get(cuentaId, `%ID: ${depositoId})%`) as any;

      console.log('🔍 Buscando movimiento para depósito', depositoId, 'en cuenta', cuentaId);
      console.log('🔍 Movimiento encontrado:', movimiento);

      if (movimiento) {
        console.log('🗑️  Eliminando movimiento', movimiento.id);
        // Eliminar el movimiento manualmente
        db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(movimiento.id);
        console.log('✅ Movimiento eliminado');

        // Recalcular saldos de la cuenta
        const cuentasService = require('./cuentas.service').default;
        cuentasService.recalcularSaldos(cuentaId);
        console.log('✅ Saldos recalculados');
      } else {
        console.log('⚠️  No se encontró movimiento para eliminar');
      }

      // Actualizar el depósito (quitar la asociación y restaurar estado)
      // Marcar como null la cuenta_id sin cambiar otros campos
      db.prepare('UPDATE depositos SET cuenta_id = NULL WHERE id = ?').run(depositoId);

      const depositoActualizado = this.getDepositoById(depositoId);
      if (!depositoActualizado) {
        throw new Error('Error al actualizar el depósito');
      }

      return depositoActualizado;
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
   * Si un depósito tiene observaciones, se considera identificado y NO aparece aquí
   */
  getDepositosNoAsociados(): Deposito[] {
    return db
      .prepare(
        `SELECT d.*, cc.nombre as cuenta_nombre
         FROM depositos d
         LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
         WHERE d.movimiento_origen_id IS NULL
         AND d.estado IN ('PENDIENTE', 'A_FAVOR')
         AND (d.observaciones IS NULL OR d.observaciones = '')
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

  /**
   * Sincroniza depósitos asignados a cuentas con sus movimientos
   * Busca depósitos con cuenta_id pero sin movimiento INGRESO en la cuenta corriente
   * y crea los movimientos faltantes
   */
  sincronizarMovimientosDepositos(): { procesados: number; movimientos_creados: number } {
    return transaction(() => {
      // Buscar depósitos con cuenta asignada (estado A_CUENTA)
      const depositos = db
        .prepare(
          `SELECT d.*, cc.saldo_actual as cuenta_saldo
           FROM depositos d
           JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
           WHERE d.cuenta_id IS NOT NULL
           AND d.estado = 'A_CUENTA'`
        )
        .all() as any[];

      let movimientosCreados = 0;

      for (const deposito of depositos) {
        // Verificar si ya existe un movimiento para este depósito
        const movimientoExiste = db
          .prepare(
            `SELECT COUNT(*) as count
             FROM movimientos_cc
             WHERE cuenta_id = ?
             AND concepto LIKE ?
             AND monto = ?`
          )
          .get(
            deposito.cuenta_id,
            `%Depósito asignado a cuenta - ${deposito.titular}%`,
            deposito.monto_original
          ) as any;

        if (movimientoExiste.count === 0) {
          // No existe el movimiento, crearlo
          const cuenta = db
            .prepare('SELECT saldo_actual FROM cuentas_corrientes WHERE id = ?')
            .get(deposito.cuenta_id) as any;

          const saldoActual = cuenta?.saldo_actual || 0;
          const nuevoSaldo = saldoActual + deposito.monto_original;

          // Crear movimiento INGRESO
          const fechaUso = deposito.fecha_uso || new Date().toISOString().split('T')[0];
          db.prepare(
            `INSERT INTO movimientos_cc
             (cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante)
             VALUES (?, ?, 'INGRESO', ?, ?, ?)`
          ).run(
            deposito.cuenta_id,
            fechaUso,
            `Depósito asignado a cuenta - ${deposito.titular} (sincronizado)`,
            deposito.monto_original,
            nuevoSaldo
          );

          // Actualizar saldo de la cuenta
          db.prepare(
            `UPDATE cuentas_corrientes SET saldo_actual = ? WHERE id = ?`
          ).run(nuevoSaldo, deposito.cuenta_id);

          movimientosCreados++;
        }
      }

      return {
        procesados: depositos.length,
        movimientos_creados: movimientosCreados,
      };
    });
  }
}

export default new DepositosService();
