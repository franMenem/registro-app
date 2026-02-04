// Supabase service for Formularios and Vencimientos

import { supabase } from '@/lib/supabase';

// Types
export interface Vencimiento {
  id: number;
  formulario_id: number;
  numero_vencimiento: number;
  fecha_vencimiento: string;
  monto: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  fecha_pago: string | null;
  gasto_registral_id: number | null;
}

export interface Formulario {
  id: number;
  numero: string;
  descripcion: string | null;
  monto: number;
  fecha_compra: string;
  proveedor: string | null;
  vencimientos: Vencimiento[];
  created_at: string;
}

export interface FormularioCreate {
  numero: string;
  descripcion?: string;
  monto: number;
  fecha_compra: string;
  proveedor?: string;
  vencimientos: {
    numero_vencimiento: number;
    fecha_vencimiento: string;
    monto: number;
  }[];
}

export interface FormularioResumen {
  total_formularios: number;
  total_vencimientos: number;
  saldo_pendiente_formularios: number;
  formularios_con_deuda: number;
  vencimientos_pendientes: number;
  monto_pendiente: number;
  vencimientos_pagados: number;
  monto_pagado: number;
}

export interface ImportResult {
  insertados: number;
  errores: string[];
}

export const formulariosApi = {
  // Get all formularios with their vencimientos
  getAll: async (): Promise<Formulario[]> => {
    const { data: formularios, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .order('created_at', { ascending: false });

    if (formError) {
      throw new Error(`Error al obtener formularios: ${formError.message}`);
    }

    if (!formularios || formularios.length === 0) {
      return [];
    }

    // Get all vencimientos for these formularios
    // Supabase tiene un límite para .in() (~100-1000 elementos), dividimos en batches
    const formIds = formularios.map((f) => f.id);
    const BATCH_SIZE = 100;
    const vencimientos: Vencimiento[] = [];

    for (let i = 0; i < formIds.length; i += BATCH_SIZE) {
      const batchIds = formIds.slice(i, i + BATCH_SIZE);
      const { data: batchVenc, error: vencError } = await supabase
        .from('formularios_vencimientos')
        .select('*')
        .in('formulario_id', batchIds)
        .order('numero_vencimiento', { ascending: true });

      if (vencError) {
        throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
      }

      if (batchVenc) {
        vencimientos.push(...batchVenc);
      }
    }

    // Group vencimientos by formulario_id
    const vencByFormId = new Map<number, Vencimiento[]>();
    for (const venc of vencimientos || []) {
      if (!vencByFormId.has(venc.formulario_id)) {
        vencByFormId.set(venc.formulario_id, []);
      }
      vencByFormId.get(venc.formulario_id)!.push(venc);
    }

    // Combine formularios with their vencimientos
    return formularios.map((f) => ({
      ...f,
      vencimientos: vencByFormId.get(f.id) || [],
    }));
  },

  // Get a single formulario by ID
  getById: async (id: number): Promise<Formulario> => {
    const { data: formulario, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .eq('id', id)
      .single();

    if (formError) {
      throw new Error(`Error al obtener formulario: ${formError.message}`);
    }

    const { data: vencimientos, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .select('*')
      .eq('formulario_id', id)
      .order('numero_vencimiento', { ascending: true });

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
    }

    return {
      ...formulario,
      vencimientos: vencimientos || [],
    };
  },

  // Get pending vencimientos
  getVencimientosPendientes: async (): Promise<Vencimiento[]> => {
    const { data, error } = await supabase
      .from('formularios_vencimientos')
      .select('*')
      .eq('estado', 'PENDIENTE')
      .order('fecha_vencimiento', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener vencimientos pendientes: ${error.message}`);
    }

    return data || [];
  },

  // Get summary stats
  getResumen: async (): Promise<FormularioResumen> => {
    // Get all formularios
    const { data: formularios, error: formError } = await supabase
      .from('formularios')
      .select('id, monto');

    if (formError) {
      throw new Error(`Error al obtener resumen: ${formError.message}`);
    }

    // Get all vencimientos
    const { data: vencimientos, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .select('formulario_id, monto, estado, fecha_vencimiento, numero_vencimiento');

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
    }

    const totalFormularios = formularios?.length || 0;
    const totalVencimientos = vencimientos?.length || 0;

    // Agrupar vencimientos por formulario
    const vencByFormId = new Map<number, typeof vencimientos>();
    for (const v of vencimientos || []) {
      if (!vencByFormId.has(v.formulario_id)) {
        vencByFormId.set(v.formulario_id, []);
      }
      vencByFormId.get(v.formulario_id)!.push(v);
    }

    // Encontrar formularios que tienen al menos un vencimiento PAGADO
    const formulariosPagados = new Set<number>();
    for (const [formId, vencs] of vencByFormId) {
      if (vencs.some((v) => v.estado === 'PAGADO')) {
        formulariosPagados.add(formId);
      }
    }

    // Calcular estadísticas
    // Para formularios sin pagar: contar solo 1 vencimiento (el vigente) por formulario
    let vencimientosPendientes = 0;
    let montoPendiente = 0;
    let vencimientosPagados = 0;
    let montoPagado = 0;
    const formulariosConDeuda = new Set<number>();

    // Contar vencimientos pagados
    for (const v of vencimientos || []) {
      if (v.estado === 'PAGADO') {
        vencimientosPagados++;
        montoPagado += Number(v.monto);
      }
    }

    // Para formularios sin pagar, contar solo 1 vencimiento vigente por formulario
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [formId, vencs] of vencByFormId) {
      // Si el formulario ya tiene un pago, no es deuda
      if (formulariosPagados.has(formId)) continue;

      formulariosConDeuda.add(formId);
      vencimientosPendientes++; // 1 por formulario

      // Calcular monto vigente: próximo a vencer, o venc 3 si todos vencieron
      const pendiente = vencs
        .filter((v) => new Date(v.fecha_vencimiento) >= today)
        .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())[0];

      if (pendiente) {
        montoPendiente += Number(pendiente.monto);
      } else {
        // Todos vencieron, usar vencimiento 3
        const venc3 = vencs.find((v) => v.numero_vencimiento === 3);
        montoPendiente += Number(venc3?.monto || vencs[0]?.monto || 0);
      }
    }

    // saldo_pendiente_formularios: suma del monto de formularios SIN ningún vencimiento pagado
    let saldoPendienteFormularios = 0;
    for (const f of formularios || []) {
      if (formulariosConDeuda.has(f.id)) {
        saldoPendienteFormularios += Number(f.monto);
      }
    }

    return {
      total_formularios: totalFormularios,
      total_vencimientos: totalVencimientos,
      saldo_pendiente_formularios: saldoPendienteFormularios,
      formularios_con_deuda: formulariosConDeuda.size,
      vencimientos_pendientes: vencimientosPendientes,
      monto_pendiente: montoPendiente,
      vencimientos_pagados: vencimientosPagados,
      monto_pagado: montoPagado,
    };
  },

  // Create a new formulario with vencimientos
  create: async (
    data: FormularioCreate
  ): Promise<{ message: string; data: Formulario }> => {
    // Insert formulario
    const { data: formulario, error: formError } = await supabase
      .from('formularios')
      .insert({
        numero: data.numero,
        descripcion: data.descripcion || null,
        monto: data.monto,
        fecha_compra: data.fecha_compra,
        proveedor: data.proveedor || null,
      })
      .select()
      .single();

    if (formError) {
      throw new Error(`Error al crear formulario: ${formError.message}`);
    }

    // Insert vencimientos
    const vencimientosToInsert = data.vencimientos.map((v) => ({
      formulario_id: formulario.id,
      numero_vencimiento: v.numero_vencimiento,
      fecha_vencimiento: v.fecha_vencimiento,
      monto: v.monto,
      estado: 'PENDIENTE',
    }));

    const { data: vencimientos, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .insert(vencimientosToInsert)
      .select();

    if (vencError) {
      // Try to rollback formulario creation
      await supabase.from('formularios').delete().eq('id', formulario.id);
      throw new Error(`Error al crear vencimientos: ${vencError.message}`);
    }

    return {
      message: 'Formulario creado correctamente',
      data: {
        ...formulario,
        vencimientos: vencimientos || [],
      },
    };
  },

  // Update a formulario and its vencimientos
  update: async (
    id: number,
    data: FormularioCreate
  ): Promise<{ message: string }> => {
    // Update formulario
    const { error: formError } = await supabase
      .from('formularios')
      .update({
        numero: data.numero,
        descripcion: data.descripcion || null,
        monto: data.monto,
        fecha_compra: data.fecha_compra,
        proveedor: data.proveedor || null,
      })
      .eq('id', id);

    if (formError) {
      throw new Error(`Error al actualizar formulario: ${formError.message}`);
    }

    // Get existing vencimientos
    const { data: existingVenc, error: fetchError } = await supabase
      .from('formularios_vencimientos')
      .select('id, numero_vencimiento, estado')
      .eq('formulario_id', id);

    if (fetchError) {
      throw new Error(`Error al obtener vencimientos: ${fetchError.message}`);
    }

    // Update each vencimiento (only if not PAGADO)
    for (const v of data.vencimientos) {
      const existing = existingVenc?.find(
        (e) => e.numero_vencimiento === v.numero_vencimiento
      );
      if (existing && existing.estado !== 'PAGADO') {
        const { error: updateError } = await supabase
          .from('formularios_vencimientos')
          .update({
            fecha_vencimiento: v.fecha_vencimiento,
            monto: v.monto,
          })
          .eq('id', existing.id);

        if (updateError) {
          throw new Error(
            `Error al actualizar vencimiento ${v.numero_vencimiento}: ${updateError.message}`
          );
        }
      }
    }

    return { message: 'Formulario actualizado correctamente' };
  },

  // Delete a formulario (only if no vencimientos are PAGADO)
  delete: async (id: number): Promise<{ message: string }> => {
    // Check if any vencimiento is PAGADO
    const { data: pagados, error: checkError } = await supabase
      .from('formularios_vencimientos')
      .select('id')
      .eq('formulario_id', id)
      .eq('estado', 'PAGADO');

    if (checkError) {
      throw new Error(`Error al verificar vencimientos: ${checkError.message}`);
    }

    if (pagados && pagados.length > 0) {
      throw new Error(
        'No se puede eliminar un formulario con vencimientos pagados'
      );
    }

    // Delete vencimientos first
    const { error: deleteVencError } = await supabase
      .from('formularios_vencimientos')
      .delete()
      .eq('formulario_id', id);

    if (deleteVencError) {
      throw new Error(`Error al eliminar vencimientos: ${deleteVencError.message}`);
    }

    // Delete formulario
    const { error: deleteFormError } = await supabase
      .from('formularios')
      .delete()
      .eq('id', id);

    if (deleteFormError) {
      throw new Error(`Error al eliminar formulario: ${deleteFormError.message}`);
    }

    return { message: 'Formulario eliminado correctamente' };
  },

  // Pay multiple vencimientos (creates a gasto_registral CARCOS)
  pagarVencimientos: async (
    vencimientoIds: number[],
    fechaPago: string
  ): Promise<{ message: string; data: { total_pagado: number } }> => {
    if (vencimientoIds.length === 0) {
      throw new Error('Debe seleccionar al menos un vencimiento');
    }

    // Get the vencimientos to pay WITH formulario info
    const { data: vencimientos, error: fetchError } = await supabase
      .from('formularios_vencimientos')
      .select('id, monto, estado, formulario_id, formularios(numero)')
      .in('id', vencimientoIds);

    if (fetchError) {
      throw new Error(`Error al obtener vencimientos: ${fetchError.message}`);
    }

    // Calculate total and collect formulario numbers
    let totalPagado = 0;
    const numerosFormularios: string[] = [];
    for (const v of vencimientos || []) {
      if (v.estado === 'PAGADO') {
        throw new Error('Uno de los vencimientos ya está pagado');
      }
      totalPagado += Number(v.monto);
      // @ts-expect-error - Supabase join returns nested object
      const numero = v.formularios?.numero;
      if (numero && !numerosFormularios.includes(numero)) {
        numerosFormularios.push(numero);
      }
    }

    // Create observaciones with formulario numbers
    const observaciones = numerosFormularios.length > 0
      ? `Formularios: ${numerosFormularios.join(', ')}`
      : null;

    // Create gasto_registral (CARCOS)
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos_registrales')
      .insert({
        concepto: 'CARCOS',
        monto: totalPagado,
        fecha: fechaPago,
        observaciones,
        origen: 'FORMULARIOS',
      })
      .select()
      .single();

    if (gastoError) {
      throw new Error(`Error al crear gasto registral: ${gastoError.message}`);
    }

    // Update vencimientos to PAGADO
    const { error: updateError } = await supabase
      .from('formularios_vencimientos')
      .update({
        estado: 'PAGADO',
        fecha_pago: fechaPago,
        gasto_registral_id: gasto.id,
      })
      .in('id', vencimientoIds);

    if (updateError) {
      // Try to rollback the gasto creation
      await supabase.from('gastos_registrales').delete().eq('id', gasto.id);
      throw new Error(`Error al actualizar vencimientos: ${updateError.message}`);
    }

    return {
      message: `${vencimientoIds.length} vencimiento(s) pagado(s) correctamente`,
      data: { total_pagado: totalPagado },
    };
  },

  // Import formularios from CSV
  importarCSV: async (contenido: string): Promise<ImportResult> => {
    const lines = contenido.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo CSV debe tener al menos una línea de datos');
    }

    // Skip header
    const dataLines = lines.slice(1);
    const errores: string[] = [];
    let insertados = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        // Expected format: numero,descripcion,monto,fecha_compra,proveedor,fecha_venc1,monto_venc1,fecha_venc2,monto_venc2,fecha_venc3,monto_venc3
        const parts = line.split(',');
        if (parts.length < 11) {
          errores.push(`Línea ${i + 2}: Formato inválido (faltan columnas)`);
          continue;
        }

        const [
          numero,
          descripcion,
          monto,
          fecha_compra,
          proveedor,
          fecha_venc1,
          monto_venc1,
          fecha_venc2,
          monto_venc2,
          fecha_venc3,
          monto_venc3,
        ] = parts;

        // Create formulario
        const { data: formulario, error: formError } = await supabase
          .from('formularios')
          .insert({
            numero: numero.trim(),
            descripcion: descripcion.trim() || null,
            monto: parseFloat(monto) || 0,
            fecha_compra: fecha_compra.trim(),
            proveedor: proveedor.trim() || null,
          })
          .select()
          .single();

        if (formError) {
          errores.push(`Línea ${i + 2}: ${formError.message}`);
          continue;
        }

        // Create vencimientos
        const vencimientos = [
          {
            formulario_id: formulario.id,
            numero_vencimiento: 1,
            fecha_vencimiento: fecha_venc1.trim(),
            monto: parseFloat(monto_venc1) || 0,
            estado: 'PENDIENTE',
          },
          {
            formulario_id: formulario.id,
            numero_vencimiento: 2,
            fecha_vencimiento: fecha_venc2.trim(),
            monto: parseFloat(monto_venc2) || 0,
            estado: 'PENDIENTE',
          },
          {
            formulario_id: formulario.id,
            numero_vencimiento: 3,
            fecha_vencimiento: fecha_venc3.trim(),
            monto: parseFloat(monto_venc3) || 0,
            estado: 'PENDIENTE',
          },
        ];

        const { error: vencError } = await supabase
          .from('formularios_vencimientos')
          .insert(vencimientos);

        if (vencError) {
          // Rollback formulario
          await supabase.from('formularios').delete().eq('id', formulario.id);
          errores.push(`Línea ${i + 2}: Error en vencimientos - ${vencError.message}`);
          continue;
        }

        insertados++;
      } catch (err) {
        errores.push(`Línea ${i + 2}: Error inesperado`);
      }
    }

    return { insertados, errores };
  },

  // Obtener historial de pagos de formularios (gastos registrales CARCOS)
  getHistorialPagos: async (): Promise<{
    id: number;
    fecha: string;
    monto: number;
    observaciones: string | null;
    formularios: { numero: string; monto: number }[];
  }[]> => {
    // Obtener gastos registrales de concepto CARCOS
    const { data: gastos, error: gastosError } = await supabase
      .from('gastos_registrales')
      .select('id, fecha, monto, observaciones')
      .eq('concepto', 'CARCOS')
      .order('fecha', { ascending: false });

    if (gastosError) {
      throw new Error(`Error al obtener historial de pagos: ${gastosError.message}`);
    }

    if (!gastos || gastos.length === 0) {
      return [];
    }

    // Obtener los vencimientos asociados a cada gasto
    const gastoIds = gastos.map((g) => g.id);
    const { data: vencimientos, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .select('gasto_registral_id, monto, formularios(numero)')
      .in('gasto_registral_id', gastoIds);

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
    }

    // Agrupar vencimientos por gasto_registral_id
    const vencByGasto = new Map<number, { numero: string; monto: number }[]>();
    for (const v of vencimientos || []) {
      if (!v.gasto_registral_id) continue;
      if (!vencByGasto.has(v.gasto_registral_id)) {
        vencByGasto.set(v.gasto_registral_id, []);
      }
      // @ts-expect-error - Supabase join returns nested object
      const numero = v.formularios?.numero || 'N/A';
      vencByGasto.get(v.gasto_registral_id)!.push({
        numero,
        monto: Number(v.monto),
      });
    }

    // Combinar gastos con sus formularios
    return gastos.map((g) => ({
      ...g,
      formularios: vencByGasto.get(g.id) || [],
    }));
  },

  // Ver formularios pendientes agrupados por año
  verPendientesPorAnio: async (): Promise<
    { anio: number; cantidad_formularios: number; ejemplo_numeros: string[] }[]
  > => {
    const { data, error } = await supabase.rpc('ver_formularios_pendientes_por_anio');

    if (error) {
      throw new Error(`Error al ver pendientes por año: ${error.message}`);
    }

    return data || [];
  },

  // Marcar formularios históricos como pagados (para migración de datos)
  marcarHistoricosPagados: async (
    anioLimite: number = 2025
  ): Promise<{ formularios_actualizados: number; detalle: unknown[] }> => {
    const { data, error } = await supabase.rpc('marcar_formularios_historicos_pagados', {
      p_anio_limite: anioLimite,
    });

    if (error) {
      throw new Error(`Error al marcar históricos: ${error.message}`);
    }

    if (data && data.length > 0) {
      return {
        formularios_actualizados: data[0].formularios_actualizados,
        detalle: data[0].detalle || [],
      };
    }

    return { formularios_actualizados: 0, detalle: [] };
  },
};
