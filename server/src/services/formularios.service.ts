import db, { transaction } from '../db/database';
import gastosRegistralesService from './gastos-registrales.service';

interface Formulario {
  id: number;
  numero: string;
  descripcion: string | null;
  monto: number;
  fecha_compra: string;
  proveedor: string | null;
  created_at: string;
}

interface Vencimiento {
  id: number;
  formulario_id: number;
  numero_vencimiento: number;
  fecha_vencimiento: string;
  monto: number;
  estado: 'PENDIENTE' | 'PAGADO';
  fecha_pago: string | null;
  gasto_registral_id: number | null;
  created_at: string;
  updated_at: string;
}

interface FormularioConVencimientos extends Formulario {
  vencimientos: Vencimiento[];
}

interface FormularioCreate {
  numero: string;
  descripcion?: string;
  monto: number;
  fecha_compra: string;
  proveedor?: string;
  vencimientos: {
    numero_vencimiento: number;
    fecha_vencimiento: string;
    monto: number;
  }[];
}

/**
 * Servicio de Formularios
 * Aplicando Single Responsibility Principle
 */
export class FormulariosService {
  /**
   * Obtiene todos los formularios con sus vencimientos
   */
  obtenerTodos(): FormularioConVencimientos[] {
    const formularios = db
      .prepare(
        `SELECT * FROM formularios
         ORDER BY fecha_compra DESC, created_at DESC`
      )
      .all() as Formulario[];

    return formularios.map((formulario) => ({
      ...formulario,
      vencimientos: this.obtenerVencimientos(formulario.id),
    }));
  }

  /**
   * Obtiene un formulario por ID con sus vencimientos
   */
  obtenerPorId(id: number): FormularioConVencimientos | null {
    const formulario = db
      .prepare('SELECT * FROM formularios WHERE id = ?')
      .get(id) as Formulario | undefined;

    if (!formulario) return null;

    return {
      ...formulario,
      vencimientos: this.obtenerVencimientos(id),
    };
  }

  /**
   * Obtiene los vencimientos de un formulario
   */
  obtenerVencimientos(formularioId: number): Vencimiento[] {
    return db
      .prepare(
        `SELECT * FROM formularios_vencimientos
         WHERE formulario_id = ?
         ORDER BY numero_vencimiento ASC`
      )
      .all(formularioId) as Vencimiento[];
  }

  /**
   * Obtiene vencimientos pendientes
   */
  obtenerVencimientosPendientes(): any[] {
    return db
      .prepare(
        `SELECT fv.*, f.numero, f.descripcion, f.proveedor
         FROM formularios_vencimientos fv
         JOIN formularios f ON fv.formulario_id = f.id
         WHERE fv.estado = 'PENDIENTE'
         ORDER BY fv.fecha_vencimiento ASC`
      )
      .all();
  }

