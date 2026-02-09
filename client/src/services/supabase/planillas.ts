// Supabase service for Planillas (RENTAS and CAJA daily aggregations)

import { supabase } from '@/lib/supabase';
import { parseDateFromDB } from '@/utils/format';

// CUIT placeholder para movimientos generados desde planillas (no asociados a un cliente)
const CUIT_PLANILLA = '00000000000';

// Types
export interface DiaRentas {
  fecha: string;
  GIT: number;
  SUAT_ALTA: number;
  SUAT_PATENTES: number;
  SUAT_INFRACCIONES: number;
  SUCERP: number;
  SUGIT: number;
  PROVINCIA: number;
  CONSULTA: number;
  POSNET: number;
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
  DEPOSITOS: number;
  EFECTIVO: number;
}

export interface DiaCaja {
  fecha: string;
  ARANCEL: number;
  SUAT_SELLADO: number;
  SUCERP_SELLADO: number;
  CONSULTAS: number;
  FORMULARIOS: number;
  POSNET: number;
  VEP: number;
  EPAGOS: number;
  LIBRERIA: number;
  MARIA: number;
  AGUA: number;
  EDESUR: number;
  TERE: number;
  DAMI: number;
  MUMI: number;
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
  DEPOSITOS: number;
  EFECTIVO: number;
}

