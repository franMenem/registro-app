import { supabase } from '../../lib/supabase';

// Types
type Empleado = 'DAMI' | 'MUMI';

export interface Adelanto {
  id: number;
  empleado: Empleado;
  fecha_adelanto: string;
  monto: number;
  estado: string;
  fecha_descuento: string | null;
  observaciones: string | null;
  origen: string;
  created_at: string;
}

export interface AdelantoCreate {
  empleado: Empleado;
  fecha_adelanto: string;
  monto: number;
  observaciones?: string;
  origen?: string;
}

export interface AdelantoResumen {
  total_pendiente: number;
  total_descontado: number;
  cantidad_pendientes: number;
  cantidad_descontados: number;
  adelantos: Adelanto[];
  // Additional properties used by the UI
  pendientes_mes_actual: number;
  total_anio_actual: number;
  total_historico: number;
  adelantos_pendientes: Adelanto[];
  adelantos_descontados: Adelanto[];
}

export const adelantosApi = {
  /**
   * Obtener adelantos por empleado
   */
  getPorEmpleado: async (empleado: Empleado): Promise<Adelanto[]> => {
    const { data, error } = await supabase
      .from('adelantos_empleados')
      .select('*')
      .eq('empleado', empleado)
      .order('fecha_adelanto', { ascending: false });

    if (error) throw new Error(error.message);
    return data as Adelanto[];
  },

  /**
   * Obtener resumen de adelantos por empleado
   */
  getResumen: async (empleado: Empleado): Promise<AdelantoResumen> => {
    const adelantos = await adelantosApi.getPorEmpleado(empleado);

    const pendientes = adelantos.filter((a) => a.estado === 'Pendiente');
    const descontados = adelantos.filter((a) => a.estado === 'Descontado');

    // Current month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endOfMonth =
      currentMonth === 12
        ? `${currentYear + 1}-01-01`
        : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

    const pendientesMesActual = pendientes.filter(
      (a) => a.fecha_adelanto >= startOfMonth && a.fecha_adelanto < endOfMonth
    );

    // Current year
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear + 1}-01-01`;

    const adelantosAnio = adelantos.filter(
      (a) => a.fecha_adelanto >= startOfYear && a.fecha_adelanto < endOfYear
    );

    return {
      total_pendiente: pendientes.reduce((sum, a) => sum + Number(a.monto), 0),
      total_descontado: descontados.reduce((sum, a) => sum + Number(a.monto), 0),
      cantidad_pendientes: pendientes.length,
      cantidad_descontados: descontados.length,
      adelantos,
      pendientes_mes_actual: pendientesMesActual.reduce((sum, a) => sum + Number(a.monto), 0),
      total_anio_actual: adelantosAnio.reduce((sum, a) => sum + Number(a.monto), 0),
      total_historico: adelantos.reduce((sum, a) => sum + Number(a.monto), 0),
      adelantos_pendientes: pendientes,
      adelantos_descontados: descontados,
    };
  },

  /**
   * Obtener totales pendientes de ambos empleados
   */
  getPendientes: async (): Promise<{ dami: number; mumi: number }> => {
    const { data, error } = await supabase
      .from('adelantos_empleados')
      .select('empleado, monto')
      .eq('estado', 'Pendiente');

    if (error) throw new Error(error.message);

    const dami = (data || [])
      .filter((a) => a.empleado === 'DAMI')
      .reduce((sum, a) => sum + Number(a.monto), 0);
    const mumi = (data || [])
      .filter((a) => a.empleado === 'MUMI')
      .reduce((sum, a) => sum + Number(a.monto), 0);

    return { dami, mumi };
  },

  /**
   * Crear nuevo adelanto
   */
  create: async (adelanto: AdelantoCreate): Promise<{ message: string; data: Adelanto }> => {
    const { data, error } = await supabase
      .from('adelantos_empleados')
      .insert({
        empleado: adelanto.empleado,
        fecha_adelanto: adelanto.fecha_adelanto,
        monto: adelanto.monto,
        observaciones: adelanto.observaciones || null,
        estado: 'Pendiente',
        origen: adelanto.origen || 'MANUAL',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Adelanto registrado correctamente', data: data as Adelanto };
  },

  /**
   * Marcar adelanto como descontado
   */
  marcarDescontado: async (
    id: number,
    fechaDescuento: string
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('adelantos_empleados')
      .update({
        estado: 'Descontado',
        fecha_descuento: fechaDescuento,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Adelanto marcado como descontado' };
  },

  /**
   * Actualizar adelanto
   */
  update: async (
    id: number,
    datos: Partial<AdelantoCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('adelantos_empleados')
      .update(datos)
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Adelanto actualizado correctamente' };
  },

  /**
   * Eliminar adelanto
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('adelantos_empleados')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Adelanto eliminado correctamente' };
  },
};
