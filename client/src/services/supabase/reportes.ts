// Supabase service for Reportes (Reports and Analytics)

import { supabase } from '@/lib/supabase';

// Types
export interface DepositoPorEstado {
  estado: string;
  cantidad: number;
  total_monto: number;
  total_saldo: number;
}

export interface DepositoPorCliente {
  cliente_id: number;
  razon_social: string;
  cantidad_depositos: number;
  total_depositado: number;
  saldo_actual_total: number;
}

export interface TopDeposito {
  id: number;
  titular: string;
  cliente_nombre: string | null;
  fecha_ingreso: string;
  monto_original: number;
  saldo_actual: number;
  estado: string;
}

export interface BalanceCuenta {
  id: number;
  nombre: string;
  total_movimientos: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_actual: number;
}

export interface CuentaSaldoNegativo {
  id: number;
  nombre: string;
  tipo: string;
  saldo_actual: number;
}

export interface EvolucionSaldo {
  fecha: string;
  saldo_resultante: number;
}

export interface ClienteTopDepositos {
  cliente_id: number;
  razon_social: string;
  cantidad_depositos: number;
  total_depositado: number;
  saldo_activo: number;
}

export interface ClienteSaldoActivo {
  cliente_id: number;
  razon_social: string;
  cuit: string;
  cantidad_depositos_activos: number;
  saldo_total: number;
}

export interface ResumenMensualItem {
  concepto: string;
  monto: number;
}

export interface ComparativaMensualItem {
  mes: string;
  total_depositado: number;
  total_liquidado: number;
}

export interface FlujoCajaItem {
  concepto: string;
  monto: number;
}

export interface TopMovimiento {
  id: number;
  fecha: string;
  cuenta_nombre: string;
  concepto: string;
  tipo_movimiento: string;
  monto: number;
}

