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
    const formIds = formularios.map((f) => f.id);
    const { data: vencimientos, error: vencError } = await supabase
      .from('formularios_vencimientos')
      .select('*')
      .in('formulario_id', formIds)
      .order('numero_vencimiento', { ascending: true });

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
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
      .select('formulario_id, monto, estado');

    if (vencError) {
      throw new Error(`Error al obtener vencimientos: ${vencError.message}`);
    }

    const totalFormularios = formularios?.length || 0;
    const totalVencimientos = vencimientos?.length || 0;

    // Calculate stats from vencimientos
    let vencimientosPendientes = 0;
    let montoPendiente = 0;
    let vencimientosPagados = 0;
    let montoPagado = 0;
    const formulariosConDeuda = new Set<number>();

    for (const v of vencimientos || []) {
      if (v.estado === 'PENDIENTE' || v.estado === 'VENCIDO') {
        vencimientosPendientes++;
        montoPendiente += Number(v.monto);
        formulariosConDeuda.add(v.formulario_id);
      } else if (v.estado === 'PAGADO') {
        vencimientosPagados++;
        montoPagado += Number(v.monto);
      }
    }

    // saldo_pendiente_formularios is the sum of monto from formularios that have pending vencimientos
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

    // Get the vencimientos to pay
    const { data: vencimientos, error: fetchError } = await supabase
      .from('formularios_vencimientos')
      .select('id, monto, estado')
      .in('id', vencimientoIds);

    if (fetchError) {
      throw new Error(`Error al obtener vencimientos: ${fetchError.message}`);
    }

    // Calculate total
    let totalPagado = 0;
    for (const v of vencimientos || []) {
      if (v.estado === 'PAGADO') {
        throw new Error('Uno de los vencimientos ya está pagado');
      }
      totalPagado += Number(v.monto);
    }

    // Create gasto_registral (CARCOS)
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos_registrales')
      .insert({
        tipo: 'CARCOS',
        descripcion: `Pago de ${vencimientoIds.length} vencimiento(s) de formularios`,
        monto: totalPagado,
        fecha: fechaPago,
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
};
