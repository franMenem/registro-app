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
});

// Mapping of concepto names to DiaRentas keys
const rentasConceptoMap: Record<string, keyof DiaRentas> = {
  GIT: 'GIT',
  'SUAT ALTA': 'SUAT_ALTA',
  'SUAT PATENTES': 'SUAT_PATENTES',
  'SUAT INFRACCIONES': 'SUAT_INFRACCIONES',
  SUCERP: 'SUCERP',
  SUGIT: 'SUGIT',
  PROVINCIA: 'PROVINCIA',
  'CONSULTA RENTAS': 'CONSULTA',
  'POSNET RENTAS': 'POSNET',
  'ICBC RENTAS': 'ICBC',
  'FORD RENTAS': 'FORD',
  'SICARDI RENTAS': 'SICARDI',
  'PATAGONIA RENTAS': 'PATAGONIA',
  'IVECO RENTAS': 'IVECO',
  'CNH RENTAS': 'CNH',
  'GESTORIA FORD RENTAS': 'GESTORIA_FORD',
  'ALRA RENTAS': 'ALRA',
  'DEPOSITOS RENTAS': 'DEPOSITOS',
};

// Mapping of concepto names to DiaCaja keys
const cajaConceptoMap: Record<string, keyof DiaCaja> = {
  ARANCEL: 'ARANCEL',
  'SUAT SELLADO': 'SUAT_SELLADO',
  'SUCERP SELLADO': 'SUCERP_SELLADO',
  'CONSULTAS CAJA': 'CONSULTAS',
  FORMULARIOS: 'FORMULARIOS',
  'POSNET CAJA': 'POSNET',
  VEP: 'VEP',
  EPAGOS: 'EPAGOS',
  LIBRERIA: 'LIBRERIA',
  MARIA: 'MARIA',
  AGUA: 'AGUA',
  EDESUR: 'EDESUR',
  TERE: 'TERE',
  DAMI: 'DAMI',
  MUMI: 'MUMI',
  'ICBC CAJA': 'ICBC',
  'FORD CAJA': 'FORD',
  'SICARDI CAJA': 'SICARDI',
  'PATAGONIA CAJA': 'PATAGONIA',
  'IVECO CAJA': 'IVECO',
  'CNH CAJA': 'CNH',
  'GESTORIA FORD CAJA': 'GESTORIA_FORD',
  'ALRA CAJA': 'ALRA',
  'DEPOSITOS CAJA': 'DEPOSITOS',
};

// Reverse mapping for updates (DiaRentas key -> concepto name)
const rentasKeyToConcepto: Record<keyof Omit<DiaRentas, 'fecha'>, string> = {
  GIT: 'GIT',
  SUAT_ALTA: 'SUAT ALTA',
  SUAT_PATENTES: 'SUAT PATENTES',
  SUAT_INFRACCIONES: 'SUAT INFRACCIONES',
  SUCERP: 'SUCERP',
  SUGIT: 'SUGIT',
  PROVINCIA: 'PROVINCIA',
  CONSULTA: 'CONSULTA RENTAS',
  POSNET: 'POSNET RENTAS',
  ICBC: 'ICBC RENTAS',
  FORD: 'FORD RENTAS',
  SICARDI: 'SICARDI RENTAS',
  PATAGONIA: 'PATAGONIA RENTAS',
  IVECO: 'IVECO RENTAS',
  CNH: 'CNH RENTAS',
  GESTORIA_FORD: 'GESTORIA FORD RENTAS',
  ALRA: 'ALRA RENTAS',
  DEPOSITOS: 'DEPOSITOS RENTAS',
};

// Reverse mapping for updates (DiaCaja key -> concepto name)
const cajaKeyToConcepto: Record<keyof Omit<DiaCaja, 'fecha'>, string> = {
  ARANCEL: 'ARANCEL',
  SUAT_SELLADO: 'SUAT SELLADO',
  SUCERP_SELLADO: 'SUCERP SELLADO',
  CONSULTAS: 'CONSULTAS CAJA',
  FORMULARIOS: 'FORMULARIOS',
  POSNET: 'POSNET CAJA',
  VEP: 'VEP',
  EPAGOS: 'EPAGOS',
  LIBRERIA: 'LIBRERIA',
  MARIA: 'MARIA',
  AGUA: 'AGUA',
  EDESUR: 'EDESUR',
  TERE: 'TERE',
  DAMI: 'DAMI',
  MUMI: 'MUMI',
  ICBC: 'ICBC CAJA',
  FORD: 'FORD CAJA',
  SICARDI: 'SICARDI CAJA',
  PATAGONIA: 'PATAGONIA CAJA',
  IVECO: 'IVECO CAJA',
  CNH: 'CNH CAJA',
  GESTORIA_FORD: 'GESTORIA FORD CAJA',
  ALRA: 'ALRA CAJA',
  DEPOSITOS: 'DEPOSITOS CAJA',
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

export const planillasApi = {
  // Get aggregated RENTAS data by date
  getRentas: async (filters: PlanillaFilters = {}): Promise<DiaRentas[]> => {
    let query = supabase
      .from('movimientos')
      .select('fecha, monto, conceptos(nombre)')
      .eq('tipo', 'RENTAS')
      .order('fecha', { ascending: false });

    if (filters.fechaDesde) {
      query = query.gte('fecha', filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      query = query.lte('fecha', filters.fechaHasta);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener planilla RENTAS: ${error.message}`);
    }

    // Aggregate by fecha
    const byFecha = new Map<string, DiaRentas>();

    for (const mov of data || []) {
      const fecha = mov.fecha;
      if (!byFecha.has(fecha)) {
        byFecha.set(fecha, emptyDiaRentas(fecha));
      }

      const dia = byFecha.get(fecha)!;
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? rentasConceptoMap[conceptoNombre] : undefined;
      if (key && key !== 'fecha') {
        dia[key] = (dia[key] as number) + Number(mov.monto || 0);
      }
    }

    // Sort by fecha descending
    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  // Get aggregated CAJA data by date
  getCaja: async (filters: PlanillaFilters = {}): Promise<DiaCaja[]> => {
    let query = supabase
      .from('movimientos')
      .select('fecha, monto, conceptos(nombre)')
      .eq('tipo', 'CAJA')
      .order('fecha', { ascending: false });

    if (filters.fechaDesde) {
      query = query.gte('fecha', filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      query = query.lte('fecha', filters.fechaHasta);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener planilla CAJA: ${error.message}`);
    }

    // Aggregate by fecha
    const byFecha = new Map<string, DiaCaja>();

    for (const mov of data || []) {
      const fecha = mov.fecha;
      if (!byFecha.has(fecha)) {
        byFecha.set(fecha, emptyDiaCaja(fecha));
      }

      const dia = byFecha.get(fecha)!;
      const conceptoNombre = getConceptoNombre(mov.conceptos);
      const key = conceptoNombre ? cajaConceptoMap[conceptoNombre] : undefined;
      if (key && key !== 'fecha') {
        dia[key] = (dia[key] as number) + Number(mov.monto || 0);
      }
    }

    // Sort by fecha descending
    return Array.from(byFecha.values()).sort(
      (a, b) => parseDateFromDB(b.fecha).getTime() - parseDateFromDB(a.fecha).getTime()
    );
  },

  // Update RENTAS values for a specific date
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

    // Process each field — collect results instead of mutating shared array
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

    // Process each field — collect results instead of mutating shared array
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