export const reportesApi = {
  // ==================== DEPÓSITOS ====================

  // Get deposits grouped by status
  getDepositosPorEstado: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<DepositoPorEstado[]> => {
    let query = supabase
      .from('depositos')
      .select('estado, monto_original, saldo_actual');

    if (filtros?.fecha_desde) {
      query = query.gte('fecha_ingreso', filtros.fecha_desde);
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha_ingreso', filtros.fecha_hasta);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener depósitos por estado: ${error.message}`);
    }

    // Aggregate by estado
    const byEstado = new Map<string, DepositoPorEstado>();

    for (const dep of data || []) {
      const estado = dep.estado || 'DESCONOCIDO';
      if (!byEstado.has(estado)) {
        byEstado.set(estado, {
          estado,
          cantidad: 0,
          total_monto: 0,
          total_saldo: 0,
        });
      }
      const item = byEstado.get(estado)!;
      item.cantidad++;
      item.total_monto += Number(dep.monto_original) || 0;
      item.total_saldo += Number(dep.saldo_actual) || 0;
    }

    return Array.from(byEstado.values());
  },

  // Get deposits grouped by client
  getDepositosPorCliente: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    cliente_id?: number;
  }): Promise<DepositoPorCliente[]> => {
    let query = supabase
      .from('depositos')
      .select('cliente_id, monto_original, saldo_actual, clientes(razon_social)')
      .not('cliente_id', 'is', null);

    if (filtros?.fecha_desde) {
      query = query.gte('fecha_ingreso', filtros.fecha_desde);
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha_ingreso', filtros.fecha_hasta);
    }
    if (filtros?.cliente_id) {
      query = query.eq('cliente_id', filtros.cliente_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener depósitos por cliente: ${error.message}`);
    }

    // Aggregate by cliente_id
    const byCliente = new Map<number, DepositoPorCliente>();

    for (const dep of data || []) {
      const clienteId = dep.cliente_id;
      if (!clienteId) continue;

      if (!byCliente.has(clienteId)) {
        byCliente.set(clienteId, {
          cliente_id: clienteId,
          razon_social: (dep.clientes as any)?.razon_social || 'Desconocido',
          cantidad_depositos: 0,
          total_depositado: 0,
          saldo_actual_total: 0,
        });
      }
      const item = byCliente.get(clienteId)!;
      item.cantidad_depositos++;
      item.total_depositado += Number(dep.monto_original) || 0;
      item.saldo_actual_total += Number(dep.saldo_actual) || 0;
    }

    return Array.from(byCliente.values()).sort(
      (a, b) => b.total_depositado - a.total_depositado
    );
  },

  // Get top deposits by amount
  getTopDepositos: async (limit: number = 10): Promise<TopDeposito[]> => {
    const { data, error } = await supabase
      .from('depositos')
      .select('id, titular, cliente_id, fecha_ingreso, monto_original, saldo_actual, estado, clientes(razon_social)')
      .order('monto_original', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error al obtener top depósitos: ${error.message}`);
    }

    return (data || []).map((dep) => ({
      id: dep.id,
      titular: dep.titular,
      cliente_nombre: (dep.clientes as any)?.razon_social || null,
      fecha_ingreso: dep.fecha_ingreso,
      monto_original: dep.monto_original,
      saldo_actual: dep.saldo_actual,
      estado: dep.estado,
    }));
  },

  // ==================== CUENTAS CORRIENTES ====================

  // Get balance of all accounts
  getBalanceCuentas: async (): Promise<BalanceCuenta[]> => {
    // Get all accounts
    const { data: cuentas, error: cuentasError } = await supabase
      .from('cuentas_corrientes')
      .select('id, nombre, saldo_actual');

    if (cuentasError) {
      throw new Error(`Error al obtener cuentas: ${cuentasError.message}`);
    }

    // Get movements for each account
    const { data: movimientos, error: movError } = await supabase
      .from('movimientos_cc')
      .select('cuenta_id, tipo_movimiento, monto');

    if (movError) {
      throw new Error(`Error al obtener movimientos: ${movError.message}`);
    }

    // Aggregate movements by account
    const movsByAccount = new Map<
      number,
      { total: number; ingresos: number; egresos: number }
    >();
    for (const mov of movimientos || []) {
      if (!movsByAccount.has(mov.cuenta_id)) {
        movsByAccount.set(mov.cuenta_id, { total: 0, ingresos: 0, egresos: 0 });
      }
      const item = movsByAccount.get(mov.cuenta_id)!;
      item.total++;
      if (mov.tipo_movimiento === 'INGRESO') {
        item.ingresos += Number(mov.monto) || 0;
      } else {
        item.egresos += Number(mov.monto) || 0;
      }
    }

    return (cuentas || []).map((c) => {
      const movs = movsByAccount.get(c.id) || { total: 0, ingresos: 0, egresos: 0 };
      return {
        id: c.id,
        nombre: c.nombre,
        total_movimientos: movs.total,
        total_ingresos: movs.ingresos,
        total_egresos: movs.egresos,
        saldo_actual: c.saldo_actual,
      };
    });
  },

  // Get accounts with negative balance
  getCuentasConSaldoNegativo: async (): Promise<CuentaSaldoNegativo[]> => {
    const { data, error } = await supabase
      .from('cuentas_corrientes')
      .select('id, nombre, tipo, saldo_actual')
      .lt('saldo_actual', 0);

    if (error) {
      throw new Error(`Error al obtener cuentas con saldo negativo: ${error.message}`);
    }

    return data || [];
  },

  // Get balance evolution for an account
  getEvolucionSaldos: async (
    cuenta_id: number,
    fecha_desde?: string,
    fecha_hasta?: string
  ): Promise<EvolucionSaldo[]> => {
    let query = supabase
      .from('movimientos_cc')
      .select('fecha, saldo_resultante')
      .eq('cuenta_id', cuenta_id)
      .order('fecha', { ascending: true });

    if (fecha_desde) {
      query = query.gte('fecha', fecha_desde);
    }
    if (fecha_hasta) {
      query = query.lte('fecha', fecha_hasta);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener evolución de saldos: ${error.message}`);
    }

    return (data || []).map((m) => ({
      fecha: m.fecha,
      saldo_resultante: m.saldo_resultante,
    }));
  },

  // ==================== CLIENTES ====================

  // Get top clients by number of deposits
  getClientesConMasDepositos: async (limit: number = 10): Promise<ClienteTopDepositos[]> => {
    const { data, error } = await supabase
      .from('depositos')
      .select('cliente_id, monto_original, saldo_actual, clientes(razon_social)')
      .not('cliente_id', 'is', null);

    if (error) {
      throw new Error(`Error al obtener clientes: ${error.message}`);
    }

    // Aggregate by cliente_id
    const byCliente = new Map<number, ClienteTopDepositos>();

    for (const dep of data || []) {
      const clienteId = dep.cliente_id;
      if (!clienteId) continue;

      if (!byCliente.has(clienteId)) {
        byCliente.set(clienteId, {
          cliente_id: clienteId,
          razon_social: (dep.clientes as any)?.razon_social || 'Desconocido',
          cantidad_depositos: 0,
          total_depositado: 0,
          saldo_activo: 0,
        });
      }
      const item = byCliente.get(clienteId)!;
      item.cantidad_depositos++;
      item.total_depositado += Number(dep.monto_original) || 0;
      item.saldo_activo += Number(dep.saldo_actual) || 0;
    }

    return Array.from(byCliente.values())
      .sort((a, b) => b.cantidad_depositos - a.cantidad_depositos)
      .slice(0, limit);
  },

  // Get clients with active balances
  getClientesConSaldosActivos: async (): Promise<ClienteSaldoActivo[]> => {
    const { data, error } = await supabase
      .from('depositos')
      .select('cliente_id, saldo_actual, clientes(razon_social, cuit)')
      .not('cliente_id', 'is', null)
      .gt('saldo_actual', 0);

    if (error) {
      throw new Error(`Error al obtener clientes con saldos activos: ${error.message}`);
    }

    // Aggregate by cliente_id
    const byCliente = new Map<number, ClienteSaldoActivo>();

    for (const dep of data || []) {
      const clienteId = dep.cliente_id;
      if (!clienteId) continue;

      if (!byCliente.has(clienteId)) {
        byCliente.set(clienteId, {
          cliente_id: clienteId,
          razon_social: (dep.clientes as any)?.razon_social || 'Desconocido',
          cuit: (dep.clientes as any)?.cuit || '',
          cantidad_depositos_activos: 0,
          saldo_total: 0,
        });
      }
      const item = byCliente.get(clienteId)!;
      item.cantidad_depositos_activos++;
      item.saldo_total += Number(dep.saldo_actual) || 0;
    }

    return Array.from(byCliente.values()).sort((a, b) => b.saldo_total - a.saldo_total);
  },

  // ==================== FINANCIERO ====================

  // Get monthly summary
  getResumenMensual: async (
    anio: number,
    mes: number
  ): Promise<ResumenMensualItem[]> => {
    const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    // Get movimientos grouped by concepto
    const { data, error } = await supabase
      .from('movimientos')
      .select('concepto, monto')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    if (error) {
      throw new Error(`Error al obtener resumen mensual: ${error.message}`);
    }

    // Aggregate by concepto
    const byConcepto = new Map<string, number>();

    for (const mov of data || []) {
      const concepto = mov.concepto || 'OTROS';
      if (!byConcepto.has(concepto)) {
        byConcepto.set(concepto, 0);
      }
      byConcepto.set(concepto, byConcepto.get(concepto)! + (Number(mov.monto) || 0));
    }

    return Array.from(byConcepto.entries())
      .map(([concepto, monto]) => ({ concepto, monto }))
      .sort((a, b) => b.monto - a.monto);
  },

  // Get monthly comparison
  getComparativaMensual: async (anio: number): Promise<ComparativaMensualItem[]> => {
    const result: ComparativaMensualItem[] = [];

    for (let mes = 1; mes <= 12; mes++) {
      const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(anio, mes, 0).getDate();
      const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      // Get deposits for the month
      const { data: depositos, error: depError } = await supabase
        .from('depositos')
        .select('monto_original')
        .gte('fecha_ingreso', fechaInicio)
        .lte('fecha_ingreso', fechaFin);

      if (depError) {
        throw new Error(`Error al obtener depósitos: ${depError.message}`);
      }

      // Get liquidated amounts for the month
      const { data: liquidados, error: liqError } = await supabase
        .from('depositos')
        .select('monto_original')
        .gte('fecha_uso', fechaInicio)
        .lte('fecha_uso', fechaFin)
        .eq('estado', 'LIQUIDADO');

      if (liqError) {
        throw new Error(`Error al obtener liquidados: ${liqError.message}`);
      }

      const totalDepositado = (depositos || []).reduce(
        (sum, d) => sum + (Number(d.monto_original) || 0),
        0
      );
      const totalLiquidado = (liquidados || []).reduce(
        (sum, d) => sum + (Number(d.monto_original) || 0),
        0
      );

      result.push({
        mes: mes.toString(),
        total_depositado: totalDepositado,
        total_liquidado: totalLiquidado,
      });
    }

    return result;
  },

  // Get projected cash flow
  getFlujoCajaProyectado: async (): Promise<FlujoCajaItem[]> => {
    // Get total active deposits (saldo > 0)
    const { data: depositosActivos, error: depError } = await supabase
      .from('depositos')
      .select('saldo_actual')
      .gt('saldo_actual', 0);

    if (depError) {
      throw new Error(`Error al obtener depósitos activos: ${depError.message}`);
    }

    const totalDepositosActivos = (depositosActivos || []).reduce(
      (sum, d) => sum + (Number(d.saldo_actual) || 0),
      0
    );

    // Get total pending vencimientos
    const { data: vencimientosPendientes, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .select('monto')
      .eq('estado', 'PENDIENTE');

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
    }

    const totalVencimientos = (vencimientosPendientes || []).reduce(
      (sum, v) => sum + (Number(v.monto) || 0),
      0
    );

    // Get total accounts balance
    const { data: cuentas, error: cuentasError } = await supabase
      .from('cuentas_corrientes')
      .select('saldo_actual');

    if (cuentasError) {
      throw new Error(`Error al obtener cuentas: ${cuentasError.message}`);
    }

    const totalCuentas = (cuentas || []).reduce(
      (sum, c) => sum + (Number(c.saldo_actual) || 0),
      0
    );

    return [
      { concepto: 'Depósitos Activos (Saldo)', monto: totalDepositosActivos },
      { concepto: 'Vencimientos Pendientes', monto: totalVencimientos },
      { concepto: 'Saldo Total Cuentas Corrientes', monto: totalCuentas },
      {
        concepto: 'Flujo Neto Proyectado',
        monto: totalDepositosActivos - totalVencimientos + totalCuentas,
      },
    ];
  },

  // Get top movements
  getTopMovimientos: async (limit: number = 10): Promise<TopMovimiento[]> => {
    const { data, error } = await supabase
      .from('movimientos_cc')
      .select('id, fecha, cuenta_id, concepto, tipo_movimiento, monto, cuentas_corrientes(nombre)')
      .order('monto', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error al obtener top movimientos: ${error.message}`);
    }

    return (data || []).map((m) => ({
      id: m.id,
      fecha: m.fecha,
      cuenta_nombre: (m.cuentas_corrientes as any)?.nombre || 'Desconocido',
      concepto: m.concepto,
      tipo_movimiento: m.tipo_movimiento,
      monto: m.monto,
    }));
  },
};
