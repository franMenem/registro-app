import db, { transaction } from '../db/database';
import { IMovimientoResult } from '../interfaces/control.interface';
import controlSemanalService from './controles-semanales.service';
import controlQuincenalService from './controles-quincenales.service';
import controlPOSNETService from './control-posnet.service';
import cuentasService from './cuentas.service';
import integracionesService from './integraciones.service';
import vepsService from './veps.service';
import epagosService from './epagos.service';

/**
 * Servicio principal de movimientos
 * Orquesta las acciones según el concepto del movimiento
 * Aplicando Single Responsibility y Open/Closed Principles
 */
export class MovimientosService {
  /**
   * Crea un nuevo movimiento y ejecuta acciones automáticas según el concepto
   */
  async crear(movimiento: {
    fecha: string;
    tipo: 'RENTAS' | 'CAJA';
    cuit: string;
    concepto_id: number;
    monto: number;
    observaciones?: string;
  }): Promise<IMovimientoResult> {
    const alertas: string[] = [];

    // Validar concepto
    const concepto = db
      .prepare('SELECT * FROM conceptos WHERE id = ?')
      .get(movimiento.concepto_id) as any;

    if (!concepto) {
      throw new Error('Concepto no válido');
    }

    // Validar que el concepto corresponda al tipo
    if (concepto.tipo !== movimiento.tipo) {
      throw new Error(`El concepto ${concepto.nombre} no corresponde al tipo ${movimiento.tipo}`);
    }

    // Ejecutar en transacción
    const result = transaction(() => {
      // 1. Insertar movimiento
      const insertResult = db
        .prepare(
          `INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          movimiento.fecha,
          movimiento.tipo,
          movimiento.cuit,
          movimiento.concepto_id,
          movimiento.monto,
          movimiento.observaciones
        );

      const movimientoId = insertResult.lastInsertRowid as number;

      // 2. Aplicar lógica según frecuencia de pago y concepto
      const fecha = new Date(movimiento.fecha);

      if (concepto.frecuencia_pago === 'SEMANAL') {
        // Controles semanales
        controlSemanalService.actualizarControl(concepto.id, fecha, movimiento.monto);
        alertas.push(
          `Control semanal actualizado para ${concepto.nombre}. Pago programado para el próximo lunes.`
        );
      } else if (concepto.frecuencia_pago === 'QUINCENAL') {
        // Controles quincenales (ARBA)
        controlQuincenalService.actualizarControl(concepto.id, fecha, movimiento.monto);
        alertas.push(
          `Control quincenal actualizado para ${concepto.nombre}. Pago programado 5 días corridos después de fin de quincena.`
        );
      }

      // 3. Lógica específica por concepto
      if (concepto.nombre === 'POSNET' || concepto.nombre === 'POSNET CAJA') {
        // Control POSNET
        controlPOSNETService.actualizarControl(fecha, movimiento.monto, movimiento.tipo);
        alertas.push(
          `Control POSNET mensual actualizado. Este concepto requiere revisión manual.`
        );
      } else if (concepto.nombre === 'ICBC') {
        // Va a cuenta corriente "Gastos Bancarios"
        const cuenta = cuentasService.getCuentaByNombre('Gastos Bancarios');
        if (cuenta) {
          cuentasService.crearMovimiento(
            cuenta.id,
            movimiento.fecha,
            'EGRESO',
            movimiento.tipo,
            movimiento.monto,
            movimientoId
          );
          alertas.push(
            `Egreso registrado en cuenta corriente "Gastos Bancarios" por $${movimiento.monto.toFixed(
              2
            )}`
          );
        }
      } else if (concepto.nombre === 'Formularios') {
        // Va a cuenta corriente "Gastos Formularios"
        const cuenta = cuentasService.getCuentaByNombre('Gastos Formularios');
        if (cuenta) {
          cuentasService.crearMovimiento(
            cuenta.id,
            movimiento.fecha,
            'EGRESO',
            movimiento.tipo,
            movimiento.monto,
            movimientoId
          );
          alertas.push(
            `Egreso registrado en cuenta corriente "Gastos Formularios" por $${movimiento.monto.toFixed(
              2
            )}`
          );
        }
      } else if (concepto.nombre === 'VEP' || concepto.nombre === 'VEP CAJA') {
        // Registrar en control_veps (siempre CAJA)
        vepsService.crear(movimiento.fecha, movimiento.monto, 'CAJA', movimiento.observaciones);
        alertas.push(
          `VEP registrado en control por $${movimiento.monto.toFixed(2)}`
        );
      } else if (concepto.nombre === 'ePagos' || concepto.nombre === 'ePagos CAJA') {
        // Registrar en control_epagos (siempre CAJA)
        epagosService.crear(movimiento.fecha, movimiento.monto, 'CAJA', movimiento.observaciones);
        alertas.push(
          `ePago registrado en control por $${movimiento.monto.toFixed(2)}`
        );
      }

      return { movimientoId, alertas };
    });

    return result;
  }

  /**
   * Obtiene todos los movimientos con filtros
   */
  getMovimientos(filters?: {
    tipo?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    conceptoId?: number;
    limit?: number;
    offset?: number;
  }): any[] {
    let query = `
      SELECT m.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo
      FROM movimientos m
      JOIN conceptos c ON m.concepto_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.tipo) {
      query += ' AND m.tipo = ?';
      params.push(filters.tipo);
    }

    if (filters?.fechaDesde) {
      query += ' AND m.fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND m.fecha <= ?';
      params.push(filters.fechaHasta);
    }

    if (filters?.conceptoId) {
      query += ' AND m.concepto_id = ?';
      params.push(filters.conceptoId);
    }

    query += ' ORDER BY m.fecha DESC, m.id DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Obtiene un movimiento por ID
   */
  getById(id: number): any {
    return db
      .prepare(
        `SELECT m.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo
         FROM movimientos m
         JOIN conceptos c ON m.concepto_id = c.id
         WHERE m.id = ?`
      )
      .get(id);
  }

  /**
   * Actualiza un movimiento
   */
  async actualizar(
    id: number,
    datos: Partial<{
      fecha: string;
      cuit: string;
      concepto_id: number;
      monto: number;
      observaciones: string;
    }>
  ): Promise<void> {
    const movimiento = this.getById(id);
    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    const campos = Object.keys(datos)
      .map((key) => `${key} = ?`)
      .join(', ');
    const valores = Object.values(datos);

    db.prepare(`UPDATE movimientos SET ${campos} WHERE id = ?`).run(...valores, id);
  }

  /**
   * Elimina un movimiento
   */
  async eliminar(id: number): Promise<void> {
    const movimiento = this.getById(id);
    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    db.prepare('DELETE FROM movimientos WHERE id = ?').run(id);
  }

  /**
   * Crea múltiples movimientos del formulario RENTAS diario
   */
  async crearRentasDiario(
    fecha: string,
    values: {
      GIT: number;
      SUAT_ALTA: number;
      SUAT_PATENTES: number;
      SUAT_INFRACCIONES: number;
      CONSULTA: number;
      SUCERP: number;
      SUGIT: number;
      PROVINCIA: number;
      POSNET: number;
      DEPOSITOS: number;
      ICBC: number;
      FORD: number;
      SICARDI: number;
      PATAGONIA: number;
      IVECO: number;
      CNH: number;
      GESTORIA_FORD: number;
      ALRA: number;
    },
    entregado: number
  ): Promise<{ totalMovimientos: number; diferencia: number; alertas: string[] }> {
    const alertas: string[] = [];
    let totalMovimientos = 0;

    // Mapeo de conceptos del formulario a nombres en BD
    const conceptosMap = {
      GIT: 'GIT',
      SUAT_ALTA: 'SUAT - Alta',
      SUAT_PATENTES: 'SUAT - Patentes',
      SUAT_INFRACCIONES: 'SUAT - Infracciones',
      CONSULTA: 'Consulta',
      SUCERP: 'SUCERP',
      SUGIT: 'SUGIT',
      PROVINCIA: 'PROVINCIA (ARBA)',
      POSNET: 'POSNET',
      ICBC: 'ICBC',
    };

    // Mapeo de gastos de cuentas corrientes a cuentas
    const cuentasMap = {
      ICBC: 'ICBC',
      FORD: 'FORD',
      SICARDI: 'SICARDI',
      PATAGONIA: 'PATAGONIA',
      IVECO: 'IVECO',
      CNH: 'CNH',
      GESTORIA_FORD: 'GESTORIA FORD',
      ALRA: 'ALRA',
    };

    // Obtener todos los conceptos
    const conceptos = db.prepare('SELECT * FROM conceptos WHERE tipo = ?').all('RENTAS') as any[];
    const conceptosById = new Map(conceptos.map((c) => [c.nombre, c]));

    // CUIT genérico para el día (se podría mejorar para tener un CUIT por movimiento)
    const cuitGenerico = '00-00000000-0';

    // Ejecutar en transacción
    const result = transaction(() => {
      const fechaObj = new Date(fecha);

      // Preparar statement UNA SOLA VEZ antes del loop (optimización de performance)
      const insertMovimientoStmt = db.prepare(
        `INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      // Procesar conceptos que suman
      for (const [key, conceptoNombre] of Object.entries(conceptosMap)) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          const concepto = conceptosById.get(conceptoNombre);
          if (concepto) {
            // Insertar movimiento usando el statement preparado
            const insertResult = insertMovimientoStmt.run(
              fecha,
              'RENTAS',
              cuitGenerico,
              concepto.id,
              valor,
              `Registro diario - ${conceptoNombre}`
            );

            const movimientoId = insertResult.lastInsertRowid as number;
            totalMovimientos++;

            // Aplicar lógica según frecuencia de pago
            if (concepto.frecuencia_pago === 'SEMANAL') {
              controlSemanalService.actualizarControl(concepto.id, fechaObj, valor);
              alertas.push(
                `Control semanal actualizado para ${concepto.nombre}. Pago programado para el próximo lunes.`
              );
            } else if (concepto.frecuencia_pago === 'QUINCENAL') {
              controlQuincenalService.actualizarControl(concepto.id, fechaObj, valor);
              alertas.push(
                `Control quincenal actualizado para ${concepto.nombre}. Pago programado 5 días corridos después de fin de quincena.`
              );
            }

            // Lógica específica para POSNET
            if (concepto.nombre === 'POSNET') {
              controlPOSNETService.actualizarControl(fechaObj, valor, 'RENTAS');
              alertas.push(`Control POSNET mensual actualizado. Este concepto requiere revisión manual.`);
            }

            // Lógica específica para ICBC (ya se procesa como cuenta corriente abajo)
            if (concepto.nombre === 'ICBC') {
              const cuenta = cuentasService.getCuentaByNombre('ICBC');
              if (cuenta) {
                cuentasService.crearMovimiento(
                  cuenta.id,
                  fecha,
                  'EGRESO',
                  'RENTAS',
                  valor,
                  movimientoId
                );
                alertas.push(`Egreso registrado en cuenta corriente "ICBC" por $${valor.toFixed(2)}`);
              }
            }
          }
        }
      }

      // Procesar DEPOSITOS (que resta, pero no es un concepto con control)
      if (values.DEPOSITOS > 0) {
        // DEPOSITOS no está en conceptos RENTAS, lo ignoramos o podríamos crear un concepto especial
        // Por ahora lo registramos como observación
        alertas.push(`DEPOSITOS: $${values.DEPOSITOS.toFixed(2)} (no registrado como movimiento)`);
      }

      // Procesar gastos de cuentas corrientes
      for (const [key, cuentaNombre] of Object.entries(cuentasMap)) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          // Si es ICBC, ya se creó como movimiento arriba
          if (key === 'ICBC') continue;

          // Para los demás, crear directamente en cuenta corriente
          const cuenta = cuentasService.getCuentaByNombre(cuentaNombre);
          if (cuenta) {
            cuentasService.crearMovimiento(
              cuenta.id,
              fecha,
              'EGRESO',
              'RENTAS',
              valor
            );
            alertas.push(`Egreso registrado en cuenta "${cuentaNombre}" por $${valor.toFixed(2)}`);
            totalMovimientos++;
          } else {
            alertas.push(`Advertencia: Cuenta "${cuentaNombre}" no encontrada`);
          }
        }
      }

      // Calcular totales
      const totalSuman =
        values.GIT +
        values.SUAT_ALTA +
        values.SUAT_PATENTES +
        values.SUAT_INFRACCIONES +
        values.CONSULTA +
        values.SUCERP +
        values.SUGIT +
        values.PROVINCIA;

      const totalRestan = values.POSNET + values.DEPOSITOS;

      const totalGastos =
        values.ICBC +
        values.FORD +
        values.SICARDI +
        values.PATAGONIA +
        values.IVECO +
        values.CNH +
        values.GESTORIA_FORD +
        values.ALRA;

      const total = totalSuman - totalRestan - totalGastos;
      const diferencia = entregado - total;

      // Si hay entregado, registrarlo como INGRESO de efectivo
      if (entregado > 0) {
        db.prepare(
          `INSERT INTO movimientos_efectivo
           (fecha, tipo, concepto, monto, observaciones)
           VALUES (?, 'INGRESO', ?, ?, ?)`
        ).run(
          fecha,
          'Efectivo RENTAS entregado',
          entregado,
          diferencia !== 0 ? `Diferencia: ${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}` : null
        );
        console.log(`💰 Efectivo RENTAS registrado: $${entregado}`);
      }

      return {
        totalMovimientos,
        diferencia,
        alertas,
      };
    });

    return result;
  }

  /**
   * Crea múltiples movimientos del formulario CAJA diario
   */
  async crearCajaDiario(
    fecha: string,
    values: any,
    entregado: number
  ): Promise<{ totalMovimientos: number; diferencia: number; alertas: string[] }> {
    const alertas: string[] = [];
    let totalMovimientos = 0;

    // Mapeo de conceptos del formulario a nombres en BD
    const conceptosMap = {
      ARANCEL: 'Arancel',
      SUAT_SELLADO: 'SUAT - Sellado',
      SUCERP_SELLADO: 'SUCERP - Sellado',
      CONSULTAS: 'Consultas CAJA',
      FORMULARIOS: 'Formularios',
      POSNET: 'POSNET CAJA',
      // VEP, EPAGOS y DEPOSITOS se procesan como restas sin concepto específico
    };

    // Mapeo de otros gastos a cuentas corrientes
    const otrosGastosMap = {
      LIBRERIA: 'Librería',
      MARIA: 'María',
      AGUA: 'Agua',
      EDESUR: 'Edesur',
      // Los demás gastos (TERE, DAMI, MUMI, etc.) podrían necesitar cuentas adicionales
    };

    // Mapeo de gastos de cuentas corrientes
    const cuentasMap = {
      ICBC: 'ICBC',
      FORD: 'FORD',
      SICARDI: 'SICARDI',
      PATAGONIA: 'PATAGONIA',
      IVECO: 'IVECO',
      CNH: 'CNH',
      GESTORIA_FORD: 'GESTORIA FORD',
      ALRA: 'ALRA',
    };

    // Obtener todos los conceptos CAJA
    const conceptos = db.prepare('SELECT * FROM conceptos WHERE tipo = ?').all('CAJA') as any[];
    const conceptosById = new Map(conceptos.map((c) => [c.nombre, c]));

    // CUIT genérico para el día
    const cuitGenerico = '00-00000000-0';

    // Ejecutar en transacción
    const result = transaction(() => {
      const fechaObj = new Date(fecha);

      // Preparar statement UNA SOLA VEZ antes del loop (optimización de performance)
      const insertMovimientoStmt = db.prepare(
        `INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      // Procesar conceptos que suman o restan
      for (const [key, conceptoNombre] of Object.entries(conceptosMap)) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          const concepto = conceptosById.get(conceptoNombre);
          if (concepto) {
            // Insertar movimiento usando el statement preparado
            const insertResult = insertMovimientoStmt.run(
              fecha, 'CAJA', cuitGenerico, concepto.id, valor, `Registro diario - ${conceptoNombre}`
            );

            const movimientoId = insertResult.lastInsertRowid as number;
            totalMovimientos++;

            // Aplicar lógica según frecuencia de pago
            if (concepto.frecuencia_pago === 'SEMANAL') {
              controlSemanalService.actualizarControl(concepto.id, fechaObj, valor);
              alertas.push(
                `Control semanal actualizado para ${concepto.nombre}. Pago programado para el próximo lunes.`
              );
            } else if (concepto.frecuencia_pago === 'MENSUAL') {
              alertas.push(`Concepto mensual ${concepto.nombre} registrado por $${valor.toFixed(2)}`);
            }

            // Lógica específica para POSNET CAJA
            if (concepto.nombre === 'POSNET CAJA') {
              controlPOSNETService.actualizarControl(fechaObj, valor, 'CAJA');
              alertas.push(`Control POSNET mensual actualizado. Este concepto requiere revisión manual.`);
            }

            // Formularios va a cuenta corriente "Gastos Formularios"
            if (concepto.nombre === 'Formularios') {
              const cuenta = cuentasService.getCuentaByNombre('Gastos Formularios');
              if (cuenta) {
                cuentasService.crearMovimiento(
                  cuenta.id,
                  fecha,
                  'EGRESO',
                  'CAJA',
                  valor,
                  movimientoId
                );
                alertas.push(`Egreso registrado en cuenta corriente "Gastos Formularios" por $${valor.toFixed(2)}`);
              }
            }
          }
        }
      }

      // Procesar VEP, EPAGOS (conceptos que restan sin control específico)
      if (values.VEP > 0) {
        alertas.push(`VEP: $${values.VEP.toFixed(2)} (restado del total)`);
      }
      if (values.EPAGOS > 0) {
        alertas.push(`EPAGOS: $${values.EPAGOS.toFixed(2)} (restado del total)`);
      }

      // Procesar 12 depósitos (que restan)
      let totalDepositos = 0;
      for (let i = 1; i <= 12; i++) {
        const depositoKey = `DEPOSITO_${i}` as keyof typeof values;
        if (values[depositoKey] > 0) {
          totalDepositos += values[depositoKey];
        }
      }
      if (totalDepositos > 0) {
        alertas.push(`Total depósitos: $${totalDepositos.toFixed(2)} (restados del total)`);
      }

      // Procesar otros gastos (van a cuentas corrientes específicas)
      for (const [key, cuentaNombre] of Object.entries(otrosGastosMap)) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          const cuenta = cuentasService.getCuentaByNombre(cuentaNombre);
          if (cuenta) {
            cuentasService.crearMovimiento(cuenta.id, fecha, 'EGRESO', 'CAJA', valor);
            alertas.push(`Egreso registrado en cuenta "${cuentaNombre}" por $${valor.toFixed(2)}`);
            totalMovimientos++;
          } else {
            alertas.push(`Advertencia: Cuenta "${cuentaNombre}" no encontrada`);
          }
        }
      }

      // Procesar gastos varios que no tienen cuenta específica todavía
      const gastosVarios = ['TERE', 'DAMI', 'MUMI', 'CARGAS_SOCIALES', 'OTROS', 'REPO_CAJA_CHICA', 'REPO_RENTAS_CHICA'];
      for (const key of gastosVarios) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          alertas.push(`${key}: $${valor.toFixed(2)} registrado como gasto (sin cuenta específica)`);
        }
      }

      // Procesar gastos de cuentas corrientes (igual que RENTAS)
      for (const [key, cuentaNombre] of Object.entries(cuentasMap)) {
        const valor = values[key as keyof typeof values];
        if (valor > 0) {
          const cuenta = cuentasService.getCuentaByNombre(cuentaNombre);
          if (cuenta) {
            cuentasService.crearMovimiento(cuenta.id, fecha, 'EGRESO', 'CAJA', valor);
            alertas.push(`Egreso registrado en cuenta "${cuentaNombre}" por $${valor.toFixed(2)}`);
            totalMovimientos++;
          } else {
            alertas.push(`Advertencia: Cuenta "${cuentaNombre}" no encontrada`);
          }
        }
      }

      // Calcular totales
      const totalSuman =
        values.ARANCEL +
        values.SUAT_SELLADO +
        values.SUCERP_SELLADO +
        values.CONSULTAS +
        values.FORMULARIOS;

      const totalRestan =
        values.POSNET +
        values.VEP +
        values.EPAGOS +
        totalDepositos;

      const totalOtrosGastos =
        (values.LIBRERIA || 0) +
        (values.MARIA || 0) +
        (values.TERE || 0) +
        (values.DAMI || 0) +
        (values.MUMI || 0) +
        (values.AGUA || 0) +
        (values.CARGAS_SOCIALES || 0) +
        (values.EDESUR || 0) +
        (values.OTROS || 0) +
        (values.REPO_CAJA_CHICA || 0) +
        (values.REPO_RENTAS_CHICA || 0);

      const totalGastosCuentas =
        values.ICBC +
        values.FORD +
        values.SICARDI +
        values.PATAGONIA +
        values.IVECO +
        values.CNH +
        values.GESTORIA_FORD +
        values.ALRA;

      const total = totalSuman - totalRestan - totalOtrosGastos - totalGastosCuentas;
      const diferencia = entregado - total;

      // Procesar integración con Gastos Registrales y Adelantos
      const integracion = integracionesService.procesarFormularioCaja(fecha, values);
      if (integracion.gastosCreados > 0) {
        alertas.push(`✅ ${integracion.gastosCreados} gasto(s) registrado(s) en Gastos Registrales automáticamente`);
      }
      if (integracion.adelantosCreados > 0) {
        alertas.push(`✅ ${integracion.adelantosCreados} adelanto(s) registrado(s) automáticamente (Pendiente)`);
      }
      if (integracion.vepsCreados > 0) {
        alertas.push(`✅ ${integracion.vepsCreados} VEP(s) registrado(s) en Control VEPs automáticamente`);
      }
      if (integracion.epagosCreados > 0) {
        alertas.push(`✅ ${integracion.epagosCreados} ePago(s) registrado(s) en Control ePagos automáticamente`);
      }
      if (integracion.gastosPersonalesCreados > 0) {
        alertas.push(`✅ ${integracion.gastosPersonalesCreados} gasto(s) personal(es) registrado(s) automáticamente`);
      }

      // Si hay entregado, registrarlo como INGRESO de efectivo
      if (entregado > 0) {
        db.prepare(
          `INSERT INTO movimientos_efectivo
           (fecha, tipo, concepto, monto, observaciones)
           VALUES (?, 'INGRESO', ?, ?, ?)`
        ).run(
          fecha,
          'Efectivo CAJA entregado',
          entregado,
          diferencia !== 0 ? `Diferencia: ${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}` : null
        );
        console.log(`💰 Efectivo CAJA registrado: $${entregado}`);
      }

      return {
        totalMovimientos,
        diferencia,
        alertas,
      };
    });

    return result;
  }
}

export default new MovimientosService();
