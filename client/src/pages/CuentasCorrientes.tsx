import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/tables/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Landmark, Download, X, Edit, Trash2, Check, Upload, AlertTriangle, Plus } from 'lucide-react';
import { cuentasApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { MovimientoCC } from '@/types';
import { showToast } from '@/components/ui/Toast';

const CuentasCorrientes: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipo: 'todos', // 'todos', 'INGRESO', 'EGRESO'
    montoDesde: '',
    montoHasta: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    monto: number;
    concepto: string;
    fecha: string;
  }>({
    monto: 0,
    concepto: '',
    fecha: '',
  });
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

  const [nuevoMovimientoDialog, setNuevoMovimientoDialog] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });

  const [nuevoMovimientoForm, setNuevoMovimientoForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo_movimiento: 'INGRESO' as 'INGRESO' | 'EGRESO',
    concepto: '',
    monto: 0,
  });

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
    setEditValues({ monto: 0, concepto: '', fecha: '' });
  }, [selectedCuentaId]);

  // Reset page when filters or cuenta change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters, selectedCuentaId, itemsPerPage]);

  // Fetch movimientos for selected cuenta with pagination
  const { data: movimientosData, isLoading: movimientosLoading } = useQuery({
    queryKey: ['movimientos-cc', selectedCuentaId, filters.fechaDesde, filters.fechaHasta, filters.tipo, currentPage, itemsPerPage],
    queryFn: () =>
      cuentasApi.getMovimientos(selectedCuentaId!, {
        fecha_desde: filters.fechaDesde || undefined,
        fecha_hasta: filters.fechaHasta || undefined,
        tipo: filters.tipo !== 'todos' ? (filters.tipo as 'INGRESO' | 'EGRESO') : undefined,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      }),
    enabled: !!selectedCuentaId,
  });

  const movimientosRaw = movimientosData?.movimientos || [];
  const totalMovimientos = movimientosData?.total || 0;

  // Aplicar filtros en el frontend
  const movimientos = React.useMemo(() => {
    let filtered = movimientosRaw;

    // Filtro por tipo
    if (filters.tipo !== 'todos') {
      filtered = filtered.filter((m) => m.tipo_movimiento === filters.tipo);
    }

    // Filtro por monto desde
    if (filters.montoDesde && filters.montoDesde !== '') {
      const montoDesde = parseFloat(filters.montoDesde);
      filtered = filtered.filter((m) => m.monto >= montoDesde);
    }

    // Filtro por monto hasta
    if (filters.montoHasta && filters.montoHasta !== '') {
      const montoHasta = parseFloat(filters.montoHasta);
      filtered = filtered.filter((m) => m.monto <= montoHasta);
    }

    return filtered;
  }, [movimientosRaw, filters.tipo, filters.montoDesde, filters.montoHasta]);

  const selectedCuenta = cuentasRentas.find((c) => c.id === selectedCuentaId);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, monto, concepto, fecha }: { id: number; monto?: number; concepto?: string; fecha?: string }) =>
      cuentasApi.updateMovimiento(id, { monto, concepto, fecha }),
    onSuccess: () => {
      showToast.success('✓ Movimiento actualizado correctamente');
      setEditingId(null);
      setEditValues({ monto: 0, concepto: '', fecha: '' });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al actualizar el movimiento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cuentasApi.deleteMovimiento(id),
    onSuccess: () => {
      showToast.success('✓ Movimiento eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al eliminar el movimiento');
    },
  });

  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => cuentasApi.importarCSV(selectedCuentaId!, contenido),
    onSuccess: (data) => {
      showToast.success(`✓ Importación completada: ${data.insertados} movimientos insertados`);
      if (data.errores.length > 0) {
        showToast.warning(`${data.errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', data.errores);
      }
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      showToast.error(`Error al importar: ${error.message}`);
    },
  });

  const limpiarCuentaMutation = useMutation({
    mutationFn: (cuentaId: number) => cuentasApi.limpiarCuenta(cuentaId),
    onSuccess: (data) => {
      showToast.success(data.message);
      setLimpiarDialog({ isOpen: false, cuentaId: null, cuentaNombre: '' });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al limpiar la cuenta');
    },
  });

  const crearMovimientoMutation = useMutation({
    mutationFn: (datos: {
      fecha: string;
      tipo_movimiento: 'INGRESO' | 'EGRESO';
      concepto: string;
      monto: number;
    }) => cuentasApi.createMovimiento(selectedCuentaId!, datos),
    onSuccess: () => {
      showToast.success('✓ Movimiento creado correctamente');
      setNuevoMovimientoDialog({ isOpen: false });
      setNuevoMovimientoForm({
        fecha: new Date().toISOString().split('T')[0],
        tipo_movimiento: 'INGRESO',
        concepto: '',
        monto: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cc', selectedCuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear el movimiento');
    },
  });

  const handleEdit = (row: MovimientoCC) => {
    setEditingId(row.id);
    setEditValues({
      monto: row.monto,
      concepto: row.concepto,
      fecha: row.fecha,
    });
  };

  const handleSaveEdit = (id: number) => {
    if (editValues.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    if (!editValues.concepto.trim()) {
      toast.error('El concepto es requerido');
      return;
    }
    if (!editValues.fecha) {
      toast.error('La fecha es requerida');
      return;
    }
    updateMutation.mutate({ id, ...editValues });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({ monto: 0, concepto: '', fecha: '' });
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
        if (editingId === row.id) {
          return (
            <input
              type="date"
              value={editValues.fecha}
              onChange={(e) => setEditValues({ ...editValues, fecha: e.target.value })}
              className="w-32 rounded border border-border px-2 py-1 text-sm"
              disabled={updateMutation.isPending}
            />
          );
        }
        return formatDate(row.fecha);
      case 'concepto':
        if (editingId === row.id) {
          return (
            <input
              type="text"
              value={editValues.concepto}
              onChange={(e) => setEditValues({ ...editValues, concepto: e.target.value })}
              className="w-full rounded border border-border px-2 py-1 text-sm"
              disabled={updateMutation.isPending}
              placeholder="Concepto"
            />
          );
        }
        return row.concepto;
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
            <input
              type="number"
              step="0.01"
              value={editValues.monto}
              onChange={(e) => setEditValues({ ...editValues, monto: parseFloat(e.target.value) || 0 })}
              className="w-32 rounded border border-border px-2 py-1 text-sm font-mono text-right"
              disabled={updateMutation.isPending}
            />
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
          return (
            <div className="flex items-center gap-2 justify-center">
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
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleEdit(row)}
              className="text-primary hover:text-primary/80"
              title="Editar"
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
    setFilters({ fechaDesde: '', fechaHasta: '', tipo: 'todos', montoDesde: '', montoHasta: '' });
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

  const handleNuevoMovimiento = () => {
    if (!selectedCuentaId) return;
    setNuevoMovimientoDialog({ isOpen: true });
  };

  const handleNuevoMovimientoFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNuevoMovimientoForm((prev) => ({
      ...prev,
      [name]: name === 'monto' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmitNuevoMovimiento = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nuevoMovimientoForm.concepto.trim()) {
      toast.error('El concepto es requerido');
      return;
    }

    if (nuevoMovimientoForm.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    crearMovimientoMutation.mutate(nuevoMovimientoForm);
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

      {/* Actions and Filters Card */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        {/* Botones de Acción */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={handleNuevoMovimiento}
            disabled={!selectedCuentaId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Nuevo Movimiento
          </button>

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

        {/* Filtros */}
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
          <Input
            label="Monto Desde"
            type="number"
            name="montoDesde"
            value={filters.montoDesde}
            onChange={handleFilterChange}
            placeholder="0.00"
            step="0.01"
            className="w-36"
          />
          <Input
            label="Monto Hasta"
            type="number"
            name="montoHasta"
            value={filters.montoHasta}
            onChange={handleFilterChange}
            placeholder="0.00"
            step="0.01"
            className="w-36"
          />
          <Button variant="outline" icon={X} size="md" onClick={handleClearFilters} className="w-24">
            Limpiar
          </Button>
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

        {/* Pagination */}
        {!movimientosLoading && movimientos.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalMovimientos}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
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

      {/* Nuevo Movimiento Modal */}
      {nuevoMovimientoDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">Nuevo Movimiento</h2>
            <form onSubmit={handleSubmitNuevoMovimiento} className="space-y-4">
              <Input
                label="Fecha"
                type="date"
                name="fecha"
                value={nuevoMovimientoForm.fecha}
                onChange={handleNuevoMovimientoFormChange}
                required
              />

              <Select
                label="Tipo de Movimiento"
                name="tipo_movimiento"
                value={nuevoMovimientoForm.tipo_movimiento}
                onChange={handleNuevoMovimientoFormChange}
                options={[
                  { value: 'INGRESO', label: 'INGRESO' },
                  { value: 'EGRESO', label: 'EGRESO' },
                ]}
                required
              />

              <Input
                label="Concepto"
                type="text"
                name="concepto"
                value={nuevoMovimientoForm.concepto}
                onChange={handleNuevoMovimientoFormChange}
                placeholder="Ej: Depósito CAJA, Gastos de RENTAS"
                required
              />

              <Input
                label="Monto"
                type="number"
                name="monto"
                value={nuevoMovimientoForm.monto}
                onChange={handleNuevoMovimientoFormChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={crearMovimientoMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {crearMovimientoMutation.isPending ? 'Creando...' : 'Crear Movimiento'}
                </button>
                <button
                  type="button"
                  onClick={() => setNuevoMovimientoDialog({ isOpen: false })}
                  disabled={crearMovimientoMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-transparent border border-border text-text-secondary hover:bg-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentasCorrientes;
