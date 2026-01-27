import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, Wallet, FileText, AlertCircle, Plus } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableColumn } from '@/components/tables/Table';
import { dashboardApi, movimientosApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { Movimiento } from '@/types';

const Dashboard: React.FC = () => {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  // Fetch recent movements
  const { data: movimientos = [], isLoading: movimientosLoading } = useQuery({
    queryKey: ['movimientos', { limit: 20 }],
    queryFn: () => movimientosApi.getAll({ limit: 20 }),
  });

  const columns: TableColumn[] = [
    { key: 'fecha', label: 'Fecha', width: '120px' },
    { key: 'tipo', label: 'Tipo', width: '100px' },
    { key: 'cuit', label: 'CUIT', width: '150px' },
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'monto', label: 'Monto', align: 'right', width: '150px' },
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
                : 'bg-success-light text-success'
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
      default:
        return row[column.key as keyof Movimiento];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Resumen de movimientos de hoy</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total RENTAS Hoy"
          value={statsLoading ? '...' : formatCurrency(stats?.total_rentas_hoy || 0)}
          icon={DollarSign}
          iconColor="text-primary"
        />
        <MetricCard
          label="Total CAJA Hoy"
          value={statsLoading ? '...' : formatCurrency(stats?.total_caja_hoy || 0)}
          icon={Wallet}
          iconColor="text-success"
        />
        <MetricCard
          label="Movimientos Hoy"
          value={statsLoading ? '...' : stats?.movimientos_count || 0}
          icon={FileText}
          iconColor="text-secondary"
        />
        <MetricCard
          label="Pagos Próximos (7 días)"
          value={statsLoading ? '...' : stats?.alertas_pagos || 0}
          icon={AlertCircle}
          iconColor="text-warning"
        />
      </div>

      {/* Quick Actions */}
      <Card title="Acciones Rápidas">
        <div className="flex flex-wrap gap-4">
          <Link to="/rentas">
            <Button variant="primary" icon={Plus}>
              Nuevo Movimiento RENTAS
            </Button>
          </Link>
          <Link to="/caja">
            <Button variant="secondary" icon={Plus}>
              Nuevo Movimiento CAJA
            </Button>
          </Link>
          <Link to="/planillas">
            <Button variant="outline">Ver Controles</Button>
          </Link>
        </div>
      </Card>

      {/* Recent Movements */}
      <Card title="Últimos Movimientos" subtitle="Movimientos más recientes">
        <Table
          columns={columns}
          data={movimientos}
          loading={movimientosLoading}
          emptyMessage="No hay movimientos registrados"
          renderCell={renderCell}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
