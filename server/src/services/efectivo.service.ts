import db, { transaction } from '../db/database';
import {
  MovimientoEfectivo,
  MovimientoEfectivoCreate,
  ControlEfectivoConfig,
  EfectivoStats,
} from '../types/efectivo.types';

/**
 * Servicio para gestión de efectivo en mano
 */
export class EfectivoService {
  /**
   * Obtiene la configuración de efectivo (saldo inicial)
   */
  getConfig(): ControlEfectivoConfig {
    const config = db
      .prepare('SELECT * FROM control_efectivo_config WHERE id = 1')
      .get() as ControlEfectivoConfig;

    return config;
  }

  /**
   * Actualiza el saldo inicial de efectivo
   */
  updateSaldoInicial(saldoInicial: number): ControlEfectivoConfig {
    db.prepare(
      `UPDATE control_efectivo_config
       SET saldo_inicial = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    ).run(saldoInicial);

    return this.getConfig();
  }

  /**
   * Obtiene estadísticas del efectivo
   */
  getStats(): EfectivoStats {
    const config = this.getConfig();

    // Total ingresos de efectivo (entregados de RENTAS y CAJA)
    const totalIngresos = db
      .prepare(
        `SELECT COALESCE(SUM(monto), 0) as total
         FROM movimientos_efectivo
         WHERE tipo = 'INGRESO'`
      )
      .get() as any;

    // Total gastos pagados del efectivo
    const totalGastos = db
      .prepare(
        `SELECT COALESCE(SUM(monto), 0) as total
         FROM movimientos_efectivo
         WHERE tipo = 'GASTO'`
      )
      .get() as any;

    // Total depósitos al banco
    const totalDepositos = db
      .prepare(
        `SELECT COALESCE(SUM(monto), 0) as total
         FROM movimientos_efectivo
         WHERE tipo = 'DEPOSITO'`
      )
      .get() as any;

    const saldoActual =
      config.saldo_inicial +
      totalIngresos.total -
      totalGastos.total -
      totalDepositos.total;

    return {
      saldo_inicial: config.saldo_inicial,
      total_rentas: 0, // Ya no se usa
      total_caja: 0, // Ya no se usa
      total_gastos: totalGastos.total,
      total_depositos: totalDepositos.total,
      saldo_actual: saldoActual,
    };
  }

  /**
   * Obtiene todos los movimientos de efectivo
   */
  getMovimientos(): MovimientoEfectivo[] {
    return db
      .prepare(
        `SELECT me.*, cc.nombre as cuenta_nombre
         FROM movimientos_efectivo me
         LEFT JOIN cuentas_corrientes cc ON me.cuenta_id = cc.id
         ORDER BY me.fecha DESC, me.created_at DESC`
      )
      .all() as MovimientoEfectivo[];
  }

  /**
   * Crea un movimiento de efectivo (gasto o depósito)
   */
  crearMovimiento(
    data: MovimientoEfectivoCreate,
    categoria?: 'GENERICO' | 'REGISTRAL' | 'PERSONAL',
    conceptoEspecifico?: string
  ): MovimientoEfectivo {
    return transaction(() => {
      // 1. Insertar movimiento de efectivo
      const result = db
        .prepare(
          `INSERT INTO movimientos_efectivo
           (fecha, tipo, concepto, monto, cuenta_id, observaciones)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.fecha,
          data.tipo,
          data.concepto,
          data.monto,
          data.cuenta_id || null,
          data.observaciones || null
        );

      const movimientoId = result.lastInsertRowid as number;

      // 2. Si es GASTO REGISTRAL, crear también en gastos_registrales
      if (data.tipo === 'GASTO' && categoria === 'REGISTRAL' && conceptoEspecifico) {
        const gastosRegistralesService = require('./gastos-registrales.service').default;

        gastosRegistralesService.crear({
          fecha: data.fecha,
          concepto: conceptoEspecifico,
          monto: data.monto,
          observaciones: data.observaciones || `Pagado con efectivo`,
          origen: 'MANUAL',
          estado: 'Pagado',
        });

        console.log(`💰 Gasto Registral "${conceptoEspecifico}" registrado en gastos_registrales y efectivo`);
      }

      // 3. Si es GASTO PERSONAL, crear también en gastos_personales
      if (data.tipo === 'GASTO' && categoria === 'PERSONAL' && conceptoEspecifico) {
        const gastosPersonalesService = require('./gastos-personales.service').default;

        gastosPersonalesService.crear({
          fecha: data.fecha,
          concepto: conceptoEspecifico as any,
          monto: data.monto,
          observaciones: data.observaciones || `Pagado con efectivo`,
          estado: 'Pagado',
        });

        console.log(`💰 Gasto Personal "${conceptoEspecifico}" registrado en gastos_personales y efectivo`);
      }

      // 4. Si es un gasto Y tiene cuenta_id, crear movimiento EGRESO en la cuenta corriente
      if (data.tipo === 'GASTO' && data.cuenta_id) {
        const cuentasService = require('./cuentas.service').default;

        cuentasService.crearMovimiento(
          data.cuenta_id,
          data.fecha,
          'EGRESO',
          `${data.concepto} (Pagado del efectivo)`,
          data.monto,
          movimientoId
        );

        console.log(`✅ Gasto registrado en cuenta ${data.cuenta_id} y efectivo`);
      }

      // 5. Obtener el movimiento creado
      const movimiento = db
        .prepare(
          `SELECT me.*, cc.nombre as cuenta_nombre
           FROM movimientos_efectivo me
           LEFT JOIN cuentas_corrientes cc ON me.cuenta_id = cc.id
           WHERE me.id = ?`
        )
        .get(movimientoId) as MovimientoEfectivo;

      return movimiento;
    });
  }

  /**
   * Elimina un movimiento de efectivo
   */
  eliminarMovimiento(id: number): void {
    return transaction(() => {
      const movimiento = db
        .prepare('SELECT * FROM movimientos_efectivo WHERE id = ?')
        .get(id) as any;

      if (!movimiento) {
        throw new Error('Movimiento no encontrado');
      }

      // Si es un gasto con cuenta asociada, eliminar también el movimiento de la cuenta corriente
      if (movimiento.tipo === 'GASTO' && movimiento.cuenta_id) {
        const cuentasService = require('./cuentas.service').default;
        
        // Buscar el movimiento en la cuenta corriente
        const movimientoCC = db
          .prepare(
            `SELECT id FROM movimientos_cc
             WHERE cuenta_id = ? AND movimiento_origen_id = ?`
          )
          .get(movimiento.cuenta_id, id) as any;

        if (movimientoCC) {
          // Eliminar el movimiento de la cuenta
          db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(movimientoCC.id);
          
          // Recalcular saldos
          cuentasService.recalcularSaldos(movimiento.cuenta_id);
          console.log(`✅ Movimiento eliminado de cuenta ${movimiento.cuenta_id}`);
        }
      }

      // Eliminar el movimiento de efectivo
      db.prepare('DELETE FROM movimientos_efectivo WHERE id = ?').run(id);
      console.log(`✅ Movimiento de efectivo ${id} eliminado`);
    });
  }
}

export default new EfectivoService();
