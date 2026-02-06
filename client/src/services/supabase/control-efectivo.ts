import { supabase } from '../../lib/supabase';
import { gastosPersonalesApi } from './gastos-personales';
import { gastosRegistralesApi } from './gastos-registrales';

// Types
type TipoMovimiento = 'INGRESO' | 'GASTO' | 'DEPOSITO';
type CategoriaGasto = 'GENERICO' | 'REGISTRAL' | 'PERSONAL';

export interface MovimientoEfectivo {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  cuenta_id: number | null;
  cuenta_nombre?: string;
  observaciones: string | null;
  created_at: string;
}

export interface EfectivoConfig {
  id: number;
  saldo_inicial: number;
  updated_at: string;
}

export interface EfectivoStats {
  saldo_inicial: number;
  total_rentas: number;
  total_caja: number;
  total_gastos: number;
  total_depositos: number;
  saldo_actual: number;
}

export const controlEfectivoApi = {
  /**
   * Obtener configuración (saldo inicial)
   */
  getConfig: async (): Promise<EfectivoConfig> => {
    const { data, error } = await supabase
      .from('control_efectivo_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      // Si no existe, crear con valores por defecto
      if (error.code === 'PGRST116') {
        const { data: newConfig, error: insertError } = await supabase
          .from('control_efectivo_config')
          .insert({ id: 1, saldo_inicial: 0 })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        return newConfig as EfectivoConfig;
      }
      throw new Error(error.message);
    }
    return data as EfectivoConfig;
  },

  /**
   * Actualizar saldo inicial
   */
  updateConfig: async (saldoInicial: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('control_efectivo_config')
      .upsert({
        id: 1,
        saldo_inicial: saldoInicial,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
    return { message: 'Configuración actualizada' };
  },

  /**
   * Obtener todos los movimientos
   */
  getMovimientos: async (): Promise<MovimientoEfectivo[]> => {
    const { data, error } = await supabase
      .from('movimientos_efectivo')
      .select(`
        *,
        cuentas_corrientes (nombre)
      `)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Map to include cuenta_nombre
    return (data || []).map((m: any) => ({
      ...m,
      cuenta_nombre: m.cuentas_corrientes?.nombre || null,
    }));
  },

  /**
   * Obtener estadísticas
   */
  getStats: async (): Promise<EfectivoStats> => {
    // Get config for saldo inicial
    const config = await controlEfectivoApi.getConfig();

    // Get all movimientos to calculate stats
    const { data: movimientos, error } = await supabase
      .from('movimientos_efectivo')
      .select('tipo, monto, concepto');

    if (error) throw new Error(error.message);

    const ingresos = (movimientos || []).filter((m) => m.tipo === 'INGRESO');
    const gastos = (movimientos || []).filter((m) => m.tipo === 'GASTO');
    const depositos = (movimientos || []).filter((m) => m.tipo === 'DEPOSITO');

    // NOTE: Para distinguir RENTAS vs CAJA, necesitamos ver el concepto o la tabla de origen
    // Por ahora, asumimos que todos los ingresos son "entregados" (rentas + caja combinados)
    const total_ingresos = ingresos.reduce((sum, m) => sum + Number(m.monto), 0);
    const total_gastos = gastos.reduce((sum, m) => sum + Number(m.monto), 0);
    const total_depositos = depositos.reduce((sum, m) => sum + Number(m.monto), 0);

    const saldo_actual =
      Number(config.saldo_inicial) + total_ingresos - total_gastos - total_depositos;

    return {
      saldo_inicial: Number(config.saldo_inicial),
      total_rentas: total_ingresos, // Simplificado - debería separarse por origen
      total_caja: 0, // Simplificado
      total_gastos,
      total_depositos,
      saldo_actual,
    };
  },

  /**
   * Crear movimiento
   * Maneja la lógica de crear gastos en otras tablas según la categoría
   */
  createMovimiento: async (data: {
    fecha: string;
    tipo: TipoMovimiento;
    categoria?: CategoriaGasto;
    concepto: string;
    concepto_especifico?: string;
    monto: number;
    cuenta_id?: number;
    observaciones?: string;
  }): Promise<{ message: string; data: MovimientoEfectivo }> => {
    // Determinar concepto final
    const conceptoFinal =
      data.tipo === 'DEPOSITO'
        ? 'Depósito al banco'
        : data.concepto_especifico || data.concepto;

    // 1. Crear el movimiento de efectivo
    const { data: movimiento, error } = await supabase
      .from('movimientos_efectivo')
      .insert({
        fecha: data.fecha,
        tipo: data.tipo,
        concepto: conceptoFinal,
        monto: data.monto,
        cuenta_id: data.cuenta_id || null,
        observaciones: data.observaciones || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 2. Si es un GASTO con categoría especial, crear también en la tabla correspondiente
    if (data.tipo === 'GASTO' && data.concepto_especifico) {
      try {
        if (data.categoria === 'PERSONAL') {
          await gastosPersonalesApi.create({
            fecha: data.fecha,
            concepto: data.concepto_especifico as any,
            monto: data.monto,
            observaciones: data.observaciones || 'Registrado desde Control Efectivo',
            estado: 'Pagado',
          });
        } else if (data.categoria === 'REGISTRAL') {
          await gastosRegistralesApi.create({
            fecha: data.fecha,
            concepto: data.concepto_especifico as any,
            monto: data.monto,
            observaciones: data.observaciones || 'Registrado desde Control Efectivo',
            estado: 'Pagado',
          });
        }
      } catch (cascadeError) {
        console.error('Error al crear gasto asociado:', cascadeError);
        // No fallar la operación principal
      }
    }

    return { message: 'Movimiento registrado exitosamente', data: movimiento as MovimientoEfectivo };
  },

  /**
   * Actualizar movimiento
   */
  updateMovimiento: async (
    id: number,
    data: {
      fecha?: string;
      concepto?: string;
      monto?: number;
      cuenta_id?: number | null;
      observaciones?: string | null;
    }
  ): Promise<{ message: string; data: MovimientoEfectivo }> => {
    const { data: movimiento, error } = await supabase
      .from('movimientos_efectivo')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Movimiento actualizado', data: movimiento as MovimientoEfectivo };
  },

  /**
   * Eliminar movimiento
   */
  deleteMovimiento: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('movimientos_efectivo').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Movimiento eliminado' };
  },
};
