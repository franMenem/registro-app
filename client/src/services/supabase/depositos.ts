import { supabase } from '../../lib/supabase';

// Types
type EstadoDeposito = 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR' | 'A_CUENTA' | 'DEVUELTO';
type TipoUso = 'CAJA' | 'RENTAS' | 'A_CUENTA' | 'DEVUELTO';

export interface Deposito {
  id: number;
  monto_original: number;
  saldo_actual: number;
  fecha_ingreso: string;
  fecha_uso: string | null;
  fecha_devolucion: string | null;
  estado: EstadoDeposito;
  tipo_uso: TipoUso | null;
  descripcion_uso: string | null;
  monto_devuelto: number;
  titular: string;
  observaciones: string | null;
  cuenta_id: number | null;
  movimiento_origen_id: number | null;
  created_at: string;
  cliente_id: number | null;
  // Joined data
  cuenta_nombre?: string;
  cliente_nombre?: string;
}

export interface DepositoCreate {
  monto_original: number;
  fecha_ingreso: string;
  titular: string;
  observaciones?: string;
  cliente_id?: number;
  cuenta_id?: number;
  fecha_uso?: string;
  estado?: 'PENDIENTE' | 'LIQUIDADO';
}

export interface GastoDeposito {
  id: number;
  fecha: string;
  tipo: 'CAJA' | 'RENTAS';
  numero_deposito: number;
  monto: number;
  deposito_id: number | null;
  created_at: string;
}

export interface DepositoEstadisticas {
  total: number;
  pendientes: number;
  liquidados: number;
  a_favor: number;
  a_cuenta: number;
  saldo_total_disponible: number;
}

