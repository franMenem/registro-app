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
  ControlPendiente,
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

  createRentasDiario: async (payload: {
    fecha: string;
    values: any;
    entregado: number;
  }): Promise<{ message: string; data: any }> => {
    const { data } = await api.post('/movimientos/rentas-diario', payload);
    return data;
  },

  createCajaDiario: async (payload: {
    fecha: string;
    values: any;
    entregado: number;
  }): Promise<{ message: string; data: any }> => {
    const { data } = await api.post('/movimientos/caja-diario', payload);
    return data;
  },

  update: async (id: number, movimiento: Partial<MovimientoCreate>): Promise<Movimiento> => {
    const { data } = await api.put<ApiResponse<Movimiento>>(`/movimientos/${id}`, movimiento);
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/movimientos/${id}`);
  },

  importarCSV: async (contenido: string): Promise<{
    insertados: number;
    errores: string[];
    registros_procesados: number;
  }> => {
    const { data } = await api.post<ApiResponse<{
      insertados: number;
      errores: string[];
      registros_procesados: number;
    }>>('/movimientos/import', { contenido });
    return data.data;
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

  createMovimiento: async (
    cuentaId: number,
    datos: {
      fecha: string;
      tipo_movimiento: 'INGRESO' | 'EGRESO';
      concepto: string;
      monto: number;
    }
  ): Promise<MovimientoCC> => {
    const { data } = await api.post<ApiResponse<MovimientoCC>>(
      `/cuentas/${cuentaId}/movimientos`,
      datos
    );
    return data.data;
  },

  updateMovimiento: async (
    movimientoId: number,
    datos: { monto?: number; concepto?: string; fecha?: string }
  ): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(
      `/cuentas/movimientos/${movimientoId}`,
      datos
    );
    return data;
  },

  deleteMovimiento: async (movimientoId: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/cuentas/movimientos/${movimientoId}`);
    return data;
  },

  importarCSV: async (cuentaId: number, contenido: string): Promise<{ insertados: number; errores: string[] }> => {
    const { data } = await api.post<{ insertados: number; errores: string[] }>(
      `/cuentas/${cuentaId}/importar`,
      { contenido }
    );
    return data;
  },

  limpiarCuenta: async (cuentaId: number): Promise<{ message: string; movimientos_eliminados: number }> => {
    const { data } = await api.delete<{ success: boolean; message: string; movimientos_eliminados: number }>(
      `/cuentas/${cuentaId}/limpiar`
    );
    return data;
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

  updateMontoSemanal: async (id: number, monto: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/semanales/${id}/monto`, {
      monto,
    });
    return data;
  },

  updateMontoQuincenal: async (id: number, monto: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/quincenales/${id}/monto`, {
      monto,
    });
    return data;
  },

  deleteSemanal: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/controles/semanales/${id}`);
    return data;
  },

  deleteQuincenal: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/controles/quincenales/${id}`);
    return data;
  },

  pagarSemanal: async (id: number, fechaPago: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/semanales/${id}/pagar`, {
      fecha_pago: fechaPago,
    });
    return data;
  },

  pagarQuincenal: async (id: number, fechaPago: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/quincenales/${id}/pagar`, {
      fecha_pago: fechaPago,
    });
    return data;
  },

  desmarcarPagoSemanal: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/semanales/${id}/desmarcar-pago`);
    return data;
  },

  desmarcarPagoQuincenal: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/controles/quincenales/${id}/desmarcar-pago`);
    return data;
  },
};

// Dashboard
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return data.data;
  },

  getControlesPendientes: async (): Promise<ControlPendiente[]> => {
    const { data } = await api.get<ApiResponse<ControlPendiente[]>>('/dashboard/controles-pendientes');
    return data.data;
  },

  getAlertasPagos: async (): Promise<ControlPendiente[]> => {
    const { data } = await api.get<ApiResponse<ControlPendiente[]>>('/dashboard/alertas-pagos');
    return data.data;
  },
};

