import db, { transaction } from '../db/database';
import controlSemanalService from './controles-semanales.service';
import controlQuincenalService from './controles-quincenales.service';
import cuentasCorrientesService from './cuentas-corrientes.service';
import vepsService from './veps.service';
import epagosService from './epagos.service';
import integracionesService from './integraciones.service';

/**
 * Servicio de Planillas
 * Maneja la visualización y edición de movimientos agrupados por día
 */
export class PlanillasService {
  /**
   * Obtiene movimientos RENTAS agrupados por día
   */
  obtenerRentasPorDia(filters?: { fechaDesde?: string; fechaHasta?: string }): any[] {
    let query = `
      SELECT
        m.fecha,
        c.nombre as concepto,
        SUM(m.monto) as monto
      FROM movimientos m
      JOIN conceptos c ON m.concepto_id = c.id
      WHERE m.tipo = 'RENTAS'
    `;

    const params: any[] = [];

    if (filters?.fechaDesde) {
      query += ' AND m.fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND m.fecha <= ?';
      params.push(filters.fechaHasta);
    }

    query += ' GROUP BY m.fecha, c.nombre ORDER BY m.fecha DESC';

    const rows = db.prepare(query).all(...params) as any[];

    // Agrupar por fecha
    const porFecha = new Map<string, any>();

    rows.forEach((row) => {
      if (!porFecha.has(row.fecha)) {
        porFecha.set(row.fecha, {
          fecha: row.fecha,
          GIT: 0,
          SUAT_ALTA: 0,
          SUAT_PATENTES: 0,
          SUAT_INFRACCIONES: 0,
          SUCERP: 0,
          SUGIT: 0,
          PROVINCIA: 0,
          CONSULTA: 0,
          POSNET: 0,
          ICBC: 0,
          FORD: 0,
          SICARDI: 0,
          PATAGONIA: 0,
          IVECO: 0,
          CNH: 0,
          GESTORIA_FORD: 0,
          ALRA: 0,
          DEPOSITOS: 0,
        });
      }

      const dia = porFecha.get(row.fecha)!;

      // Mapear conceptos a campos
      switch (row.concepto) {
        case 'GIT':
          dia.GIT = row.monto;
          break;
        case 'SUAT - Alta':
          dia.SUAT_ALTA = row.monto;
          break;
        case 'SUAT - Patentes':
          dia.SUAT_PATENTES = row.monto;
          break;
        case 'SUAT - Infracciones':
          dia.SUAT_INFRACCIONES = row.monto;
          break;
        case 'SUCERP':
          dia.SUCERP = row.monto;
          break;
        case 'SUGIT':
          dia.SUGIT = row.monto;
          break;
        case 'PROVINCIA (ARBA)':
          dia.PROVINCIA = row.monto;
          break;
        case 'Consulta':
          dia.CONSULTA = row.monto;
          break;
        case 'POSNET':
          dia.POSNET = row.monto;
          break;
        case 'ICBC':
          dia.ICBC = row.monto;
          break;
        case 'FORD':
          dia.FORD = row.monto;
          break;
        case 'SICARDI':
          dia.SICARDI = row.monto;
          break;
        case 'PATAGONIA':
          dia.PATAGONIA = row.monto;
          break;
        case 'IVECO':
          dia.IVECO = row.monto;
          break;
        case 'CNH':
          dia.CNH = row.monto;
          break;
        case 'GESTORIA FORD':
          dia.GESTORIA_FORD = row.monto;
          break;
        case 'ALRA':
          dia.ALRA = row.monto;
          break;
        case 'DEPOSITOS':
          dia.DEPOSITOS = row.monto;
          break;
      }
    });

    return Array.from(porFecha.values());
  }

