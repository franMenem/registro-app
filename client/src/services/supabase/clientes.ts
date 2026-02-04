import { supabase } from '../../lib/supabase';

// Types
export interface Cliente {
  id: number;
  cuit: string;
  razon_social: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteCreate {
  cuit: string;
  razon_social: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
}

export interface ClienteConDepositos extends Cliente {
  depositos: any[];
  total_depositado: number;
  cantidad_depositos: number;
}

export interface ClienteResumen {
  total_clientes: number;
  clientes_con_depositos: number;
  total_depositado: number;
}

export const clientesApi = {
  /**
   * Obtener todos los clientes, opcionalmente filtrados por búsqueda
   */
  getAll: async (search?: string): Promise<Cliente[]> => {
    let query = supabase.from('clientes').select('*');

    if (search) {
      // Buscar por CUIT o razón social
      query = query.or(`cuit.ilike.%${search}%,razon_social.ilike.%${search}%`);
    }

    query = query.order('razon_social', { ascending: true });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as Cliente[];
  },

  /**
   * Obtener un cliente por ID
   */
  getById: async (id: number): Promise<Cliente> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Cliente;
  },

  /**
   * Obtener resumen de clientes
   */
  getResumen: async (): Promise<ClienteResumen> => {
    // Total de clientes
    const { count: total_clientes, error: countError } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new Error(countError.message);

    // Clientes con depósitos y total depositado
    const { data: depositosData, error: depositosError } = await supabase
      .from('depositos')
      .select('cliente_id, monto');

    if (depositosError) throw new Error(depositosError.message);

    const clientesConDepositos = new Set(
      depositosData?.map((d) => d.cliente_id).filter(Boolean)
    );
    const total_depositado = depositosData?.reduce(
      (sum, d) => sum + Number(d.monto),
      0
    ) || 0;

    return {
      total_clientes: total_clientes || 0,
      clientes_con_depositos: clientesConDepositos.size,
      total_depositado,
    };
  },

  /**
   * Obtener cliente con sus depósitos
   */
  getConDepositos: async (id: number): Promise<ClienteConDepositos> => {
    // Obtener cliente
    const cliente = await clientesApi.getById(id);

    // Obtener depósitos del cliente
    const { data: depositos, error: depositosError } = await supabase
      .from('depositos')
      .select('*')
      .eq('cliente_id', id)
      .order('fecha_ingreso', { ascending: false });

    if (depositosError) throw new Error(depositosError.message);

    const total_depositado = depositos?.reduce(
      (sum, d) => sum + Number(d.monto),
      0
    ) || 0;

    return {
      ...cliente,
      depositos: depositos || [],
      total_depositado,
      cantidad_depositos: depositos?.length || 0,
    };
  },

  /**
   * Crear nuevo cliente
   */
  create: async (cliente: ClienteCreate): Promise<{ message: string; data: Cliente }> => {
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        cuit: cliente.cuit,
        razon_social: cliente.razon_social,
        email: cliente.email || null,
        telefono: cliente.telefono || null,
        direccion: cliente.direccion || null,
        observaciones: cliente.observaciones || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Cliente creado correctamente', data: data as Cliente };
  },

  /**
   * Actualizar cliente existente
   */
  update: async (
    id: number,
    datos: Partial<ClienteCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('clientes')
      .update({
        ...datos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Cliente actualizado correctamente' };
  },

  /**
   * Eliminar cliente
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('clientes').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Cliente eliminado correctamente' };
  },

  /**
   * Buscar clientes por término
   */
  buscar: async (termino: string): Promise<Cliente[]> => {
    return clientesApi.getAll(termino);
  },

  /**
   * Obtener cliente por CUIT
   */
  getByCUIT: async (cuit: string): Promise<Cliente | null> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('cuit', cuit)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data as Cliente | null;
  },
};
