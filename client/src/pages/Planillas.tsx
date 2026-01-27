import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/tables/Table';
import { controlesApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { ControlSemanal, ControlQuincenal } from '@/types';

const Planillas: React.FC = () => {
  // Fetch controles semanales
  const { data: semanales = [], isLoading: semanalesLoading } = useQuery({
    queryKey: ['controles-semanales'],
    queryFn: () => controlesApi.getSemanales(),
  });

  // Fetch controles quincenales
  const { data: quincenales = [], isLoading: quincenalesLoading } = useQuery({
    queryKey: ['controles-quincenales'],
    queryFn: () => controlesApi.getQuincenales(),
  });

  const semanalesColumns: TableColumn[] = [
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'fecha_inicio', label: 'Desde', width: '120px' },
    { key: 'fecha_fin', label: 'Hasta', width: '120px' },
    { key: 'total_recaudado', label: 'Total', align: 'right', width: '150px' },
    { key: 'fecha_pago_programada', label: 'Pago Programado', width: '150px' },
    { key: 'pagado', label: 'Estado', width: '100px' },
  ];

  const quincenalesColumns: TableColumn[] = [
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'quincena', label: 'Quincena', width: '120px' },
    { key: 'fecha_inicio', label: 'Desde', width: '120px' },
    { key: 'fecha_fin', label: 'Hasta', width: '120px' },
    { key: 'total_recaudado', label: 'Total', align: 'right', width: '150px' },
    { key: 'fecha_pago_programada', label: 'Pago Programado', width: '150px' },
    { key: 'pagado', label: 'Estado', width: '100px' },
  ];

  const renderSemanalCell = (column: TableColumn, row: ControlSemanal) => {
    switch (column.key) {
      case 'fecha_inicio':
      case 'fecha_fin':
      case 'fecha_pago_programada':
        return formatDate(row[column.key]);
      case 'total_recaudado':
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.total_recaudado)}
          </span>
        );
      case 'pagado':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.pagado
                ? 'bg-success-light text-success'
                : 'bg-warning-light text-warning'
            }`}
          >
            {row.pagado ? 'Pagado' : 'Pendiente'}
          </span>
        );
      default:
        return row[column.key as keyof ControlSemanal];
    }
  };

  const renderQuincenalCell = (column: TableColumn, row: ControlQuincenal) => {
    switch (column.key) {
      case 'fecha_inicio':
      case 'fecha_fin':
      case 'fecha_pago_programada':
        return formatDate(row[column.key]);
      case 'total_recaudado':
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.total_recaudado)}
          </span>
        );
      case 'pagado':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.pagado
                ? 'bg-success-light text-success'
                : 'bg-warning-light text-warning'
            }`}
          >
            {row.pagado ? 'Pagado' : 'Pendiente'}
          </span>
        );
      default:
        return row[column.key as keyof ControlQuincenal];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Planillas</h1>
        <p className="text-text-secondary mt-1">Controles de pagos semanales y quincenales</p>
      </div>

      {/* Controles Semanales */}
      <Card
        title="Controles Semanales"
        subtitle="GIT, SUAT, SUCERP, SUGIT - Pago el próximo lunes"
      >
        <Table
          columns={semanalesColumns}
          data={semanales}
          loading={semanalesLoading}
          emptyMessage="No hay controles semanales"
          renderCell={renderSemanalCell}
        />
      </Card>

      {/* Controles Quincenales */}
      <Card
        title="Controles Quincenales"
        subtitle="ARBA - Pago 5 días corridos después de fin de quincena"
      >
        <Table
          columns={quincenalesColumns}
          data={quincenales}
          loading={quincenalesLoading}
          emptyMessage="No hay controles quincenales"
          renderCell={renderQuincenalCell}
        />
      </Card>
    </div>
  );
};

export default Planillas;
