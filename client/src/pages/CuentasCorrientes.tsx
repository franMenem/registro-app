import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/tables/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Landmark, Download, X, Edit, Trash2, Check, Upload, AlertTriangle } from 'lucide-react';
import { cuentasApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { MovimientoCC } from '@/types';
import toast from 'react-hot-toast';

const CuentasCorrientes: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipo: 'todos', // 'todos', 'INGRESO', 'EGRESO'
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    concepto: string;
  }>({ isOpen: false, id: null, concepto: '' });

  const [limpiarDialog, setLimpiarDialog] = useState<{
    isOpen: boolean;
    cuentaId: number | null;
    cuentaNombre: string;
  }>({ isOpen: false, cuentaId: null, cuentaNombre: '' });

  // Fetch cuentas desde el backend
  const { data: cuentas = [], isLoading: cuentasLoading } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  // Filtrar solo las 8 cuentas de gastos RENTAS
  const cuentasRentas = cuentas.filter((c) =>
    ['ICBC', 'FORD', 'SICARDI', 'PATAGONIA', 'IVECO', 'CNH', 'GESTORIA FORD', 'ALRA'].includes(
      c.nombre
    )
  );

  // Set initial selected cuenta when cuentas load
  React.useEffect(() => {
    if (cuentasRentas.length > 0 && !selectedCuentaId) {
      setSelectedCuentaId(cuentasRentas[0].id);
    }
  }, [cuentasRentas, selectedCuentaId]);

  // Cancel edit when changing cuenta
  React.useEffect(() => {
    setEditingId(null);
    setEditValue(0);
  }, [selectedCuentaId]);

  // Fetch movimientos for selected cuenta
  const { data: movimientosRaw = [], isLoading: movimientosLoading } = useQuery({
    queryKey: ['movimientos-cc', selectedCuentaId, filters.fechaDesde, filters.fechaHasta],
    queryFn: () =>
      cuentasApi.getMovimientos(selectedCuentaId!, {
        fecha_desde: filters.fechaDesde || undefined,
        fecha_hasta: filters.fechaHasta || undefined,
      }),
    enabled: !!selectedCuentaId,
  });

  // Aplicar filtro de tipo en el frontend
  const movimientos = React.useMemo(() => {
    if (filters.tipo === 'todos') {
      return movimientosRaw;
    }
    return movimientosRaw.filter((m) => m.tipo_movimiento === filters.tipo);
  }, [movimientosRaw, filters.tipo]);

  const selectedCuenta = cuentasRentas.find((c) => c.id === selectedCuentaId);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      cuentasApi.updateMovimiento(id, { monto }),
    onSuccess: () => {
      toast.success('Movimiento actualizado correctamente');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el movimiento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cuentasApi.deleteMovimiento(id),
    onSuccess: () => {
      toast.success('Movimiento eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el movimiento');
    },
  });

  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => cuentasApi.importarCSV(selectedCuentaId!, contenido),
    onSuccess: (data) => {
      toast.success(`Importación completada: ${data.insertados} movimientos insertados`);
      if (data.errores.length > 0) {
        toast.error(`${data.errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', data.errores);
      }
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });

  const limpiarCuentaMutation = useMutation({
    mutationFn: (cuentaId: number) => cuentasApi.limpiarCuenta(cuentaId),
    onSuccess: (data) => {
      toast.success(data.message);
      setLimpiarDialog({ isOpen: false, cuentaId: null, cuentaNombre: '' });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al limpiar la cuenta');
    },
  });

  const handleEdit = (id: number, currentValue: number) => {
    setEditingId(id);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (id: number) => {
    if (editValue <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    updateMutation.mutate({ id, monto: editValue });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue(0);
  };

  const handleDelete = (id: number, concepto: string) => {
    setDeleteDialog({ isOpen: true, id, concepto });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      deleteMutation.mutate(deleteDialog.id);
      setDeleteDialog({ isOpen: false, id: null, concepto: '' });
    }
  };

  // Calculate stats - HISTÓRICOS (todos los movimientos)
  const totalIngresos = movimientos
    .filter((m) => m.tipo_movimiento === 'INGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalEgresos = movimientos
    .filter((m) => m.tipo_movimiento === 'EGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const saldoActual = selectedCuenta?.saldo_actual || 0;

  const promedioDiario = movimientos.length > 0 ? totalEgresos / movimientos.length : 0;
  const ultimoMovimiento = movimientos.length > 0 ? movimientos[0].fecha : null;

  const columns: TableColumn[] = [
    { key: 'fecha', label: 'Fecha', width: '120px' },
    { key: 'concepto', label: 'Concepto', width: '200px' },
    { key: 'tipo_movimiento', label: 'Tipo', width: '100px' },
    { key: 'monto', label: 'Monto', align: 'right', width: '150px' },
    { key: 'saldo_resultante', label: 'Saldo', align: 'right', width: '150px' },
    { key: 'actions', label: 'Acciones', align: 'center', width: '120px' },
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
                ? 'bg-success-light text-success'
                : 'bg-error-light text-error'
            }`}
          >
            {row.tipo_movimiento}
          </span>
        );
      case 'monto':
        if (editingId === row.id) {
          return (
            <div className="flex items-center gap-2 justify-end">
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                className="w-32 rounded border border-border px-2 py-1 text-sm font-mono text-right"
                autoFocus
                disabled={updateMutation.isPending}
              />
              <button
                onClick={() => handleSaveEdit(row.id)}
                className="text-success hover:text-success/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Guardar"
                disabled={updateMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-error hover:text-error/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cancelar"
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return (
          <span
            className={`font-semibold font-mono ${
              row.tipo_movimiento === 'INGRESO' ? 'text-success' : 'text-error'
            }`}
          >
            {row.tipo_movimiento === 'INGRESO' ? '+' : '-'}
            {formatCurrency(row.monto)}
          </span>
        );
      case 'saldo_resultante':
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.saldo_resultante)}
          </span>
        );
      case 'actions':
        if (editingId === row.id) {
          return null; // Los botones ya están en la celda de monto
        }
        return (
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleEdit(row.id, row.monto)}
              className="text-primary hover:text-primary/80"
              title="Editar monto"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(row.id, row.concepto)}
              className="text-error hover:text-error/80"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      default:
        return row[column.key as keyof MovimientoCC];
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ fechaDesde: '', fechaHasta: '', tipo: 'todos' });
  };

  const handleExportExcel = () => {
    // TODO: Implementar exportación a Excel
    alert('Exportar a Excel - Funcionalidad pendiente');
  };

  const handleImportarClick = () => {
    fileInputRef.current?.click();
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor seleccioná un archivo CSV');
      return;
    }

    try {
      const contenido = await file.text();
      importarCSVMutation.mutate(contenido);
    } catch (error) {
      toast.error('Error al leer el archivo');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLimpiarCuenta = () => {
    if (!selectedCuenta) return;
    setLimpiarDialog({
      isOpen: true,
      cuentaId: selectedCuenta.id,
      cuentaNombre: selectedCuenta.nombre,
    });
  };

  const handleConfirmarLimpiar = () => {
    if (limpiarDialog.cuentaId) {
      limpiarCuentaMutation.mutate(limpiarDialog.cuentaId);
    }
  };

  if (cuentasLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Cargando cuentas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold text-text-primary">
          Cuentas Corrientes - {selectedCuenta?.nombre || 'Cargando...'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <nav className="flex space-x-0 overflow-x-auto scrollbar-hide">
          {cuentasRentas.map((cuenta) => (
            <button
              key={cuenta.id}
              onClick={() => setSelectedCuentaId(cuenta.id)}
              className={`whitespace-nowrap py-3 px-6 text-sm font-medium transition-colors ${
                selectedCuentaId === cuenta.id
                  ? 'text-white bg-primary border-b-4 border-primary'
                  : 'text-text-secondary bg-transparent hover:text-text-primary'
              }`}
            >
              {cuenta.nombre}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Card */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold text-text-primary">
            {selectedCuenta?.nombre} - Cuenta Corriente
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-secondary">
              Total Ingresos Histórico
            </p>
            <p className="text-3xl font-bold text-success font-mono">
              {formatCurrency(totalIngresos)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-secondary">
              Total Egresos Histórico
            </p>
            <p className="text-3xl font-bold text-error font-mono">
              {formatCurrency(totalEgresos)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-secondary">
              Saldo Actual Disponible
            </p>
            <p className={`text-3xl font-bold font-mono ${saldoActual >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(saldoActual)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <span className="text-sm text-text-secondary">
              Promedio diario egresos: {formatCurrency(promedioDiario)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <span className="text-sm text-text-secondary">
              Total movimientos: {movimientos.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <span className="text-sm text-text-secondary">
              Último movimiento: {ultimoMovimiento ? formatDate(ultimoMovimiento) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <Input
              label="Fecha Desde"
              type="date"
              name="fechaDesde"
              value={filters.fechaDesde}
              onChange={handleFilterChange}
              className="w-40"
            />
            <Input
              label="Fecha Hasta"
              type="date"
              name="fechaHasta"
              value={filters.fechaHasta}
              onChange={handleFilterChange}
              className="w-40"
            />
            <Select
              label="Tipo de Movimiento"
              name="tipo"
              value={filters.tipo}
              onChange={handleFilterChange}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'INGRESO', label: 'INGRESO' },
                { value: 'EGRESO', label: 'EGRESO' },
              ]}
              className="w-48"
            />
            <Button variant="outline" icon={X} size="md" onClick={handleClearFilters} className="w-24">
              Limpiar
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleImportarClick}
              disabled={importarCSVMutation.isPending || !selectedCuentaId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {importarCSVMutation.isPending ? 'Importando...' : 'Importar CSV'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleArchivoSeleccionado}
              className="hidden"
            />

            <button
              onClick={handleLimpiarCuenta}
              disabled={limpiarCuentaMutation.isPending || !selectedCuentaId || movimientos.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Eliminar todos los movimientos de esta cuenta"
            >
              <Trash2 className="h-4 w-4" />
              {limpiarCuentaMutation.isPending ? 'Limpiando...' : 'Limpiar Cuenta'}
            </button>

            <Button
              variant="primary"
              icon={Download}
              size="md"
              onClick={handleExportExcel}
              className="bg-success hover:bg-success/90"
            >
              Exportar Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table
          columns={columns}
          data={movimientos}
          loading={movimientosLoading}
          emptyMessage="No hay movimientos para esta cuenta"
          renderCell={renderCell}
        />
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, concepto: '' })}
        onConfirm={confirmDelete}
        title="Eliminar Movimiento"
        message={`¿Está seguro que desea eliminar el movimiento "${deleteDialog.concepto}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Limpiar Cuenta Confirm Dialog */}
      <ConfirmDialog
        isOpen={limpiarDialog.isOpen}
        onClose={() => setLimpiarDialog({ isOpen: false, cuentaId: null, cuentaNombre: '' })}
        onConfirm={handleConfirmarLimpiar}
        title="⚠️ Limpiar Cuenta Corriente"
        message={`¿Está seguro que desea eliminar TODOS los movimientos de la cuenta "${limpiarDialog.cuentaNombre}"?\n\nEsta acción es IRREVERSIBLE y eliminará ${movimientos.length} movimiento(s).\n\nEl saldo de la cuenta se reseteará a $0.`}
        confirmText="Sí, Limpiar Todo"
        cancelText="Cancelar"
        variant="danger"
        isLoading={limpiarCuentaMutation.isPending}
      />
    </div>
  );
};

export default CuentasCorrientes;