// Depósitos
export const depositosApi = {
  getAll: async (filters?: {
    estado?: string;
    cuenta_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<import('@/types').Deposito[]> => {
    const { data } = await api.get<import('@/types').ApiResponse<import('@/types').Deposito[]>>('/depositos', {
      params: filters,
    });
    return data.data;
  },

  getById: async (id: number): Promise<import('@/types').Deposito> => {
    const { data } = await api.get<import('@/types').ApiResponse<import('@/types').Deposito>>(`/depositos/${id}`);
    return data.data;
  },

  getNoAsociados: async (): Promise<import('@/types').Deposito[]> => {
    const { data } = await api.get<import('@/types').ApiResponse<import('@/types').Deposito[]>>('/depositos/no-asociados');
    return data.data;
  },

  getEstadisticas: async (): Promise<import('@/types').DepositoEstadisticas> => {
    const { data } = await api.get<import('@/types').ApiResponse<import('@/types').DepositoEstadisticas>>('/depositos/estadisticas');
    return data.data;
  },

  create: async (deposito: import('@/types').DepositoCreate): Promise<{ message: string; data: import('@/types').Deposito }> => {
    const { data } = await api.post<import('@/types').ApiResponse<import('@/types').Deposito>>('/depositos', deposito);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: Partial<import('@/types').Deposito>): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/depositos/${id}`);
    return data;
  },

  liquidar: async (id: number, fechaUso: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}/liquidar`, {
      fecha_uso: fechaUso,
    });
    return data;
  },

  marcarAFavor: async (id: number, saldoRestante: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}/a-favor`, {
      saldo_restante: saldoRestante,
    });
    return data;
  },

  devolver: async (id: number, fechaDevolucion: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}/devolver`, {
      fecha_devolucion: fechaDevolucion,
    });
    return data;
  },

  usarSaldo: async (id: number, monto: number, tipoUso: 'CAJA' | 'RENTAS', descripcion?: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}/usar-saldo`, {
      monto,
      tipo_uso: tipoUso,
      descripcion,
    });
    return data;
  },

  asociarCuenta: async (id: number, cuentaId: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/depositos/${id}/asociar-cuenta`, {
      cuenta_id: cuentaId,
    });
    return data;
  },

  desasociarCuenta: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>(`/depositos/${id}/desasociar`);
    return data;
  },

  sincronizarMovimientos: async (): Promise<{
    procesados: number;
    movimientos_creados: number;
    message: string;
  }> => {
    const { data } = await api.post('/depositos/sincronizar-movimientos');
    return {
      procesados: data.data.procesados,
      movimientos_creados: data.data.movimientos_creados,
      message: data.message,
    };
  },
};

// Gastos Registrales
export const gastosRegistralesApi = {
  getAll: async (filters?: {
    mes?: number;
    anio?: number;
    concepto?: string;
    estado?: string;
  }): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/gastos-registrales', {
      params: filters,
    });
    return data.data;
  },

  getById: async (id: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/gastos-registrales/${id}`);
    return data.data;
  },

  getResumen: async (mes: number, anio: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/gastos-registrales/resumen/${mes}/${anio}`);
    return data.data;
  },

  getPendientes: async (mes: number, anio: number): Promise<string[]> => {
    const { data } = await api.get<ApiResponse<string[]>>(`/gastos-registrales/pendientes/${mes}/${anio}`);
    return data.data;
  },

  create: async (gasto: any): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/gastos-registrales', gasto);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: any): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/gastos-registrales/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/gastos-registrales/${id}`);
    return data;
  },

  importarCSV: async (contenido: string): Promise<{
    insertados: number;
    errores: string[];
    registros_procesados: number;
  }> => {
    const { data } = await api.post<ApiResponse<{
      insertados: number;
      errores: string[];
      registros_procesados: number;
    }>>('/gastos-registrales/import', { contenido });
    return data.data;
  },
};

