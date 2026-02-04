import { supabase } from '../../lib/supabase';

// Types
type TipoMovimiento = 'RENTAS' | 'CAJA';
type Quincena = 'PRIMERA' | 'SEGUNDA';

export interface DashboardStats {
  total_rentas_hoy: number;
  total_caja_hoy: number;
  total_semanal_pendiente: number;
  total_quincenal_pendiente: number;
  alertas_pagos: number;
  total_arancel_mes: number;
  efectivo_en_mano: number;
}

export interface ControlPendiente {
  id: number;
  concepto_id: number;
  concepto_nombre: string;
  concepto_tipo: TipoMovimiento;
  frecuencia: 'SEMANAL' | 'QUINCENAL';
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real?: string;
  quincena?: Quincena;
  mes?: number;
  anio?: number;
}

// -----------------------------------------------------------------------------
// Internal types for Supabase query responses
// These match the exact shape returned by each query
// -----------------------------------------------------------------------------

/** Row shape for movimientos query (tipo + monto only) */
interface MovimientoRow {
  tipo: TipoMovimiento;
  monto: number;
}

/** Row shape for controles pendientes query (total_recaudado only) */
interface ControlRecaudadoRow {
  total_recaudado: number;
}

/** Row shape for arancel query (monto with joined concepto) */
interface ArancelRow {
  monto: number;
}

// -----------------------------------------------------------------------------
// Helper: Transforms raw Supabase control data into ControlPendiente format
// Used by both getControlesPendientes and getAlertasPagos to avoid duplication
// -----------------------------------------------------------------------------
interface RawControlData {
  id: number;
  concepto_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real: string | null;
  quincena?: 'PRIMERA' | 'SEGUNDA';
  mes?: number;
  anio?: number;
  conceptos: { nombre: string; tipo: TipoMovimiento } | null;
}

const transformToControlPendiente = (
  control: RawControlData,
  frecuencia: 'SEMANAL' | 'QUINCENAL'
): ControlPendiente => ({
  id: control.id,
  concepto_id: control.concepto_id,
  concepto_nombre: control.conceptos?.nombre || 'Sin nombre',
  concepto_tipo: control.conceptos?.tipo || 'RENTAS',
  frecuencia,
  fecha_inicio: control.fecha_inicio,
  fecha_fin: control.fecha_fin,
  total_recaudado: control.total_recaudado,
  fecha_pago_programada: control.fecha_pago_programada,
  pagado: control.pagado,
  fecha_pago_real: control.fecha_pago_real || undefined,
  ...(frecuencia === 'QUINCENAL' && {
    quincena: control.quincena,
    mes: control.mes,
    anio: control.anio,
  }),
});

