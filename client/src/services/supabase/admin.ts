// Supabase service for Admin operations (cleanup, migration)

import { supabase } from '@/lib/supabase';

export interface CleanupResult {
  message: string;
  deleted?: number;
}

export interface MigracionResult {
  message: string;
  veps_migrados: number;
  epagos_migrados: number;
  errores: string[];
}

export const adminApi = {
  // Cleanup operations

  // Clean all data
  limpiarTodo: async (): Promise<CleanupResult> => {
    // Delete in order to respect foreign keys
    await supabase.from('movimientos_cc').delete().neq('id', 0);
    await supabase.from('control_posnet_diario').delete().neq('id', 0);
    await supabase.from('control_posnet').delete().neq('id', 0);
    await supabase.from('controles_semanales').delete().neq('id', 0);
    await supabase.from('controles_quincenales').delete().neq('id', 0);
    await supabase.from('movimientos').delete().neq('id', 0);
    await supabase.from('movimientos_efectivo').delete().neq('id', 0);
    await supabase.from('depositos').delete().neq('id', 0);
    await supabase.from('adelantos_empleados').delete().neq('id', 0);
    await supabase.from('formularios_vencimientos').delete().neq('id', 0);
    await supabase.from('formularios').delete().neq('id', 0);
    await supabase.from('gastos_registrales').delete().neq('id', 0);
    await supabase.from('gastos_personales').delete().neq('id', 0);
    await supabase.from('gastos_mios').delete().neq('id', 0);
    await supabase.from('control_veps').delete().neq('id', 0);
    await supabase.from('control_epagos').delete().neq('id', 0);

    // Reset account balances to 0
    await supabase.from('cuentas_corrientes').update({ saldo_actual: 0 }).neq('id', 0);

    return { message: 'Base de datos limpiada correctamente' };
  },

  // Clean all gastos registrales
  limpiarGastosRegistrales: async (): Promise<CleanupResult> => {
    const { error } = await supabase
      .from('gastos_registrales')
      .delete()
      .neq('id', 0);

    if (error) {
      throw new Error(`Error al limpiar gastos registrales: ${error.message}`);
    }

    return { message: 'Gastos registrales eliminados correctamente' };
  },

  // Clean gastos registrales for a specific month
  limpiarGastosRegistralesMes: async (
    mes: number,
    anio: number
  ): Promise<CleanupResult> => {
    const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('gastos_registrales')
      .delete()
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .select();

    if (error) {
      throw new Error(`Error al limpiar gastos registrales: ${error.message}`);
    }

    return {
      message: `Gastos registrales de ${mes}/${anio} eliminados correctamente`,
      deleted: data?.length || 0,
    };
  },

  // Clean all gastos personales
  limpiarGastosPersonales: async (): Promise<CleanupResult> => {
    const { error } = await supabase
      .from('gastos_personales')
      .delete()
      .neq('id', 0);

    if (error) {
      throw new Error(`Error al limpiar gastos personales: ${error.message}`);
    }

    return { message: 'Gastos personales eliminados correctamente' };
  },

  // Clean gastos personales for a specific month
  limpiarGastosPersonalesMes: async (
    mes: number,
    anio: number
  ): Promise<CleanupResult> => {
    const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('gastos_personales')
      .delete()
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .select();

    if (error) {
      throw new Error(`Error al limpiar gastos personales: ${error.message}`);
    }

    return {
      message: `Gastos personales de ${mes}/${anio} eliminados correctamente`,
      deleted: data?.length || 0,
    };
  },

  // Clean movimientos (RENTAS and CAJA)
  limpiarMovimientos: async (): Promise<CleanupResult> => {
    // Delete controles semanales and quincenales first
    await supabase.from('controles_semanales').delete().neq('id', 0);
    await supabase.from('controles_quincenales').delete().neq('id', 0);

    // Delete movimientos
    const { error } = await supabase.from('movimientos').delete().neq('id', 0);

    if (error) {
      throw new Error(`Error al limpiar movimientos: ${error.message}`);
    }

    return { message: 'Movimientos eliminados correctamente' };
  },

  // Clean control POSNET
  limpiarPosnet: async (): Promise<CleanupResult> => {
    await supabase.from('control_posnet_diario').delete().neq('id', 0);
    const { error } = await supabase.from('control_posnet').delete().neq('id', 0);

    if (error) {
      throw new Error(`Error al limpiar control POSNET: ${error.message}`);
    }

    return { message: 'Control POSNET eliminado correctamente' };
  },
};

// Migration utilities
export const migracionApi = {
  // Migrate VEPs and ePagos from movimientos table to control tables
  migrarVepsYEpagos: async (): Promise<MigracionResult> => {
    const errores: string[] = [];
    let veps_migrados = 0;
    let epagos_migrados = 0;

    // Get VEP movements from movimientos_cc
    const { data: vepMovs, error: vepError } = await supabase
      .from('movimientos_cc')
      .select('*')
      .ilike('concepto', '%VEP%');

    if (vepError) {
      throw new Error(`Error al obtener movimientos VEP: ${vepError.message}`);
    }

    // Migrate VEPs
    for (const mov of vepMovs || []) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('control_veps')
          .select('id')
          .eq('fecha', mov.fecha)
          .eq('monto', mov.monto)
          .single();

        if (!existing) {
          const { error: insertError } = await supabase.from('control_veps').insert({
            fecha: mov.fecha,
            monto: mov.monto,
            concepto: mov.concepto,
            descripcion: `Migrado desde movimientos_cc #${mov.id}`,
          });

          if (insertError) {
            errores.push(`VEP ${mov.id}: ${insertError.message}`);
          } else {
            veps_migrados++;
          }
        }
      } catch (err) {
        errores.push(`VEP ${mov.id}: Error desconocido`);
      }
    }

    // Get ePagos movements from movimientos_cc
    const { data: epagoMovs, error: epagoError } = await supabase
      .from('movimientos_cc')
      .select('*')
      .ilike('concepto', '%EPAGO%');

    if (epagoError) {
      throw new Error(`Error al obtener movimientos ePagos: ${epagoError.message}`);
    }

    // Migrate ePagos
    for (const mov of epagoMovs || []) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('control_epagos')
          .select('id')
          .eq('fecha', mov.fecha)
          .eq('monto', mov.monto)
          .single();

        if (!existing) {
          const { error: insertError } = await supabase.from('control_epagos').insert({
            fecha: mov.fecha,
            monto: mov.monto,
            concepto: mov.concepto,
            descripcion: `Migrado desde movimientos_cc #${mov.id}`,
          });

          if (insertError) {
            errores.push(`ePago ${mov.id}: ${insertError.message}`);
          } else {
            epagos_migrados++;
          }
        }
      } catch (err) {
        errores.push(`ePago ${mov.id}: Error desconocido`);
      }
    }

    return {
      message: `Migración completada: ${veps_migrados} VEPs, ${epagos_migrados} ePagos`,
      veps_migrados,
      epagos_migrados,
      errores,
    };
  },
};
