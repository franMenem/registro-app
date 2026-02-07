import { supabase } from '../../lib/supabase';

// Types
export type TipoPago = 'CUOTAS' | 'LIBRE';
export type EstadoDeuda = 'PENDIENTE' | 'EN_CURSO' | 'PAGADA';

export interface DeudaPago {
  id: number;
  deuda_id: number;
  fecha: string;
  monto: number;
  numero_cuota: number | null;
  observaciones: string | null;
  created_at: string;
}

export interface Deuda {
  id: number;
  concepto: string;
  acreedor: string;
  monto_total: number;
  tipo_pago: TipoPago;
  cantidad_cuotas: number | null;
  monto_cuota: number | null;
  fecha_inicio: string;
  estado: EstadoDeuda;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  pagos: DeudaPago[];
  // Computed
  total_pagado: number;
  saldo_pendiente: number;
}

export interface DeudaCreate {
  concepto: string;
  acreedor: string;
  monto_total: number;
  tipo_pago: TipoPago;
  cantidad_cuotas?: number;
  fecha_inicio: string;
  observaciones?: string;
}

export interface ResumenDeudas {
  total_deuda: number;
  total_pagado: number;
  total_pendiente: number;
  deudas_activas: number;
  deudas_pagadas: number;
}

export const deudasApi = {
  getAll: async (filtros?: { estado?: EstadoDeuda }): Promise<Deuda[]> => {
    let query = supabase.from('deudas').select('*');

    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado);
    }

    query = query.order('fecha_inicio', { ascending: false }).order('created_at', { ascending: false });

    const { data: deudas, error } = await query;
    if (error) throw new Error(error.message);
    if (!deudas || deudas.length === 0) return [];

    // Fetch all pagos for these deudas
    const deudaIds = deudas.map((d) => d.id);
    const { data: pagos, error: pagosError } = await supabase
      .from('deudas_pagos')
      .select('*')
      .in('deuda_id', deudaIds)
      .order('fecha', { ascending: true });

    if (pagosError) throw new Error(pagosError.message);

    // Group pagos by deuda_id
    const pagosMap = new Map<number, DeudaPago[]>();
    (pagos || []).forEach((p) => {
      const existing = pagosMap.get(p.deuda_id) || [];
      existing.push(p as DeudaPago);
      pagosMap.set(p.deuda_id, existing);
    });

    // Enrich deudas with pagos and computed fields
    return deudas.map((d) => {
      const deudaPagos = pagosMap.get(d.id) || [];
      const total_pagado = deudaPagos.reduce((sum, p) => sum + p.monto, 0);
      return {
        ...d,
        pagos: deudaPagos,
        total_pagado,
        saldo_pendiente: d.monto_total - total_pagado,
      } as Deuda;
    });
  },

  getResumen: async (): Promise<ResumenDeudas> => {
    const { data: deudas, error } = await supabase
      .from('deudas')
      .select('id, monto_total, estado');

    if (error) throw new Error(error.message);
    if (!deudas || deudas.length === 0) {
      return { total_deuda: 0, total_pagado: 0, total_pendiente: 0, deudas_activas: 0, deudas_pagadas: 0 };
    }

    const activas = deudas.filter((d) => d.estado !== 'PAGADA');
    const pagadas = deudas.filter((d) => d.estado === 'PAGADA');

    // Fetch pagos only for active deudas
    const activaIds = activas.map((d) => d.id);
    let total_pagado_activas = 0;

    if (activaIds.length > 0) {
      const { data: pagos, error: pagosError } = await supabase
        .from('deudas_pagos')
        .select('monto')
        .in('deuda_id', activaIds);

      if (pagosError) throw new Error(pagosError.message);
      total_pagado_activas = (pagos || []).reduce((sum, p) => sum + p.monto, 0);
    }

    const total_deuda = activas.reduce((sum, d) => sum + d.monto_total, 0);

    return {
      total_deuda,
      total_pagado: total_pagado_activas,
      total_pendiente: total_deuda - total_pagado_activas,
      deudas_activas: activas.length,
      deudas_pagadas: pagadas.length,
    };
  },

  create: async (deuda: DeudaCreate): Promise<{ message: string; data: Deuda }> => {
    const insertData: Record<string, unknown> = {
      concepto: deuda.concepto,
      acreedor: deuda.acreedor,
      monto_total: deuda.monto_total,
      tipo_pago: deuda.tipo_pago,
      fecha_inicio: deuda.fecha_inicio,
      observaciones: deuda.observaciones || null,
    };

    if (deuda.tipo_pago === 'CUOTAS' && deuda.cantidad_cuotas) {
      insertData.cantidad_cuotas = deuda.cantidad_cuotas;
      insertData.monto_cuota = Math.round((deuda.monto_total / deuda.cantidad_cuotas) * 100) / 100;
    }

    const { data, error } = await supabase
      .from('deudas')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      message: 'Deuda creada correctamente',
      data: { ...data, pagos: [], total_pagado: 0, saldo_pendiente: data.monto_total } as Deuda,
    };
  },

  update: async (
    id: number,
    data: {
      concepto?: string;
      acreedor?: string;
      monto_total?: number;
      tipo_pago?: TipoPago;
      cantidad_cuotas?: number | null;
      fecha_inicio?: string;
      observaciones?: string | null;
    }
  ): Promise<{ message: string }> => {
    const updateData: Record<string, unknown> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    // Recompute monto_cuota if relevant fields changed
    if (data.tipo_pago === 'CUOTAS' && data.monto_total && data.cantidad_cuotas) {
      updateData.monto_cuota = Math.round((data.monto_total / data.cantidad_cuotas) * 100) / 100;
    } else if (data.tipo_pago === 'LIBRE') {
      updateData.cantidad_cuotas = null;
      updateData.monto_cuota = null;
    }

    const { error } = await supabase.from('deudas').update(updateData).eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Deuda actualizada correctamente' };
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('deudas').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Deuda eliminada correctamente' };
  },

  registrarPago: async (
    deudaId: number,
    pago: { fecha: string; monto: number; numero_cuota?: number; observaciones?: string }
  ): Promise<{ message: string; data: DeudaPago }> => {
    // Insert pago
    const { data: nuevoPago, error: pagoError } = await supabase
      .from('deudas_pagos')
      .insert({
        deuda_id: deudaId,
        fecha: pago.fecha,
        monto: pago.monto,
        numero_cuota: pago.numero_cuota || null,
        observaciones: pago.observaciones || null,
      })
      .select()
      .single();

    if (pagoError) throw new Error(pagoError.message);

    // Compute new total and update estado
    const { data: allPagos, error: fetchError } = await supabase
      .from('deudas_pagos')
      .select('monto')
      .eq('deuda_id', deudaId);

    if (fetchError) throw new Error(fetchError.message);

    const totalPagado = (allPagos || []).reduce((sum, p) => sum + p.monto, 0);

    // Get deuda monto_total
    const { data: deuda, error: deudaError } = await supabase
      .from('deudas')
      .select('monto_total')
      .eq('id', deudaId)
      .single();

    if (deudaError) throw new Error(deudaError.message);

    const nuevoEstado: EstadoDeuda = totalPagado >= deuda.monto_total ? 'PAGADA' : 'EN_CURSO';

    const { error: updateError } = await supabase
      .from('deudas')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', deudaId);

    if (updateError) throw new Error(updateError.message);

    return {
      message: nuevoEstado === 'PAGADA'
        ? 'Deuda pagada completamente!'
        : `Pago registrado. Pendiente: $${(deuda.monto_total - totalPagado).toLocaleString('es-AR')}`,
      data: nuevoPago as DeudaPago,
    };
  },

  eliminarPago: async (pagoId: number): Promise<{ message: string }> => {
    // Get pago to find deuda_id
    const { data: pago, error: pagoError } = await supabase
      .from('deudas_pagos')
      .select('deuda_id')
      .eq('id', pagoId)
      .single();

    if (pagoError) throw new Error(pagoError.message);

    const deudaId = pago.deuda_id;

    // Delete pago
    const { error: deleteError } = await supabase
      .from('deudas_pagos')
      .delete()
      .eq('id', pagoId);

    if (deleteError) throw new Error(deleteError.message);

    // Recompute estado
    const { data: remainingPagos, error: fetchError } = await supabase
      .from('deudas_pagos')
      .select('monto')
      .eq('deuda_id', deudaId);

    if (fetchError) throw new Error(fetchError.message);

    const totalPagado = (remainingPagos || []).reduce((sum, p) => sum + p.monto, 0);

    const { data: deuda, error: deudaError } = await supabase
      .from('deudas')
      .select('monto_total')
      .eq('id', deudaId)
      .single();

    if (deudaError) throw new Error(deudaError.message);

    let nuevoEstado: EstadoDeuda;
    if (totalPagado <= 0) {
      nuevoEstado = 'PENDIENTE';
    } else if (totalPagado >= deuda.monto_total) {
      nuevoEstado = 'PAGADA';
    } else {
      nuevoEstado = 'EN_CURSO';
    }

    const { error: updateError } = await supabase
      .from('deudas')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', deudaId);

    if (updateError) throw new Error(updateError.message);

    return { message: 'Pago eliminado correctamente' };
  },
};