  /**
   * Obtiene movimientos CAJA agrupados por día
   */
  obtenerCajaPorDia(filters?: { fechaDesde?: string; fechaHasta?: string }): any[] {
    let query = `
      SELECT
        m.fecha,
        c.nombre as concepto,
        SUM(m.monto) as monto
      FROM movimientos m
      JOIN conceptos c ON m.concepto_id = c.id
      WHERE m.tipo = 'CAJA'
    `;

    const params: any[] = [];

    if (filters?.fechaDesde) {
      query += ' AND m.fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND m.fecha <= ?';
      params.push(filters.fechaHasta);
    }

    query += ' GROUP BY m.fecha, c.nombre ORDER BY m.fecha DESC';

    const rows = db.prepare(query).all(...params) as any[];

    // Agrupar por fecha
    const porFecha = new Map<string, any>();

    rows.forEach((row) => {
      if (!porFecha.has(row.fecha)) {
        porFecha.set(row.fecha, {
          fecha: row.fecha,
          ARANCEL: 0,
          SUAT_SELLADO: 0,
          SUCERP_SELLADO: 0,
          CONSULTAS: 0,
          FORMULARIOS: 0,
          POSNET: 0,
          VEP: 0,
          EPAGOS: 0,
          LIBRERIA: 0,
          MARIA: 0,
          AGUA: 0,
          EDESUR: 0,
          TERE: 0,
          DAMI: 0,
          MUMI: 0,
          ICBC: 0,
          FORD: 0,
          SICARDI: 0,
          PATAGONIA: 0,
          IVECO: 0,
          CNH: 0,
          GESTORIA_FORD: 0,
          ALRA: 0,
          DEPOSITOS: 0,
        });
      }

      const dia = porFecha.get(row.fecha)!;

      // Mapear conceptos a campos
      switch (row.concepto) {
        case 'Arancel':
          dia.ARANCEL = row.monto;
          break;
        case 'SUAT - Sellado':
          dia.SUAT_SELLADO = row.monto;
          break;
        case 'SUCERP - Sellado':
          dia.SUCERP_SELLADO = row.monto;
          break;
        case 'Consultas CAJA':
          dia.CONSULTAS = row.monto;
          break;
        case 'Formularios':
          dia.FORMULARIOS = row.monto;
          break;
        case 'POSNET CAJA':
          dia.POSNET = row.monto;
          break;
      }
    });

    // Agregar datos de VEPs
    const vepsQuery = `
      SELECT fecha, SUM(monto) as total
      FROM control_veps
      WHERE tipo = 'CAJA'
    `;
    const vepsParams: any[] = [];
    if (filters?.fechaDesde) {
      vepsParams.push(filters.fechaDesde);
    }
    if (filters?.fechaHasta) {
      vepsParams.push(filters.fechaHasta);
    }

    const vepsRows = db.prepare(
      vepsQuery +
      (filters?.fechaDesde ? ' AND fecha >= ?' : '') +
      (filters?.fechaHasta ? ' AND fecha <= ?' : '') +
      ' GROUP BY fecha'
    ).all(...vepsParams) as any[];

    vepsRows.forEach((row) => {
      if (!porFecha.has(row.fecha)) {
        porFecha.set(row.fecha, {
          fecha: row.fecha,
          ARANCEL: 0,
          SUAT_SELLADO: 0,
          SUCERP_SELLADO: 0,
          CONSULTAS: 0,
          FORMULARIOS: 0,
          POSNET: 0,
          VEP: 0,
          EPAGOS: 0,
          LIBRERIA: 0,
          MARIA: 0,
          AGUA: 0,
          EDESUR: 0,
          TERE: 0,
          DAMI: 0,
          MUMI: 0,
          ICBC: 0,
          FORD: 0,
          SICARDI: 0,
          PATAGONIA: 0,
          IVECO: 0,
          CNH: 0,
          GESTORIA_FORD: 0,
          ALRA: 0,
          DEPOSITOS: 0,
        });
      }
      porFecha.get(row.fecha)!.VEP = row.total;
    });

    // Agregar datos de ePagos
    const epagosQuery = `
      SELECT fecha, SUM(monto) as total
      FROM control_epagos
      WHERE tipo = 'CAJA'
    `;
    const epagosParams: any[] = [];
    if (filters?.fechaDesde) {
      epagosParams.push(filters.fechaDesde);
    }
    if (filters?.fechaHasta) {
      epagosParams.push(filters.fechaHasta);
    }

    const epagosRows = db.prepare(
      epagosQuery +
      (filters?.fechaDesde ? ' AND fecha >= ?' : '') +
      (filters?.fechaHasta ? ' AND fecha <= ?' : '') +
      ' GROUP BY fecha'
    ).all(...epagosParams) as any[];

    epagosRows.forEach((row) => {
      if (!porFecha.has(row.fecha)) {
        porFecha.set(row.fecha, {
          fecha: row.fecha,
          ARANCEL: 0,
          SUAT_SELLADO: 0,
          SUCERP_SELLADO: 0,
          CONSULTAS: 0,
          FORMULARIOS: 0,
          POSNET: 0,
          VEP: 0,
          EPAGOS: 0,
          LIBRERIA: 0,
          MARIA: 0,
          AGUA: 0,
          EDESUR: 0,
          TERE: 0,
          DAMI: 0,
          MUMI: 0,
          ICBC: 0,
          FORD: 0,
          SICARDI: 0,
          PATAGONIA: 0,
          IVECO: 0,
          CNH: 0,
          GESTORIA_FORD: 0,
          ALRA: 0,
          DEPOSITOS: 0,
        });
      }
      porFecha.get(row.fecha)!.EPAGOS = row.total;
    });

    // Agregar otros gastos desde integraciones (LIBRERIA, MARIA, AGUA, EDESUR, TERE, DAMI, MUMI)
    // Estos se guardaron en gastos_registrales o gastos_personales o adelantos
    // Por ahora los dejamos en 0, se pueden agregar después si es necesario

    return Array.from(porFecha.values());
  }

