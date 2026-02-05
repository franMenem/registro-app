// Supabase service for Control POSNET Diario
// Aggregates POSNET data from movimientos table by date

import { supabase } from '@/lib/supabase';

// Types
export interface RegistroPosnet {
  id: number;
  fecha: string;
  monto_rentas: number;
  monto_caja: number;
  total_posnet: number;
  monto_ingresado_banco: number;
  diferencia: number;
  created_at: string;
  updated_at: string;
}

export interface ResumenMensual {
  mes: number;
  anio: number;
  total_dias: number;
  total_rentas: number;
  total_caja: number;
  total_posnet: number;
  total_ingresado: number;
  diferencia_acumulada: number;
  dias_ok: number;
  dias_falta_ingresar: number;
  dias_error: number;
}

export interface ImportResult {
  insertados: number;
  actualizados: number;
  errores: string[];
  registros_procesados: number;
}

export const posnetDiarioApi = {
  // Get all records for a specific month directly from control_posnet_diario table
  getRegistrosMes: async (mes: number, anio: number): Promise<RegistroPosnet[]> => {
    // Calculate date range for the month
    const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    // Get all records directly from control_posnet_diario
    const { data, error } = await supabase
      .from('control_posnet_diario')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener registros POSNET: ${error.message}`);
    }

    // Map to RegistroPosnet format
    return (data || []).map((d) => ({
      id: d.id,
      fecha: d.fecha,
      monto_rentas: Number(d.monto_rentas) || 0,
      monto_caja: Number(d.monto_caja) || 0,
      total_posnet: Number(d.total_posnet) || 0,
      monto_ingresado_banco: Number(d.monto_ingresado_banco) || 0,
      diferencia: Number(d.diferencia) || 0,
      created_at: d.created_at || new Date().toISOString(),
      updated_at: d.updated_at || new Date().toISOString(),
    }));
  },

  // Get monthly summary
  getResumen: async (mes: number, anio: number): Promise<ResumenMensual> => {
    // Get all records for the month
    const registros = await posnetDiarioApi.getRegistrosMes(mes, anio);

    // Calculate stats
    let totalRentas = 0;
    let totalCaja = 0;
    let totalPosnet = 0;
    let totalIngresado = 0;
    let diferencia_acumulada = 0;
    let diasOk = 0;
    let diasFaltaIngresar = 0;
    let diasError = 0;

    for (const reg of registros) {
      totalRentas += Number(reg.monto_rentas) || 0;
      totalCaja += Number(reg.monto_caja) || 0;
      totalPosnet += Number(reg.total_posnet) || 0;
      totalIngresado += Number(reg.monto_ingresado_banco) || 0;

      const dif = Number(reg.diferencia) || 0;
      diferencia_acumulada += dif;

      if (dif === 0) {
        diasOk++;
      } else if (dif > 0) {
        diasFaltaIngresar++;
      } else {
        diasError++;
      }
    }

    return {
      mes,
      anio,
      total_dias: registros.length,
      total_rentas: totalRentas,
      total_caja: totalCaja,
      total_posnet: totalPosnet,
      total_ingresado: totalIngresado,
      diferencia_acumulada,
      dias_ok: diasOk,
      dias_falta_ingresar: diasFaltaIngresar,
      dias_error: diasError,
    };
  },

  // Update the bank deposit amount for a record by fecha
  // Uses upsert since the record might not exist in control_posnet_diario yet
  actualizarMontoIngresado: async (
    fecha: string,
    monto: number,
    totalPosnet: number
  ): Promise<{ message: string }> => {
    const nuevaDiferencia = totalPosnet - monto;

    // Check if record exists
    const { data: existing } = await supabase
      .from('control_posnet_diario')
      .select('id')
      .eq('fecha', fecha)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('control_posnet_diario')
        .update({
          monto_ingresado_banco: monto,
          diferencia: nuevaDiferencia,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Error al actualizar monto: ${error.message}`);
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('control_posnet_diario')
        .insert({
          fecha,
          monto_rentas: 0,
          monto_caja: 0,
          total_posnet: totalPosnet,
          monto_ingresado_banco: monto,
          diferencia: nuevaDiferencia,
        });

      if (error) {
        throw new Error(`Error al crear registro: ${error.message}`);
      }
    }

    return { message: 'Monto actualizado correctamente' };
  },

  // Import records from CSV
  importarCSV: async (contenido: string): Promise<ImportResult> => {
    const lines = contenido.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo CSV debe tener al menos una línea de datos');
    }

    // Skip header
    const dataLines = lines.slice(1);
    const errores: string[] = [];
    let insertados = 0;
    let actualizados = 0;
    let registros_procesados = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        // Expected format: fecha,monto_ingresado_banco
        const parts = line.split(',');
        if (parts.length < 2) {
          errores.push(`Línea ${i + 2}: Formato inválido (faltan columnas)`);
          continue;
        }

        const [fecha, montoStr] = parts;
        const monto = parseFloat(montoStr) || 0;

        // Check if record exists for this date
        const { data: existing, error: checkError } = await supabase
          .from('control_posnet_diario')
          .select('id, total_posnet')
          .eq('fecha', fecha.trim())
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 = no rows found
          errores.push(`Línea ${i + 2}: ${checkError.message}`);
          continue;
        }

        if (existing) {
          // Update existing record
          const nuevaDiferencia = (existing.total_posnet || 0) - monto;
          const { error: updateError } = await supabase
            .from('control_posnet_diario')
            .update({
              monto_ingresado_banco: monto,
              diferencia: nuevaDiferencia,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            errores.push(`Línea ${i + 2}: ${updateError.message}`);
            continue;
          }

          actualizados++;
        } else {
          // Insert new record (without RENTAS/CAJA data - those come from forms)
          const { error: insertError } = await supabase
            .from('control_posnet_diario')
            .insert({
              fecha: fecha.trim(),
              monto_rentas: 0,
              monto_caja: 0,
              total_posnet: 0,
              monto_ingresado_banco: monto,
              diferencia: -monto, // negative since we have no POSNET amount yet
            });

          if (insertError) {
            errores.push(`Línea ${i + 2}: ${insertError.message}`);
            continue;
          }

          insertados++;
        }

        registros_procesados++;
      } catch (err) {
        errores.push(`Línea ${i + 2}: Error inesperado`);
      }
    }

    return { insertados, actualizados, errores, registros_procesados };
  },
};
