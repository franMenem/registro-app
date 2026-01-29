import gastosRegistralesService from './gastos-registrales.service';
import adelantosService from './adelantos.service';
import { ConceptoGastoRegistral } from '../types/gastos-registrales.types';

/**
 * Servicio de Integraciones
 * Principio Open/Closed: Extensible sin modificar código existente
 * Principio Single Responsibility: Solo maneja las integraciones entre módulos
 */
export class IntegracionesService {
  /**
   * Mapeo de conceptos del Formulario CAJA a Gastos Registrales
   */
  private readonly MAPEO_CAJA_A_GR: Record<
    string,
    {
      concepto: ConceptoGastoRegistral;
      observacion?: string;
    }
  > = {
    LIBRERIA: { concepto: 'LIBRERIA' },
    AGUA: { concepto: 'AGUA' },
    'CARGAS SOCIALES': { concepto: 'CARGAS_SOCIALES' },
    EDESUR: { concepto: 'EDESUR' },
    ACARA: { concepto: 'ACARA' },
    'REPO CAJA CHICA': { concepto: 'OTROS', observacion: 'Repo Caja Chica' },
    'REPO RENTAS CHICA': { concepto: 'OTROS', observacion: 'Repo Rentas Chica' },
  };

  /**
   * Procesar integración del Formulario CAJA → Gastos Registrales + Adelantos
   * Usa transacción implícita: si algo falla, se propaga el error y no se guarda nada
   */
  procesarFormularioCaja(fecha: string, conceptos: Record<string, number>): {
    gastosCreados: number;
    adelantosCreados: number;
  } {
    let gastosCreados = 0;
    let adelantosCreados = 0;

    try {
      // 1. Procesar conceptos que van a Gastos Registrales
      for (const [nombreConcepto, monto] of Object.entries(conceptos)) {
        if (monto > 0) {
          const mapeo = this.MAPEO_CAJA_A_GR[nombreConcepto];

          if (mapeo) {
            gastosRegistralesService.crear({
              fecha,
              concepto: mapeo.concepto,
              monto,
              observaciones: mapeo.observacion || 'Desde Formulario CAJA',
              origen: 'CAJA',
              estado: 'Pagado',
            });
            gastosCreados++;
          }
        }
      }

      // 2. Procesar adelantos de DAMI
      if (conceptos['DAMI'] && conceptos['DAMI'] > 0) {
        adelantosService.crear({
          empleado: 'DAMI',
          fecha_adelanto: fecha,
          monto: conceptos['DAMI'],
          observaciones: 'Desde Formulario CAJA',
          origen: 'CAJA',
        });
        adelantosCreados++;
      }

      // 3. Procesar adelantos de MUMI
      if (conceptos['MUMI'] && conceptos['MUMI'] > 0) {
        adelantosService.crear({
          empleado: 'MUMI',
          fecha_adelanto: fecha,
          monto: conceptos['MUMI'],
          observaciones: 'Desde Formulario CAJA',
          origen: 'CAJA',
        });
        adelantosCreados++;
      }

      return { gastosCreados, adelantosCreados };
    } catch (error) {
      // Si algo falla, propagar el error para que el controlador maneje el rollback
      throw error;
    }
  }

  /**
   * Verificar si un concepto debe integrarse con Gastos Registrales
   */
  debeIntegrarseConGR(nombreConcepto: string): boolean {
    return !!this.MAPEO_CAJA_A_GR[nombreConcepto];
  }

  /**
   * Verificar si un concepto es un adelanto
   */
  esAdelanto(nombreConcepto: string): boolean {
    return nombreConcepto === 'DAMI' || nombreConcepto === 'MUMI';
  }
}

export default new IntegracionesService();
