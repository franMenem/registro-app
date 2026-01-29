import db from '../db/database';
import {
  Adelanto,
  AdelantoCreate,
  AdelantoUpdate,
  Empleado,
  ResumenAdelantosEmpleado,
  EstadoAdelanto,
} from '../types/adelantos.types';

/**
 * Servicio para gestionar Adelantos de Empleados
 * Principio Single Responsibility: Solo maneja la lógica de adelantos
 */
export class AdelantosService {
  /**
   * Obtener todos los adelantos con filtros
   */
  obtenerTodos(empleado?: Empleado, estado?: EstadoAdelanto): Adelanto[] {
    let query = 'SELECT * FROM adelantos_empleados WHERE 1=1';
    const params: any[] = [];

    if (empleado) {
      query += ' AND empleado = ?';
      params.push(empleado);
    }

    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY fecha_adelanto DESC';

    return db.prepare(query).all(...params) as Adelanto[];
  }

  /**
   * Obtener adelanto por ID
   */
  obtenerPorId(id: number): Adelanto | undefined {
    return db
      .prepare('SELECT * FROM adelantos_empleados WHERE id = ?')
      .get(id) as Adelanto | undefined;
  }

  /**
   * Crear un nuevo adelanto
   */
  crear(data: AdelantoCreate): Adelanto {
    const stmt = db.prepare(`
      INSERT INTO adelantos_empleados
      (empleado, fecha_adelanto, monto, observaciones, origen)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.empleado,
      data.fecha_adelanto,
      data.monto,
      data.observaciones || null,
      data.origen || 'MANUAL'
    );

    const adelanto = this.obtenerPorId(result.lastInsertRowid as number);
    if (!adelanto) {
      throw new Error('Error al crear el adelanto');
    }

    return adelanto;
  }

  /**
   * Actualizar un adelanto
   */
  actualizar(id: number, data: AdelantoUpdate): Adelanto {
    const adelanto = this.obtenerPorId(id);
    if (!adelanto) {
      throw new Error('Adelanto no encontrado');
    }

    const campos: string[] = [];
    const valores: any[] = [];

    if (data.estado !== undefined) {
      campos.push('estado = ?');
      valores.push(data.estado);
    }
    if (data.fecha_descuento !== undefined) {
      campos.push('fecha_descuento = ?');
      valores.push(data.fecha_descuento);
    }
    if (data.observaciones !== undefined) {
      campos.push('observaciones = ?');
      valores.push(data.observaciones);
    }

    if (campos.length === 0) {
      return adelanto;
    }

    valores.push(id);
    const query = `UPDATE adelantos_empleados SET ${campos.join(', ')} WHERE id = ?`;

    db.prepare(query).run(...valores);

    const adelantoActualizado = this.obtenerPorId(id);
    if (!adelantoActualizado) {
      throw new Error('Error al actualizar el adelanto');
    }

    return adelantoActualizado;
  }

  /**
   * Marcar adelanto como descontado
   */
  marcarComoDescontado(id: number, fechaDescuento: string): Adelanto {
    return this.actualizar(id, {
      estado: 'Descontado',
      fecha_descuento: fechaDescuento,
    });
  }

  /**
   * Eliminar un adelanto
   */
  eliminar(id: number): void {
    const adelanto = this.obtenerPorId(id);
    if (!adelanto) {
      throw new Error('Adelanto no encontrado');
    }

    db.prepare('DELETE FROM adelantos_empleados WHERE id = ?').run(id);
  }

  /**
   * Obtener resumen de adelantos de un empleado
   */
  obtenerResumenEmpleado(empleado: Empleado): ResumenAdelantosEmpleado {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    // Pendientes del mes actual
    const pendientesMesActual = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = ?
        AND estado = 'Pendiente'
        AND strftime('%m', fecha_adelanto) = ?
        AND strftime('%Y', fecha_adelanto) = ?
    `
      )
      .get(
        empleado,
        mesActual.toString().padStart(2, '0'),
        anioActual.toString()
      ) as { total: number };

    // Total del año actual
    const totalAnioActual = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = ?
        AND strftime('%Y', fecha_adelanto) = ?
    `
      )
      .get(empleado, anioActual.toString()) as { total: number };

    // Total histórico
    const totalHistorico = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = ?
    `
      )
      .get(empleado) as { total: number };

    // Adelantos pendientes y descontados
    const adelantosPendientes = this.obtenerTodos(empleado, 'Pendiente');
    const adelantosDescontados = this.obtenerTodos(empleado, 'Descontado');

    return {
      empleado,
      pendientes_mes_actual: pendientesMesActual.total,
      total_anio_actual: totalAnioActual.total,
      total_historico: totalHistorico.total,
      adelantos_pendientes: adelantosPendientes,
      adelantos_descontados: adelantosDescontados,
    };
  }

  /**
   * Obtener adelantos pendientes para alertas
   */
  obtenerAdelantosPendientes(): { dami: number; mumi: number } {
    const dami = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = 'DAMI' AND estado = 'Pendiente'
    `
      )
      .get() as { total: number };

    const mumi = db
      .prepare(
        `
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_empleados
      WHERE empleado = 'MUMI' AND estado = 'Pendiente'
    `
      )
      .get() as { total: number };

    return {
      dami: dami.total,
      mumi: mumi.total,
    };
  }
}

export default new AdelantosService();
