import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2, AlertTriangle, Database, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { depositosApi, adminApi, migracionApi } from '@/services/supabase';

const Configuracion: React.FC = () => {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: string;
    params?: { mes: number; anio: number };
  }>({ isOpen: false, title: '', message: '', action: '' });

  // Estados para mes/año
  const [mesGR, setMesGR] = useState(new Date().getMonth() + 1);
  const [anioGR, setAnioGR] = useState(new Date().getFullYear());
  const [mesGP, setMesGP] = useState(new Date().getMonth() + 1);
  const [anioGP, setAnioGP] = useState(new Date().getFullYear());

  // Mutation para sincronizar depósitos
  const sincronizarDepositosMutation = useMutation({
    mutationFn: depositosApi.sincronizarMovimientos,
    onSuccess: (data) => {
      showToast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Error al sincronizar depósitos');
    },
  });

  // Mutation para migrar VEPs y ePagos
  const migrarVepsEpagosMutation = useMutation({
    mutationFn: migracionApi.migrarVepsYEpagos,
    onSuccess: (data) => {
      if (data.errores.length > 0) {
        showToast.error(`Migración con errores. Revisa la consola para más detalles.`);
        console.error('Errores de migración:', data.errores);
      } else {
        showToast.success(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['veps'] });
      queryClient.invalidateQueries({ queryKey: ['epagos'] });
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Error al migrar VEPs y ePagos');
    },
  });

  // Mutation para limpiar datos
  const limpiarMutation = useMutation({
    mutationFn: async ({ action, params }: { action: string; params?: { mes: number; anio: number } }) => {
      switch (action) {
        case 'todo':
          return adminApi.limpiarTodo();
        case 'gastos-registrales':
          return adminApi.limpiarGastosRegistrales();
        case 'gastos-registrales-mes':
          return adminApi.limpiarGastosRegistralesMes(params!.mes, params!.anio);
        case 'gastos-personales':
          return adminApi.limpiarGastosPersonales();
        case 'gastos-personales-mes':
          return adminApi.limpiarGastosPersonalesMes(params!.mes, params!.anio);
        case 'movimientos':
          return adminApi.limpiarMovimientos();
        case 'posnet':
          return adminApi.limpiarPosnet();
        default:
          throw new Error('Acción no válida');
      }
    },
    onSuccess: (data) => {
      showToast.success(data.message);
      queryClient.invalidateQueries();
      setConfirmDialog({ isOpen: false, title: '', message: '', action: '' });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const handleConfirm = () => {
    limpiarMutation.mutate({
      action: confirmDialog.action,
      params: confirmDialog.params,
    });
  };

  const openConfirmDialog = (title: string, message: string, action: string, params?: any) => {
    setConfirmDialog({ isOpen: true, title, message, action, params });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">⚙️ Configuración</h1>
        <p className="text-text-secondary mt-1">Gestión y limpieza de datos del sistema</p>
      </div>

      {/* Alerta */}
      <div className="bg-warning-light border border-warning rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-warning">¡Precaución!</p>
          <p className="text-sm text-text-secondary mt-1">
            Las acciones de limpieza son <strong>irreversibles</strong>. Asegurate de tener un backup antes de continuar.
          </p>
        </div>
      </div>

      {/* Sincronización de Depósitos */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronización de Depósitos
          </h2>
          <p className="text-text-secondary mb-6">
            Si hay depósitos asignados a cuentas corrientes que no tienen su movimiento INGRESO correspondiente,
            esta herramienta los creará automáticamente.
          </p>
          <button
            onClick={() => sincronizarDepositosMutation.mutate()}
            disabled={sincronizarDepositosMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${sincronizarDepositosMutation.isPending ? 'animate-spin' : ''}`} />
            {sincronizarDepositosMutation.isPending ? 'Sincronizando...' : 'Sincronizar Depósitos'}
          </button>
        </div>
      </Card>

      {/* Migración de VEPs y ePagos */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Migración de VEPs y ePagos
          </h2>
          <p className="text-text-secondary mb-6">
            Si tenés movimientos de VEP o ePagos que no aparecen en las tablas de control,
            esta herramienta los migrará automáticamente desde la tabla de movimientos.
          </p>
          <button
            onClick={() => migrarVepsEpagosMutation.mutate()}
            disabled={migrarVepsEpagosMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <ArrowRightLeft className={`h-4 w-4 ${migrarVepsEpagosMutation.isPending ? 'animate-spin' : ''}`} />
            {migrarVepsEpagosMutation.isPending ? 'Migrando...' : 'Migrar VEPs y ePagos'}
          </button>
        </div>
      </Card>

      {/* Limpieza General */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Limpieza General
          </h2>
          <p className="text-text-secondary mb-6">
            Borra toda la información de la base de datos. Los conceptos y cuentas corrientes se mantienen.
          </p>
          <button
            onClick={() =>
              openConfirmDialog(
                'Confirmar Limpieza Total',
                '⚠️ Esta acción eliminará TODOS los datos:\n\n• Movimientos (RENTAS y CAJA)\n• Control POSNET\n• Gastos Registrales\n• Gastos Personales\n• Depósitos\n• Adelantos\n• Cuentas Corrientes (saldos a $0)\n\n¿Estás seguro?',
                'todo'
              )
            }
            className="flex items-center gap-2 px-6 py-3 bg-error text-white rounded-lg hover:bg-error/90 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar Toda la Base de Datos
          </button>
        </div>
      </Card>

      {/* Gastos Registrales */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">
            💸 Gastos Registrales
          </h2>

          <div className="space-y-4">
            {/* Limpiar todos */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div>
                <p className="font-medium text-text-primary">Eliminar todos los gastos registrales</p>
                <p className="text-sm text-text-secondary">Borra todos los registros históricos</p>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Gastos Registrales',
                    '¿Confirmar eliminación de TODOS los gastos registrales?',
                    'gastos-registrales'
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar Todos
              </button>
            </div>

            {/* Limpiar por mes */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-text-primary mb-3">Eliminar gastos por mes</p>
                <div className="flex items-center gap-3">
                  <select
                    value={mesGR}
                    onChange={(e) => setMesGR(parseInt(e.target.value))}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2025, m - 1).toLocaleString('es-AR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={anioGR}
                    onChange={(e) => setAnioGR(parseInt(e.target.value))}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-24"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Gastos del Mes',
                    `¿Confirmar eliminación de gastos registrales de ${mesGR}/${anioGR}?`,
                    'gastos-registrales-mes',
                    { mes: mesGR, anio: anioGR }
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar Mes
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gastos Personales */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">
            👤 Gastos Personales
          </h2>

          <div className="space-y-4">
            {/* Limpiar todos */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div>
                <p className="font-medium text-text-primary">Eliminar todos los gastos personales</p>
                <p className="text-sm text-text-secondary">Borra todos los registros históricos</p>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Gastos Personales',
                    '¿Confirmar eliminación de TODOS los gastos personales?',
                    'gastos-personales'
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar Todos
              </button>
            </div>

            {/* Limpiar por mes */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-text-primary mb-3">Eliminar gastos por mes</p>
                <div className="flex items-center gap-3">
                  <select
                    value={mesGP}
                    onChange={(e) => setMesGP(parseInt(e.target.value))}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2025, m - 1).toLocaleString('es-AR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={anioGP}
                    onChange={(e) => setAnioGP(parseInt(e.target.value))}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-24"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Gastos del Mes',
                    `¿Confirmar eliminación de gastos personales de ${mesGP}/${anioGP}?`,
                    'gastos-personales-mes',
                    { mes: mesGP, anio: anioGP }
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar Mes
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Otras Secciones */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">
            📊 Otros Datos
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div>
                <p className="font-medium text-text-primary">Eliminar movimientos (RENTAS y CAJA)</p>
                <p className="text-sm text-text-secondary">Incluye controles semanales/quincenales</p>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Movimientos',
                    '¿Confirmar eliminación de todos los movimientos RENTAS y CAJA?',
                    'movimientos'
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div>
                <p className="font-medium text-text-primary">Eliminar control POSNET</p>
                <p className="text-sm text-text-secondary">Borra todos los registros de control diario</p>
              </div>
              <button
                onClick={() =>
                  openConfirmDialog(
                    'Eliminar Control POSNET',
                    '¿Confirmar eliminación de todos los registros POSNET?',
                    'posnet'
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', action: '' })}
        onConfirm={handleConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={limpiarMutation.isPending}
      />
    </div>
  );
};

export default Configuracion;
