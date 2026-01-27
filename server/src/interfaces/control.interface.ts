/**
 * Interface base para controles de pago
 * Aplicando principio de Interface Segregation (SOLID)
 */
export interface IControl {
  id: number;
  concepto_id: number;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real?: string;
}

/**
 * Interface para servicios de control
 * Aplicando principio de Dependency Inversion (SOLID)
 */
export interface IControlService {
  actualizarControl(conceptoId: number, fecha: Date, monto: number): Promise<void>;
}

/**
 * Interface para resultado de actualización de movimiento
 */
export interface IMovimientoResult {
  movimientoId: number;
  alertas: string[];
}
