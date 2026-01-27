import axios, { AxiosError } from 'axios';
import {
  Movimiento,
  MovimientoCreate,
  Concepto,
  CuentaCorriente,
  MovimientoCC,
  ControlSemanal,
  ControlQuincenal,
  DashboardStats,
  ApiResponse,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message: string }>) => {
    const message = error.response?.data?.message || 'Error en la solicitud';
    return Promise.reject(new Error(message));
  }
);

// Movimientos
export const movimientosApi = {
  getAll: async (filters?: {
    tipo?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    concepto_id?: number;
  }): Promise<Movimiento[]> => {
    const { data } = await api.get<ApiResponse<Movimiento[]>>('/movimientos', {
      params: filters,
    });
    return data.data;
  },

  getById: async (id: number): Promise<Movimiento> => {
    const { data } = await api.get<ApiResponse<Movimiento>>(`/movimientos/${id}`);
    return data.data;
  },

  create: async (movimiento: MovimientoCreate): Promise<ApiResponse<Movimiento>> => {
    const { data } = await api.post<ApiResponse<Movimiento>>('/movimientos', movimiento);
    return data;
  },

  update: async (id: number, movimiento: Partial<MovimientoCreate>): Promise<Movimiento> => {
    const { data } = await api.put<ApiResponse<Movimiento>>(`/movimientos/${id}`, movimiento);
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/movimientos/${id}`);
  },
};

// Conceptos
export const conceptosApi = {
  getAll: async (tipo?: string): Promise<Concepto[]> => {
    const { data } = await api.get<ApiResponse<Concepto[]>>('/conceptos', {
      params: { tipo },
    });
    return data.data;
  },
};

// Cuentas Corrientes
export const cuentasApi = {
  getAll: async (): Promise<CuentaCorriente[]> => {
    const { data } = await api.get<ApiResponse<CuentaCorriente[]>>('/cuentas');
    return data.data;
  },

  getById: async (id: number): Promise<CuentaCorriente> => {
    const { data } = await api.get<ApiResponse<CuentaCorriente>>(`/cuentas/${id}`);
    return data.data;
  },

  getMovimientos: async (
    id: number,
    filters?: {
      fecha_desde?: string;
      fecha_hasta?: string;
    }
  ): Promise<MovimientoCC[]> => {
    const { data } = await api.get<ApiResponse<MovimientoCC[]>>(`/cuentas/${id}/movimientos`, {
      params: filters,
    });
    return data.data;
  },
};

// Controles
export const controlesApi = {
  getSemanales: async (filters?: {
    concepto_id?: number;
    pagado?: boolean;
  }): Promise<ControlSemanal[]> => {
    const { data } = await api.get<ApiResponse<ControlSemanal[]>>('/controles/semanales', {
      params: filters,
    });
    return data.data;
  },

  getQuincenales: async (filters?: {
    concepto_id?: number;
    pagado?: boolean;
  }): Promise<ControlQuincenal[]> => {
    const { data } = await api.get<ApiResponse<ControlQuincenal[]>>('/controles/quincenales', {
      params: filters,
    });
    return data.data;
  },
};

// Dashboard
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return data.data;
  },
};

export default api;
