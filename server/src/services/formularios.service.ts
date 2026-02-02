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
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
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
   * Calcula el estado de un vencimiento basándose en la fecha
   */
  private calcularEstadoVencimiento(vencimiento: any): 'PENDIENTE' | 'PAGADO' | 'VENCIDO' {
    // Si está pagado, devolver PAGADO
    if (vencimiento.fecha_pago) {
      return 'PAGADO';
    }

    // Si la fecha de vencimiento ya pasó, es VENCIDO
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaVenc = new Date(vencimiento.fecha_vencimiento);
    fechaVenc.setHours(0, 0, 0, 0);

    if (fechaVenc < hoy) {
      return 'VENCIDO';
    }

    // Si no, es PENDIENTE
    return 'PENDIENTE';
  }

  /**
   * Agrega el estado calculado a cada vencimiento
   */
  private agregarEstadosCalculados(formularios: FormularioConVencimientos[]): FormularioConVencimientos[] {
    return formularios.map((f) => ({
      ...f,
      vencimientos: f.vencimientos.map((v) => ({
        ...v,
        estado: this.calcularEstadoVencimiento(v),
      })),
    }));
  }

  /**
   * Calcula el monto a mostrar del formulario (del próximo vencimiento no vencido/no pagado)
   */
  private calcularMontoFormulario(formulario: FormularioConVencimientos): number {
    // Buscar el primer vencimiento que NO esté pagado ni vencido
    const vencimientoPendiente = formulario.vencimientos.find(
      (v) => this.calcularEstadoVencimiento(v) === 'PENDIENTE'
    );

    if (vencimientoPendiente) {
      return vencimientoPendiente.monto;
    }

    // Si no hay pendientes, buscar el primer vencido
    const vencimientoVencido = formulario.vencimientos.find(
      (v) => this.calcularEstadoVencimiento(v) === 'VENCIDO'
    );

    if (vencimientoVencido) {
      return vencimientoVencido.monto;
    }

    // Si todos están pagados, devolver el monto original
    return formulario.monto;
  }

  /**
   * Obtiene todos los formularios con sus vencimientos
   * Optimizado para evitar N+1 queries (1 query para formularios + 1 para todos los vencimientos)
   */
  obtenerTodos(): FormularioConVencimientos[] {
    // 1. Obtener todos los formularios
    const formularios = db
      .prepare(
        `SELECT * FROM formularios
         ORDER BY fecha_compra DESC, created_at DESC`
      )
      .all() as Formulario[];

    if (formularios.length === 0) return [];

    // 2. Obtener TODOS los vencimientos de una sola vez con LEFT JOIN a gastos_registrales
    const formularioIds = formularios.map((f) => f.id);
    const placeholders = formularioIds.map(() => '?').join(',');

    const todosVencimientos = db
      .prepare(
        `SELECT
          fv.*,
          gr.fecha as gasto_fecha,
          gr.monto as gasto_monto,
          gr.estado as gasto_estado
        FROM formularios_vencimientos fv
        LEFT JOIN gastos_registrales gr ON fv.gasto_registral_id = gr.id
        WHERE fv.formulario_id IN (${placeholders})
        ORDER BY fv.formulario_id, fv.numero_vencimiento`
      )
      .all(...formularioIds) as any[];

    // 3. Agrupar vencimientos por formulario_id
    const vencimientosPorFormulario = new Map<number, Vencimiento[]>();
    for (const venc of todosVencimientos) {
      if (!vencimientosPorFormulario.has(venc.formulario_id)) {
        vencimientosPorFormulario.set(venc.formulario_id, []);
      }

      // Construir vencimiento con datos del gasto si existe
      const vencimiento: Vencimiento = {
        id: venc.id,
        formulario_id: venc.formulario_id,
        numero_vencimiento: venc.numero_vencimiento,
        fecha_vencimiento: venc.fecha_vencimiento,
        monto: venc.monto,
        estado: venc.estado,
        fecha_pago: venc.fecha_pago,
        gasto_registral_id: venc.gasto_registral_id,
        created_at: venc.created_at,
        updated_at: venc.updated_at,
      };

      vencimientosPorFormulario.get(venc.formulario_id)!.push(vencimiento);
    }

    // 4. Mapear formularios con sus vencimientos
    const formulariosConVencimientos = formularios.map((formulario) => {
      const vencimientos = vencimientosPorFormulario.get(formulario.id) || [];
      const vencimientosConEstado = vencimientos.map((v) => ({
        ...v,
        estado: this.calcularEstadoVencimiento(v),
      }));

      return {
        ...formulario,
        monto: this.calcularMontoFormulario({
          ...formulario,
          vencimientos: vencimientosConEstado,
        }),
        vencimientos: vencimientosConEstado,
      };
    });

    return formulariosConVencimientos;
  }

  /**
   * Obtiene un formulario por ID con sus vencimientos
   */
  obtenerPorId(id: number): FormularioConVencimientos | null {
    const formulario = db
      .prepare('SELECT * FROM formularios WHERE id = ?')
      .get(id) as Formulario | undefined;

    if (!formulario) return null;

    const vencimientos = this.obtenerVencimientos(id);
    const vencimientosConEstado = vencimientos.map((v) => ({
      ...v,
      estado: this.calcularEstadoVencimiento(v),
    }));

    return {
      ...formulario,
      monto: this.calcularMontoFormulario({
        ...formulario,
        vencimientos: vencimientosConEstado,
      }),
      vencimientos: vencimientosConEstado,
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
   * Obtiene vencimientos pendientes (incluye PENDIENTE y VENCIDO, excluye PAGADO)
   */
  obtenerVencimientosPendientes(): any[] {
    const vencimientos = db
      .prepare(
        `SELECT fv.*, f.numero, f.descripcion, f.proveedor
         FROM formularios_vencimientos fv
         JOIN formularios f ON fv.formulario_id = f.id
         WHERE fv.fecha_pago IS NULL
         ORDER BY fv.fecha_vencimiento ASC`
      )
      .all() as any[];

    // Agregar estado calculado
    return vencimientos.map((v) => ({
      ...v,
      estado: this.calcularEstadoVencimiento(v),
    }));
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

      // Obtener números de formularios asociados
      const numerosFormularios = vencimientos.map((venc) => {
        const formulario = db
          .prepare('SELECT numero FROM formularios WHERE id = ?')
          .get(venc.formulario_id) as { numero: string } | undefined;
        return formulario?.numero || 'N/A';
      });

      // Crear observaciones con números de formularios
      const formulariosUnicos = [...new Set(numerosFormularios)]; // Eliminar duplicados
      const observaciones = `Formularios pagados: ${formulariosUnicos.join(', ')} (${vencimientos.length} vencimiento${vencimientos.length > 1 ? 's' : ''})`;

      // Crear gasto en Gastos Registrales (CARCOS)
      const gastoCreado = gastosRegistralesService.crear({
        fecha: fechaPago,
        concepto: 'CARCOS',
        monto: totalPagar,
        observaciones,
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
    const formularios = db.prepare('SELECT COUNT(*) as total FROM formularios').get() as any;

    const vencimientos = db
      .prepare('SELECT * FROM formularios_vencimientos')
      .all() as any[];

    // Calcular estados de vencimientos
    let vencimientosPendientes = 0;
    let vencimientosVencidos = 0;
    let vencimientosPagados = 0;
    let montoPendiente = 0;
    let montoVencido = 0;
    let montoPagado = 0;

    vencimientos.forEach((v) => {
      const estado = this.calcularEstadoVencimiento(v);

      if (estado === 'PENDIENTE') {
        vencimientosPendientes++;
        montoPendiente += v.monto;
      } else if (estado === 'VENCIDO') {
        vencimientosVencidos++;
        montoVencido += v.monto;
      } else if (estado === 'PAGADO') {
        vencimientosPagados++;
        montoPagado += v.monto;
      }
    });

    // Calcular saldo pendiente de formularios (suma dinámica de montos a mostrar)
    // Solo contar formularios "activos" = NINGÚN vencimiento pagado todavía
    const todosFormularios = this.obtenerTodos();
    let saldoPendienteFormularios = 0;
    let formulariosConDeuda = 0;

    todosFormularios.forEach((formulario) => {
      // Solo contar formularios donde TODOS los vencimientos están sin pagar (activos)
      const todosVencimientosSinPagar = formulario.vencimientos.every(
        (v) => v.estado === 'PENDIENTE' || v.estado === 'VENCIDO'
      );

      if (todosVencimientosSinPagar) {
        saldoPendienteFormularios += formulario.monto; // Este monto ya es el calculado dinámicamente
        formulariosConDeuda++;
      }
    });

    return {
      total_formularios: formularios.total || 0,
      total_vencimientos: vencimientos.length,
      vencimientos_pendientes: vencimientosPendientes,
      vencimientos_vencidos: vencimientosVencidos,
      vencimientos_pagados: vencimientosPagados,
      monto_pendiente: montoPendiente,
      monto_vencido: montoVencido,
      monto_pagado: montoPagado,
      saldo_pendiente_formularios: saldoPendienteFormularios,
      formularios_con_deuda: formulariosConDeuda,
    };
  }
}

export default new FormulariosService();
