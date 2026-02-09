// Supabase service for Planillas (RENTAS and CAJA daily aggregations)
// Mappings are built dynamically from the `conceptos` table using `column_key`.

import { supabase } from '@/lib/supabase';
import { parseDateFromDB } from '@/utils/format';

// ============================================================================
// Types
// ============================================================================

/** Dynamic planilla row: fecha + concepto column_keys + CC + static columns */
export type PlanillaRow = { fecha: string } & Record<string, number>;

export interface PlanillaFilters {
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface UpdateResult {
  message: string;
  alertas?: string[];
}

// ============================================================================
// Static column keys (NOT from conceptos table)
// These come from other tables and are the same for both planillas.
// ============================================================================

/** Cuentas corrientes columns (from movimientos_cc) */
const CC_MAP: Record<string, string> = {
  'ICBC': 'ICBC',
  'FORD': 'FORD',
  'SICARDI': 'SICARDI',
  'PATAGONIA': 'PATAGONIA',
  'IVECO': 'IVECO',
  'CNH': 'CNH',
  'GESTORIA FORD': 'GESTORIA_FORD',
  'ALRA': 'ALRA',
};

const CC_KEYS = Object.values(CC_MAP);

/** Gastos registrales (only in CAJA) */
const GASTOS_REG_MAP: Record<string, string> = {
  'Libreria': 'LIBRERIA',
  'Agua': 'AGUA',
  'Edesur': 'EDESUR',
  'Acara': 'ACARA',
  'Cargas Sociales': 'CARGAS_SOCIALES',
  'Otros': 'OTROS',
  'Supermercado': 'SUPERMERCADO',
  'Sec': 'SEC',
  'Osecac': 'OSECAC',
  'Maria': 'MARIA',
  'Repo Caja Chica': 'REPO_CAJA_CHICA',
  'Repo Rentas Chica': 'REPO_RENTAS_CHICA',
};

/** Adelantos empleados (only in CAJA) - solo DAMI y MUMI */
const ADELANTOS_MAP: Record<string, string> = {
  'Dami': 'DAMI',
  'Mumi': 'MUMI',
};

/** Gastos personales (only in CAJA) - TERE va acá, no a adelantos */
const GASTOS_PERSONALES_MAP: Record<string, string> = {
  'Tere': 'TERE',
};

// ============================================================================
// Dynamic concepto mapping from DB
// ============================================================================

interface ConceptoMapping {
  /** concepto.nombre → column_key, for conceptos of this tipo */
  nameToKey: Record<string, string>;
  /** column_key → concepto.nombre, for updates */
  keyToName: Record<string, string>;
  /** All column_keys for this tipo */
  keys: string[];
  /** concepto.nombre → concepto.id, for inserts */
  nameToId: Record<string, number>;
}

async function buildConceptoMappings(tipo: 'RENTAS' | 'CAJA'): Promise<ConceptoMapping> {
  const { data, error } = await supabase
    .from('conceptos')
    .select('id, nombre, column_key')
    .eq('tipo', tipo);

  if (error) throw new Error(`Error al obtener conceptos ${tipo}: ${error.message}`);

  const nameToKey: Record<string, string> = {};
  const keyToName: Record<string, string> = {};
  const nameToId: Record<string, number> = {};
  const keys: string[] = [];

  for (const c of data || []) {
    nameToKey[c.nombre] = c.column_key;
    keyToName[c.column_key] = c.nombre;
    nameToId[c.nombre] = c.id;
    keys.push(c.column_key);
  }

  return { nameToKey, keyToName, keys, nameToId };
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract concepto nombre from Supabase joined data */
const getConceptoNombre = (conceptos: unknown): string | undefined => {
  if (Array.isArray(conceptos)) return conceptos[0]?.nombre;
  if (conceptos && typeof conceptos === 'object' && 'nombre' in conceptos) {
    return (conceptos as { nombre: string }).nombre;
  }
  return undefined;
};

/** Get or create a PlanillaRow in a Map */
function getOrCreate(
  map: Map<string, PlanillaRow>,
  fecha: string,
  allKeys: string[]
): PlanillaRow {
  if (!map.has(fecha)) {
    const row = { fecha } as PlanillaRow;
    for (const k of allKeys) row[k] = 0;
    map.set(fecha, row);
  }
  return map.get(fecha)!;
}

/** Build full set of column keys for a planilla tipo */
function buildAllKeys(conceptoKeys: string[], tipo: 'RENTAS' | 'CAJA'): string[] {
  const depositKeys = Array.from({ length: 12 }, (_, i) => `DEPOSITO_${i + 1}`);
  const keys = [...conceptoKeys, ...CC_KEYS, 'DEPOSITOS', ...depositKeys, 'EFECTIVO'];
  if (tipo === 'CAJA') {
    keys.push('VEP', 'EPAGOS');
    keys.push(...Object.values(GASTOS_REG_MAP));
    keys.push(...Object.values(ADELANTOS_MAP));
    keys.push(...Object.values(GASTOS_PERSONALES_MAP));
  }
  return keys;
}

// ============================================================================
// API
// ============================================================================

export const planillasApi = {
  /** Get aggregated RENTAS data by date */
  getRentas: async (filters: PlanillaFilters = {}): Promise<PlanillaRow[]> => {
    const mapping = await buildConceptoMappings('RENTAS');
    const allKeys = buildAllKeys(mapping.keys, 'RENTAS');

    // 1. Movimientos (conceptos)
    let movQuery = supabase
      .from('movimientos')
      .select('fecha, monto, conceptos(nombre)')
      .eq('tipo', 'RENTAS')
      .order('fecha', { ascending: false });

    if (filters.fechaDesde) movQuery = movQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) movQuery = movQuery.lte('fecha', filters.fechaHasta);

    // 2. Movimientos CC (EGRESO concepto='RENTAS')
    let ccQuery = supabase
      .from('movimientos_cc')
      .select('fecha, monto, tipo_movimiento, cuentas_corrientes(nombre)')
      .eq('concepto', 'RENTAS')
      .eq('tipo_movimiento', 'EGRESO');

    if (filters.fechaDesde) ccQuery = ccQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) ccQuery = ccQuery.lte('fecha', filters.fechaHasta);

    // 3. Efectivo entregado
    let efectivoQuery = supabase
      .from('movimientos_efectivo')
      .select('fecha, monto')
      .eq('concepto', 'Efectivo RENTAS entregado');

    if (filters.fechaDesde) efectivoQuery = efectivoQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) efectivoQuery = efectivoQuery.lte('fecha', filters.fechaHasta);

