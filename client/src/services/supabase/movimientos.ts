import { supabase } from '../../lib/supabase';
import { cuentasApi } from './cuentas-corrientes';

// Types
type TipoMovimiento = 'RENTAS' | 'CAJA';
type FrecuenciaPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'NINGUNA';

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cuit: string;
  concepto_id: number;
  monto: number;
  observaciones: string | null;
  created_at: string;
  // Joined data
  concepto_nombre?: string;
  concepto_tipo?: TipoMovimiento;
}

export interface MovimientoCreate {
  fecha: string;
  tipo: TipoMovimiento;
  cuit: string;
  concepto_id: number;
  monto: number;
  observaciones?: string;
}

// Internal type - Concepto is exported from conceptos.ts
interface Concepto {
  id: number;
  nombre: string;
  tipo: TipoMovimiento;
  frecuencia_pago: FrecuenciaPago | null;
  descripcion: string | null;
}

// Interface for raw Supabase query response
interface RawMovimientoWithConcepto {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cuit: string;
  concepto_id: number;
  monto: number;
  observaciones: string | null;
  created_at: string;
  conceptos: { nombre: string; tipo: TipoMovimiento } | null;
}

// Values interfaces for batch operations
export interface RentasDiarioValues {
  GIT: number;
  SUAT_ALTA: number;
  SUAT_PATENTES: number;
  SUAT_INFRACCIONES: number;
  CONSULTA: number;
  SUCERP: number;
  SUGIT: number;
  PROVINCIA: number;
  POSNET: number;
  DEPOSITOS: number;
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
}

export interface CajaDiarioValues {
  ARANCEL: number;
  SUAT_SELLADO: number;
  SUCERP_SELLADO: number;
  CONSULTAS: number;
  FORMULARIOS: number;
  POSNET: number;
  VEP: number;
  EPAGOS: number;
  DEPOSITO_1: number;
  DEPOSITO_2: number;
  DEPOSITO_3: number;
  DEPOSITO_4: number;
  DEPOSITO_5: number;
  DEPOSITO_6: number;
  DEPOSITO_7: number;
  DEPOSITO_8: number;
  DEPOSITO_9: number;
  DEPOSITO_10: number;
  DEPOSITO_11: number;
  DEPOSITO_12: number;
  LIBRERIA: number;
  MARIA: number;
  TERE: number;
  DAMI: number;
  MUMI: number;
  AGUA: number;
  CARGAS_SOCIALES: number;
  EDESUR: number;
  ACARA: number;
  OTROS: number;
  REPO_CAJA_CHICA: number;
  REPO_RENTAS_CHICA: number;
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
}

export interface BatchResult {
  totalMovimientos: number;
  diferencia: number;
  alertas: string[];
}

export interface BatchResponse {
  message: string;
  data: BatchResult;
}

// Helper: Calculate next Monday for weekly controls
const getNextMonday = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

// Helper: Get week boundaries (Monday to Sunday)
const getWeekBoundaries = (date: Date): { inicio: string; fin: string } => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    inicio: monday.toISOString().split('T')[0],
    fin: sunday.toISOString().split('T')[0],
  };
};

// Helper: Get quincena info
const getQuincenaInfo = (date: Date): {
  quincena: 'PRIMERA' | 'SEGUNDA';
  mes: number;
  anio: number;
  inicio: string;
  fin: string;
  fechaPago: string;
} => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  const quincena = day <= 15 ? 'PRIMERA' : 'SEGUNDA';

  let inicio: Date;
  let fin: Date;

  if (quincena === 'PRIMERA') {
    inicio = new Date(year, month, 1);
    fin = new Date(year, month, 15);
  } else {
    inicio = new Date(year, month, 16);
    fin = new Date(year, month + 1, 0); // Last day of month
  }

  // Payment date: 5 business days after end
  const fechaPago = new Date(fin);
  fechaPago.setDate(fechaPago.getDate() + 5);

  return {
    quincena,
    mes: month + 1,
    anio: year,
    inicio: inicio.toISOString().split('T')[0],
    fin: fin.toISOString().split('T')[0],
    fechaPago: fechaPago.toISOString().split('T')[0],
  };
};

