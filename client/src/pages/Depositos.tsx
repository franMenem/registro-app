import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { Table, TableColumn } from '@/components/tables/Table';
import { MetricCard } from '@/components/ui/MetricCard';
import { depositosApi, cuentasApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { Deposito, DepositoCreate, EstadoDeposito } from '@/types';
import { Plus, Trash2, DollarSign, AlertCircle, CheckCircle, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

const Depositos: React.FC = () => {
  const queryClient = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<EstadoDeposito | 'TODOS'>('TODOS');
  const [filtroTitular, setFiltroTitular] = useState<string>('');
  const [filtroMontoMin, setFiltroMontoMin] = useState<string>('');
  const [filtroMontoMax, setFiltroMontoMax] = useState<string>('');
  const [filtroObservaciones, setFiltroObservaciones] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showUsarSaldoModal, setShowUsarSaldoModal] = useState(false);
  const [depositoToUse, setDepositoToUse] = useState<Deposito | null>(null);
  const [usarSaldoData, setUsarSaldoData] = useState({
    monto: 0,
    tipo_uso: 'CAJA' as 'CAJA' | 'RENTAS',
    descripcion: '',
  });
  const [editingDeposito, setEditingDeposito] = useState<Deposito | null>(null);
  const [formData, setFormData] = useState<DepositoCreate>({
    monto_original: 0,
    fecha_ingreso: new Date().toISOString().split('T')[0],
    titular: '',
    observaciones: '',
    cuenta_id: undefined,
  });

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
    titular: string;
  }>({ isOpen: false, depositoId: null, titular: '' });

  const [liquidarDialog, setLiquidarDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
  }>({ isOpen: false, depositoId: null });

  const [devolverDialog, setDevolverDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
  }>({ isOpen: false, depositoId: null });

  // Fetch depósitos
  const { data: depositosRaw = [], isLoading, error: depositosError } = useQuery({
    queryKey: ['depositos', filtroEstado],
    queryFn: () =>
      depositosApi.getAll(filtroEstado !== 'TODOS' ? { estado: filtroEstado } : undefined),
  });

  // Aplicar filtros locales
  const depositos = depositosRaw.filter((deposito) => {
    // Filtro por titular
    if (filtroTitular && !deposito.titular.toLowerCase().includes(filtroTitular.toLowerCase())) {
      return false;
    }

    // Filtro por monto mínimo
    if (filtroMontoMin && deposito.monto_original < parseFloat(filtroMontoMin)) {
      return false;
    }

    // Filtro por monto máximo
    if (filtroMontoMax && deposito.monto_original > parseFloat(filtroMontoMax)) {
      return false;
    }

    // Filtro por observaciones
    if (filtroObservaciones && deposito.observaciones) {
      if (!deposito.observaciones.toLowerCase().includes(filtroObservaciones.toLowerCase())) {
        return false;
      }
    } else if (filtroObservaciones) {
      return false; // No tiene observaciones pero el filtro está activo
    }

    return true;
  });

  // Fetch estadísticas
  const { data: estadisticas, error: estadisticasError } = useQuery({
    queryKey: ['depositos-estadisticas'],
    queryFn: depositosApi.getEstadisticas,
  });

  // Fetch depósitos no asociados
  const { data: depositosNoAsociados = [], error: noAsociadosError } = useQuery({
    queryKey: ['depositos-no-asociados'],
    queryFn: depositosApi.getNoAsociados,
  });

  // Fetch cuentas corrientes para el select
  const { data: cuentasRaw = [], error: cuentasError } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  // Filtrar solo cuentas con nombres en mayúsculas
  const cuentas = cuentasRaw.filter((cuenta) => {
    // Verificar si el nombre está completamente en mayúsculas
    // (puede tener espacios pero todas las letras deben ser mayúsculas)
    return cuenta.nombre === cuenta.nombre.toUpperCase();
  });

  // Mostrar error crítico solo si no se pueden cargar los depósitos
  if (depositosError) {
    return (
      <div className="p-6">
        <div className="bg-error-light border border-error text-error px-4 py-3 rounded">
          <p className="font-bold">Error al cargar depósitos</p>
          <p>{(depositosError as Error).message}</p>
        </div>
      </div>
    );
  }

  // Mutation para crear
  const createMutation = useMutation({
    mutationFn: (data: DepositoCreate) => depositosApi.create(data),
    onSuccess: () => {
      toast.success('Depósito creado correctamente');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear el depósito');
    },
  });

  // Mutation para actualizar
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deposito> }) =>
      depositosApi.update(id, data),
    onSuccess: () => {
      toast.success('Depósito actualizado correctamente');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el depósito');
    },
  });

  // Mutation para eliminar
  const deleteMutation = useMutation({
    mutationFn: (id: number) => depositosApi.delete(id),
    onSuccess: () => {
      toast.success('Depósito eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el depósito');
    },
  });

  // Mutation para cambiar estado
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, accion, data }: { id: number; accion: string; data?: any }) => {
      switch (accion) {
        case 'liquidar':
          return depositosApi.liquidar(id, data.fecha_uso);
        case 'a-favor':
          return depositosApi.marcarAFavor(id, data.saldo_restante);
        case 'devolver':
          return depositosApi.devolver(id, data.fecha_devolucion);
        case 'usar-saldo':
          return depositosApi.usarSaldo(id, data.monto, data.tipo_uso, data.descripcion);
        default:
          throw new Error('Acción no válida');
      }
    },
    onSuccess: () => {
      toast.success('Estado actualizado correctamente');
      setShowUsarSaldoModal(false);
      setDepositoToUse(null);
      setUsarSaldoData({ monto: 0, tipo_uso: 'CAJA', descripcion: '' });
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al cambiar el estado');
    },
  });

  const columns: TableColumn[] = [
    { key: 'fecha_ingreso', label: 'Fecha Ingreso', width: '120px' },
    { key: 'titular', label: 'Titular', width: '180px' },
    { key: 'monto_original', label: 'Monto Original', align: 'right', width: '130px' },
    { key: 'saldo_actual', label: 'Saldo Actual', align: 'right', width: '130px' },
    { key: 'monto_devuelto', label: 'Monto Devuelto', align: 'right', width: '130px' },
    { key: 'estado', label: 'Estado', width: '110px' },
    { key: 'tipo_uso', label: 'Tipo Uso', width: '100px' },
    { key: 'cuenta_nombre', label: 'Cuenta', width: '140px' },
    { key: 'observaciones', label: 'Observaciones', width: '180px' },
    { key: 'actions', label: 'Acciones', align: 'center', width: '180px' },
  ];

  const renderCell = (column: TableColumn, row: Deposito) => {
    switch (column.key) {
      case 'fecha_ingreso':
        return formatDate(row.fecha_ingreso);
      case 'monto_original':
        return (
          <span className="font-semibold font-mono">
            {formatCurrency(row.monto_original)}
          </span>
        );
      case 'saldo_actual':
        return (
          <span className="font-semibold font-mono">
            {formatCurrency(row.saldo_actual)}
          </span>
        );
      case 'monto_devuelto':
        // Mostrar el monto devuelto solo si el estado es DEVUELTO
        if (row.estado === 'DEVUELTO' && row.monto_devuelto > 0) {
          return (
            <span className="font-semibold font-mono text-error">
              {formatCurrency(row.monto_devuelto)}
            </span>
          );
        }
        return <span className="text-text-muted">-</span>;
      case 'estado':
        const estadoColors: Record<EstadoDeposito, string> = {
          PENDIENTE: 'bg-warning-light text-warning',
          LIQUIDADO: 'bg-success-light text-success',
          A_FAVOR: 'bg-primary-light text-primary',
          A_CUENTA: 'bg-secondary-light text-secondary',
          DEVUELTO: 'bg-error-light text-error',
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              estadoColors[row.estado]
            }`}
          >
            {row.estado.replace('_', ' ')}
          </span>
        );
      case 'tipo_uso':
        return row.tipo_uso ? (
          <span className="text-xs text-text-secondary">
            {row.tipo_uso}
          </span>
        ) : (
          '-'
        );
      case 'cuenta_nombre':
        return row.cuenta_nombre || '-';
      case 'observaciones':
        return row.observaciones || '-';
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            {row.estado === 'PENDIENTE' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleLiquidar(row.id)}
                  disabled={cambiarEstadoMutation.isPending}
                >
                  Liquidar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDevolver(row.id)}
                  disabled={cambiarEstadoMutation.isPending}
                >
                  Devolver
                </Button>
              </>
            )}
            {(row.estado === 'A_FAVOR' || row.estado === 'PENDIENTE') && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleUsarSaldo(row)}
                  disabled={cambiarEstadoMutation.isPending}
                >
                  Usar Saldo
                </Button>
                {row.saldo_actual > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDevolver(row.id)}
                    disabled={cambiarEstadoMutation.isPending}
                  >
                    Devolver
                  </Button>
                )}
              </>
            )}
            <button
              onClick={() => handleEdit(row)}
              className="text-primary hover:text-primary/80"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(row.id, row.titular)}
              className="text-error hover:text-error/80"
              title="Eliminar"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      default:
        return row[column.key as keyof Deposito];
    }
  };

  const resetForm = () => {
    setFormData({
      monto_original: 0,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      titular: '',
      observaciones: '',
      cuenta_id: undefined,
    });
    setEditingDeposito(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titular) {
      toast.error('El titular es requerido');
      return;
    }

    if (formData.monto_original <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (editingDeposito) {
      // Actualizar
      updateMutation.mutate({
        id: editingDeposito.id,
        data: {
          observaciones: formData.observaciones,
          cuenta_id: formData.cuenta_id,
        },
      });
    } else {
      // Crear
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (deposito: Deposito) => {
    setEditingDeposito(deposito);
    setFormData({
      monto_original: deposito.monto_original,
      fecha_ingreso: deposito.fecha_ingreso,
      titular: deposito.titular,
      observaciones: deposito.observaciones || '',
      cuenta_id: deposito.cuenta_id || undefined,
    });
    setShowModal(true);
  };

  const handleDelete = (id: number, titular: string) => {
    setDeleteDialog({ isOpen: true, depositoId: id, titular });
  };

  const confirmDelete = () => {
    if (deleteDialog.depositoId) {
      deleteMutation.mutate(deleteDialog.depositoId);
      setDeleteDialog({ isOpen: false, depositoId: null, titular: '' });
    }
  };

  const handleLiquidar = (id: number) => {
    setLiquidarDialog({ isOpen: true, depositoId: id });
  };

  const confirmLiquidar = (fechaUso: string) => {
    if (liquidarDialog.depositoId && fechaUso) {
      cambiarEstadoMutation.mutate({
        id: liquidarDialog.depositoId,
        accion: 'liquidar',
        data: { fecha_uso: fechaUso },
      });
      setLiquidarDialog({ isOpen: false, depositoId: null });
    }
  };

  const handleDevolver = (id: number) => {
    setDevolverDialog({ isOpen: true, depositoId: id });
  };

  const confirmDevolver = (fechaDevolucion: string) => {
    if (devolverDialog.depositoId && fechaDevolucion) {
      cambiarEstadoMutation.mutate({
        id: devolverDialog.depositoId,
        accion: 'devolver',
        data: { fecha_devolucion: fechaDevolucion },
      });
      setDevolverDialog({ isOpen: false, depositoId: null });
    }
  };

  const handleUsarSaldo = (deposito: Deposito) => {
    setDepositoToUse(deposito);
    setUsarSaldoData({
      monto: 0,
      tipo_uso: 'CAJA',
      descripcion: '',
    });
    setShowUsarSaldoModal(true);
  };

  const handleSubmitUsarSaldo = () => {
    if (!depositoToUse) return;

    if (usarSaldoData.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (usarSaldoData.monto > depositoToUse.saldo_actual) {
      toast.error(`El monto no puede superar el saldo disponible (${formatCurrency(depositoToUse.saldo_actual)})`);
      return;
    }

    cambiarEstadoMutation.mutate({
      id: depositoToUse.id,
      accion: 'usar-saldo',
      data: usarSaldoData,
    });
  };

  // Si está cargando
  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Cargando depósitos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Depósitos</h1>
          <p className="text-text-secondary mt-1">Gestión de depósitos y saldos a favor</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
          Nuevo Depósito
        </Button>
      </div>

      {/* Estadísticas */}
      {estadisticas && estadisticas.total !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            label="Total"
            value={estadisticas.total.toString()}
            icon={DollarSign}
            iconColor="text-primary"
          />
          <MetricCard
            label="Pendientes"
            value={estadisticas.pendientes.toString()}
            icon={AlertCircle}
            iconColor="text-warning"
          />
          <MetricCard
            label="Liquidados"
            value={estadisticas.liquidados.toString()}
            icon={CheckCircle}
            iconColor="text-success"
          />
          <MetricCard
            label="A Favor"
            value={estadisticas.a_favor.toString()}
            icon={DollarSign}
            iconColor="text-primary"
          />
          <MetricCard
            label="A Cuenta"
            value={estadisticas.a_cuenta.toString()}
            icon={CheckCircle}
            iconColor="text-secondary"
          />
          <MetricCard
            label="Saldo Disponible"
            value={formatCurrency(estadisticas.saldo_total_disponible)}
            icon={DollarSign}
            iconColor="text-success"
          />
        </div>
      )}

      {/* Filtros */}
      <Card title="Filtros">
        <div className="space-y-4">
          {/* Primera fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              >
                <option value="TODOS">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="LIQUIDADO">Liquidados</option>
                <option value="A_FAVOR">A Favor</option>
                <option value="A_CUENTA">A Cuenta</option>
                <option value="DEVUELTO">Devueltos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Buscar por Titular
              </label>
              <input
                type="text"
                value={filtroTitular}
                onChange={(e) => setFiltroTitular(e.target.value)}
                placeholder="Ingrese nombre del titular..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Buscar en Observaciones
              </label>
              <input
                type="text"
                value={filtroObservaciones}
                onChange={(e) => setFiltroObservaciones(e.target.value)}
                placeholder="Ingrese texto a buscar..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>
          </div>

          {/* Segunda fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Monto Original Mínimo
              </label>
              <input
                type="number"
                step="0.01"
                value={filtroMontoMin}
                onChange={(e) => setFiltroMontoMin(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Monto Original Máximo
              </label>
              <input
                type="number"
                step="0.01"
                value={filtroMontoMax}
                onChange={(e) => setFiltroMontoMax(e.target.value)}
                placeholder="999999.99"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFiltroTitular('');
                  setFiltroMontoMin('');
                  setFiltroMontoMax('');
                  setFiltroObservaciones('');
                  setFiltroEstado('TODOS');
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-text-secondary">
            Mostrando {depositos.length} de {depositosRaw.length} depósito{depositosRaw.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Depósitos No Asociados */}
      {depositosNoAsociados.length > 0 && (
        <Card
          title="⚠️ Depósitos No Asociados"
          subtitle={`${depositosNoAsociados.length} depósito${depositosNoAsociados.length > 1 ? 's' : ''} sin asociar a movimientos`}
        >
          <div className="space-y-2">
            {depositosNoAsociados.map((deposito) => (
              <div
                key={deposito.id}
                className="flex items-center justify-between p-3 rounded-lg border border-warning bg-warning-light"
              >
                <div>
                  <p className="font-medium text-text-primary">{deposito.titular}</p>
                  <p className="text-sm text-text-secondary">
                    Ingreso: {formatDate(deposito.fecha_ingreso)} - Saldo: {formatCurrency(deposito.saldo_actual)}
                  </p>
                </div>
                <span className="text-lg font-semibold text-text-primary font-mono">
                  {formatCurrency(deposito.monto_original)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla de Depósitos */}
      <Card title="Todos los Depósitos">
        <Table
          columns={columns}
          data={depositos}
          loading={isLoading}
          emptyMessage="No hay depósitos registrados"
          renderCell={renderCell}
        />
      </Card>

      {/* Modal para crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              {editingDeposito ? 'Editar Depósito' : 'Nuevo Depósito'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Titular *
                </label>
                <input
                  type="text"
                  value={formData.titular}
                  onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!!editingDeposito}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Monto *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto_original}
                  onChange={(e) =>
                    setFormData({ ...formData, monto_original: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!!editingDeposito}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Fecha de Ingreso *
                </label>
                <input
                  type="date"
                  value={formData.fecha_ingreso}
                  onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!!editingDeposito}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Cuenta Corriente (opcional)
                </label>
                <select
                  value={formData.cuenta_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cuenta_id: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                >
                  <option value="">Ninguna</option>
                  {cuentas.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  rows={3}
                />
              </div>

              {editingDeposito && (
                <div className="text-sm text-text-secondary bg-background border border-border rounded p-3">
                  ℹ️ Al editar solo puedes cambiar la Cuenta Corriente y las Observaciones
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : editingDeposito
                    ? 'Actualizar'
                    : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para usar saldo */}
      {showUsarSaldoModal && depositoToUse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">Usar Saldo del Depósito</h2>

            <div className="mb-4 p-4 bg-primary-light rounded-lg">
              <p className="text-sm text-text-secondary">Titular: <span className="font-semibold text-text-primary">{depositoToUse.titular}</span></p>
              <p className="text-sm text-text-secondary">Saldo Disponible: <span className="font-semibold text-text-primary">{formatCurrency(depositoToUse.saldo_actual)}</span></p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitUsarSaldo(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Monto a Usar *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={usarSaldoData.monto}
                  onChange={(e) =>
                    setUsarSaldoData({ ...usarSaldoData, monto: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Tipo de Uso *
                </label>
                <select
                  value={usarSaldoData.tipo_uso}
                  onChange={(e) =>
                    setUsarSaldoData({ ...usarSaldoData, tipo_uso: e.target.value as 'CAJA' | 'RENTAS' })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                >
                  <option value="CAJA">CAJA</option>
                  <option value="RENTAS">RENTAS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={usarSaldoData.descripcion}
                  onChange={(e) => setUsarSaldoData({ ...usarSaldoData, descripcion: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  rows={3}
                  placeholder="Ej: Pago de gastos varios, Compra de insumos, etc."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={cambiarEstadoMutation.isPending}
                  className="flex-1"
                >
                  {cambiarEstadoMutation.isPending ? 'Procesando...' : 'Usar Saldo'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUsarSaldoModal(false);
                    setDepositoToUse(null);
                  }}
                  disabled={cambiarEstadoMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, depositoId: null, titular: '' })}
        onConfirm={confirmDelete}
        title="Eliminar Depósito"
        message={`¿Está seguro que desea eliminar el depósito de "${deleteDialog.titular}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Liquidar Prompt Dialog */}
      <PromptDialog
        isOpen={liquidarDialog.isOpen}
        onClose={() => setLiquidarDialog({ isOpen: false, depositoId: null })}
        onConfirm={confirmLiquidar}
        title="Liquidar Depósito"
        message="Ingrese la fecha de uso del depósito:"
        placeholder="YYYY-MM-DD"
        defaultValue={new Date().toISOString().split('T')[0]}
        confirmText="Liquidar"
        cancelText="Cancelar"
        inputType="date"
      />

      {/* Devolver Prompt Dialog */}
      <PromptDialog
        isOpen={devolverDialog.isOpen}
        onClose={() => setDevolverDialog({ isOpen: false, depositoId: null })}
        onConfirm={confirmDevolver}
        title="Devolver Depósito"
        message="Ingrese la fecha de devolución del depósito:"
        placeholder="YYYY-MM-DD"
        defaultValue={new Date().toISOString().split('T')[0]}
        confirmText="Devolver"
        cancelText="Cancelar"
        inputType="date"
      />
    </div>
  );
};

export default Depositos;
