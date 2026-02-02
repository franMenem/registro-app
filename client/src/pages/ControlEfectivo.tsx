import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingDown, TrendingUp, Trash2, Edit2, X, DollarSign, Plus } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableColumn } from '@/components/tables/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/utils/format';
import { showToast } from '@/components/ui/Toast';
import api from '@/services/api';
import { CuentaCorriente } from '@/types';

interface EfectivoStats {
  saldo_inicial: number;
  total_rentas: number;
  total_caja: number;
  total_gastos: number;
  total_depositos: number;
  saldo_actual: number;
}

interface MovimientoEfectivo {
  id: number;
  fecha: string;
  tipo: 'INGRESO' | 'GASTO' | 'DEPOSITO';
  concepto: string;
  monto: number;
  cuenta_id: number | null;
  cuenta_nombre?: string;
  observaciones: string | null;
  created_at: string;
}

interface EfectivoConfig {
  id: number;
  saldo_inicial: number;
  updated_at: string;
}

const ControlEfectivo: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingSaldoInicial, setEditingSaldoInicial] = useState(false);
  const [nuevoSaldoInicial, setNuevoSaldoInicial] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<MovimientoEfectivo | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    movimiento: MovimientoEfectivo | null;
  }>({ isOpen: false, movimiento: null });

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'GASTO' as 'GASTO' | 'DEPOSITO',
    categoria: 'GENERICO' as 'GENERICO' | 'REGISTRAL' | 'PERSONAL',
    concepto: '',
    concepto_especifico: '',
    monto: '',
    cuenta_id: '',
    observaciones: '',
  });

  // Conceptos de Gastos Registrales
  const CONCEPTOS_REGISTRALES = [
    'ABL', 'ACARA', 'ADT', 'AERPA', 'AFIP', 'AGUA', 'ALEJANDRO', 'AYSA',
    'CARCOS', 'CARGAS_SOCIALES', 'CONTADOR', 'CORREO', 'EDESUR',
    'EMERGENCIAS', 'EXPENSAS', 'FED_PATRONAL', 'FIBERTEL', 'LIBRERIA',
    'OTROS', 'SUELDOS', 'SUPERMERCADOS', 'TELEFONOS', 'TOTALNET'
  ];

  // Conceptos de Gastos Personales
  const CONCEPTOS_PERSONALES = ['Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop'];

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<EfectivoStats>({
    queryKey: ['efectivo-stats'],
    queryFn: async () => {
      const response = await api.get('/efectivo/stats');
      return response.data.data;
    },
  });

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery<EfectivoConfig>({
    queryKey: ['efectivo-config'],
    queryFn: async () => {
      const response = await api.get('/efectivo/config');
      return response.data.data;
    },
  });

  // Fetch movimientos
  const { data: movimientos = [], isLoading: movimientosLoading } = useQuery<MovimientoEfectivo[]>({
    queryKey: ['movimientos-efectivo'],
    queryFn: async () => {
      const response = await api.get('/efectivo/movimientos');
      return response.data.data;
    },
  });

  // Fetch cuentas corrientes
  const { data: cuentas = [] } = useQuery<CuentaCorriente[]>({
    queryKey: ['cuentas'],
    queryFn: async () => {
      const response = await api.get('/cuentas');
      return response.data.data;
    },
  });

  // Mutation para actualizar saldo inicial
  const updateSaldoInicialMutation = useMutation({
    mutationFn: async (saldoInicial: number) => {
      const response = await api.put('/efectivo/config', { saldo_inicial: saldoInicial });
      return response.data;
    },
    onSuccess: () => {
      showToast.success('Saldo inicial actualizado');
      queryClient.invalidateQueries({ queryKey: ['efectivo-config'] });
      queryClient.invalidateQueries({ queryKey: ['efectivo-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setEditingSaldoInicial(false);
      setNuevoSaldoInicial('');
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al actualizar saldo inicial');
    },
  });

  // Mutation para crear movimiento
  const createMovimientoMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/efectivo/movimientos', data);
      return response.data;
    },
    onSuccess: () => {
      showToast.success('Movimiento registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['movimientos-efectivo'] });
      queryClient.invalidateQueries({ queryKey: ['efectivo-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
      // Invalidar gastos personales y registrales (si creó un gasto de esos tipos)
      queryClient.invalidateQueries({ queryKey: ['gastos-personales'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
      resetForm();
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al registrar movimiento');
    },
  });

  // Mutation para eliminar movimiento
  const deleteMovimientoMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/efectivo/movimientos/${id}`);
    },
    onSuccess: () => {
      showToast.success('Movimiento eliminado');
      queryClient.invalidateQueries({ queryKey: ['movimientos-efectivo'] });
      queryClient.invalidateQueries({ queryKey: ['efectivo-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
      // Invalidar gastos personales y registrales (si eliminó un gasto de esos tipos)
      queryClient.invalidateQueries({ queryKey: ['gastos-personales'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al eliminar movimiento');
    },
  });

  const handleUpdateSaldoInicial = () => {
    const valor = parseFloat(nuevoSaldoInicial);
    if (isNaN(valor) || valor < 0) {
      showToast.error('Ingrese un valor válido');
      return;
    }
    updateSaldoInicialMutation.mutate(valor);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const monto = parseFloat(formData.monto);
    if (isNaN(monto) || monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }

    // Validar concepto según categoría
    if (formData.tipo === 'GASTO') {
      if (formData.categoria === 'GENERICO' && !formData.concepto.trim()) {
        showToast.error('El concepto es requerido');
        return;
      }
      if (
        (formData.categoria === 'REGISTRAL' || formData.categoria === 'PERSONAL') &&
        !formData.concepto_especifico
      ) {
        showToast.error('Debe seleccionar un concepto');
        return;
      }
    }

    // Determinar el concepto final
    let conceptoFinal = formData.concepto;
    if (formData.tipo === 'GASTO' && formData.categoria !== 'GENERICO') {
      conceptoFinal = formData.concepto_especifico;
    }
    if (formData.tipo === 'DEPOSITO') {
      conceptoFinal = 'Depósito al banco';
    }

    createMovimientoMutation.mutate({
      fecha: formData.fecha,
      tipo: formData.tipo,
      categoria: formData.tipo === 'GASTO' ? formData.categoria : undefined,
      concepto: conceptoFinal,
      concepto_especifico:
        formData.tipo === 'GASTO' && formData.categoria !== 'GENERICO'
          ? formData.concepto_especifico
          : undefined,
      monto,
      cuenta_id: formData.cuenta_id ? parseInt(formData.cuenta_id) : undefined,
      observaciones: formData.observaciones || undefined,
    });
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'GASTO',
      categoria: 'GENERICO',
      concepto: '',
      concepto_especifico: '',
      monto: '',
      cuenta_id: '',
      observaciones: '',
    });
    setShowForm(false);
    setEditingMovimiento(null);
  };

  const handleEliminar = (movimiento: MovimientoEfectivo) => {
    setConfirmDialog({ isOpen: true, movimiento });
  };

  const confirmEliminar = () => {
    if (!confirmDialog.movimiento) return;
    deleteMovimientoMutation.mutate(confirmDialog.movimiento.id);
    setConfirmDialog({ isOpen: false, movimiento: null });
  };

  const columns: TableColumn[] = [
    { key: 'fecha', label: 'Fecha', width: '120px' },
    { key: 'tipo', label: 'Tipo', width: '120px' },
    { key: 'concepto', label: 'Concepto', width: '250px' },
    { key: 'monto', label: 'Monto', align: 'right', width: '150px' },
    { key: 'cuenta_nombre', label: 'Cuenta Asociada', width: '200px' },
    { key: 'observaciones', label: 'Observaciones', width: '200px' },
    { key: 'actions', label: 'Acciones', align: 'center', width: '100px' },
  ];

  const renderCell = (column: TableColumn, row: MovimientoEfectivo) => {
    switch (column.key) {
      case 'fecha':
        return formatDate(row.fecha);
      case 'tipo':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.tipo === 'INGRESO'
                ? 'bg-success-light text-success'
                : row.tipo === 'GASTO'
                ? 'bg-error-light text-error'
                : 'bg-info-light text-info'
            }`}
          >
            {row.tipo}
          </span>
        );
      case 'monto':
        const icon =
          row.tipo === 'INGRESO' ? (
            <TrendingUp className="h-4 w-4 text-success inline mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 text-error inline mr-1" />
          );
        return (
          <span className="font-semibold text-text-primary font-mono">
            {icon}
            {formatCurrency(row.monto)}
          </span>
        );
      case 'cuenta_nombre':
        return row.cuenta_nombre || '-';
      case 'observaciones':
        return row.observaciones || '-';
      case 'actions':
        // Solo permitir eliminar GASTO y DEPOSITO (no INGRESO porque vienen automáticos)
        if (row.tipo === 'INGRESO') {
          return <span className="text-xs text-text-secondary">Auto</span>;
        }
        return (
          <button
            onClick={() => handleEliminar(row)}
            disabled={deleteMovimientoMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-error hover:bg-error/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Eliminar movimiento"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        );
      default:
        return row[column.key as keyof MovimientoEfectivo];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Control de Efectivo</h1>
        <p className="text-text-secondary mt-1">Gestión de efectivo en mano</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          label="Saldo Inicial"
          value={statsLoading ? '...' : formatCurrency(stats?.saldo_inicial || 0)}
          icon={Wallet}
          iconColor="text-info"
          subtitle="Configurado"
        />
        <MetricCard
          label="Total Ingresos (Entregados)"
          value={statsLoading ? '...' : formatCurrency((stats?.total_rentas || 0) + (stats?.total_caja || 0))}
          icon={TrendingUp}
          iconColor="text-success"
        />
        <MetricCard
          label="Total Gastos"
          value={statsLoading ? '...' : formatCurrency(stats?.total_gastos || 0)}
          icon={TrendingDown}
          iconColor="text-error"
        />
        <MetricCard
          label="Total Depósitos"
          value={statsLoading ? '...' : formatCurrency(stats?.total_depositos || 0)}
          icon={DollarSign}
          iconColor="text-warning"
        />
        <MetricCard
          label="Saldo Actual"
          value={statsLoading ? '...' : formatCurrency(stats?.saldo_actual || 0)}
          icon={Wallet}
          iconColor="text-primary"
          subtitle="Disponible ahora"
        />
      </div>

      {/* Configuración Saldo Inicial */}
      <Card title="Configuración" subtitle="Saldo inicial de efectivo">
        <div className="flex items-center gap-4">
          {editingSaldoInicial ? (
            <>
              <Input
                type="number"
                value={nuevoSaldoInicial}
                onChange={(e) => setNuevoSaldoInicial(e.target.value)}
                placeholder="Nuevo saldo inicial"
                className="max-w-xs"
              />
              <Button
                variant="primary"
                onClick={handleUpdateSaldoInicial}
                disabled={updateSaldoInicialMutation.isPending}
              >
                Guardar
              </Button>
              <Button variant="outline" onClick={() => setEditingSaldoInicial(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <p className="text-text-primary">
                Saldo inicial actual:{' '}
                <span className="font-semibold font-mono">
                  {configLoading ? '...' : formatCurrency(config?.saldo_inicial || 0)}
                </span>
              </p>
              <Button
                variant="outline"
                icon={Edit2}
                onClick={() => {
                  setEditingSaldoInicial(true);
                  setNuevoSaldoInicial(config?.saldo_inicial?.toString() || '0');
                }}
              >
                Modificar
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Botón destacado para nuevo movimiento */}
      {!showForm && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="h-6 w-6" />
            Registrar Nuevo Movimiento de Efectivo
          </button>
        </div>
      )}

      {/* Formulario Nuevo Movimiento */}
      {showForm && (
        <Card
          title="Nuevo Movimiento"
          subtitle="Registrar gasto o depósito de efectivo"
          headerAction={
            <Button variant="ghost" icon={X} onClick={resetForm}>
              Cancelar
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha */}
              <Input
                label="Fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                required
              />

              {/* Tipo de Movimiento */}
              <Select
                label="Tipo de Movimiento"
                value={formData.tipo}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tipo: e.target.value as 'GASTO' | 'DEPOSITO',
                    categoria: 'GENERICO',
                    concepto: '',
                    concepto_especifico: '',
                  })
                }
                required
              >
                <option value="GASTO">Gasto</option>
                <option value="DEPOSITO">Depósito al Banco</option>
              </Select>

              {/* Categoría de Gasto (solo si tipo = GASTO) */}
              {formData.tipo === 'GASTO' && (
                <Select
                  label="Categoría de Gasto"
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      categoria: e.target.value as 'GENERICO' | 'REGISTRAL' | 'PERSONAL',
                      concepto: '',
                      concepto_especifico: '',
                    })
                  }
                  required
                >
                  <option value="GENERICO">Gasto Genérico (Concepto Libre)</option>
                  <option value="REGISTRAL">Gasto Registral (Librería, María, Agua, etc.)</option>
                  <option value="PERSONAL">Gasto Personal (Gaspar, Nacion, etc.)</option>
                </Select>
              )}

              {/* Concepto Genérico (solo si categoria = GENERICO) */}
              {formData.tipo === 'GASTO' && formData.categoria === 'GENERICO' && (
                <Input
                  label="Concepto"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  placeholder="Descripción del gasto"
                  required
                />
              )}

              {/* Concepto Registral (solo si categoria = REGISTRAL) */}
              {formData.tipo === 'GASTO' && formData.categoria === 'REGISTRAL' && (
                <Select
                  label="Concepto Registral"
                  value={formData.concepto_especifico}
                  onChange={(e) => setFormData({ ...formData, concepto_especifico: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {CONCEPTOS_REGISTRALES.map((concepto) => (
                    <option key={concepto} value={concepto}>
                      {concepto}
                    </option>
                  ))}
                </Select>
              )}

              {/* Concepto Personal (solo si categoria = PERSONAL) */}
              {formData.tipo === 'GASTO' && formData.categoria === 'PERSONAL' && (
                <Select
                  label="Concepto Personal"
                  value={formData.concepto_especifico}
                  onChange={(e) => setFormData({ ...formData, concepto_especifico: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {CONCEPTOS_PERSONALES.map((concepto) => (
                    <option key={concepto} value={concepto}>
                      {concepto}
                    </option>
                  ))}
                </Select>
              )}

              {/* Monto */}
              <Input
                label="Monto"
                type="number"
                step="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
                required
              />

              {/* Cuenta Asociada (solo para gastos) */}
              {formData.tipo === 'GASTO' && (
                <Select
                  label="Cuenta Asociada (opcional)"
                  value={formData.cuenta_id}
                  onChange={(e) => setFormData({ ...formData, cuenta_id: e.target.value })}
                >
                  <option value="">Ninguna</option>
                  {cuentas.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </Select>
              )}

              {/* Observaciones */}
              <Input
                label="Observaciones (opcional)"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales"
              />
            </div>

            {/* Ayuda contextual */}
            {formData.tipo === 'GASTO' && (
              <div className="bg-info-light border border-info rounded-lg p-4 text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-2">ℹ️ Información:</p>
                {formData.categoria === 'REGISTRAL' && (
                  <p>
                    Este gasto se registrará en <strong>Gastos Registrales</strong> y en{' '}
                    <strong>Efectivo</strong>. Aparecerá en ambos reportes.
                  </p>
                )}
                {formData.categoria === 'PERSONAL' && (
                  <p>
                    Este gasto se registrará en <strong>Gastos Personales</strong> y en{' '}
                    <strong>Efectivo</strong>. Aparecerá en ambos reportes.
                  </p>
                )}
                {formData.categoria === 'GENERICO' && (
                  <p>
                    Este gasto solo se registrará en <strong>Efectivo</strong>. Si lo asocia a una
                    cuenta corriente, también aparecerá allí.
                  </p>
                )}
              </div>
            )}

            {formData.tipo === 'DEPOSITO' && (
              <div className="bg-warning-light border border-warning rounded-lg p-4 text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-2">💰 Depósito al Banco</p>
                <p>
                  Este movimiento registra efectivo que fue depositado en el banco. El saldo de efectivo
                  disminuirá en este monto.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" variant="primary" disabled={createMovimientoMutation.isPending}>
                Guardar Movimiento
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabla de Movimientos */}
      <Card title="Historial de Movimientos" subtitle="Todos los movimientos de efectivo registrados">
        <Table
          columns={columns}
          data={movimientos}
          loading={movimientosLoading}
          emptyMessage="No hay movimientos registrados"
          renderCell={renderCell}
        />
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, movimiento: null })}
        onConfirm={confirmEliminar}
        title="Eliminar Movimiento"
        message={
          confirmDialog.movimiento
            ? `¿Está seguro que desea eliminar este movimiento?\n\n` +
              `Tipo: ${confirmDialog.movimiento.tipo}\n` +
              `Concepto: ${confirmDialog.movimiento.concepto}\n` +
              `Monto: ${formatCurrency(confirmDialog.movimiento.monto)}\n\n` +
              `Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        variant="error"
        isLoading={deleteMovimientoMutation.isPending}
      />
    </div>
  );
};

export default ControlEfectivo;
