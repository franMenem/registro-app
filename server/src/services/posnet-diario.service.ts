import db from '../db/database';

/**
 * Servicio de Control POSNET Diario
 * Aplicando Single Responsibility Principle
 */
export class PosnetDiarioService {
  /**
   * Obtiene los registros diarios de POSNET para un mes/año específico
   */
  obtenerRegistrosMes(mes: number, anio: number): any[] {
    // Calcular primer y último día del mes
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const fechaInicio = this.formatearFecha(primerDia);
    const fechaFin = this.formatearFecha(ultimoDia);

    const registros = db
      .prepare(
        `SELECT * FROM control_posnet_diario
         WHERE fecha >= ? AND fecha <= ?
         ORDER BY fecha ASC`
      )
      .all(fechaInicio, fechaFin) as any[];

    return registros;
  }

  /**
   * Obtiene o crea un registro para una fecha específica
   */
  obtenerOCrearRegistro(fecha: string): any {
    let registro = db
      .prepare('SELECT * FROM control_posnet_diario WHERE fecha = ?')
      .get(fecha) as any;

    if (!registro) {
      // Crear registro con valores por defecto
      const result = db
        .prepare(
          `INSERT INTO control_posnet_diario
           (fecha, monto_rentas, monto_caja, total_posnet, monto_ingresado_banco, diferencia)
           VALUES (?, 0, 0, 0, 0, 0)`
        )
        .run(fecha);

      registro = db
        .prepare('SELECT * FROM control_posnet_diario WHERE id = ?')
        .get(result.lastInsertRowid) as any;
    }

    return registro;
  }

  /**
   * Actualiza los montos de RENTAS y CAJA desde formularios
   */
  actualizarMontosFormulario(fecha: string, tipo: 'RENTAS' | 'CAJA', monto: number): any {
    // Obtener o crear registro
    let registro = this.obtenerOCrearRegistro(fecha);

    // Actualizar según tipo
    if (tipo === 'RENTAS') {
      registro.monto_rentas = (registro.monto_rentas || 0) + monto;
    } else {
      registro.monto_caja = (registro.monto_caja || 0) + monto;
    }

    // Recalcular totales
    registro.total_posnet = registro.monto_rentas + registro.monto_caja;
    registro.diferencia = registro.total_posnet - (registro.monto_ingresado_banco || 0);

    // Actualizar en BD
    db.prepare(
      `UPDATE control_posnet_diario
       SET monto_rentas = ?,
           monto_caja = ?,
           total_posnet = ?,
           diferencia = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE fecha = ?`
    ).run(
      registro.monto_rentas,
      registro.monto_caja,
      registro.total_posnet,
      registro.diferencia,
      fecha
    );

    return this.obtenerOCrearRegistro(fecha);
  }

  /**
   * Actualiza el monto ingresado al banco (edición inline)
   */
  actualizarMontoIngresado(id: number, montoIngresado: number): any {
    const registro = db
      .prepare('SELECT * FROM control_posnet_diario WHERE id = ?')
      .get(id) as any;

    if (!registro) {
      throw new Error('Registro no encontrado');
    }

    // Recalcular diferencia
    const diferencia = registro.total_posnet - montoIngresado;

    // Actualizar
    db.prepare(
      `UPDATE control_posnet_diario
       SET monto_ingresado_banco = ?,
           diferencia = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(montoIngresado, diferencia, id);

    return db
      .prepare('SELECT * FROM control_posnet_diario WHERE id = ?')
      .get(id) as any;
  }

  /**
   * Obtiene el resumen mensual
   */
  obtenerResumenMes(mes: number, anio: number): any {
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const fechaInicio = this.formatearFecha(primerDia);
    const fechaFin = this.formatearFecha(ultimoDia);

    const resumen = db
      .prepare(
        `SELECT
          COUNT(*) as total_dias,
          COALESCE(SUM(monto_rentas), 0) as total_rentas,
          COALESCE(SUM(monto_caja), 0) as total_caja,
          COALESCE(SUM(total_posnet), 0) as total_posnet,
          COALESCE(SUM(monto_ingresado_banco), 0) as total_ingresado,
          COALESCE(SUM(diferencia), 0) as diferencia_acumulada,
          COALESCE(SUM(CASE WHEN diferencia = 0 THEN 1 ELSE 0 END), 0) as dias_ok,
          COALESCE(SUM(CASE WHEN diferencia > 0 THEN 1 ELSE 0 END), 0) as dias_falta_ingresar,
          COALESCE(SUM(CASE WHEN diferencia < 0 THEN 1 ELSE 0 END), 0) as dias_error
         FROM control_posnet_diario
         WHERE fecha >= ? AND fecha <= ?`
      )
      .get(fechaInicio, fechaFin) as any;

    return {
      mes,
      anio,
      total_dias: resumen.total_dias || 0,
      total_rentas: resumen.total_rentas || 0,
      total_caja: resumen.total_caja || 0,
      total_posnet: resumen.total_posnet || 0,
      total_ingresado: resumen.total_ingresado || 0,
      diferencia_acumulada: resumen.diferencia_acumulada || 0,
      dias_ok: resumen.dias_ok || 0,
      dias_falta_ingresar: resumen.dias_falta_ingresar || 0,
      dias_error: resumen.dias_error || 0,
    };
  }

  /**
   * Formatea fecha a YYYY-MM-DD
   */
  private formatearFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}

export default new PosnetDiarioService();
