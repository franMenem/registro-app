import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, Wallet, Clock, Calendar, Plus, Check, AlertCircle, Trash2, ClipboardList } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, TableColumn } from '@/components/tables/Table';
import { dashboardApi, controlesApi, ControlPendiente } from '@/services/supabase';
import { formatCurrency, formatDate } from '@/utils/format';
import { parseISO } from 'date-fns';
import { showToast } from '@/components/ui/Toast';

// Tipo para las tareas/recordatorios
interface Tarea {
  id: string;
  texto: string;
  completada: boolean;
  fecha: string;
}

const TAREAS_KEY = 'registro_app_tareas';

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    control: ControlPendiente | null;
  }>({ isOpen: false, control: null });

  // Estado para tareas/recordatorios (localStorage)
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState('');

  // Cargar tareas de localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem(TAREAS_KEY);
    if (saved) {
      try {
        setTareas(JSON.parse(saved));
      } catch {
        setTareas([]);
      }
    }
  }, []);

  // Guardar tareas en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem(TAREAS_KEY, JSON.stringify(tareas));
  }, [tareas]);

  const agregarTarea = () => {
    if (!nuevaTarea.trim()) return;
    const tarea: Tarea = {
      id: Date.now().toString(),
      texto: nuevaTarea.trim(),
      completada: false,
      fecha: new Date().toISOString(),
    };
    setTareas([tarea, ...tareas]);
    setNuevaTarea('');
  };

  const toggleTarea = (id: string) => {
    setTareas(tareas.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t)));
  };

  const eliminarTarea = (id: string) => {
    setTareas(tareas.filter((t) => t.id !== id));
  };

  const limpiarCompletadas = () => {
    setTareas(tareas.filter((t) => !t.completada));
  };

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  // Fetch controles pendientes
  const { data: controlesPendientes = [], isLoading: controlesLoading } = useQuery({
    queryKey: ['controles-pendientes'],
    queryFn: dashboardApi.getControlesPendientes,
  });

  // Fetch alertas de pagos próximos
  const { data: alertasPagos = [], isLoading: alertasLoading } = useQuery({
    queryKey: ['alertas-pagos'],
    queryFn: dashboardApi.getAlertasPagos,
  });

  // Mutation para marcar como pagado
  const marcarPagadoMutation = useMutation({
    mutationFn: ({ id, tipo, fecha }: { id: number; tipo: 'SEMANAL' | 'QUINCENAL'; fecha: string }) => {
      if (tipo === 'SEMANAL') {
        return controlesApi.pagarSemanal(id, fecha);
      } else {
        return controlesApi.pagarQuincenal(id, fecha);
      }
    },
    onSuccess: () => {
      showToast.success('✅ Control marcado como PAGADO exitosamente. El control ha sido removido de la lista de pendientes.');
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['controles-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-pagos'] });
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al marcar como pagado');
    },
  });

  const handleMarcarPagado = (control: ControlPendiente) => {
    setConfirmDialog({ isOpen: true, control });
  };

  const confirmMarcarPagado = () => {
    if (!confirmDialog.control) return;

    const hoy = new Date().toISOString().split('T')[0];
    marcarPagadoMutation.mutate({
      id: confirmDialog.control.id,
      tipo: confirmDialog.control.frecuencia,
      fecha: hoy,
    });

    setConfirmDialog({ isOpen: false, control: null });
  };

  const columns: TableColumn[] = [
    { key: 'concepto_nombre', label: 'Concepto', width: '200px' },
    { key: 'concepto_tipo', label: 'Tipo', width: '100px' },
    { key: 'frecuencia', label: 'Frecuencia', width: '120px' },
    { key: 'periodo', label: 'Período', width: '200px' },
    { key: 'total_recaudado', label: 'Monto', align: 'right', width: '150px' },
    { key: 'fecha_pago_programada', label: 'Fecha Pago', width: '120px' },
    { key: 'actions', label: 'Acción', align: 'center', width: '120px' },
  ];

  const renderCell = (column: TableColumn, row: ControlPendiente) => {
    switch (column.key) {
      case 'concepto_tipo':
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.concepto_tipo === 'RENTAS'
                ? 'bg-primary-light text-primary'
                : 'bg-success-light text-success'
            }`}
          >
            {row.concepto_tipo}
          </span>
        );
      case 'frecuencia':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-text-primary">
            {row.frecuencia}
          </span>
        );
      case 'periodo':
        if (row.frecuencia === 'QUINCENAL') {
          return `${row.quincena} quincena - ${row.mes}/${row.anio}`;
        }
        return `${formatDate(row.fecha_inicio)} - ${formatDate(row.fecha_fin)}`;
      case 'total_recaudado':
        return (
          <span className="font-semibold text-text-primary font-mono">
            {formatCurrency(row.total_recaudado)}
          </span>
        );
      case 'fecha_pago_programada':
        const hoy = new Date();
        const fechaPago = parseISO(row.fecha_pago_programada);
        const diff = Math.ceil((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        const isProximo = diff <= 3 && diff >= 0;
        const isVencido = diff < 0;

        return (
          <div className="flex flex-col gap-1">
            <span
              className={`text-sm font-medium ${
                isVencido ? 'text-error' : isProximo ? 'text-warning' : 'text-text-primary'
              }`}
            >
              {formatDate(row.fecha_pago_programada)}
            </span>
            {isVencido && <span className="text-xs text-error">Vencido</span>}
            {isProximo && !isVencido && (
              <span className="text-xs text-warning">
                {diff === 0 ? 'Hoy' : `En ${diff} día${diff > 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        );
      case 'actions':
        return (
          <Button
            variant="primary"
            size="sm"
            icon={Check}
            onClick={() => handleMarcarPagado(row)}
            disabled={marcarPagadoMutation.isPending}
          >
            Pagar
          </Button>
        );
      default:
        return row[column.key as keyof ControlPendiente];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Resumen de efectivo y controles pendientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          label="Arancel del Mes"
          value={statsLoading ? '...' : formatCurrency(stats?.total_arancel_mes || 0)}
          icon={Calendar}
          iconColor="text-info"
          subtitle={`${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}
        />
        <MetricCard
          label="Controles Semanales Pendientes"
          value={statsLoading ? '...' : formatCurrency(stats?.total_semanal_pendiente || 0)}
          icon={Clock}
          iconColor="text-warning"
        />
        <MetricCard
          label="Controles Quincenales Pendientes"
          value={statsLoading ? '...' : formatCurrency(stats?.total_quincenal_pendiente || 0)}
          icon={Calendar}
          iconColor="text-secondary"
        />
        <MetricCard
          label="Efectivo en Mano"
          value={statsLoading ? '...' : formatCurrency(stats?.efectivo_en_mano || 0)}
          icon={Wallet}
          iconColor="text-success"
          subtitle="Disponible"
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
            <Button variant="outline">Ver Planillas</Button>
          </Link>
        </div>
      </Card>

      {/* Recordatorios / Tareas */}
      <Card
        title="📋 Mis Recordatorios"
        subtitle="Tareas y notas para no olvidar"
        actions={
          tareas.some((t) => t.completada) && (
            <Button variant="outline" size="sm" onClick={limpiarCompletadas}>
              Limpiar completadas
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {/* Input para nueva tarea */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevaTarea}
              onChange={(e) => setNuevaTarea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregarTarea()}
              placeholder="Agregar recordatorio... (Enter para guardar)"
              className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
            <Button variant="primary" size="sm" icon={Plus} onClick={agregarTarea}>
              Agregar
            </Button>
          </div>

          {/* Lista de tareas */}
          {tareas.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-text-muted">
              <ClipboardList className="h-5 w-5 mr-2" />
              <span>No hay recordatorios</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tareas.map((tarea) => (
                <div
                  key={tarea.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    tarea.completada
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-background border-border hover:border-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tarea.completada}
                    onChange={() => toggleTarea(tarea.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      tarea.completada ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  >
                    {tarea.texto}
                  </span>
                  <button
                    onClick={() => eliminarTarea(tarea.id)}
                    className="p-1 text-text-muted hover:text-error transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Alertas de Pagos Próximos */}
      {alertasPagos.length > 0 && (
        <Card
          title="🔔 Alertas de Pagos Próximos"
          subtitle="Controles que vencen en los próximos 7 días"
        >
          <div className="space-y-3">
            {alertasLoading ? (
              <p className="text-text-secondary">Cargando alertas...</p>
            ) : (
              alertasPagos.map((control) => {
                const fechaPago = parseISO(control.fecha_pago_programada);
                const hoy = new Date();
                const diff = Math.ceil((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                const isVencido = diff < 0;

                return (
                  <div
                    key={`${control.frecuencia}-${control.id}`}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isVencido
                        ? 'border-error bg-error-light'
                        : diff <= 1
                        ? 'border-warning bg-warning-light'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle
                        className={`h-5 w-5 ${isVencido ? 'text-error' : 'text-warning'}`}
                      />
                      <div>
                        <p className="font-medium text-text-primary">
                          {control.concepto_nombre} ({control.concepto_tipo})
                        </p>
                        <p className="text-sm text-text-secondary">
                          {isVencido ? (
                            <span className="text-error font-medium">
                              Vencido - Programado para {formatDate(control.fecha_pago_programada)}
                            </span>
                          ) : diff === 0 ? (
                            <span className="text-warning font-medium">Vence HOY</span>
                          ) : (
                            `Vence en ${diff} día${diff > 1 ? 's' : ''} - ${formatDate(
                              control.fecha_pago_programada
                            )}`
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-text-primary font-mono">
                        {formatCurrency(control.total_recaudado)}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Check}
                        onClick={() => handleMarcarPagado(control)}
                        disabled={marcarPagadoMutation.isPending}
                      >
                        Pagar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* Controles Pendientes de Pago */}
      <Card
        title="Controles Pendientes de Pago"
        subtitle="Todos los controles semanales y quincenales sin pagar"
      >
        <Table
          columns={columns}
          data={controlesPendientes}
          loading={controlesLoading}
          emptyMessage="¡Excelente! No hay controles pendientes de pago"
          renderCell={renderCell}
        />
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, control: null })}
        onConfirm={confirmMarcarPagado}
        title="Confirmar Pago"
        message={
          confirmDialog.control
            ? `Concepto: ${confirmDialog.control.concepto_nombre}\n` +
              `Monto: ${formatCurrency(confirmDialog.control.total_recaudado)}\n` +
              `Período: ${formatDate(confirmDialog.control.fecha_inicio)} - ${formatDate(confirmDialog.control.fecha_fin)}\n\n` +
              `El control se marcará como PAGADO y desaparecerá de la lista de pendientes.`
            : ''
        }
        confirmText="Marcar como Pagado"
        variant="warning"
        isLoading={marcarPagadoMutation.isPending}
      />
    </div>
  );
};

export default Dashboard;