export interface PlanillaFilters {
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface UpdateResult {
  message: string;
  alertas?: string[];
}

// Helper to create empty DiaRentas
const emptyDiaRentas = (fecha: string): DiaRentas => ({
  fecha,
  GIT: 0,
  SUAT_ALTA: 0,
  SUAT_PATENTES: 0,
  SUAT_INFRACCIONES: 0,
  SUCERP: 0,
  SUGIT: 0,
  PROVINCIA: 0,
  CONSULTA: 0,
  POSNET: 0,
  ICBC: 0,
  FORD: 0,
  SICARDI: 0,
  PATAGONIA: 0,
  IVECO: 0,
  CNH: 0,
  GESTORIA_FORD: 0,
  ALRA: 0,
  DEPOSITOS: 0,
  EFECTIVO: 0,
});

// Helper to create empty DiaCaja
const emptyDiaCaja = (fecha: string): DiaCaja => ({
  fecha,
  ARANCEL: 0,
  SUAT_SELLADO: 0,
  SUCERP_SELLADO: 0,
  CONSULTAS: 0,
  FORMULARIOS: 0,
  POSNET: 0,
  VEP: 0,
  EPAGOS: 0,
  LIBRERIA: 0,
  MARIA: 0,
  AGUA: 0,
  EDESUR: 0,
  TERE: 0,
  DAMI: 0,
  MUMI: 0,
  ICBC: 0,
  FORD: 0,
  SICARDI: 0,
  PATAGONIA: 0,
  IVECO: 0,
  CNH: 0,
  GESTORIA_FORD: 0,
  ALRA: 0,
  DEPOSITOS: 0,
  EFECTIVO: 0,
});

// ============================================================================
// Mapping: concepto name (from DB) → DiaRentas/DiaCaja key
// Names MUST match exactly what's in the `conceptos` table
// ============================================================================

const rentasConceptoMap: Record<string, keyof DiaRentas> = {
  'GIT': 'GIT',
  'SUAT - Alta': 'SUAT_ALTA',
  'SUAT - Patentes': 'SUAT_PATENTES',
  'SUAT - Infracciones': 'SUAT_INFRACCIONES',
  'SUCERP': 'SUCERP',
  'SUGIT': 'SUGIT',
  'PROVINCIA (ARBA)': 'PROVINCIA',
  'Consulta': 'CONSULTA',
  'POSNET': 'POSNET',
  'ICBC': 'ICBC',
};

const cajaConceptoMap: Record<string, keyof DiaCaja> = {
  'Arancel': 'ARANCEL',
  'SUAT - Sellado': 'SUAT_SELLADO',
  'SUCERP - Sellado': 'SUCERP_SELLADO',
  'Consultas CAJA': 'CONSULTAS',
  'Formularios': 'FORMULARIOS',
  'POSNET CAJA': 'POSNET',
};

// ============================================================================
// Reverse mapping: DiaRentas/DiaCaja key → concepto name (for updates)
// Only includes fields stored in `movimientos` table via concepto_id
// ============================================================================

const rentasKeyToConcepto: Record<string, string> = {
  GIT: 'GIT',
  SUAT_ALTA: 'SUAT - Alta',
  SUAT_PATENTES: 'SUAT - Patentes',
  SUAT_INFRACCIONES: 'SUAT - Infracciones',
  SUCERP: 'SUCERP',
  SUGIT: 'SUGIT',
  PROVINCIA: 'PROVINCIA (ARBA)',
  CONSULTA: 'Consulta',
  POSNET: 'POSNET',
  ICBC: 'ICBC',
};

const cajaKeyToConcepto: Record<string, string> = {
  ARANCEL: 'Arancel',
  SUAT_SELLADO: 'SUAT - Sellado',
  SUCERP_SELLADO: 'SUCERP - Sellado',
  CONSULTAS: 'Consultas CAJA',
  FORMULARIOS: 'Formularios',
  POSNET: 'POSNET CAJA',
};

// ============================================================================
// Mapping: cuentas_corrientes.nombre → DiaRentas/DiaCaja key
// These fields are stored in movimientos_cc, NOT in movimientos
// ============================================================================

const cuentaCCMap: Record<string, string> = {
  'ICBC': 'ICBC',
  'FORD': 'FORD',
  'SICARDI': 'SICARDI',
  'PATAGONIA': 'PATAGONIA',
  'IVECO': 'IVECO',
  'CNH': 'CNH',
  'GESTORIA FORD': 'GESTORIA_FORD',
  'ALRA': 'ALRA',
};

// ============================================================================
// Mapping: gastos_registrales concepto → DiaCaja key
// Stored via INITCAP(LOWER(key)) in procesar_caja_diario
// ============================================================================

const gastosRegistralesMap: Record<string, keyof DiaCaja> = {
  'Libreria': 'LIBRERIA',
  'Agua': 'AGUA',
  'Edesur': 'EDESUR',
};

// ============================================================================
// Mapping: adelantos_empleados empleado → DiaCaja key
// Stored via INITCAP(LOWER(key)) in procesar_caja_diario
// ============================================================================

const adelantosEmpleadoMap: Record<string, keyof DiaCaja> = {
  'Maria': 'MARIA',
  'Tere': 'TERE',
  'Dami': 'DAMI',
  'Mumi': 'MUMI',
};

// Helper to extract concepto nombre from Supabase joined data
// PostgREST returns a single object for many-to-one FK, but TS may infer array
const getConceptoNombre = (conceptos: unknown): string | undefined => {
  if (Array.isArray(conceptos)) return conceptos[0]?.nombre;
  if (conceptos && typeof conceptos === 'object' && 'nombre' in conceptos) {
    return (conceptos as { nombre: string }).nombre;
  }
  return undefined;
};

// Helper to get or create a DiaRentas/DiaCaja in a Map
function getOrCreate<T>(map: Map<string, T>, fecha: string, factory: (f: string) => T): T {
  if (!map.has(fecha)) {
    map.set(fecha, factory(fecha));
  }
  return map.get(fecha)!;
}

export const planillasApi = {
  // Get aggregated RENTAS data by date
  getRentas: async (filters: PlanillaFilters = {}): Promise<DiaRentas[]> => {
    // 1. Query movimientos (conceptos: GIT, SUAT, SUCERP, etc.)
    let movQuery = supabase
      .from('movimientos')
      .select('fecha, monto, conceptos(nombre)')
      .eq('tipo', 'RENTAS')
      .order('fecha', { ascending: false });

    if (filters.fechaDesde) movQuery = movQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) movQuery = movQuery.lte('fecha', filters.fechaHasta);

    // 2. Query movimientos_cc for cuentas CC (FORD, SICARDI, etc.)
    //    These are stored as EGRESO with concepto='RENTAS'
    let ccQuery = supabase
      .from('movimientos_cc')
      .select('fecha, monto, tipo_movimiento, cuentas_corrientes(nombre)')
      .eq('concepto', 'RENTAS')
      .eq('tipo_movimiento', 'EGRESO');

    if (filters.fechaDesde) ccQuery = ccQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) ccQuery = ccQuery.lte('fecha', filters.fechaHasta);

    // 3. Query movimientos_efectivo for cash delivered
    let efectivoQuery = supabase
      .from('movimientos_efectivo')
      .select('fecha, monto')
      .eq('concepto', 'Efectivo RENTAS entregado');