  /**
   * Crea un formulario con sus vencimientos
   */
  crear(data: FormularioCreate): FormularioConVencimientos {
    return transaction(() => {
      // Validar que haya 3 vencimientos
      if (data.vencimientos.length !== 3) {
        throw new Error('Debe haber exactamente 3 vencimientos');
      }

      // Validar que el monto total = primer vencimiento
      // Los 3 vencimientos son opciones de pago (con recargos), no cuotas que suman
      const primerVencimiento = data.vencimientos[0].monto;
      if (Math.abs(primerVencimiento - data.monto) > 0.01) {
        throw new Error('El monto total debe ser igual al monto del primer vencimiento');
      }

      // Validar que los vencimientos tengan orden ascendente (recargos)
      if (data.vencimientos[1].monto < data.vencimientos[0].monto) {
        throw new Error('El segundo vencimiento debe ser mayor o igual al primero');
      }
      if (data.vencimientos[2].monto < data.vencimientos[1].monto) {
        throw new Error('El tercer vencimiento debe ser mayor o igual al segundo');
      }

      // Insertar formulario
      const result = db
        .prepare(
          `INSERT INTO formularios
           (numero, descripcion, monto, fecha_compra, proveedor)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          data.numero,
          data.descripcion || null,
          data.monto,
          data.fecha_compra,
          data.proveedor || null
        );

      const formularioId = result.lastInsertRowid as number;

      // Insertar vencimientos
      const stmtVencimiento = db.prepare(
        `INSERT INTO formularios_vencimientos
         (formulario_id, numero_vencimiento, fecha_vencimiento, monto)
         VALUES (?, ?, ?, ?)`
      );

      data.vencimientos.forEach((venc) => {
        stmtVencimiento.run(
          formularioId,
          venc.numero_vencimiento,
          venc.fecha_vencimiento,
          venc.monto
        );
      });

      const formulario = this.obtenerPorId(formularioId);
      if (!formulario) {
        throw new Error('Error al crear el formulario');
      }

      return formulario;
    });
  }

  /**
   * Actualiza un formulario
   */
  actualizar(id: number, data: Partial<FormularioCreate>): FormularioConVencimientos {
    return transaction(() => {
      const formulario = this.obtenerPorId(id);
      if (!formulario) {
        throw new Error('Formulario no encontrado');
      }

      // Actualizar formulario
      const updates: string[] = [];
      const params: any[] = [];

      if (data.numero !== undefined) {
        updates.push('numero = ?');
        params.push(data.numero);
      }
      if (data.descripcion !== undefined) {
        updates.push('descripcion = ?');
        params.push(data.descripcion);
      }
      if (data.monto !== undefined) {
        updates.push('monto = ?');
        params.push(data.monto);
      }
      if (data.fecha_compra !== undefined) {
        updates.push('fecha_compra = ?');
        params.push(data.fecha_compra);
      }
      if (data.proveedor !== undefined) {
        updates.push('proveedor = ?');
        params.push(data.proveedor);
      }

      if (updates.length > 0) {
        params.push(id);
        db.prepare(`UPDATE formularios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      // Actualizar vencimientos si se proporcionan
      if (data.vencimientos) {
        if (data.vencimientos.length !== 3) {
          throw new Error('Debe haber exactamente 3 vencimientos');
        }

        // Validar que el monto total = primer vencimiento
        const primerVencimiento = data.vencimientos[0].monto;
        const montoFinal = data.monto !== undefined ? data.monto : formulario.monto;
        if (Math.abs(primerVencimiento - montoFinal) > 0.01) {
          throw new Error('El monto total debe ser igual al monto del primer vencimiento');
        }

        // Validar que los vencimientos tengan orden ascendente (recargos)
        if (data.vencimientos[1].monto < data.vencimientos[0].monto) {
          throw new Error('El segundo vencimiento debe ser mayor o igual al primero');
        }
        if (data.vencimientos[2].monto < data.vencimientos[1].monto) {
          throw new Error('El tercer vencimiento debe ser mayor o igual al segundo');
        }

        // Actualizar cada vencimiento
        const stmtUpdate = db.prepare(
          `UPDATE formularios_vencimientos
           SET fecha_vencimiento = ?, monto = ?, updated_at = CURRENT_TIMESTAMP
           WHERE formulario_id = ? AND numero_vencimiento = ?`
        );

        data.vencimientos.forEach((venc) => {
          stmtUpdate.run(venc.fecha_vencimiento, venc.monto, id, venc.numero_vencimiento);
        });
      }

      const formularioActualizado = this.obtenerPorId(id);
      if (!formularioActualizado) {
        throw new Error('Error al actualizar el formulario');
      }

      return formularioActualizado;
    });
  }

  /**
   * Elimina un formulario
   */
  eliminar(id: number): void {
    const formulario = this.obtenerPorId(id);
    if (!formulario) {
      throw new Error('Formulario no encontrado');
    }

    // Verificar que no haya vencimientos con gastos registrales asociados
    const vencimientosConGastos = formulario.vencimientos.filter(
      (v) => v.gasto_registral_id !== null
    );

    if (vencimientosConGastos.length > 0) {
      throw new Error(
        'No se puede eliminar un formulario con gastos registrales asociados. Elimine primero los gastos CARCOS vinculados.'
      );
    }

    // Si no hay gastos asociados, se puede eliminar aunque esté pagado
    db.prepare('DELETE FROM formularios WHERE id = ?').run(id);
  }

  /**
   * Marca vencimientos como pagados (selección múltiple)
   * Crea automáticamente un gasto en Gastos Registrales (CARCOS)
   */
  marcarVencimientosComoPagados(vencimientoIds: number[], fechaPago: string): any {
    return transaction(() => {
      if (vencimientoIds.length === 0) {
        throw new Error('Debe seleccionar al menos un vencimiento');
      }

      // Obtener vencimientos
      const vencimientos = vencimientoIds.map((id) => {
        const venc = db
          .prepare('SELECT * FROM formularios_vencimientos WHERE id = ?')
          .get(id) as Vencimiento | undefined;

        if (!venc) {
          throw new Error(`Vencimiento ${id} no encontrado`);
        }

        if (venc.estado === 'PAGADO') {
          throw new Error(`El vencimiento ${id} ya está pagado`);
        }

        return venc;
      });

      // Calcular total a pagar
      const totalPagar = vencimientos.reduce((sum, v) => sum + v.monto, 0);

      // Crear gasto en Gastos Registrales (CARCOS)
      const gastoCreado = gastosRegistralesService.crear({
        fecha: fechaPago,
        concepto: 'CARCOS',
        monto: totalPagar,
        observaciones: `Pago de ${vencimientos.length} vencimiento(s) de formularios`,
        origen: 'FORMULARIOS',
        estado: 'Pagado',
      });

      // Marcar vencimientos como pagados
      const stmtUpdate = db.prepare(
        `UPDATE formularios_vencimientos
         SET estado = 'PAGADO',
             fecha_pago = ?,
             gasto_registral_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      );

      vencimientos.forEach((venc) => {
        stmtUpdate.run(fechaPago, gastoCreado.id, venc.id);
      });

      return {
        vencimientos_pagados: vencimientos.length,
        total_pagado: totalPagar,
        gasto_registral_id: gastoCreado.id,
        gasto_registral: gastoCreado,
      };
    });
  }

  /**
   * Obtiene resumen de formularios
   */
  obtenerResumen(): any {
    const resumen = db
      .prepare(
        `SELECT
          COUNT(DISTINCT f.id) as total_formularios,
          COUNT(fv.id) as total_vencimientos,
          SUM(CASE WHEN fv.estado = 'PENDIENTE' THEN 1 ELSE 0 END) as vencimientos_pendientes,
          SUM(CASE WHEN fv.estado = 'PAGADO' THEN 1 ELSE 0 END) as vencimientos_pagados,
          COALESCE(SUM(CASE WHEN fv.estado = 'PENDIENTE' THEN fv.monto ELSE 0 END), 0) as monto_pendiente,
          COALESCE(SUM(CASE WHEN fv.estado = 'PAGADO' THEN fv.monto ELSE 0 END), 0) as monto_pagado
         FROM formularios f
         LEFT JOIN formularios_vencimientos fv ON f.id = fv.formulario_id`
      )
      .get() as any;

    return {
      total_formularios: resumen.total_formularios || 0,
      total_vencimientos: resumen.total_vencimientos || 0,
      vencimientos_pendientes: resumen.vencimientos_pendientes || 0,
      vencimientos_pagados: resumen.vencimientos_pagados || 0,
      monto_pendiente: resumen.monto_pendiente || 0,
      monto_pagado: resumen.monto_pagado || 0,
    };
  }
}

export default new FormulariosService();
