import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/tables/Table';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlesApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { ControlSemanal, ControlQuincenal } from '@/types';
import { Edit, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Planillas: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingSemanalId, setEditingSemanalId] = useState<number | null>(null);
  const [editingQuincenalId, setEditingQuincenalId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    tipo: 'semanal' | 'quincenal' | null;
    concepto: string;
  }>({ isOpen: false, id: null, tipo: null, concepto: '' });

  const [togglePagadoDialog, setTogglePagadoDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    tipo: 'semanal' | 'quincenal' | null;
    concepto: string;
    pagadoActual: boolean;
  }>({ isOpen: false, id: null, tipo: null, concepto: '', pagadoActual: false });

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
    { key: 'concepto_tipo', label: 'Tipo', width: '100px' },
    { key: 'fecha_inicio', label: 'Desde', width: '120px' },
    { key: 'fecha_fin', label: 'Hasta', width: '120px' },
    { key: 'total_recaudado', label: 'Total', align: 'right', width: '150px' },
    { key: 'fecha_pago_programada', label: 'Pago Programado', width: '150px' },
    { key: 'pagado', label: 'Estado', width: '100px' },
    { key: 'actions', label: 'Acciones', width: '100px', align: 'center' },
  ];

  const quincenalesColumns: TableColumn[] = [
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'concepto_tipo', label: 'Tipo', width: '100px' },
    { key: 'quincena', label: 'Quincena', width: '120px' },
    { key: 'fecha_inicio', label: 'Desde', width: '120px' },
    { key: 'fecha_fin', label: 'Hasta', width: '120px' },
    { key: 'total_recaudado', label: 'Total', align: 'right', width: '150px' },
    { key: 'fecha_pago_programada', label: 'Pago Programado', width: '150px' },
    { key: 'pagado', label: 'Estado', width: '100px' },
    { key: 'actions', label: 'Acciones', width: '100px', align: 'center' },
  ];

  const handleEditSemanal = (id: number, currentValue: number) => {
    setEditingSemanalId(id);
    setEditValue(currentValue);
  };

  const handleEditQuincenal = (id: number, currentValue: number) => {
    setEditingQuincenalId(id);
    setEditValue(currentValue);
  };

  // Mutation para actualizar monto semanal
  const updateSemanalMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      controlesApi.updateMontoSemanal(id, monto),
    onSuccess: () => {
      toast.success('Monto actualizado correctamente');
      setEditingSemanalId(null);
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el monto');
    },
  });

  // Mutation para actualizar monto quincenal
  const updateQuincenalMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      controlesApi.updateMontoQuincenal(id, monto),
    onSuccess: () => {
      toast.success('Monto actualizado correctamente');
      setEditingQuincenalId(null);
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el monto');
    },
  });

  // Mutation para eliminar control semanal
  const deleteSemanalMutation = useMutation({
    mutationFn: (id: number) => controlesApi.deleteSemanal(id),
    onSuccess: () => {
      toast.success('Control eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el control');
    },
  });

  // Mutation para eliminar control quincenal
  const deleteQuincenalMutation = useMutation({
    mutationFn: (id: number) => controlesApi.deleteQuincenal(id),
    onSuccess: () => {
      toast.success('Control eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el control');
    },
  });

  const handleSaveSemanalEdit = (id: number) => {
    if (editValue < 0) {
      toast.error('El monto no puede ser negativo');
      return;
    }
    updateSemanalMutation.mutate({ id, monto: editValue });
  };

  const handleSaveQuincenalEdit = (id: number) => {
    if (editValue < 0) {
      toast.error('El monto no puede ser negativo');
      return;
    }
    updateQuincenalMutation.mutate({ id, monto: editValue });
  };

  const handleCancelSemanalEdit = () => {
    setEditingSemanalId(null);
    setEditValue(0);
  };

  const handleCancelQuincenalEdit = () => {
    setEditingQuincenalId(null);
    setEditValue(0);
  };

  const handleDelete = (id: number, tipo: 'semanal' | 'quincenal', concepto: string) => {
    setDeleteDialog({ isOpen: true, id, tipo, concepto });
  };

  const confirmDelete = () => {
    if (deleteDialog.id && deleteDialog.tipo) {
      if (deleteDialog.tipo === 'semanal') {
        deleteSemanalMutation.mutate(deleteDialog.id);
      } else {
        deleteQuincenalMutation.mutate(deleteDialog.id);
      }
      setDeleteDialog({ isOpen: false, id: null, tipo: null, concepto: '' });
    }
  };

  // Mutation para cambiar estado de pagado (semanal)
  const togglePagadoSemanalMutation = useMutation({
    mutationFn: ({ id, pagado }: { id: number; pagado: boolean }) => {
      if (pagado) {
        // Marcar como pagado
        const hoy = new Date().toISOString().split('T')[0];
        return controlesApi.pagarSemanal(id, hoy);
      } else {
        // Desmarcar como pagado
        return controlesApi.desmarcarPagoSemanal(id);
      }
    },
    onSuccess: () => {
      toast.success('Estado actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['controles-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-pagos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar estado');
    },
  });

  // Mutation para cambiar estado de pagado (quincenal)
  const togglePagadoQuincenalMutation = useMutation({
    mutationFn: ({ id, pagado }: { id: number; pagado: boolean }) => {
      if (pagado) {
        // Marcar como pagado
        const hoy = new Date().toISOString().split('T')[0];
        return controlesApi.pagarQuincenal(id, hoy);
      } else {
        // Desmarcar como pagado
        return controlesApi.desmarcarPagoQuincenal(id);
      }
    },
    onSuccess: () => {
      toast.success('Estado actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['controles-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-pagos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar estado');
    },
  });

  const handleTogglePagado = (id: number, tipo: 'semanal' | 'quincenal', concepto: string, pagadoActual: boolean) => {
    setTogglePagadoDialog({ isOpen: true, id, tipo, concepto, pagadoActual });
  };

  const confirmTogglePagado = () => {
    if (togglePagadoDialog.id && togglePagadoDialog.tipo !== null) {
      const pagadoNuevo = !togglePagadoDialog.pagadoActual;
      if (togglePagadoDialog.tipo === 'semanal') {
        togglePagadoSemanalMutation.mutate({ id: togglePagadoDialog.id, pagado: pagadoNuevo });
      } else {
        togglePagadoQuincenalMutation.mutate({ id: togglePagadoDialog.id, pagado: pagadoNuevo });
      }
      setTogglePagadoDialog({ isOpen: false, id: null, tipo: null, concepto: '', pagadoActual: false });
    }
  };

  const renderSemanalCell = (column: TableColumn, row: ControlSemanal) => {
    switch (column.key) {
      case 'fecha_inicio':
      case 'fecha_fin':
      case 'fecha_pago_programada':
        return formatDate(row[column.key]);
      case 'concepto_tipo':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.concepto_tipo === 'RENTAS'
                ? 'bg-primary-light text-primary'
                : 'bg-secondary-light text-secondary'
            }`}
          >
            {row.concepto_tipo}
          </span>
        );
      case 'total_recaudado':
        if (editingSemanalId === row.id) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                className="w-32 rounded border border-border px-2 py-1 text-sm font-mono"
                autoFocus
                disabled={updateSemanalMutation.isPending}
              />
              <button
                onClick={() => handleSaveSemanalEdit(row.id)}
                className="text-success hover:text-success/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Guardar"
                disabled={updateSemanalMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelSemanalEdit}
                className="text-error hover:text-error/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cancelar"
                disabled={updateSemanalMutation.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.total_recaudado)}
          </span>
        );
      case 'pagado':
        return (
          <button
            onClick={() => handleTogglePagado(row.id, 'semanal', row.concepto_nombre, row.pagado)}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
              row.pagado
                ? 'bg-success-light text-success'
                : 'bg-warning-light text-warning'
            }`}
            title="Click para cambiar estado"
          >
            {row.pagado ? 'Pagado' : 'Pendiente'}
          </button>
        );
      case 'actions':
        if (editingSemanalId === row.id) {
          return null; // Los botones ya están en la celda de monto
        }
        return (
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleEditSemanal(row.id, row.total_recaudado)}
              className="text-primary hover:text-primary/80"
              title="Editar monto"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(row.id, 'semanal', row.concepto_nombre)}
              className="text-error hover:text-error/80"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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
      case 'concepto_tipo':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.concepto_tipo === 'RENTAS'
                ? 'bg-primary-light text-primary'
                : 'bg-secondary-light text-secondary'
            }`}
          >
            {row.concepto_tipo}
          </span>
        );
      case 'total_recaudado':
        if (editingQuincenalId === row.id) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                className="w-32 rounded border border-border px-2 py-1 text-sm font-mono"
                autoFocus
                disabled={updateQuincenalMutation.isPending}
              />
              <button
                onClick={() => handleSaveQuincenalEdit(row.id)}
                className="text-success hover:text-success/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Guardar"
                disabled={updateQuincenalMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelQuincenalEdit}
                className="text-error hover:text-error/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cancelar"
                disabled={updateQuincenalMutation.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.total_recaudado)}
          </span>
        );
      case 'pagado':
        return (
          <button
            onClick={() => handleTogglePagado(row.id, 'quincenal', row.concepto_nombre, row.pagado)}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
              row.pagado
                ? 'bg-success-light text-success'
                : 'bg-warning-light text-warning'
            }`}
            title="Click para cambiar estado"
          >
            {row.pagado ? 'Pagado' : 'Pendiente'}
          </button>
        );
      case 'actions':
        if (editingQuincenalId === row.id) {
          return null; // Los botones ya están en la celda de monto
        }
        return (
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleEditQuincenal(row.id, row.total_recaudado)}
              className="text-primary hover:text-primary/80"
              title="Editar monto"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(row.id, 'quincenal', row.concepto_nombre)}
              className="text-error hover:text-error/80"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, tipo: null, concepto: '' })}
        onConfirm={confirmDelete}
        title="Eliminar Control"
        message={`¿Está seguro que desea eliminar el control "${deleteDialog.concepto}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteSemanalMutation.isPending || deleteQuincenalMutation.isPending}
      />

      {/* Toggle Pagado Confirm Dialog */}
      <ConfirmDialog
        isOpen={togglePagadoDialog.isOpen}
        onClose={() => setTogglePagadoDialog({ isOpen: false, id: null, tipo: null, concepto: '', pagadoActual: false })}
        onConfirm={confirmTogglePagado}
        title="Confirmar Cambio de Estado"
        message={
          `⚠️ ¿CONFIRMAR CAMBIO DE ESTADO?\n\n` +
          `Concepto: ${togglePagadoDialog.concepto}\n` +
          `Estado actual: ${togglePagadoDialog.pagadoActual ? 'PAGADO' : 'PENDIENTE'}\n` +
          `Nueva acción: ${togglePagadoDialog.pagadoActual ? 'DESMARCAR como NO PAGADO' : 'MARCAR como PAGADO'}\n\n` +
          `¿Desea continuar?`
        }
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="warning"
        isLoading={togglePagadoSemanalMutation.isPending || togglePagadoQuincenalMutation.isPending}
      />
    </div>
  );
};

export default Planillas;