    if (filters.fechaDesde) efectivoQuery = efectivoQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) efectivoQuery = efectivoQuery.lte('fecha', filters.fechaHasta);

    const [movResult, ccResult, efectivoResult] = await Promise.all([movQuery, ccQuery, efectivoQuery]);

    if (movResult.error) {
      throw new Error(`Error al obtener planilla RENTAS: ${movResult.error.message}`);
    }

    // Aggregate by fecha
    const byFecha = new Map<string, DiaRentas>();

    // Process movimientos
    for (const mov of movResult.data || []) {
      const dia = getOrCreate(byFecha, mov.fecha, emptyDiaRentas);
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? rentasConceptoMap[conceptoNombre] : undefined;
      if (key && key !== 'fecha') {
        dia[key] = (dia[key] as number) + Number(mov.monto || 0);
      }
    }

    // Process movimientos_cc (cuentas corrientes)
    // Note: ICBC is already in movimientos, so we skip it here to avoid double-counting
    if (!ccResult.error) {
      for (const mov of ccResult.data || []) {
        const dia = getOrCreate(byFecha, mov.fecha, emptyDiaRentas);
        const cuentaNombre = getConceptoNombre(mov.cuentas_corrientes);
        if (cuentaNombre && cuentaNombre !== 'ICBC') {
          const key = cuentaCCMap[cuentaNombre] as keyof DiaRentas | undefined;
          if (key && key !== 'fecha') {
            dia[key] = (dia[key] as number) + Number(mov.monto || 0);
          }
        }
      }
    }

    // Process efectivo entregado
    if (!efectivoResult.error) {
      for (const e of efectivoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, emptyDiaRentas);
        dia.EFECTIVO += Number(e.monto || 0);
      }
    }

    // Sort by fecha descending
    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  // Get aggregated CAJA data by date
  getCaja: async (filters: PlanillaFilters = {}): Promise<DiaCaja[]> => {
    // Build date filter helper
    const addDateFilters = <T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
      query: T, dateCol: string
    ): T => {
      if (filters.fechaDesde) query = query.gte(dateCol, filters.fechaDesde);
      if (filters.fechaHasta) query = query.lte(dateCol, filters.fechaHasta);
      return query;
    };

    // 1. Movimientos (conceptos: Arancel, SUAT-Sellado, etc.)
    const movQuery = addDateFilters(
      supabase
        .from('movimientos')
        .select('fecha, monto, conceptos(nombre)')
        .eq('tipo', 'CAJA')
        .order('fecha', { ascending: false }),
      'fecha'
    );

    // 2. Movimientos CC (cuentas: ICBC, FORD, etc.)
    const ccQuery = addDateFilters(
      supabase
        .from('movimientos_cc')
        .select('fecha, monto, tipo_movimiento, cuentas_corrientes(nombre)')
        .eq('concepto', 'CAJA')
        .eq('tipo_movimiento', 'EGRESO'),
      'fecha'
    );

    // 3. Control VEPs
    const vepQuery = addDateFilters(
      supabase.from('control_veps').select('fecha, monto'),
      'fecha'
    );

    // 4. Control ePagos
    const epagoQuery = addDateFilters(
      supabase.from('control_epagos').select('fecha, monto'),
      'fecha'
    );

    // 5. Gastos registrales (LIBRERIA, AGUA, EDESUR)
    const gastosQuery = addDateFilters(
      supabase
        .from('gastos_registrales')
        .select('fecha, concepto, monto')
        .eq('origen', 'CAJA'),
      'fecha'
    );

    // 6. Adelantos empleados (MARIA, TERE, DAMI, MUMI)
    const adelantosQuery = addDateFilters(
      supabase
        .from('adelantos_empleados')
        .select('fecha_adelanto, empleado, monto')
        .eq('origen', 'CAJA'),
      'fecha_adelanto'
    );

    // 7. Efectivo entregado
    const efectivoQuery = addDateFilters(
      supabase
        .from('movimientos_efectivo')
        .select('fecha, monto')
        .eq('concepto', 'Efectivo CAJA entregado'),
      'fecha'
    );

    const [movResult, ccResult, vepResult, epagoResult, gastosResult, adelantosResult, efectivoResult] =
      await Promise.all([movQuery, ccQuery, vepQuery, epagoQuery, gastosQuery, adelantosQuery, efectivoQuery]);

    if (movResult.error) {
      throw new Error(`Error al obtener planilla CAJA: ${movResult.error.message}`);
    }

    const byFecha = new Map<string, DiaCaja>();

    // Process movimientos
    for (const mov of movResult.data || []) {
      const dia = getOrCreate(byFecha, mov.fecha, emptyDiaCaja);
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? cajaConceptoMap[conceptoNombre] : undefined;
      if (key && key !== 'fecha') {
        dia[key] = (dia[key] as number) + Number(mov.monto || 0);
      }
    }

    // Process movimientos_cc
    if (!ccResult.error) {
      for (const mov of ccResult.data || []) {
        const dia = getOrCreate(byFecha, mov.fecha, emptyDiaCaja);
        const cuentaNombre = getConceptoNombre(mov.cuentas_corrientes);
        if (cuentaNombre) {
          const key = cuentaCCMap[cuentaNombre] as keyof DiaCaja | undefined;
          if (key && key !== 'fecha') {
            dia[key] = (dia[key] as number) + Number(mov.monto || 0);
          }
        }
      }
    }

    // Process VEPs
    if (!vepResult.error) {
      for (const v of vepResult.data || []) {
        const dia = getOrCreate(byFecha, v.fecha, emptyDiaCaja);
        dia.VEP += Number(v.monto || 0);
      }
    }

    // Process ePagos
    if (!epagoResult.error) {
      for (const e of epagoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, emptyDiaCaja);
        dia.EPAGOS += Number(e.monto || 0);
      }
    }

    // Process gastos registrales
    if (!gastosResult.error) {
      for (const g of gastosResult.data || []) {
        const dia = getOrCreate(byFecha, g.fecha, emptyDiaCaja);
        const key = gastosRegistralesMap[g.concepto] as Exclude<keyof DiaCaja, 'fecha'> | undefined;
        if (key) {
          dia[key] = (dia[key] as number) + Number(g.monto || 0);
        }
      }
    }

    // Process adelantos empleados
    if (!adelantosResult.error) {
      for (const a of adelantosResult.data || []) {
        const dia = getOrCreate(byFecha, a.fecha_adelanto, emptyDiaCaja);
        const key = adelantosEmpleadoMap[a.empleado] as Exclude<keyof DiaCaja, 'fecha'> | undefined;
        if (key) {
          dia[key] = (dia[key] as number) + Number(a.monto || 0);
        }
      }
    }

    // Process efectivo entregado
    if (!efectivoResult.error) {
      for (const e of efectivoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, emptyDiaCaja);
        dia.EFECTIVO += Number(e.monto || 0);
      }
    }

    // Sort by fecha descending
    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  // Update RENTAS values for a specific date
  // NOTE: Only updates fields stored in the `movimientos` table (concepto-based).
  // Fields from movimientos_cc (FORD, SICARDI, etc.) are read-only from this view.
  updateRentas: async (
    fecha: string,
    valores: DiaRentas
  ): Promise<UpdateResult> => {
    const alertas: string[] = [];

    // Pre-load conceptos for name→id mapping (needed for inserts)
    const { data: conceptos, error: conceptosError } = await supabase
      .from('conceptos')
      .select('id, nombre')
      .eq('tipo', 'RENTAS');

    if (conceptosError) {
      throw new Error(`Error al obtener conceptos: ${conceptosError.message}`);
    }

    const conceptoIdByNombre = new Map<string, number>();
    for (const c of conceptos || []) {
      conceptoIdByNombre.set(c.nombre, c.id);
    }

    // Get existing movimientos for this date (join conceptos for name)
    const { data: existingMovs, error: fetchError } = await supabase
      .from('movimientos')
      .select('id, monto, conceptos(nombre)')
      .eq('tipo', 'RENTAS')
      .eq('fecha', fecha);

    if (fetchError) {
      throw new Error(`Error al obtener movimientos: ${fetchError.message}`);
    }

    // Create map of existing movimientos by concepto name
    const existingByConcepto = new Map<string, { id: number; monto: number }>();
    for (const mov of existingMovs || []) {
      const nombre = getConceptoNombre(mov.conceptos);
      if (nombre) {
        existingByConcepto.set(nombre, { id: mov.id, monto: mov.monto });
      }
    }

    // Process each concepto-based field
    const operations: Promise<string | null>[] = [];

    for (const [key, concepto] of Object.entries(rentasKeyToConcepto)) {
      const nuevoMonto = valores[key as keyof DiaRentas] as number;
      const existing = existingByConcepto.get(concepto);

      if (existing) {
        if (existing.monto !== nuevoMonto) {
          operations.push(
            (async () => {
              const { error } = await supabase
                .from('movimientos')
                .update({ monto: nuevoMonto })
                .eq('id', existing.id);
              if (error) {
                throw new Error(`Error actualizando ${concepto}: ${error.message}`);
              }
              return `${concepto}: ${existing.monto} → ${nuevoMonto}`;
            })()
          );
        }
      } else if (nuevoMonto > 0) {
        const conceptoId = conceptoIdByNombre.get(concepto);
        if (!conceptoId) {
          alertas.push(`Concepto "${concepto}" no encontrado en tabla conceptos`);
          continue;
        }
        operations.push(
          (async () => {
            const { error } = await supabase.from('movimientos').insert({
              fecha,
              tipo: 'RENTAS',
              cuit: CUIT_PLANILLA,
              concepto_id: conceptoId,
              monto: nuevoMonto,
            });
            if (error) {
              throw new Error(`Error insertando ${concepto}: ${error.message}`);
            }
            return `${concepto}: nuevo → ${nuevoMonto}`;
          })()
        );
      }
    }

    const results = await Promise.all(operations);
    alertas.push(...results.filter((r): r is string => r !== null));

    return {
      message: `Planilla RENTAS actualizada para ${fecha}`,
      alertas: alertas.length > 0 ? alertas : undefined,
    };
  },

  // Update CAJA values for a specific date
  // NOTE: Only updates fields stored in the `movimientos` table (concepto-based).
  // Fields from other tables (VEP, ePagos, gastos, adelantos, CC) are read-only from this view.
  updateCaja: async (fecha: string, valores: DiaCaja): Promise<UpdateResult> => {
    const alertas: string[] = [];

    // Pre-load conceptos for name→id mapping (needed for inserts)
    const { data: conceptos, error: conceptosError } = await supabase
      .from('conceptos')
      .select('id, nombre')
      .eq('tipo', 'CAJA');

    if (conceptosError) {
      throw new Error(`Error al obtener conceptos: ${conceptosError.message}`);
    }

    const conceptoIdByNombre = new Map<string, number>();
    for (const c of conceptos || []) {
      conceptoIdByNombre.set(c.nombre, c.id);
    }

    // Get existing movimientos for this date (join conceptos for name)
    const { data: existingMovs, error: fetchError } = await supabase
      .from('movimientos')
      .select('id, monto, conceptos(nombre)')
      .eq('tipo', 'CAJA')
      .eq('fecha', fecha);

    if (fetchError) {
      throw new Error(`Error al obtener movimientos: ${fetchError.message}`);
    }

    // Create map of existing movimientos by concepto name
    const existingByConcepto = new Map<string, { id: number; monto: number }>();
    for (const mov of existingMovs || []) {
      const nombre = getConceptoNombre(mov.conceptos);
      if (nombre) {
        existingByConcepto.set(nombre, { id: mov.id, monto: mov.monto });
      }
    }

    // Process each concepto-based field
    const operations: Promise<string | null>[] = [];

    for (const [key, concepto] of Object.entries(cajaKeyToConcepto)) {
      const nuevoMonto = valores[key as keyof DiaCaja] as number;
      const existing = existingByConcepto.get(concepto);

      if (existing) {
        if (existing.monto !== nuevoMonto) {
          operations.push(
            (async () => {
              const { error } = await supabase
                .from('movimientos')
                .update({ monto: nuevoMonto })
                .eq('id', existing.id);
              if (error) {
                throw new Error(`Error actualizando ${concepto}: ${error.message}`);
              }
              return `${concepto}: ${existing.monto} → ${nuevoMonto}`;
            })()
          );
        }
      } else if (nuevoMonto > 0) {
        const conceptoId = conceptoIdByNombre.get(concepto);
        if (!conceptoId) {
          alertas.push(`Concepto "${concepto}" no encontrado en tabla conceptos`);
          continue;
        }
        operations.push(
          (async () => {
            const { error } = await supabase.from('movimientos').insert({
              fecha,
              tipo: 'CAJA',
              cuit: CUIT_PLANILLA,
              concepto_id: conceptoId,
              monto: nuevoMonto,
            });
            if (error) {
              throw new Error(`Error insertando ${concepto}: ${error.message}`);
            }
            return `${concepto}: nuevo → ${nuevoMonto}`;
          })()
        );
      }
    }

    const results = await Promise.all(operations);
    alertas.push(...results.filter((r): r is string => r !== null));

    return {
      message: `Planilla CAJA actualizada para ${fecha}`,
      alertas: alertas.length > 0 ? alertas : undefined,
    };
  },
};
