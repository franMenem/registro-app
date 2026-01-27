import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Table, TableColumn } from '@/components/tables/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Filter } from 'lucide-react';
import { cuentasApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { MovimientoCC } from '@/types';
import { format } from 'date-fns';

const CuentasCorrientes: React.FC = () => {
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
  });

  // Fetch all cuentas
  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  // Set initial selected cuenta
  React.useEffect(() => {
    if (cuentas.length > 0 && !selectedCuentaId) {
      setSelectedCuentaId(cuentas[0].id);
    }
  }, [cuentas, selectedCuentaId]);

  // Fetch movimientos for selected cuenta
  const { data: movimientos = [], isLoading: movimientosLoading } = useQuery({
    queryKey: ['movimientos-cc', selectedCuentaId, filters],
    queryFn: () =>
      selectedCuentaId
        ? cuentasApi.getMovimientos(selectedCuentaId, {
            fecha_desde: filters.fechaDesde || undefined,
            fecha_hasta: filters.fechaHasta || undefined,
          })
        : [],
    enabled: !!selectedCuentaId,
  });

  const selectedCuenta = cuentas.find((c) => c.id === selectedCuentaId);

  // Calculate totals
  const totalIngresos = movimientos
    .filter((m) => m.tipo_movimiento === 'INGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalEgresos = movimientos
    .filter((m) => m.tipo_movimiento === 'EGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const columns: TableColumn[] = [
    { key: 'fecha', label: 'Fecha', width: '120px' },
    { key: 'concepto', label: 'Concepto', width: '300px' },
    { key: 'tipo_movimiento', label: 'Tipo', width: '100px' },
    { key: 'monto', label: 'Monto', align: 'right', width: '150px' },
    { key: 'saldo_resultante', label: 'Saldo', align: 'right', width: '150px' },
  ];

  const renderCell = (column: TableColumn, row: MovimientoCC) => {
    switch (column.key) {
      case 'fecha':
        return formatDate(row.fecha);
      case 'tipo_movimiento':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.tipo_movimiento === 'INGRESO'
                ? 'bg-success-100 text-success-700'
                : 'bg-danger-100 text-danger-700'
            }`}
          >
            {row.tipo_movimiento}
          </span>
        );
      case 'monto':
        return (
          <span
            className={`font-semibold ${
              row.tipo_movimiento === 'INGRESO' ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            {row.tipo_movimiento === 'INGRESO' ? '+' : '-'}
            {formatCurrency(row.monto)}
          </span>
        );
      case 'saldo_resultante':
        return (
          <span className="font-semibold text-secondary-900">
            {formatCurrency(row.saldo_resultante)}
          </span>
        );
      default:
        return row[column.key as keyof MovimientoCC];
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ fechaDesde: '', fechaHasta: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Cuentas Corrientes</h1>
        <p className="text-muted mt-1">Gestión de cuentas corrientes</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-4 overflow-x-auto scrollbar-hide">
          {cuentas.map((cuenta) => (
            <button
              key={cuenta.id}
              onClick={() => setSelectedCuentaId(cuenta.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedCuentaId === cuenta.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary-700 hover:border-secondary-300'
              }`}
            >
              {cuenta.nombre}
            </button>
          ))}
        </nav>
      </div>

      {selectedCuenta && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              label="Saldo Actual"
              value={formatCurrency(selectedCuenta.saldo_actual)}
            />
            <MetricCard
              label="Total Ingresos"
              value={formatCurrency(totalIngresos)}
              iconColor="text-success"
            />
            <MetricCard
              label="Total Egresos"
              value={formatCurrency(totalEgresos)}
              iconColor="text-danger"
            />
          </div>

          {/* Filters */}
          <Card title="Filtros">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Desde"
                type="date"
                name="fechaDesde"
                value={filters.fechaDesde}
                onChange={handleFilterChange}
              />
              <Input
                label="Hasta"
                type="date"
                name="fechaHasta"
                value={filters.fechaHasta}
                onChange={handleFilterChange}
              />
              <div className="flex items-end">
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </Card>

          {/* Movements Table */}
          <Card title="Movimientos">
            <Table
              columns={columns}
              data={movimientos}
              loading={movimientosLoading}
              emptyMessage="No hay movimientos para esta cuenta"
              renderCell={renderCell}
            />
          </Card>
        </div>
      )}
    </div>
  );
};

export default CuentasCorrientes;