// Adelantos
export const adelantosApi = {
  getPorEmpleado: async (empleado: 'DAMI' | 'MUMI'): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>(`/adelantos/${empleado}`);
    return data.data;
  },

  getResumen: async (empleado: 'DAMI' | 'MUMI'): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/adelantos/resumen/${empleado}`);
    return data.data;
  },

  getPendientes: async (): Promise<{ dami: number; mumi: number }> => {
    const { data } = await api.get<ApiResponse<{ dami: number; mumi: number }>>('/adelantos/pendientes');
    return data.data;
  },

  create: async (adelanto: any): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/adelantos', adelanto);
    return { message: data.message || '', data: data.data };
  },

  marcarDescontado: async (id: number, fechaDescuento: string): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/adelantos/${id}/descontar`, {
      fecha_descuento: fechaDescuento,
    });
    return data;
  },

  update: async (id: number, datos: any): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/adelantos/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/adelantos/${id}`);
    return data;
  },
};

// Control POSNET Diario
export const posnetDiarioApi = {
  getRegistrosMes: async (mes: number, anio: number): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/posnet-diario', {
      params: { mes, anio },
    });
    return data.data;
  },

  getResumen: async (mes: number, anio: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/posnet-diario/resumen/${mes}/${anio}`);
    return data.data;
  },

  actualizarMontoIngresado: async (id: number, monto: number): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/posnet-diario/${id}/banco`, {
      monto_ingresado_banco: monto,
    });
    return data;
  },

  importarCSV: async (contenido: string): Promise<{
    insertados: number;
    actualizados: number;
    errores: string[];
    registros_procesados: number;
  }> => {
    const { data } = await api.post<ApiResponse<{
      insertados: number;
      actualizados: number;
      errores: string[];
      registros_procesados: number;
    }>>('/posnet-diario/import', { contenido });
    return data.data;
  },
};

// Formularios
export const formulariosApi = {
  getAll: async (): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/formularios');
    return data.data;
  },

  getById: async (id: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/formularios/${id}`);
    return data.data;
  },

  getVencimientosPendientes: async (): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/formularios/vencimientos/pendientes');
    return data.data;
  },

  getResumen: async (): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>('/formularios/resumen');
    return data.data;
  },

  create: async (formulario: any): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/formularios', formulario);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: any): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/formularios/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/formularios/${id}`);
    return data;
  },

  pagarVencimientos: async (
    vencimientoIds: number[],
    fechaPago: string
  ): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/formularios/pagar-vencimientos', {
      vencimiento_ids: vencimientoIds,
      fecha_pago: fechaPago,
    });
    return { message: data.message || '', data: data.data };
  },

  importarCSV: async (contenido: string): Promise<{ insertados: number; errores: string[] }> => {
    const { data } = await api.post<{ insertados: number; errores: string[] }>("/formularios/importar", { contenido });
    return data;
  },
};

// Clientes
export const clientesApi = {
  getAll: async (search?: string): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/clientes', {
      params: { search },
    });
    return data.data;
  },

  getById: async (id: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/clientes/${id}`);
    return data.data;
  },

  getByCUIT: async (cuit: string): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/clientes/cuit/${cuit}`);
    return data.data;
  },

  buscar: async (termino: string): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>(`/clientes/buscar/${termino}`);
    return data.data;
  },

  create: async (cliente: any): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/clientes', cliente);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: any): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/clientes/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/clientes/${id}`);
    return data;
  },

  getConDepositos: async (id: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/clientes/${id}/depositos`);
    return data.data;
  },

  getResumen: async (): Promise<{
    total_clientes: number;
    clientes_con_depositos: number;
    total_depositado: number;
  }> => {
    const { data } = await api.get<
      ApiResponse<{
        total_clientes: number;
        clientes_con_depositos: number;
        total_depositado: number;
      }>
    >('/clientes/resumen');
    return data.data;
  },
};

// Gastos Personales
export const gastosPersonalesApi = {
  getAll: async (filters?: {
    mes?: number;
    anio?: number;
    concepto?: string;
    estado?: string;
  }): Promise<any[]> => {
    const { data } = await api.get<ApiResponse<any[]>>('/gastos-personales', {
      params: filters,
    });
    return data.data;
  },

  getById: async (id: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/gastos-personales/${id}`);
    return data.data;
  },

  getResumen: async (mes: number, anio: number): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>(`/gastos-personales/resumen/${mes}/${anio}`);
    return data.data;
  },

  getPendientes: async (mes: number, anio: number): Promise<string[]> => {
    const { data } = await api.get<ApiResponse<string[]>>(`/gastos-personales/pendientes/${mes}/${anio}`);
    return data.data;
  },

  create: async (gasto: any): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/gastos-personales', gasto);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: any): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/gastos-personales/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/gastos-personales/${id}`);
    return data;
  },

  importarCSV: async (contenido: string): Promise<{
    insertados: number;
    errores: string[];
    registros_procesados: number;
  }> => {
    const { data } = await api.post<ApiResponse<{
      insertados: number;
      errores: string[];
      registros_procesados: number;
    }>>('/gastos-personales/import', { contenido });
    return data.data;
  },
};

