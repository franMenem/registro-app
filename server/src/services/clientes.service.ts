import db, { transaction } from '../db/database';
import { Cliente, ClienteCreate, ClienteUpdate, ClienteFilters } from '../types/clientes.types';

/**
 * Service para Clientes
 * Principios SOLID:
 * - Single Responsibility: Manejo exclusivo de clientes
 * - Open/Closed: Extensible para nuevas funcionalidades
 * - Dependency Inversion: Trabaja con abstracciones (interfaces)
 */
export class ClientesService {
  /**
   * Validar formato de CUIT (XX-XXXXXXXX-X)
   */
  private validarCUIT(cuit: string): boolean {
    // Formato: 20-12345678-9 o 27-12345678-9
    const regex = /^\d{2}-\d{8}-\d{1}$/;
    return regex.test(cuit);
  }

  /**
   * Obtener todos los clientes con filtros opcionales
   */
  obtenerTodos(filtros: ClienteFilters = {}): Cliente[] {
    let query = 'SELECT * FROM clientes WHERE 1=1';
    const params: any[] = [];

    if (filtros.search) {
      query += ' AND (cuit LIKE ? OR razon_social LIKE ?)';
      const searchTerm = `%${filtros.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY razon_social ASC';

    return db.prepare(query).all(...params) as Cliente[];
  }

  /**
   * Obtener un cliente por ID
   */
  obtenerPorId(id: number): Cliente | undefined {
    return db
      .prepare('SELECT * FROM clientes WHERE id = ?')
      .get(id) as Cliente | undefined;
  }

  /**
   * Obtener un cliente por CUIT
   */
  obtenerPorCUIT(cuit: string): Cliente | undefined {
    return db
      .prepare('SELECT * FROM clientes WHERE cuit = ?')
      .get(cuit) as Cliente | undefined;
  }

  /**
   * Crear un nuevo cliente
   */
  crear(data: ClienteCreate): Cliente {
    return transaction(() => {
      // Validación de CUIT
      if (!this.validarCUIT(data.cuit)) {
        throw new Error('CUIT inválido. Formato esperado: XX-XXXXXXXX-X');
      }

      // Verificar si ya existe
      const clienteExistente = this.obtenerPorCUIT(data.cuit);
      if (clienteExistente) {
        throw new Error('Ya existe un cliente con este CUIT');
      }

      // Validación de razón social
      if (!data.razon_social || data.razon_social.trim().length === 0) {
        throw new Error('La razón social es requerida');
      }

      const result = db
        .prepare(
          `
          INSERT INTO clientes (cuit, razon_social, email, telefono, direccion, observaciones)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          data.cuit,
          data.razon_social,
          data.email || null,
          data.telefono || null,
          data.direccion || null,
          data.observaciones || null
        );

      const clienteCreado = this.obtenerPorId(result.lastInsertRowid as number);
      if (!clienteCreado) {
        throw new Error('Error al crear el cliente');
      }

      return clienteCreado;
    });
  }

  /**
   * Actualizar un cliente existente
   */
  actualizar(id: number, data: ClienteUpdate): Cliente {
    return transaction(() => {
      const clienteExistente = this.obtenerPorId(id);
      if (!clienteExistente) {
        throw new Error('Cliente no encontrado');
      }

      // Validar CUIT si se proporciona
      if (data.cuit && !this.validarCUIT(data.cuit)) {
        throw new Error('CUIT inválido. Formato esperado: XX-XXXXXXXX-X');
      }

      // Si cambia el CUIT, verificar que no exista
      if (data.cuit && data.cuit !== clienteExistente.cuit) {
        const otroCuit = this.obtenerPorCUIT(data.cuit);
        if (otroCuit) {
          throw new Error('Ya existe un cliente con este CUIT');
        }
      }

      const campos: string[] = [];
      const valores: any[] = [];

      if (data.cuit !== undefined) {
        campos.push('cuit = ?');
        valores.push(data.cuit);
      }
      if (data.razon_social !== undefined) {
        if (data.razon_social.trim().length === 0) {
          throw new Error('La razón social no puede estar vacía');
        }
        campos.push('razon_social = ?');
        valores.push(data.razon_social);
      }
      if (data.email !== undefined) {
        campos.push('email = ?');
        valores.push(data.email || null);
      }
      if (data.telefono !== undefined) {
        campos.push('telefono = ?');
        valores.push(data.telefono || null);
      }
      if (data.direccion !== undefined) {
        campos.push('direccion = ?');
        valores.push(data.direccion || null);
      }
      if (data.observaciones !== undefined) {
        campos.push('observaciones = ?');
        valores.push(data.observaciones || null);
      }

      if (campos.length === 0) {
        return clienteExistente;
      }

      campos.push('updated_at = CURRENT_TIMESTAMP');
      valores.push(id);

      db.prepare(
        `UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`
      ).run(...valores);

      const clienteActualizado = this.obtenerPorId(id);
      if (!clienteActualizado) {
        throw new Error('Error al actualizar el cliente');
      }

      return clienteActualizado;
    });
  }

  /**
   * Eliminar un cliente
   */
  eliminar(id: number): void {
    transaction(() => {
      const cliente = this.obtenerPorId(id);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }

      // Verificar si tiene movimientos asociados
      const movimientos = db
        .prepare('SELECT COUNT(*) as count FROM movimientos WHERE cuit = ?')
        .get(cliente.cuit) as { count: number };

      if (movimientos.count > 0) {
        throw new Error(
          `No se puede eliminar el cliente porque tiene ${movimientos.count} movimiento(s) asociado(s)`
        );
      }

      // Verificar si tiene depósitos asociados
      const depositos = db
        .prepare('SELECT COUNT(*) as count FROM depositos WHERE cliente_id = ?')
        .get(id) as { count: number };

      if (depositos.count > 0) {
        throw new Error(
          `No se puede eliminar el cliente porque tiene ${depositos.count} depósito(s) asociado(s)`
        );
      }

      db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    });
  }

  /**
   * Buscar clientes por CUIT o razón social (autocompletado)
   */
  buscar(termino: string): Cliente[] {
    const searchTerm = `%${termino}%`;
    return db
      .prepare(
        `
        SELECT * FROM clientes
        WHERE cuit LIKE ? OR razon_social LIKE ?
        ORDER BY razon_social ASC
        LIMIT 10
      `
      )
      .all(searchTerm, searchTerm) as Cliente[];
  }

  /**
   * Obtener un cliente con sus depósitos
   */
  obtenerConDepositos(id: number): any {
    const cliente = this.obtenerPorId(id);
    if (!cliente) return null;

    const depositos = db.prepare(
      `SELECT d.*, cc.nombre as cuenta_nombre
       FROM depositos d
       LEFT JOIN cuentas_corrientes cc ON d.cuenta_id = cc.id
       WHERE d.cliente_id = ?
       ORDER BY d.fecha_ingreso DESC`
    ).all(id);

    const totalDepositado = depositos.reduce((sum: number, d: any) => sum + d.monto, 0);

    return {
      ...cliente,
      depositos,
      total_depositado: totalDepositado,
      cantidad_depositos: depositos.length,
    };
  }

  /**
   * Obtener resumen de clientes
   */
  obtenerResumen(): any {
    const total = db.prepare('SELECT COUNT(*) as count FROM clientes').get() as { count: number };

    const conDepositos = db.prepare(
      'SELECT COUNT(DISTINCT cliente_id) as count FROM depositos WHERE cliente_id IS NOT NULL'
    ).get() as { count: number };

    const totalDepositado = db.prepare(
      'SELECT SUM(monto) as total FROM depositos WHERE cliente_id IS NOT NULL'
    ).get() as { total: number | null };

    return {
      total_clientes: total.count,
      clientes_con_depositos: conDepositos.count,
      total_depositado: totalDepositado.total || 0,
    };
  }
}

export default new ClientesService();