export const depositosApi = {
  /**
   * Obtener todos los depósitos con filtros
   */
  getAll: async (filters?: {
    estado?: string;
    cuenta_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ depositos: Deposito[]; total: number }> => {
    let query = supabase
      .from('depositos')
      .select(
        `
        *,
        cuentas_corrientes (nombre),
        clientes (razon_social)
      `,
        { count: 'exact' }
      );

    if (filters?.estado) {
      query = query.eq('estado', filters.estado);
    }
    if (filters?.cuenta_id) {
      query = query.eq('cuenta_id', filters.cuenta_id);
    }
    if (filters?.fecha_desde) {
      query = query.gte('fecha_ingreso', filters.fecha_desde);
    }
    if (filters?.fecha_hasta) {
      query = query.lte('fecha_ingreso', filters.fecha_hasta);
    }

    query = query.order('fecha_ingreso', { ascending: false });

    if (filters?.limit) {
      const offset = filters.offset || 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    const depositos = (data || []).map((d: any) => ({
      ...d,
      cuenta_nombre: d.cuentas_corrientes?.nombre || null,
      cliente_nombre: d.clientes?.razon_social || null,
    }));

    return { depositos, total: count || 0 };
  },

  /**
   * Obtener depósito por ID
   */
  getById: async (id: number): Promise<Deposito> => {
    const { data, error } = await supabase
      .from('depositos')
      .select(
        `
        *,
        cuentas_corrientes (nombre),
        clientes (razon_social)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);

    return {
      ...data,
      cuenta_nombre: data.cuentas_corrientes?.nombre || null,
      cliente_nombre: data.clientes?.razon_social || null,
    } as Deposito;
  },

  /**
   * Obtener depósitos no asociados a cuenta
   */
  getNoAsociados: async (): Promise<Deposito[]> => {
    const { data, error } = await supabase
      .from('depositos')
      .select('*')
      .is('cuenta_id', null)
      .is('cliente_id', null)
      .in('estado', ['PENDIENTE', 'A_FAVOR'])
      .order('fecha_ingreso', { ascending: false });

    if (error) throw new Error(error.message);
    return data as Deposito[];
  },

  /**
   * Obtener estadísticas de depósitos
   */
  getEstadisticas: async (): Promise<DepositoEstadisticas> => {
    const { data, error } = await supabase.from('depositos').select('estado, saldo_actual');

    if (error) throw new Error(error.message);

    const depositos = data || [];

    const pendientes = depositos.filter((d) => d.estado === 'PENDIENTE');
    const liquidados = depositos.filter((d) => d.estado === 'LIQUIDADO');
    const aFavor = depositos.filter((d) => d.estado === 'A_FAVOR');
    const aCuenta = depositos.filter((d) => d.estado === 'A_CUENTA');

    // Saldo disponible = pendientes + a_favor (los que aún tienen saldo usable)
    const saldoDisponible = [...pendientes, ...aFavor].reduce(
      (sum, d) => sum + Number(d.saldo_actual),
      0
    );

    return {
      total: depositos.length,
      pendientes: pendientes.length,
      liquidados: liquidados.length,
      a_favor: aFavor.length,
      a_cuenta: aCuenta.length,
      saldo_total_disponible: saldoDisponible,
    };
  },

  /**
   * Verificar si existen depósitos con misma fecha y monto
   */
  checkDuplicados: async (fecha: string, monto: number): Promise<number> => {
    const { count, error } = await supabase
      .from('depositos')
      .select('*', { count: 'exact', head: true })
      .eq('fecha_ingreso', fecha)
      .eq('monto_original', monto);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  /**
   * Crear nuevo depósito
   */
  create: async (deposito: DepositoCreate): Promise<{ message: string; data: Deposito }> => {
    const esLiquidado = deposito.estado === 'LIQUIDADO';

    const { data, error } = await supabase
      .from('depositos')
      .insert({
        monto_original: deposito.monto_original,
        saldo_actual: esLiquidado ? 0 : deposito.monto_original,
        fecha_ingreso: deposito.fecha_ingreso,
        titular: deposito.titular,
        observaciones: deposito.observaciones || null,
        cliente_id: deposito.cliente_id || null,
        cuenta_id: deposito.cuenta_id || null,
        fecha_uso: esLiquidado ? deposito.fecha_ingreso : (deposito.fecha_uso || null),
        estado: esLiquidado ? 'LIQUIDADO' : 'PENDIENTE',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Depósito creado correctamente', data: data as Deposito };
  },

  /**
   * Actualizar depósito
   */
  update: async (id: number, datos: Partial<Deposito>): Promise<{ message: string }> => {
    const { error } = await supabase.from('depositos').update(datos).eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Depósito actualizado correctamente' };
  },

  /**
   * Eliminar depósito
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('depositos').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Depósito eliminado correctamente' };
  },

  /**
   * Liquidar depósito (usar completamente)
   */
  liquidar: async (id: number, fechaUso: string): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('depositos')
      .update({
        estado: 'LIQUIDADO',
        fecha_uso: fechaUso,
        saldo_actual: 0,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Depósito liquidado correctamente' };
  },

  /**
   * Marcar depósito como A FAVOR (saldo restante)
   */
  marcarAFavor: async (id: number, saldoRestante: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('depositos')
      .update({
        estado: 'A_FAVOR',
        saldo_actual: saldoRestante,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Depósito marcado como A FAVOR' };
  },

  /**
   * Devolver depósito
   */
  devolver: async (id: number, fechaDevolucion: string): Promise<{ message: string }> => {
    // Obtener depósito actual
    const deposito = await depositosApi.getById(id);

    const { error } = await supabase
      .from('depositos')
      .update({
        estado: 'DEVUELTO',
        fecha_devolucion: fechaDevolucion,
        monto_devuelto: deposito.saldo_actual,
        saldo_actual: 0,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Depósito devuelto correctamente' };
  },

  /**
   * Usar saldo parcial del depósito
   */
  usarSaldo: async (
    id: number,
    monto: number,
    tipoUso: 'CAJA' | 'RENTAS',
    descripcion?: string
  ): Promise<{ message: string }> => {
    // Obtener depósito actual
    const deposito = await depositosApi.getById(id);

    if (monto > deposito.saldo_actual) {
      throw new Error('El monto a usar excede el saldo disponible');
    }

    const nuevoSaldo = deposito.saldo_actual - monto;
    const nuevoEstado = nuevoSaldo === 0 ? 'LIQUIDADO' : 'A_FAVOR';

    const { error } = await supabase
      .from('depositos')
      .update({
        saldo_actual: nuevoSaldo,
        estado: nuevoEstado,
        tipo_uso: tipoUso,
        descripcion_uso: descripcion || null,
        fecha_uso: new Date().toISOString().split('T')[0],
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: `Saldo utilizado. Nuevo saldo: ${nuevoSaldo}` };
  },

  /**
   * Asociar depósito a cuenta corriente (auto-sync: crea INGRESO + recalcula saldos)
   */
  asociarCuenta: async (id: number, cuentaId: number): Promise<{ message: string }> => {
    const deposito = await depositosApi.getById(id);

    // Crear movimiento INGRESO en la cuenta corriente
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos_cc')
      .insert({
        cuenta_id: cuentaId,
        fecha: deposito.fecha_ingreso,
        tipo_movimiento: 'INGRESO',
        concepto: `Depósito de ${deposito.titular}`,
        monto: deposito.monto_original,
        saldo_resultante: 0, // Se recalcula después
      })
      .select()
      .single();

    if (movError) throw new Error(movError.message);

    // Actualizar depósito con cuenta_id, movimiento_origen_id y estado A_CUENTA
    const { error } = await supabase
      .from('depositos')
      .update({
        cuenta_id: cuentaId,
        movimiento_origen_id: movimiento.id,
        estado: 'A_CUENTA',
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    // Recalcular saldos de la cuenta
    await supabase.rpc('recalcular_saldos_cuenta', { p_cuenta_id: cuentaId });

    return { message: 'Depósito asociado a cuenta correctamente' };
  },

  /**
   * Desasociar depósito de cuenta corriente (auto-sync: borra INGRESO + recalcula saldos)
   */
  desasociarCuenta: async (id: number): Promise<{ message: string }> => {
    const deposito = await depositosApi.getById(id);
    const cuentaId = deposito.cuenta_id;

    // Borrar movimiento INGRESO si existe
    if (deposito.movimiento_origen_id) {
      const { error: delError } = await supabase
        .from('movimientos_cc')
        .delete()
        .eq('id', deposito.movimiento_origen_id);

      if (delError) throw new Error(delError.message);
    }

    // Limpiar cuenta_id y movimiento_origen_id del depósito, revertir estado a PENDIENTE
    const { error } = await supabase
      .from('depositos')
      .update({ cuenta_id: null, movimiento_origen_id: null, estado: 'PENDIENTE' })
      .eq('id', id);

    if (error) throw new Error(error.message);

    // Recalcular saldos de la cuenta que se desasoció
    if (cuentaId) {
      await supabase.rpc('recalcular_saldos_cuenta', { p_cuenta_id: cuentaId });
    }

    return { message: 'Depósito desasociado de cuenta' };
  },

  /**
   * Obtener gastos de depósito sin asignar
   */
  getGastosSinAsignar: async (): Promise<GastoDeposito[]> => {
    const { data, error } = await supabase
      .from('gastos_deposito')
      .select('*')
      .is('deposito_id', null)
      .order('fecha', { ascending: false });

    if (error) throw new Error(error.message);
    return data as GastoDeposito[];
  },

  /**
   * Asignar gasto de planilla a un depósito (descuenta saldo)
   */
  asignarGasto: async (gastoId: number, depositoId: number): Promise<{ message: string }> => {
    // Obtener gasto
    const { data: gasto, error: gastoErr } = await supabase
      .from('gastos_deposito')
      .select('*')
      .eq('id', gastoId)
      .single();

    if (gastoErr) throw new Error(gastoErr.message);
    if (gasto.deposito_id) throw new Error('Este gasto ya está asignado');

    // Obtener depósito
    const deposito = await depositosApi.getById(depositoId);
    if (gasto.monto > deposito.saldo_actual) {
      throw new Error(`El monto del gasto ($${gasto.monto}) excede el saldo disponible ($${deposito.saldo_actual})`);
    }

    // Asignar gasto
    const { error: updGasto } = await supabase
      .from('gastos_deposito')
      .update({ deposito_id: depositoId })
      .eq('id', gastoId);

    if (updGasto) throw new Error(updGasto.message);

    // Actualizar saldo del depósito
    const nuevoSaldo = deposito.saldo_actual - gasto.monto;
    const nuevoEstado = nuevoSaldo === 0 ? 'LIQUIDADO' : 'A_FAVOR';

    const { error: updDep } = await supabase
      .from('depositos')
      .update({
        saldo_actual: nuevoSaldo,
        estado: nuevoEstado,
        ...(nuevoSaldo === 0 ? { fecha_uso: new Date().toISOString().split('T')[0] } : {}),
      })
      .eq('id', depositoId);

    if (updDep) throw new Error(updDep.message);

    return { message: `Gasto asignado. Nuevo saldo: $${nuevoSaldo}` };
  },

  /**
   * Desasignar gasto de depósito (revierte saldo)
   */
  desasignarGasto: async (gastoId: number): Promise<{ message: string }> => {
    // Obtener gasto con su deposito_id
    const { data: gasto, error: gastoErr } = await supabase
      .from('gastos_deposito')
      .select('*')
      .eq('id', gastoId)
      .single();

    if (gastoErr) throw new Error(gastoErr.message);
    if (!gasto.deposito_id) throw new Error('Este gasto no está asignado');

    const depositoId = gasto.deposito_id;

    // Obtener depósito actual
    const deposito = await depositosApi.getById(depositoId);

    // Desasignar gasto
    const { error: updGasto } = await supabase
      .from('gastos_deposito')
      .update({ deposito_id: null })
      .eq('id', gastoId);

    if (updGasto) throw new Error(updGasto.message);

    // Revertir saldo del depósito
    const nuevoSaldo = deposito.saldo_actual + gasto.monto;
    const nuevoEstado = nuevoSaldo >= deposito.monto_original ? 'PENDIENTE' : 'A_FAVOR';

    const { error: updDep } = await supabase
      .from('depositos')
      .update({
        saldo_actual: nuevoSaldo,
        estado: nuevoEstado,
        fecha_uso: null,
      })
      .eq('id', depositoId);

    if (updDep) throw new Error(updDep.message);

    return { message: `Gasto desasignado. Saldo restaurado: $${nuevoSaldo}` };
  },

  /**
   * Obtener depósitos elegibles para asignar gastos (PENDIENTE o A_FAVOR, sin cuenta CC)
   */
  getElegiblesParaGastos: async (): Promise<Deposito[]> => {
    const { data, error } = await supabase
      .from('depositos')
      .select('*')
      .is('cuenta_id', null)
      .in('estado', ['PENDIENTE', 'A_FAVOR'])
      .gt('saldo_actual', 0)
      .order('fecha_ingreso', { ascending: false });

    if (error) throw new Error(error.message);
    return data as Deposito[];
  },

  /**
   * Importar depósitos desde CSV
   * Formato: Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion
   */
  importarCSV: async (
    contenido: string
  ): Promise<{
    insertados: number;
    procesados: number;
    errores: string[];
    pendientes: number;
    liquidados: number;
    aFavor: number;
    message: string;
  }> => {
    const lines = contenido
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    const errores: string[] = [];
    let insertados = 0;
    let pendientes = 0;
    let liquidados = 0;
    let aFavor = 0;

    // Helper functions
    const parsearFecha = (fechaStr: string): string => {
      if (!fechaStr || fechaStr.trim() === '') {
        return new Date().toISOString().split('T')[0];
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
        return fechaStr.trim();
      }

      const partes = fechaStr.trim().split(/[-/]/);
      if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        let anio = partes[2];
        if (anio.length === 2) {
          const anioNum = parseInt(anio);
          anio = anioNum >= 50 ? `19${anio}` : `20${anio}`;
        }
        return `${anio}-${mes}-${dia}`;
      }

      return new Date().toISOString().split('T')[0];
    };

    const limpiarNumero = (valor: string): number => {
      if (!valor || valor.trim() === '' || valor.trim() === '-') {
        return 0;
      }
      let limpio = valor.replace(/\s/g, '').trim();
      const tieneComaDecimal = /,\d{1,2}$/.test(limpio);
      const tienePuntoDecimal = /\.\d{1,2}$/.test(limpio);

      if (tieneComaDecimal) {
        limpio = limpio.replace(/\./g, '').replace(',', '.');
      } else if (tienePuntoDecimal) {
        limpio = limpio.replace(/,/g, '');
      } else {
        limpio = limpio.replace(/[^\d]/g, '');
      }
      return parseFloat(limpio) || 0;
    };

    const determinarEstado = (
      estado: string,
      cuitDenominacion: string
    ): { estadoFinal: 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR'; saldoActual: number } => {
      if (!cuitDenominacion || cuitDenominacion.trim() === '') {
        return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
      }
      if (!estado || estado.trim() === '') {
        return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
      }

      const estadoLimpio = estado.replace(/\s/g, '').trim();
      const esNumero = /^[\d.,\-]+$/.test(estadoLimpio);

      if (esNumero) {
        try {
          const saldo = limpiarNumero(estadoLimpio);
          return { estadoFinal: 'A_FAVOR', saldoActual: saldo };
        } catch {
          return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
        }
      }

      return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
    };

    // Skip header, process data rows
    for (let i = 1; i < lines.length; i++) {
      const campos = lines[i].split(',');
      if (campos.length < 2) continue;

      try {
        const montoStr = campos[0]?.trim() || '0';
        const fechaDepositoStr = campos[1]?.trim() || '';
        const estado = campos[3]?.trim() || '';
        const cuitDenominacion = campos[4]?.trim() || '';

        const monto = limpiarNumero(montoStr);
        if (monto <= 0) continue;

        const fechaDeposito = parsearFecha(fechaDepositoStr);
        const { estadoFinal, saldoActual } = determinarEstado(estado, cuitDenominacion);

        const depositoData = {
          monto_original: monto,
          saldo_actual: estadoFinal === 'A_FAVOR' ? saldoActual : estadoFinal === 'LIQUIDADO' ? 0 : monto,
          fecha_ingreso: fechaDeposito,
          titular: cuitDenominacion || 'Sin identificar',
          estado: estadoFinal,
          observaciones: estado || null,
        };

        const { error: insertError } = await supabase.from('depositos').insert(depositoData);

        if (insertError) {
          errores.push(`Fila ${i + 1}: ${insertError.message}`);
        } else {
          insertados++;
          if (estadoFinal === 'PENDIENTE') pendientes++;
          else if (estadoFinal === 'LIQUIDADO') liquidados++;
          else if (estadoFinal === 'A_FAVOR') aFavor++;
        }
      } catch (err) {
        errores.push(`Fila ${i + 1}: Error al procesar`);
      }
    }

    return {
      insertados,
      procesados: lines.length - 1,
      errores,
      pendientes,
      liquidados,
      aFavor,
      message: `Importación completada: ${insertados} depósitos insertados`,
    };
  },

  /**
   * Sincronizar movimientos (crear movimientos CC para depósitos asociados)
   * Ahora recalcula saldos automáticamente después de crear los movimientos.
   */
  sincronizarMovimientos: async (): Promise<{
    procesados: number;
    movimientos_creados: number;
    message: string;
  }> => {
    // Obtener depósitos asociados sin movimiento origen
    const { data: depositos, error } = await supabase
      .from('depositos')
      .select('*')
      .not('cuenta_id', 'is', null)
      .is('movimiento_origen_id', null)
      .in('estado', ['PENDIENTE', 'A_FAVOR', 'LIQUIDADO']);

    if (error) throw new Error(error.message);

    let movimientosCreados = 0;
    const errores: string[] = [];
    const cuentasAfectadas = new Set<number>();

    for (const deposito of depositos || []) {
      try {
        // Crear movimiento de ingreso en la cuenta corriente
        const { data: movimiento, error: movError } = await supabase
          .from('movimientos_cc')
          .insert({
            cuenta_id: deposito.cuenta_id,
            fecha: deposito.fecha_ingreso,
            tipo_movimiento: 'INGRESO',
            concepto: `Depósito de ${deposito.titular}`,
            monto: deposito.monto_original,
            saldo_resultante: 0, // Se recalculará después
          })
          .select()
          .single();

        if (movError) {
          errores.push(`Depósito ${deposito.id}: ${movError.message}`);
          continue;
        }

        // Actualizar depósito con el movimiento origen
        await supabase
          .from('depositos')
          .update({ movimiento_origen_id: movimiento.id })
          .eq('id', deposito.id);

        cuentasAfectadas.add(deposito.cuenta_id);
        movimientosCreados++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errores.push(`Depósito ${deposito.id}: ${errorMsg}`);
      }
    }

    // Recalcular saldos de las cuentas afectadas
    for (const cuentaId of cuentasAfectadas) {
      try {
        await supabase.rpc('recalcular_saldos_cuenta', { p_cuenta_id: cuentaId });
      } catch (err) {
        console.error(`Error recalculando saldos de cuenta ${cuentaId}:`, err);
      }
    }

    return {
      procesados: depositos?.length || 0,
      movimientos_creados: movimientosCreados,
      message: `Sincronización completada: ${movimientosCreados} movimientos creados`,
    };
  },
};