// VEPs
export const vepsApi = {
  getAll: async (filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo?: string;
  }): Promise<{ data: any[]; totales: any }> => {
    const { data } = await api.get('/veps', {
      params: filters,
    });
    return data;
  },

  create: async (vep: {
    fecha: string;
    monto: number;
    tipo: 'RENTAS' | 'CAJA';
    observaciones?: string;
  }): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/veps', vep);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: {
    fecha?: string;
    monto?: number;
    tipo?: string;
    observaciones?: string;
  }): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/veps/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/veps/${id}`);
    return data;
  },
};

// ePagos
export const epagosApi = {
  getAll: async (filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo?: string;
  }): Promise<{ data: any[]; totales: any }> => {
    const { data } = await api.get('/epagos', {
      params: filters,
    });
    return data;
  },

  create: async (epago: {
    fecha: string;
    monto: number;
    tipo: 'RENTAS' | 'CAJA';
    observaciones?: string;
  }): Promise<{ message: string; data: any }> => {
    const { data } = await api.post<ApiResponse<any>>('/epagos', epago);
    return { message: data.message || '', data: data.data };
  },

  update: async (id: number, datos: {
    fecha?: string;
    monto?: number;
    tipo?: string;
    observaciones?: string;
  }): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>(`/epagos/${id}`, datos);
    return data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/epagos/${id}`);
    return data;
  },
};

// Migraciones
export const migracionApi = {
  migrarVepsYEpagos: async (): Promise<{
    veps_migrados: number;
    epagos_migrados: number;
    errores: string[];
    message: string;
  }> => {
    const { data } = await api.post('/migracion/veps-epagos');
    return {
      veps_migrados: data.data.veps_migrados,
      epagos_migrados: data.data.epagos_migrados,
      errores: data.data.errores,
      message: data.message,
    };
  },
};

// Reportes
export const reportesApi = {
  // Depósitos
  getDepositosPorPeriodo: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    estado?: string;
  }): Promise<any[]> => {
    const { data } = await api.get('/reportes/depositos/periodo', { params: filtros });
    return data;
  },

  getDepositosPorEstado: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<any[]> => {
    const { data } = await api.get('/reportes/depositos/estado', { params: filtros });
    return data;
  },

  getDepositosPorCliente: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    cliente_id?: number;
  }): Promise<any[]> => {
    const { data } = await api.get('/reportes/depositos/cliente', { params: filtros });
    return data;
  },

  getTopDepositos: async (limit: number = 10): Promise<any[]> => {
    const { data } = await api.get('/reportes/depositos/top', { params: { limit } });
    return data;
  },

  // Cuentas Corrientes
  getBalanceCuentas: async (): Promise<any[]> => {
    const { data } = await api.get('/reportes/cuentas/balance');
    return data;
  },

  getMovimientosCuentaPorPeriodo: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    cuenta_id?: number;
  }): Promise<any[]> => {
    const { data } = await api.get('/reportes/cuentas/movimientos-periodo', { params: filtros });
    return data;
  },

  getEvolucionSaldos: async (
    cuenta_id: number,
    fecha_desde?: string,
    fecha_hasta?: string
  ): Promise<any[]> => {
    const { data } = await api.get(`/reportes/cuentas/${cuenta_id}/evolucion`, {
      params: { fecha_desde, fecha_hasta },
    });
    return data;
  },

  getCuentasConSaldoNegativo: async (): Promise<any[]> => {
    const { data } = await api.get('/reportes/cuentas/saldo-negativo');
    return data;
  },

  // Clientes
  getClientesConMasDepositos: async (limit: number = 10): Promise<any[]> => {
    const { data } = await api.get('/reportes/clientes/top-depositos', { params: { limit } });
    return data;
  },

  getClientesConSaldosActivos: async (): Promise<any[]> => {
    const { data } = await api.get('/reportes/clientes/saldos-activos');
    return data;
  },

  // Financiero
  getResumenMensual: async (anio: number, mes: number): Promise<any[]> => {
    const { data } = await api.get('/reportes/financiero/resumen-mensual', {
      params: { anio, mes },
    });
    return data;
  },

  getComparativaMensual: async (anio: number): Promise<any[]> => {
    const { data } = await api.get('/reportes/financiero/comparativa-mensual', {
      params: { anio },
    });
    return data;
  },

  getFlujoCajaProyectado: async (): Promise<any[]> => {
    const { data } = await api.get('/reportes/financiero/flujo-caja');
    return data;
  },

  getTopMovimientos: async (limit: number = 10): Promise<any[]> => {
    const { data } = await api.get('/reportes/financiero/top-movimientos', { params: { limit } });
    return data;
  },
};

export default api;