  /**
   * Actualiza movimientos RENTAS de un día específico
   * Recalcula automáticamente controles semanales/quincenales
   */
  actualizarRentasDia(fecha: string, valores: any): { mensaje: string; alertas: string[] } {
    return transaction(() => {
      const alertas: string[] = [];

      // 1. Eliminar movimientos existentes de ese día
      const movimientosAnteriores = db.prepare(
        'SELECT m.id, m.monto, c.id as concepto_id, c.nombre, c.frecuencia_pago FROM movimientos m JOIN conceptos c ON m.concepto_id = c.id WHERE m.tipo = ? AND m.fecha = ?'
      ).all('RENTAS', fecha) as any[];

      // Restar montos de controles antes de eliminar
      movimientosAnteriores.forEach((mov) => {
        if (mov.frecuencia_pago === 'SEMANAL') {
          controlSemanalService.restarDelControl(mov.concepto_id, new Date(fecha), mov.monto);
        } else if (mov.frecuencia_pago === 'QUINCENAL') {
          controlQuincenalService.restarDelControl(mov.concepto_id, new Date(fecha), mov.monto);
        }
      });

      db.prepare('DELETE FROM movimientos WHERE tipo = ? AND fecha = ?').run('RENTAS', fecha);

      // 2. Insertar nuevos movimientos
      const conceptos = db.prepare('SELECT * FROM conceptos WHERE tipo = ?').all('RENTAS') as any[];
      const conceptosPorNombre = new Map(conceptos.map((c: any) => [c.nombre, c]));

      const mapeoConceptos: Record<string, string> = {
        GIT: 'GIT',
        SUAT_ALTA: 'SUAT - Alta',
        SUAT_PATENTES: 'SUAT - Patentes',
        SUAT_INFRACCIONES: 'SUAT - Infracciones',
        SUCERP: 'SUCERP',
        SUGIT: 'SUGIT',
        PROVINCIA: 'PROVINCIA (ARBA)',
        CONSULTA: 'Consulta',
        POSNET: 'POSNET',
      };

      const cuitGenerico = '00-00000000-0';

      for (const [campo, conceptoNombre] of Object.entries(mapeoConceptos)) {
        const valor = valores[campo] || 0;
        if (valor > 0) {
          const concepto = conceptosPorNombre.get(conceptoNombre);
          if (concepto) {
            db.prepare(
              'INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(fecha, 'RENTAS', cuitGenerico, concepto.id, valor, 'Actualizado desde Planillas');

            // Actualizar controles
            if (concepto.frecuencia_pago === 'SEMANAL') {
              controlSemanalService.actualizarControl(concepto.id, new Date(fecha), valor);
            } else if (concepto.frecuencia_pago === 'QUINCENAL') {
              controlQuincenalService.actualizarControl(concepto.id, new Date(fecha), valor);
            }
          }
        }
      }

      alertas.push('Movimientos RENTAS actualizados correctamente');
      alertas.push('Controles semanales/quincenales recalculados');

      return {
        mensaje: 'Actualización exitosa',
        alertas,
      };
    });
  }

  /**
   * Actualiza movimientos CAJA de un día específico
   * Recalcula automáticamente controles, VEPs, ePagos, integraciones
   */
  actualizarCajaDia(fecha: string, valores: any): { mensaje: string; alertas: string[] } {
    return transaction(() => {
      const alertas: string[] = [];

      // 1. Eliminar movimientos, VEPs y ePagos existentes de ese día
      const movimientosAnteriores = db.prepare(
        'SELECT m.id, m.monto, c.id as concepto_id, c.nombre, c.frecuencia_pago FROM movimientos m JOIN conceptos c ON m.concepto_id = c.id WHERE m.tipo = ? AND m.fecha = ?'
      ).all('CAJA', fecha) as any[];

      movimientosAnteriores.forEach((mov) => {
        if (mov.frecuencia_pago === 'SEMANAL') {
          controlSemanalService.restarDelControl(mov.concepto_id, new Date(fecha), mov.monto);
        }
      });

      db.prepare('DELETE FROM movimientos WHERE tipo = ? AND fecha = ?').run('CAJA', fecha);
      db.prepare('DELETE FROM control_veps WHERE fecha = ?').run(fecha);
      db.prepare('DELETE FROM control_epagos WHERE fecha = ?').run(fecha);

      // 2. Insertar nuevos movimientos
      const conceptos = db.prepare('SELECT * FROM conceptos WHERE tipo = ?').all('CAJA') as any[];
      const conceptosPorNombre = new Map(conceptos.map((c: any) => [c.nombre, c]));

      const mapeoConceptos: Record<string, string> = {
        ARANCEL: 'Arancel',
        SUAT_SELLADO: 'SUAT - Sellado',
        SUCERP_SELLADO: 'SUCERP - Sellado',
        CONSULTAS: 'Consultas CAJA',
        FORMULARIOS: 'Formularios',
        POSNET: 'POSNET CAJA',
      };

      const cuitGenerico = '00-00000000-0';

      for (const [campo, conceptoNombre] of Object.entries(mapeoConceptos)) {
        const valor = valores[campo] || 0;
        if (valor > 0) {
          const concepto = conceptosPorNombre.get(conceptoNombre);
          if (concepto) {
            db.prepare(
              'INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(fecha, 'CAJA', cuitGenerico, concepto.id, valor, 'Actualizado desde Planillas');

            if (concepto.frecuencia_pago === 'SEMANAL') {
              controlSemanalService.actualizarControl(concepto.id, new Date(fecha), valor);
            }
          }
        }
      }

      // 3. Procesar VEPs
      if (valores.VEP > 0) {
        vepsService.crear(fecha, valores.VEP, 'CAJA', 'Actualizado desde Planillas');
        alertas.push('VEP actualizado');
      }

      // 4. Procesar ePagos
      if (valores.EPAGOS > 0) {
        epagosService.crear(fecha, valores.EPAGOS, 'CAJA', 'Actualizado desde Planillas');
        alertas.push('ePago actualizado');
      }

      // 5. Procesar integraciones (LIBRERIA, MARIA, AGUA, EDESUR, TERE, DAMI, MUMI)
      const integracion = integracionesService.procesarFormularioCaja(fecha, valores);
      if (integracion.gastosCreados > 0) {
        alertas.push(`${integracion.gastosCreados} gasto(s) registrado(s) en Gastos Registrales`);
      }
      if (integracion.adelantosCreados > 0) {
        alertas.push(`${integracion.adelantosCreados} adelanto(s) registrado(s)`);
      }
      if (integracion.gastosPersonalesCreados > 0) {
        alertas.push(`${integracion.gastosPersonalesCreados} gasto(s) personal(es) registrado(s)`);
      }

      alertas.push('Movimientos CAJA actualizados correctamente');

      return {
        mensaje: 'Actualización exitosa',
        alertas,
      };
    });
  }
}

export default new PlanillasService();
