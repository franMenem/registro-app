import { supabase } from '../../lib/supabase';

// Types
type TipoCuenta = 'RENTAS' | 'CAJA' | 'GASTOS_REGISTRO' | 'GASTOS_PERSONALES' | 'ADELANTOS';
type TipoMovimiento = 'INGRESO' | 'EGRESO';

export interface CuentaCorriente {
  id: number;
  nombre: string;
  tipo: TipoCuenta;
  saldo_actual: number;
}

export interface MovimientoCC {
  id: number;
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  concepto: string;
  monto: number;
  saldo_resultante: number;
  movimiento_origen_id: number | null;
  created_at: string;
}

export const cuentasApi = {
  /**
   * Obtener todas las cuentas corrientes
   */
  getAll: async (): Promise<CuentaCorriente[]> => {
    const { data, error } = await supabase
      .from('cuentas_corrientes')
      .select('*')
      .order('nombre');

    if (error) throw new Error(error.message);
    return data as CuentaCorriente[];
  },

  /**
   * Obtener cuenta por ID
   */
  getById: async (id: number): Promise<CuentaCorriente> => {
    const { data, error } = await supabase
      .from('cuentas_corrientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as CuentaCorriente;
  },

  /**
   * Obtener movimientos de una cuenta con filtros opcionales
   */
  getMovimientos: async (
    cuentaId: number,
    filters?: {
      fecha_desde?: string;
      fecha_hasta?: string;
      tipo?: TipoMovimiento;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ movimientos: MovimientoCC[]; total: number }> => {
    let query = supabase
      .from('movimientos_cc')
      .select('*', { count: 'exact' })
      .eq('cuenta_id', cuentaId);

    if (filters?.fecha_desde) {
      query = query.gte('fecha', filters.fecha_desde);
    }
    if (filters?.fecha_hasta) {
      query = query.lte('fecha', filters.fecha_hasta);
    }
    if (filters?.tipo) {
      query = query.eq('tipo_movimiento', filters.tipo);
    }

    query = query.order('fecha', { ascending: false }).order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);
    return {
      movimientos: data as MovimientoCC[],
      total: count || 0,
    };
  },

  /**
   * Crear movimiento y recalcular saldos
   */
  createMovimiento: async (
    cuentaId: number,
    datos: {
      fecha: string;
      tipo_movimiento: TipoMovimiento;
      concepto: string;
      monto: number;
    }
  ): Promise<MovimientoCC> => {
    // Obtener saldo actual de la cuenta
    const cuenta = await cuentasApi.getById(cuentaId);

    // Calcular nuevo saldo
    const nuevoSaldo =
      datos.tipo_movimiento === 'INGRESO'
        ? Number(cuenta.saldo_actual) + datos.monto
        : Number(cuenta.saldo_actual) - datos.monto;

    // Insertar movimiento
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos_cc')
      .insert({
        cuenta_id: cuentaId,
        fecha: datos.fecha,
        tipo_movimiento: datos.tipo_movimiento,
        concepto: datos.concepto,
        monto: datos.monto,
        saldo_resultante: nuevoSaldo,
      })
      .select()
      .single();

    if (movError) throw new Error(movError.message);

    // Actualizar saldo de la cuenta
    const { error: updateError } = await supabase
      .from('cuentas_corrientes')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', cuentaId);

    if (updateError) throw new Error(updateError.message);

    return movimiento as MovimientoCC;
  },

  /**
   * Actualizar movimiento y recalcular saldos
   */
  updateMovimiento: async (
    movimientoId: number,
    datos: { monto?: number; concepto?: string; fecha?: string }
  ): Promise<{ message: string }> => {
    // Obtener movimiento actual
    const { data: movActual, error: getError } = await supabase
      .from('movimientos_cc')
      .select('*, cuentas_corrientes(saldo_actual)')
      .eq('id', movimientoId)
      .single();

    if (getError) throw new Error(getError.message);

    // Si cambió el monto, recalcular
    if (datos.monto !== undefined && datos.monto !== movActual.monto) {
      const diferencia = datos.monto - movActual.monto;
      const ajuste = movActual.tipo_movimiento === 'INGRESO' ? diferencia : -diferencia;

      // Actualizar movimiento
      const { error: updateMovError } = await supabase
        .from('movimientos_cc')
        .update({
          ...datos,
          saldo_resultante: movActual.saldo_resultante + ajuste,
        })
        .eq('id', movimientoId);

      if (updateMovError) throw new Error(updateMovError.message);

      // Actualizar saldo de la cuenta
      const nuevoSaldoCuenta = Number(movActual.cuentas_corrientes.saldo_actual) + ajuste;
      const { error: updateCuentaError } = await supabase
        .from('cuentas_corrientes')
        .update({ saldo_actual: nuevoSaldoCuenta })
        .eq('id', movActual.cuenta_id);

      if (updateCuentaError) throw new Error(updateCuentaError.message);
    } else {
      // Solo actualizar campos sin recalcular
      const { error } = await supabase
        .from('movimientos_cc')
        .update(datos)
        .eq('id', movimientoId);

      if (error) throw new Error(error.message);
    }

    return { message: 'Movimiento actualizado correctamente' };
  },

  /**
   * Eliminar movimiento y recalcular saldos
   */
  deleteMovimiento: async (movimientoId: number): Promise<{ message: string }> => {
    // Obtener movimiento para saber el monto y cuenta
    const { data: movimiento, error: getError } = await supabase
      .from('movimientos_cc')
      .select('*, cuentas_corrientes(saldo_actual)')
      .eq('id', movimientoId)
      .single();

    if (getError) throw new Error(getError.message);

    // Calcular ajuste al saldo
    const ajuste =
      movimiento.tipo_movimiento === 'INGRESO'
        ? -Number(movimiento.monto)
        : Number(movimiento.monto);

    // Eliminar movimiento
    const { error: deleteError } = await supabase
      .from('movimientos_cc')
      .delete()
      .eq('id', movimientoId);

    if (deleteError) throw new Error(deleteError.message);

    // Actualizar saldo de la cuenta
    const nuevoSaldo = Number(movimiento.cuentas_corrientes.saldo_actual) + ajuste;
    const { error: updateError } = await supabase
      .from('cuentas_corrientes')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', movimiento.cuenta_id);

    if (updateError) throw new Error(updateError.message);

    return { message: 'Movimiento eliminado correctamente' };
  },

  /**
   * Importar movimientos desde CSV
   */
  importarCSV: async (
    cuentaId: number,
    contenido: string
  ): Promise<{ insertados: number; errores: string[] }> => {
    const lineas = contenido.trim().split('\n');
    const errores: string[] = [];
    let insertados = 0;

    // Saltar header si existe
    const startIndex = lineas[0]?.toLowerCase().includes('fecha') ? 1 : 0;

    for (let i = startIndex; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (!linea) continue;

      const campos = linea.split(',').map((c) => c.trim());
      if (campos.length < 4) {
        errores.push(`Línea ${i + 1}: formato inválido (se esperan 4 campos)`);
        continue;
      }

      const [fecha, tipo, concepto, montoStr] = campos;

      const tipoNormalizado = tipo.toUpperCase();
      if (tipoNormalizado !== 'INGRESO' && tipoNormalizado !== 'EGRESO') {
        errores.push(`Línea ${i + 1}: tipo inválido "${tipo}"`);
        continue;
      }

      const monto = parseFloat(montoStr);
      if (isNaN(monto) || monto <= 0) {
        errores.push(`Línea ${i + 1}: monto inválido "${montoStr}"`);
        continue;
      }

      try {
        await cuentasApi.createMovimiento(cuentaId, {
          fecha,
          tipo_movimiento: tipoNormalizado as TipoMovimiento,
          concepto,
          monto,
        });
        insertados++;
      } catch (error) {
        errores.push(`Línea ${i + 1}: ${(error as Error).message}`);
      }
    }

    return { insertados, errores };
  },

  /**
   * Limpiar todos los movimientos de una cuenta
   */
  limpiarCuenta: async (
    cuentaId: number
  ): Promise<{ message: string; movimientos_eliminados: number }> => {
    // Contar movimientos
    const { count } = await supabase
      .from('movimientos_cc')
      .select('*', { count: 'exact', head: true })
      .eq('cuenta_id', cuentaId);

    // Eliminar todos los movimientos
    const { error: deleteError } = await supabase
      .from('movimientos_cc')
      .delete()
      .eq('cuenta_id', cuentaId);

    if (deleteError) throw new Error(deleteError.message);

    // Resetear saldo a 0
    const { error: updateError } = await supabase
      .from('cuentas_corrientes')
      .update({ saldo_actual: 0 })
      .eq('id', cuentaId);

    if (updateError) throw new Error(updateError.message);

    return {
      message: 'Cuenta limpiada correctamente',
      movimientos_eliminados: count || 0,
    };
  },

  /**
   * Recalcular saldos de una cuenta específica
   * Recorre todos los movimientos en orden cronológico y actualiza saldo_resultante
   * También actualiza cuentas_corrientes.saldo_actual
   */
  recalcularSaldos: async (
    cuentaId: number
  ): Promise<{ movimientos_actualizados: number; saldo_final: number }> => {
    const { data, error } = await supabase.rpc('recalcular_saldos_cuenta', {
      p_cuenta_id: cuentaId,
    });

    if (error) throw new Error(error.message);

    const result = data?.[0] || { movimientos_actualizados: 0, saldo_final: 0 };
    return {
      movimientos_actualizados: result.movimientos_actualizados,
      saldo_final: Number(result.saldo_final),
    };
  },

  /**
   * Recalcular saldos de TODAS las cuentas
   */
  recalcularTodosLosSaldos: async (): Promise<{
    cuentas: Array<{
      cuenta_id: number;
      cuenta_nombre: string;
      movimientos: number;
      saldo_anterior: number;
      saldo_nuevo: number;
    }>;
    message: string;
  }> => {
    const { data, error } = await supabase.rpc('recalcular_todos_los_saldos');

    if (error) throw new Error(error.message);

    const cuentas = (data || []).map((c: any) => ({
      cuenta_id: Number(c.cuenta_id),
      cuenta_nombre: c.cuenta_nombre,
      movimientos: c.movimientos,
      saldo_anterior: Number(c.saldo_anterior),
      saldo_nuevo: Number(c.saldo_nuevo),
    }));

    return {
      cuentas,
      message: `Recalculados saldos de ${cuentas.length} cuentas`,
    };
  },
};