    // 4. Gastos deposito (individual deposits DEPOSITO_1..12)
    let depositosQuery = supabase
      .from('gastos_deposito')
      .select('fecha, numero_deposito, monto')
      .eq('tipo', 'RENTAS');

    if (filters.fechaDesde) depositosQuery = depositosQuery.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) depositosQuery = depositosQuery.lte('fecha', filters.fechaHasta);

    const [movResult, ccResult, efectivoResult, depositosResult] = await Promise.all([movQuery, ccQuery, efectivoQuery, depositosQuery]);

    if (movResult.error) {
      throw new Error(`Error al obtener planilla RENTAS: ${movResult.error.message}`);
    }

    const byFecha = new Map<string, PlanillaRow>();

    // Process movimientos (conceptos)
    for (const mov of movResult.data || []) {
      const dia = getOrCreate(byFecha, mov.fecha, allKeys);
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? mapping.nameToKey[conceptoNombre] : undefined;
      if (key) {
        dia[key] = (dia[key] || 0) + Number(mov.monto || 0);
      }
    }

    // Process movimientos CC
    // Skip CC accounts that have a matching concepto column_key to avoid double-counting
    const conceptoKeySet = new Set(mapping.keys);
    if (!ccResult.error) {
      for (const mov of ccResult.data || []) {
        const dia = getOrCreate(byFecha, mov.fecha, allKeys);
        const cuentaNombre = getConceptoNombre(mov.cuentas_corrientes);
        if (cuentaNombre) {
          const ccKey = CC_MAP[cuentaNombre];
          // Skip if a concepto with same column_key exists (e.g., ICBC)
          if (ccKey && !conceptoKeySet.has(ccKey)) {
            dia[ccKey] = (dia[ccKey] || 0) + Number(mov.monto || 0);
          }
        }
      }
    }

    // Process efectivo
    if (!efectivoResult.error) {
      for (const e of efectivoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, allKeys);
        dia.EFECTIVO = (dia.EFECTIVO || 0) + Number(e.monto || 0);
      }
    }

    // Process gastos deposito (individual deposits)
    if (!depositosResult.error) {
      for (const d of depositosResult.data || []) {
        const dia = getOrCreate(byFecha, d.fecha, allKeys);
        const depKey = `DEPOSITO_${d.numero_deposito}`;
        dia[depKey] = (dia[depKey] || 0) + Number(d.monto || 0);
        dia.DEPOSITOS = (dia.DEPOSITOS || 0) + Number(d.monto || 0);
      }
    }

    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  /** Get aggregated CAJA data by date */
  getCaja: async (filters: PlanillaFilters = {}): Promise<PlanillaRow[]> => {
    const mapping = await buildConceptoMappings('CAJA');
    const allKeys = buildAllKeys(mapping.keys, 'CAJA');

    const addDateFilters = <T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
      query: T, dateCol: string
    ): T => {
      if (filters.fechaDesde) query = query.gte(dateCol, filters.fechaDesde);
      if (filters.fechaHasta) query = query.lte(dateCol, filters.fechaHasta);
      return query;
    };

    // 1. Movimientos (conceptos)
    const movQuery = addDateFilters(
      supabase
        .from('movimientos')
        .select('fecha, monto, conceptos(nombre)')
        .eq('tipo', 'CAJA')
        .order('fecha', { ascending: false }),
      'fecha'
    );

    // 2. Movimientos CC
    const ccQuery = addDateFilters(
      supabase
        .from('movimientos_cc')
        .select('fecha, monto, tipo_movimiento, cuentas_corrientes(nombre)')
        .eq('concepto', 'CAJA')
        .eq('tipo_movimiento', 'EGRESO'),
      'fecha'
    );

    // 3. VEPs
    const vepQuery = addDateFilters(
      supabase.from('control_veps').select('fecha, monto'),
      'fecha'
    );

    // 4. ePagos
    const epagoQuery = addDateFilters(
      supabase.from('control_epagos').select('fecha, monto'),
      'fecha'
    );

    // 5. Gastos registrales
    const gastosQuery = addDateFilters(
      supabase
        .from('gastos_registrales')
        .select('fecha, concepto, monto')
        .eq('origen', 'CAJA'),
      'fecha'
    );

    // 6. Adelantos empleados
    const adelantosQuery = addDateFilters(
      supabase
        .from('adelantos_empleados')
        .select('fecha_adelanto, empleado, monto')
        .eq('origen', 'CAJA'),
      'fecha_adelanto'
    );

    // 7. Efectivo
    const efectivoQuery = addDateFilters(
      supabase
        .from('movimientos_efectivo')
        .select('fecha, monto')
        .eq('concepto', 'Efectivo CAJA entregado'),
      'fecha'
    );

    // 8. Gastos deposito (individual deposits DEPOSITO_1..12)
    const depositosQuery = addDateFilters(
      supabase
        .from('gastos_deposito')
        .select('fecha, numero_deposito, monto')
        .eq('tipo', 'CAJA'),
      'fecha'
    );

    // 9. Gastos personales (TERE)
    const gastosPersonalesQuery = addDateFilters(
      supabase
        .from('gastos_personales')
        .select('fecha, concepto, monto'),
      'fecha'
    );

    const [movResult, ccResult, vepResult, epagoResult, gastosResult, adelantosResult, efectivoResult, depositosResult, gastosPersonalesResult] =
      await Promise.all([movQuery, ccQuery, vepQuery, epagoQuery, gastosQuery, adelantosQuery, efectivoQuery, depositosQuery, gastosPersonalesQuery]);

    if (movResult.error) {
      throw new Error(`Error al obtener planilla CAJA: ${movResult.error.message}`);
    }

    const byFecha = new Map<string, PlanillaRow>();

    // Process movimientos (conceptos)
    for (const mov of movResult.data || []) {
      const dia = getOrCreate(byFecha, mov.fecha, allKeys);
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? mapping.nameToKey[conceptoNombre] : undefined;
      if (key) {
        dia[key] = (dia[key] || 0) + Number(mov.monto || 0);
      }
    }

    // Process movimientos CC
    if (!ccResult.error) {
      for (const mov of ccResult.data || []) {
        const dia = getOrCreate(byFecha, mov.fecha, allKeys);
        const cuentaNombre = getConceptoNombre(mov.cuentas_corrientes);
        if (cuentaNombre) {
          const ccKey = CC_MAP[cuentaNombre];
          if (ccKey) {
            dia[ccKey] = (dia[ccKey] || 0) + Number(mov.monto || 0);
          }
        }
      }
    }

    // Process VEPs
    if (!vepResult.error) {
      for (const v of vepResult.data || []) {
        const dia = getOrCreate(byFecha, v.fecha, allKeys);
        dia.VEP = (dia.VEP || 0) + Number(v.monto || 0);
      }
    }

    // Process ePagos
    if (!epagoResult.error) {
      for (const e of epagoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, allKeys);
        dia.EPAGOS = (dia.EPAGOS || 0) + Number(e.monto || 0);
      }
    }

    // Process gastos registrales
    if (!gastosResult.error) {
      for (const g of gastosResult.data || []) {
        const dia = getOrCreate(byFecha, g.fecha, allKeys);
        const key = GASTOS_REG_MAP[g.concepto];
        if (key) {
          dia[key] = (dia[key] || 0) + Number(g.monto || 0);
        }
      }
    }

    // Process adelantos empleados
    if (!adelantosResult.error) {
      for (const a of adelantosResult.data || []) {
        const dia = getOrCreate(byFecha, a.fecha_adelanto, allKeys);
        const key = ADELANTOS_MAP[a.empleado];
        if (key) {
          dia[key] = (dia[key] || 0) + Number(a.monto || 0);
        }
      }
    }

    // Process efectivo
    if (!efectivoResult.error) {
      for (const e of efectivoResult.data || []) {
        const dia = getOrCreate(byFecha, e.fecha, allKeys);
        dia.EFECTIVO = (dia.EFECTIVO || 0) + Number(e.monto || 0);
      }
    }

    // Process gastos deposito (individual deposits)
    if (!depositosResult.error) {
      for (const d of depositosResult.data || []) {
        const dia = getOrCreate(byFecha, d.fecha, allKeys);
        const depKey = `DEPOSITO_${d.numero_deposito}`;
        dia[depKey] = (dia[depKey] || 0) + Number(d.monto || 0);
        dia.DEPOSITOS = (dia.DEPOSITOS || 0) + Number(d.monto || 0);
      }
    }

    // Process gastos personales (TERE)
    if (!gastosPersonalesResult.error) {
      for (const g of gastosPersonalesResult.data || []) {
        const dia = getOrCreate(byFecha, g.fecha, allKeys);
        const key = GASTOS_PERSONALES_MAP[g.concepto];
        if (key) {
          dia[key] = (dia[key] || 0) + Number(g.monto || 0);
        }
      }
    }

    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  /** Update RENTAS values for a specific date via idempotent RPC (DELETE + re-INSERT) */
  updateRentas: async (fecha: string, valores: PlanillaRow): Promise<UpdateResult> => {
    const p_values: Record<string, number> = {};
    for (const [key, value] of Object.entries(valores)) {
      if (key === 'fecha' || key === 'EFECTIVO' || key === 'DEPOSITOS') continue;
      p_values[key] = typeof value === 'number' ? value : 0;
    }
    const p_entregado = typeof valores.EFECTIVO === 'number' ? valores.EFECTIVO : 0;

    const { data, error } = await supabase.rpc('procesar_rentas_diario', {
      p_fecha: fecha,
      p_values: p_values,
      p_entregado: p_entregado,
    });

    if (error) throw new Error(`Error actualizando RENTAS: ${error.message}`);

    const result = data as { message: string; data: { alertas: string[] } };
    return {
      message: result.message,
      alertas: result.data.alertas?.length > 0 ? result.data.alertas : undefined,
    };
  },

  /** Update CAJA values for a specific date via idempotent RPC (DELETE + re-INSERT) */
  updateCaja: async (fecha: string, valores: PlanillaRow): Promise<UpdateResult> => {
    const p_values: Record<string, number> = {};
    for (const [key, value] of Object.entries(valores)) {
      if (key === 'fecha' || key === 'EFECTIVO' || key === 'DEPOSITOS') continue;
      p_values[key] = typeof value === 'number' ? value : 0;
    }
    const p_entregado = typeof valores.EFECTIVO === 'number' ? valores.EFECTIVO : 0;

    const { data, error } = await supabase.rpc('procesar_caja_diario', {
      p_fecha: fecha,
      p_values: p_values,
      p_entregado: p_entregado,
    });

    if (error) throw new Error(`Error actualizando CAJA: ${error.message}`);

    const result = data as { message: string; data: { alertas: string[] } };
    return {
      message: result.message,
      alertas: result.data.alertas?.length > 0 ? result.data.alertas : undefined,
    };
  },
};
