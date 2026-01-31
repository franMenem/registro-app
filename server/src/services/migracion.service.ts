import db, { transaction } from '../db/database';

/**
 * Servicio para migración de datos
 */
export class MigracionService {
  /**
   * Migra movimientos de VEP y ePagos a las tablas de control
   * Busca movimientos con conceptos VEP/ePagos que no estén en las tablas de control
   */
  migrarVepsYEpagos(): {
    veps_migrados: number;
    epagos_migrados: number;
    errores: string[];
  } {
    return transaction(() => {
      let vepsMigrados = 0;
      let epagosMigrados = 0;
      const errores: string[] = [];

      // Buscar movimientos con conceptos VEP
      const movimientosVep = db
        .prepare(
          `SELECT m.*, c.nombre as concepto_nombre
           FROM movimientos m
           JOIN conceptos c ON m.concepto_id = c.id
           WHERE c.nombre IN ('VEP', 'VEP CAJA')
           ORDER BY m.fecha`
        )
        .all() as any[];

      // Buscar movimientos con conceptos ePagos
      const movimientosEpagos = db
        .prepare(
          `SELECT m.*, c.nombre as concepto_nombre
           FROM movimientos m
           JOIN conceptos c ON m.concepto_id = c.id
           WHERE c.nombre IN ('ePagos', 'ePagos CAJA')
           ORDER BY m.fecha`
        )
        .all() as any[];

      // Migrar VEPs
      for (const mov of movimientosVep) {
        try {
          // Verificar si ya existe en control_veps
          const existe = db
            .prepare(
              `SELECT COUNT(*) as count
               FROM control_veps
               WHERE fecha = ? AND monto = ?`
            )
            .get(mov.fecha, mov.monto) as any;

          if (existe.count === 0) {
            // No existe, insertarlo
            db.prepare(
              `INSERT INTO control_veps (fecha, monto, observaciones)
               VALUES (?, ?, ?)`
            ).run(mov.fecha, mov.monto, mov.observaciones || `Migrado desde movimiento #${mov.id}`);

            vepsMigrados++;
          }
        } catch (error: any) {
          errores.push(`Error migrando VEP (movimiento #${mov.id}): ${error.message}`);
        }
      }

      // Migrar ePagos
      for (const mov of movimientosEpagos) {
        try {
          // Verificar si ya existe en control_epagos
          const existe = db
            .prepare(
              `SELECT COUNT(*) as count
               FROM control_epagos
               WHERE fecha = ? AND monto = ?`
            )
            .get(mov.fecha, mov.monto) as any;

          if (existe.count === 0) {
            // No existe, insertarlo
            db.prepare(
              `INSERT INTO control_epagos (fecha, monto, observaciones)
               VALUES (?, ?, ?)`
            ).run(mov.fecha, mov.monto, mov.observaciones || `Migrado desde movimiento #${mov.id}`);

            epagosMigrados++;
          }
        } catch (error: any) {
          errores.push(`Error migrando ePago (movimiento #${mov.id}): ${error.message}`);
        }
      }

      return {
        veps_migrados: vepsMigrados,
        epagos_migrados: epagosMigrados,
        errores,
      };
    });
  }
}

export default new MigracionService();
