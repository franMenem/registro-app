import { Request, Response } from 'express';
import * as reportesService from '../services/reportes.service';

// ==================== REPORTES DE DEPÓSITOS ====================

export const getDepositosPorPeriodo = (req: Request, res: Response) => {
  try {
    const filtros = {
      fecha_desde: req.query.fecha_desde as string,
      fecha_hasta: req.query.fecha_hasta as string,
      estado: req.query.estado as string,
    };

    const data = reportesService.getDepositosPorPeriodo(filtros);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepositosPorEstado = (req: Request, res: Response) => {
  try {
    const filtros = {
      fecha_desde: req.query.fecha_desde as string,
      fecha_hasta: req.query.fecha_hasta as string,
    };

    const data = reportesService.getDepositosPorEstado(filtros);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepositosPorCliente = (req: Request, res: Response) => {
  try {
    const filtros = {
      fecha_desde: req.query.fecha_desde as string,
      fecha_hasta: req.query.fecha_hasta as string,
      cliente_id: req.query.cliente_id ? Number(req.query.cliente_id) : undefined,
    };

    const data = reportesService.getDepositosPorCliente(filtros);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTopDepositos = (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = reportesService.getTopDepositos(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REPORTES DE CUENTAS CORRIENTES ====================

export const getBalanceCuentas = (req: Request, res: Response) => {
  try {
    const data = reportesService.getBalanceCuentas();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMovimientosCuentaPorPeriodo = (req: Request, res: Response) => {
  try {
    const filtros = {
      fecha_desde: req.query.fecha_desde as string,
      fecha_hasta: req.query.fecha_hasta as string,
      cuenta_id: req.query.cuenta_id ? Number(req.query.cuenta_id) : undefined,
    };

    const data = reportesService.getMovimientosCuentaPorPeriodo(filtros);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEvolucionSaldos = (req: Request, res: Response) => {
  try {
    const cuenta_id = Number(req.params.cuenta_id);
    const fecha_desde = req.query.fecha_desde as string;
    const fecha_hasta = req.query.fecha_hasta as string;

    const data = reportesService.getEvolucionSaldos(cuenta_id, fecha_desde, fecha_hasta);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCuentasConSaldoNegativo = (req: Request, res: Response) => {
  try {
    const data = reportesService.getCuentasConSaldoNegativo();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REPORTES DE CLIENTES ====================

export const getClientesConMasDepositos = (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = reportesService.getClientesConMasDepositos(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getClientesConSaldosActivos = (req: Request, res: Response) => {
  try {
    const data = reportesService.getClientesConSaldosActivos();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REPORTES FINANCIEROS GENERALES ====================

export const getResumenMensual = (req: Request, res: Response) => {
  try {
    const anio = Number(req.query.anio);
    const mes = Number(req.query.mes);

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Se requieren año y mes' });
    }

    const data = reportesService.getResumenMensual(anio, mes);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getComparativaMensual = (req: Request, res: Response) => {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const data = reportesService.getComparativaMensual(anio);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFlujoCajaProyectado = (req: Request, res: Response) => {
  try {
    const data = reportesService.getFlujoCajaProyectado();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTopMovimientos = (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = reportesService.getTopMovimientos(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