export const movimientosApi = {
  /**
   * Get all movements with filters
   */
  getAll: async (filters?: {
    tipo?: TipoMovimiento;
    fecha_desde?: string;
    fecha_hasta?: string;
    concepto_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<Movimiento[]> => {
    let query = supabase
      .from('movimientos')
      .select(`
        *,
        conceptos (nombre, tipo)
      `)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (filters?.tipo) {
      query = query.eq('tipo', filters.tipo);
    }
    if (filters?.fecha_desde) {
      query = query.gte('fecha', filters.fecha_desde);
    }
    if (filters?.fecha_hasta) {
      query = query.lte('fecha', filters.fecha_hasta);
    }
    if (filters?.concepto_id) {
      query = query.eq('concepto_id', filters.concepto_id);
    }
    if (filters?.limit) {
      const offset = filters.offset || 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return (data || []).map((m) => {
      const raw = m as RawMovimientoWithConcepto;
      return {
        ...raw,
        concepto_nombre: raw.conceptos?.nombre,
        concepto_tipo: raw.conceptos?.tipo,
      } as Movimiento;
    });
  },

  /**
   * Get movement by ID
   */
  getById: async (id: number): Promise<Movimiento> => {
    const { data, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        conceptos (nombre, tipo)
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);

    const raw = data as RawMovimientoWithConcepto;
    return {
      ...raw,
      concepto_nombre: raw.conceptos?.nombre,
      concepto_tipo: raw.conceptos?.tipo,
    } as Movimiento;
  },

  /**
   * Create single movement with side effects
   */
  create: async (movimiento: MovimientoCreate): Promise<{
    data: Movimiento;
    message: string;
    alertas: string[];
  }> => {
    const alertas: string[] = [];

    // Validate concepto exists and matches tipo
    const { data: concepto, error: conceptoError } = await supabase
      .from('conceptos')
      .select('*')
      .eq('id', movimiento.concepto_id)
      .single();

    if (conceptoError || !concepto) {
      throw new Error('Concepto no válido');
    }

    if (concepto.tipo !== movimiento.tipo) {
      throw new Error(`El concepto ${concepto.nombre} no corresponde al tipo ${movimiento.tipo}`);
    }

    // Insert movement
    const { data: inserted, error: insertError } = await supabase
      .from('movimientos')
      .insert({
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        cuit: movimiento.cuit,
        concepto_id: movimiento.concepto_id,
        monto: movimiento.monto,
        observaciones: movimiento.observaciones || null,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    const fechaObj = new Date(movimiento.fecha);

    // Apply control logic based on frequency
    if (concepto.frecuencia_pago === 'SEMANAL') {
      await movimientosApi.updateWeeklyControl(concepto.id, fechaObj, movimiento.monto);
      alertas.push(
        `Control semanal actualizado para ${concepto.nombre}. Pago programado para el próximo lunes.`
      );
    } else if (concepto.frecuencia_pago === 'QUINCENAL') {
      await movimientosApi.updateQuincenalControl(concepto.id, fechaObj, movimiento.monto);
      alertas.push(
        `Control quincenal actualizado para ${concepto.nombre}. Pago programado 5 días corridos después de fin de quincena.`
      );
    }

    // POSNET specific logic
    if (concepto.nombre === 'POSNET' || concepto.nombre === 'POSNET CAJA') {
      await movimientosApi.updatePosnetControl(fechaObj, movimiento.monto, movimiento.tipo);
      alertas.push('Control POSNET mensual actualizado.');
    }

    // Account movements for specific concepts
    if (concepto.nombre === 'ICBC') {
      const cuenta = await movimientosApi.getCuentaByNombre('ICBC');
      if (cuenta) {
        await cuentasApi.createMovimiento(cuenta.id, {
          fecha: movimiento.fecha,
          tipo_movimiento: 'EGRESO',
          concepto: movimiento.tipo,
          monto: movimiento.monto,
        });
        alertas.push(`Egreso registrado en cuenta "ICBC" por $${movimiento.monto.toFixed(2)}`);
      }
    } else if (concepto.nombre === 'Formularios') {
      const cuenta = await movimientosApi.getCuentaByNombre('Gastos Formularios');
      if (cuenta) {
        await cuentasApi.createMovimiento(cuenta.id, {
          fecha: movimiento.fecha,
          tipo_movimiento: 'EGRESO',
          concepto: movimiento.tipo,
          monto: movimiento.monto,
        });
        alertas.push(`Egreso registrado en cuenta "Gastos Formularios" por $${movimiento.monto.toFixed(2)}`);
      }
    }

    // VEP control
    if (concepto.nombre === 'VEP' || concepto.nombre === 'VEP CAJA') {
      const { error: vepError } = await supabase.from('control_veps').insert({
        fecha: movimiento.fecha,
        monto: movimiento.monto,
        tipo: 'CAJA',
        observaciones: movimiento.observaciones,
      });
      if (vepError) {
        alertas.push(`Error al registrar VEP en control: ${vepError.message}`);
      } else {
        alertas.push(`VEP registrado en control por $${movimiento.monto.toFixed(2)}`);
      }
    }

    // ePagos control
    if (concepto.nombre === 'ePagos' || concepto.nombre === 'ePagos CAJA') {
      const { error: epagoError } = await supabase.from('control_epagos').insert({
        fecha: movimiento.fecha,
        monto: movimiento.monto,
        tipo: 'CAJA',
        observaciones: movimiento.observaciones,
      });
      if (epagoError) {
        alertas.push(`Error al registrar ePago en control: ${epagoError.message}`);
      } else {
        alertas.push(`ePago registrado en control por $${movimiento.monto.toFixed(2)}`);
      }
    }

    return {
      data: inserted as Movimiento,
      message: 'Movimiento creado exitosamente',
      alertas,
    };
  },

  /**
   * Update movement
   */
  update: async (id: number, datos: Partial<MovimientoCreate>): Promise<Movimiento> => {
    const { data, error } = await supabase
      .from('movimientos')
      .update(datos)
      .eq('id', id)
      .select(`
        *,
        conceptos (nombre, tipo)
      `)
      .single();

    if (error) throw new Error(error.message);

    const raw = data as RawMovimientoWithConcepto;
    return {
      ...raw,
      concepto_nombre: raw.conceptos?.nombre,
      concepto_tipo: raw.conceptos?.tipo,
    } as Movimiento;
  },

  /**
   * Delete movement
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('movimientos').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Movimiento eliminado correctamente' };
  },

  /**
   * Create batch RENTAS diario
   * Processes the daily RENTAS form with all concepts and side effects
   *
   * Uses Postgres function `procesar_rentas_diario` for full transactional integrity.
   * If any operation fails, the entire transaction is rolled back automatically.
   */
  createRentasDiario: async (payload: {
    fecha: string;
    values: RentasDiarioValues;
    entregado: number;
  }): Promise<BatchResponse> => {
    const { fecha, values, entregado } = payload;

    // Call Postgres function for transactional batch processing
    const { data, error } = await supabase.rpc('procesar_rentas_diario', {
      p_fecha: fecha,
      p_values: values,
      p_entregado: entregado,
    });

    if (error) {
      throw new Error(`Error procesando RENTAS diario: ${error.message}`);
    }

    // Parse response from Postgres function
    const result = data as {
      message: string;
      data: { totalMovimientos: number; diferencia: number; alertas: string[] };
    };

    return {
      message: result.message,
      data: {
        totalMovimientos: result.data.totalMovimientos,
        diferencia: result.data.diferencia,
        alertas: result.data.alertas,
      },
    };
  },

  /**
   * Create batch CAJA diario
   * Processes the daily CAJA form with all concepts and side effects
   *
   * Uses Postgres function `procesar_caja_diario` for full transactional integrity.
   * If any operation fails, the entire transaction is rolled back automatically.
   */
  createCajaDiario: async (payload: {
    fecha: string;
    values: CajaDiarioValues;
    entregado: number;
  }): Promise<BatchResponse> => {
    const { fecha, values, entregado } = payload;

    // Call Postgres function for transactional batch processing
    const { data, error } = await supabase.rpc('procesar_caja_diario', {
      p_fecha: fecha,
      p_values: values,
      p_entregado: entregado,
    });

    if (error) {
      throw new Error(`Error procesando CAJA diario: ${error.message}`);
    }

    // Parse response from Postgres function
    const result = data as {
      message: string;
      data: { totalMovimientos: number; diferencia: number; alertas: string[] };
    };

    return {
      message: result.message,
      data: {
        totalMovimientos: result.data.totalMovimientos,
        diferencia: result.data.diferencia,
        alertas: result.data.alertas,
      },
    };
  },

  /**
   * Import movements from CSV
   */
  importarCSV: async (
    contenido: string
  ): Promise<{
    insertados: number;
    errores: string[];
    registros_procesados: number;
  }> => {
    const lineas = contenido.trim().split('\n');
    const errores: string[] = [];
    let insertados = 0;

    // Skip header
    for (let i = 1; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (!linea) continue;

      const campos = linea.split(',');
      if (campos.length < 5) {
        errores.push(`Línea ${i + 1}: formato inválido`);
        continue;
      }

      const [fecha, tipo, cuit, concepto_id, monto, observaciones] = campos;

      const { error } = await supabase.from('movimientos').insert({
        fecha: fecha.trim(),
        tipo: tipo.trim() as TipoMovimiento,
        cuit: cuit.trim(),
        concepto_id: parseInt(concepto_id.trim()),
        monto: parseFloat(monto.trim()),
        observaciones: observaciones?.trim() || null,
      });

      if (error) {
        errores.push(`Línea ${i + 1}: ${error.message}`);
      } else {
        insertados++;
      }
    }

    return {
      insertados,
      errores,
      registros_procesados: lineas.length - 1,
    };
  },

  // ============================================================================
  // Helper functions for control updates
  // ============================================================================

  /**
   * Update or create weekly control for a concept
   */
  updateWeeklyControl: async (conceptoId: number, fecha: Date, monto: number): Promise<void> => {
    const { inicio, fin } = getWeekBoundaries(fecha);
    const fechaPago = getNextMonday(fecha);

    // Check if control exists for this week
    const { data: existing } = await supabase
      .from('controles_semanales')
      .select('id, total_recaudado')
      .eq('concepto_id', conceptoId)
      .eq('fecha_inicio', inicio)
      .eq('fecha_fin', fin)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('controles_semanales')
        .update({ total_recaudado: existing.total_recaudado + monto })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase.from('controles_semanales').insert({
        concepto_id: conceptoId,
        fecha_inicio: inicio,
        fecha_fin: fin,
        total_recaudado: monto,
        fecha_pago_programada: fechaPago,
        pagado: false,
      });
    }
  },

  /**
   * Update or create quincenal control for a concept
   */
  updateQuincenalControl: async (conceptoId: number, fecha: Date, monto: number): Promise<void> => {
    const info = getQuincenaInfo(fecha);

    // Check if control exists
    const { data: existing } = await supabase
      .from('controles_quincenales')
      .select('id, total_recaudado')
      .eq('concepto_id', conceptoId)
      .eq('quincena', info.quincena)
      .eq('mes', info.mes)
      .eq('anio', info.anio)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('controles_quincenales')
        .update({ total_recaudado: existing.total_recaudado + monto })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase.from('controles_quincenales').insert({
        concepto_id: conceptoId,
        quincena: info.quincena,
        mes: info.mes,
        anio: info.anio,
        fecha_inicio: info.inicio,
        fecha_fin: info.fin,
        total_recaudado: monto,
        fecha_pago_programada: info.fechaPago,
        pagado: false,
      });
    }
  },

  /**
   * Update POSNET monthly control
   */
  updatePosnetControl: async (fecha: Date, monto: number, tipo: TipoMovimiento): Promise<void> => {
    const mes = fecha.getMonth() + 1;
    const anio = fecha.getFullYear();

    // Check if monthly control exists
    const { data: existing } = await supabase
      .from('control_posnet')
      .select('id, total_rentas, total_caja')
      .eq('mes', mes)
      .eq('anio', anio)
      .single();

    if (existing) {
      const updateData =
        tipo === 'RENTAS'
          ? { total_rentas: existing.total_rentas + monto }
          : { total_caja: existing.total_caja + monto };

      await supabase.from('control_posnet').update(updateData).eq('id', existing.id);
    } else {
      await supabase.from('control_posnet').insert({
        mes,
        anio,
        total_rentas: tipo === 'RENTAS' ? monto : 0,
        total_caja: tipo === 'CAJA' ? monto : 0,
      });
    }
  },

  /**
   * Get cuenta corriente by name
   */
  getCuentaByNombre: async (nombre: string): Promise<{ id: number; nombre: string } | null> => {
    const { data } = await supabase
      .from('cuentas_corrientes')
      .select('id, nombre')
      .eq('nombre', nombre)
      .single();

    return data;
  },
};