export const dashboardApi = {
  /**
   * Obtener estadísticas del dashboard
   * Fetches multiple data sources in parallel for performance
   */
  getStats: async (): Promise<DashboardStats> => {
    const hoy = new Date().toISOString().split('T')[0];
    const inicioMes = `${hoy.substring(0, 7)}-01`;

    // Fetch all data in parallel with proper error destructuring
    const [
      { data: movimientosHoy, error: errMov },
      { data: semanalesPendientes, error: errSem },
      { data: quincenalesPendientes, error: errQuin },
      { data: arancelMes, error: errAran },
      { data: efectivoConfig, error: errEfec },
    ] = await Promise.all([
      // Movimientos de hoy
      supabase.from('movimientos').select('tipo, monto').eq('fecha', hoy),
      // Controles semanales pendientes
      supabase.from('controles_semanales').select('total_recaudado').eq('pagado', false),
      // Controles quincenales pendientes
      supabase.from('controles_quincenales').select('total_recaudado').eq('pagado', false),
      // Arancel del mes (concepto ARANCEL)
      supabase
        .from('movimientos')
        .select('monto, conceptos!inner(nombre)')
        .gte('fecha', inicioMes)
        .eq('conceptos.nombre', 'ARANCEL'),
      // Efectivo en mano
      supabase.from('control_efectivo_config').select('efectivo_en_mano').single(),
    ]);

    // Check for critical errors (non-critical ones like empty efectivo_config are OK)
    if (errMov) throw new Error(`Error fetching movimientos: ${errMov.message}`);
    if (errSem) throw new Error(`Error fetching semanales: ${errSem.message}`);
    if (errQuin) throw new Error(`Error fetching quincenales: ${errQuin.message}`);
    if (errAran) throw new Error(`Error fetching arancel: ${errAran.message}`);
    // errEfec is OK to ignore - table may be empty

    // Calculate totals with proper typing
    const movimientos = (movimientosHoy || []) as MovimientoRow[];
    const movimientosRentas = movimientos
      .filter((m) => m.tipo === 'RENTAS')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const movimientosCaja = movimientos
      .filter((m) => m.tipo === 'CAJA')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const semanales = (semanalesPendientes || []) as ControlRecaudadoRow[];
    const totalSemanalPendiente = semanales.reduce(
      (sum, c) => sum + Number(c.total_recaudado),
      0
    );

    const quincenales = (quincenalesPendientes || []) as ControlRecaudadoRow[];
    const totalQuincenalPendiente = quincenales.reduce(
      (sum, c) => sum + Number(c.total_recaudado),
      0
    );

    const aranceles = (arancelMes || []) as ArancelRow[];
    const totalArancelMes = aranceles.reduce((sum, m) => sum + Number(m.monto), 0);

    // Count alertas (pagos que vencen en los próximos 7 días)
    const hoyDate = new Date();
    const en7Dias = new Date(hoyDate);
    en7Dias.setDate(en7Dias.getDate() + 7);
    const fechaLimite = en7Dias.toISOString().split('T')[0];

    const [{ count: alertasSemanales }, { count: alertasQuincenales }] = await Promise.all([
      supabase
        .from('controles_semanales')
        .select('id', { count: 'exact', head: true })
        .eq('pagado', false)
        .lte('fecha_pago_programada', fechaLimite),
      supabase
        .from('controles_quincenales')
        .select('id', { count: 'exact', head: true })
        .eq('pagado', false)
        .lte('fecha_pago_programada', fechaLimite),
    ]);

    return {
      total_rentas_hoy: movimientosRentas,
      total_caja_hoy: movimientosCaja,
      total_semanal_pendiente: totalSemanalPendiente,
      total_quincenal_pendiente: totalQuincenalPendiente,
      alertas_pagos: (alertasSemanales || 0) + (alertasQuincenales || 0),
      total_arancel_mes: totalArancelMes,
      efectivo_en_mano: efectivoConfig?.efectivo_en_mano || 0,
    };
  },

  /**
   * Obtener todos los controles pendientes de pago
   */
  getControlesPendientes: async (): Promise<ControlPendiente[]> => {
    // Fetch semanales y quincenales pendientes en paralelo
    const [{ data: semanales, error: errorS }, { data: quincenales, error: errorQ }] =
      await Promise.all([
        supabase
          .from('controles_semanales')
          .select(
            `
          *,
          conceptos (nombre, tipo)
        `
          )
          .eq('pagado', false)
          .order('fecha_pago_programada'),
        supabase
          .from('controles_quincenales')
          .select(
            `
          *,
          conceptos (nombre, tipo)
        `
          )
          .eq('pagado', false)
          .order('fecha_pago_programada'),
      ]);

    if (errorS) throw new Error(errorS.message);
    if (errorQ) throw new Error(errorQ.message);

    // Transform using helper function and combine
    const semanalesTransformed = (semanales || []).map((c) =>
      transformToControlPendiente(c as RawControlData, 'SEMANAL')
    );
    const quincenalesTransformed = (quincenales || []).map((c) =>
      transformToControlPendiente(c as RawControlData, 'QUINCENAL')
    );

    // Sort by fecha_pago_programada (earliest first)
    return [...semanalesTransformed, ...quincenalesTransformed].sort(
      (a, b) =>
        new Date(a.fecha_pago_programada).getTime() - new Date(b.fecha_pago_programada).getTime()
    );
  },

  /**
   * Obtener alertas de pagos próximos (próximos 7 días)
   * Returns controls that are due within the next 7 days, sorted by due date
   */
  getAlertasPagos: async (): Promise<ControlPendiente[]> => {
    const hoy = new Date();
    const en7Dias = new Date(hoy);
    en7Dias.setDate(en7Dias.getDate() + 7);
    const fechaLimite = en7Dias.toISOString().split('T')[0];

    // Fetch semanales y quincenales que vencen pronto (parallel)
    const [{ data: semanales, error: errorS }, { data: quincenales, error: errorQ }] =
      await Promise.all([
        supabase
          .from('controles_semanales')
          .select('*, conceptos (nombre, tipo)')
          .eq('pagado', false)
          .lte('fecha_pago_programada', fechaLimite)
          .order('fecha_pago_programada'),
        supabase
          .from('controles_quincenales')
          .select('*, conceptos (nombre, tipo)')
          .eq('pagado', false)
          .lte('fecha_pago_programada', fechaLimite)
          .order('fecha_pago_programada'),
      ]);

    if (errorS) throw new Error(errorS.message);
    if (errorQ) throw new Error(errorQ.message);

    // Transform using helper function and combine
    const semanalesTransformed = (semanales || []).map((c) =>
      transformToControlPendiente(c as RawControlData, 'SEMANAL')
    );
    const quincenalesTransformed = (quincenales || []).map((c) =>
      transformToControlPendiente(c as RawControlData, 'QUINCENAL')
    );

    // Sort by fecha_pago_programada (earliest first)
    return [...semanalesTransformed, ...quincenalesTransformed].sort(
      (a, b) =>
        new Date(a.fecha_pago_programada).getTime() - new Date(b.fecha_pago_programada).getTime()
    );
  },
};
