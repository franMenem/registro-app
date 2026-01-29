import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/tables/Table';
import { movimientosApi, conceptosApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { Movimiento } from '@/types';
import { Search, Filter } from 'lucide-react';

const HistorialMovimientos: React.FC = () => {
  const [filters, setFilters] = useState({
    tipo: '',
    fecha_desde: '',
    fecha_hasta: '',
    concepto_id: '',
  });

  // Fetch movimientos
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['movimientos', filters],
    queryFn: () => {
      const params: any = {};
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.fecha_desde) params.fecha_desde = filters.fecha_desde;
      if (filters.fecha_hasta) params.fecha_hasta = filters.fecha_hasta;
      if (filters.concepto_id) params.concepto_id = parseInt(filters.concepto_id);
      return movimientosApi.getAll(params);
    },
  });

  // Fetch conceptos para el filtro
  const { data: conceptos = [] } = useQuery({
    queryKey: ['conceptos'],
    queryFn: () => conceptosApi.getAll(),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const limpiarFiltros = () => {
    setFilters({
      tipo: '',
      fecha_desde: '',
      fecha_hasta: '',
      concepto_id: '',
    });
  };

  const columns: TableColumn[] = [
    { key: 'fecha', label: 'Fecha', width: '120px' },
    { key: 'tipo', label: 'Tipo', width: '100px' },
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'monto', label: 'Monto', align: 'right', width: '150px' },
    { key: 'cuit', label: 'CUIT', width: '150px' },
    { key: 'observaciones', label: 'Observaciones', width: '250px' },
  ];

  const renderCell = (column: TableColumn, row: Movimiento) => {
    switch (column.key) {
      case 'fecha':
        return formatDate(row.fecha);
      case 'tipo':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.tipo === 'RENTAS'
                ? 'bg-primary-light text-primary'
                : 'bg-secondary-light text-secondary'
            }`}
          >
            {row.tipo}
          </span>
        );
      case 'monto':
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.monto)}
          </span>
        );
      case 'cuit':
        return row.cuit || '-';
      case 'observaciones':
        return (
          <span className="text-sm text-text-secondary">
            {row.observaciones || '-'}
          </span>
        );
      default:
        return row[column.key as keyof Movimiento];
    }
  };

  // Calcular totales
  const totalGeneral = movimientos.reduce((sum, m) => sum + m.monto, 0);
  const totalRentas = movimientos
    .filter((m) => m.tipo === 'RENTAS')
    .reduce((sum, m) => sum + m.monto, 0);
  const totalCaja = movimientos
    .filter((m) => m.tipo === 'CAJA')
    .reduce((sum, m) => sum + m.monto, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Historial de Movimientos</h1>
        <p className="text-text-secondary mt-1">
          Todos los movimientos de RENTAS y CAJA registrados
        </p>
      </div>

      {/* Filtros */}
      <Card title="Filtros" icon={Filter}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Tipo
            </label>
            <select
              value={filters.tipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <option value="">Todos</option>
              <option value="RENTAS">RENTAS</option>
              <option value="CAJA">CAJA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Desde
            </label>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Hasta
            </label>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Concepto
            </label>
            <select
              value={filters.concepto_id}
              onChange={(e) => handleFilterChange('concepto_id', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <option value="">Todos</option>
              {conceptos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={limpiarFiltros}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      </Card>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">Total RENTAS</p>
            <p className="text-2xl font-bold text-primary font-mono">
              {formatCurrency(totalRentas)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {movimientos.filter((m) => m.tipo === 'RENTAS').length} movimientos
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">Total CAJA</p>
            <p className="text-2xl font-bold text-secondary font-mono">
              {formatCurrency(totalCaja)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {movimientos.filter((m) => m.tipo === 'CAJA').length} movimientos
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">Total General</p>
            <p className="text-2xl font-bold text-text-primary font-mono">
              {formatCurrency(totalGeneral)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {movimientos.length} movimientos
            </p>
          </div>
        </Card>
      </div>

      {/* Tabla */}
      <Card title="Movimientos" icon={Search}>
        <Table
          columns={columns}
          data={movimientos}
          loading={isLoading}
          emptyMessage="No se encontraron movimientos"
          renderCell={renderCell}
        />
      </Card>
    </div>
  );
};

export default HistorialMovimientos;
