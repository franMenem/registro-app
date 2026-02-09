import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  DollarSign,
  Calendar,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { gastosPersonalesApi, GastoPersonal, GastoPersonalCreate } from '@/services/supabase/gastos-personales';

// 6 conceptos de gastos personales
const CONCEPTOS_GP = ['Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop', 'TERE'] as const;

type ConceptoGP = (typeof CONCEPTOS_GP)[number];

const GastosPersonales: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [mesActual, setMesActual] = useState(today.getMonth() + 1);
  const [anioActual, setAnioActual] = useState(today.getFullYear());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline form state
  const [inlineFecha, setInlineFecha] = useState(format(today, 'yyyy-MM-dd'));
  const [inlineConcepto, setInlineConcepto] = useState<ConceptoGP>('Gaspar');
  const [inlineMonto, setInlineMonto] = useState('');
  const [inlineObs, setInlineObs] = useState('');

  // Modal states (solo para editar)
  const [modalGasto, setModalGasto] = useState<{
    isOpen: boolean;
    gasto: GastoPersonal | null;
  }>({ isOpen: false, gasto: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
  }>({ isOpen: false, id: null });

  // Form states (solo para editar en modal)
  const [formGasto, setFormGasto] = useState<{
    fecha: string;
    concepto: ConceptoGP;
    monto: number;
    observaciones: string;
    estado: 'Pagado' | 'Pendiente';
  }>({
    fecha: format(today, 'yyyy-MM-dd'),
    concepto: 'Gaspar',
    monto: 0,
    observaciones: '',
    estado: 'Pagado',
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Queries
  const { data: gastosPersonales = [], refetch: refetchGastos } = useQuery({
    queryKey: ['gastos-personales', mesActual, anioActual],
    queryFn: () => gastosPersonalesApi.getAll({ mes: mesActual, anio: anioActual }),
  });

  const { data: resumenGastos } = useQuery({
    queryKey: ['gastos-personales-resumen', mesActual, anioActual],
    queryFn: () => gastosPersonalesApi.getResumen(mesActual, anioActual),
  });

  const { data: conceptosPendientes = [] } = useQuery({
    queryKey: ['gastos-personales-pendientes', mesActual, anioActual],
    queryFn: () => gastosPersonalesApi.getPendientes(mesActual, anioActual),
  });

  // Mutations
  const createGastoMutation = useMutation({
    mutationFn: gastosPersonalesApi.create,
    onSuccess: (response) => {
      showToast.success(response.message);
      // Reset inline form (mantener fecha)
      setInlineMonto('');
      setInlineObs('');
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-pendientes'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const updateGastoMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) =>
      gastosPersonalesApi.update(id, datos),
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetFormGasto();
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const deleteGastoMutation = useMutation({
    mutationFn: gastosPersonalesApi.delete,
    onSuccess: (response) => {
      showToast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null });
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => gastosPersonalesApi.importarCSV(contenido),
    onSuccess: (data) => {
      const { insertados, errores } = data;
      showToast.success(`Importación completada: ${insertados} gastos insertados`);
      if (errores.length > 0) {
        showToast.error(`${errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', errores);
      }
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-personales-pendientes'] });
    },
    onError: (error: Error) => {
      showToast.error(`Error al importar: ${error.message}`);
    },
  });

  // Handlers
  const handleImportarClick = () => {
    fileInputRef.current?.click();
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showToast.error('Por favor seleccioná un archivo CSV');
      return;
    }

    try {
      const contenido = await file.text();
      importarCSVMutation.mutate(contenido);
    } catch (error) {
      showToast.error('Error al leer el archivo');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetFormGasto = () => {
    setFormGasto({
      fecha: format(today, 'yyyy-MM-dd'),
      concepto: 'Gaspar',
      monto: 0,
      observaciones: '',
      estado: 'Pagado',
    });
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(inlineMonto);
    if (!monto || monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }
    createGastoMutation.mutate({
      fecha: inlineFecha,
      concepto: inlineConcepto,
      monto,
      observaciones: inlineObs || undefined,
      estado: 'Pagado',
    });
  };

  const handleEditarGasto = (gasto: GastoPersonal) => {
    setFormGasto({
      fecha: gasto.fecha,
      concepto: gasto.concepto as ConceptoGP,
      monto: gasto.monto,
      observaciones: gasto.observaciones || '',
      estado: gasto.estado as 'Pagado' | 'Pendiente',
    });
    setModalGasto({ isOpen: true, gasto });
  };

  const handleGuardarGasto = () => {
    if (!formGasto.monto || formGasto.monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }

    if (modalGasto.gasto) {
      updateGastoMutation.mutate({
        id: modalGasto.gasto.id,
        datos: formGasto,
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: es });
  };

  // Aplicar paginación
  const totalItems = gastosPersonales.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const gastosPersonalesAMostrar = gastosPersonales.slice(startIndex, endIndex);

  // Reset page cuando cambia mes o año
  React.useEffect(() => {
    setCurrentPage(1);
  }, [mesActual, anioActual]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Gastos Personales</h1>
          <p className="text-text-secondary mt-1">
            Gestión de gastos personales de la jefa - {format(new Date(anioActual, mesActual - 1), 'MMMM yyyy', { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleImportarClick}
            disabled={importarCSVMutation.isPending}
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
        </div>
      </div>

      {/* Filtros de Fecha */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Período
            </label>
            <div className="flex items-center gap-3">
              <select
                value={mesActual}
                onChange={(e) => setMesActual(parseInt(e.target.value))}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2025, m - 1).toLocaleString('es-AR', { month: 'long' })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={anioActual}
                onChange={(e) => setAnioActual(parseInt(e.target.value))}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm w-28"
                min="2020"
                max="2050"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMesActual(today.getMonth() + 1);
                  setAnioActual(today.getFullYear());
                }}
              >
                Hoy
              </Button>
            </div>
          </div>
        </div>
      </Card>


      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Mensual</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {formatCurrency(resumenGastos?.total_general || 0)}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-primary opacity-20" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Conceptos Pagados</p>
              <p className="text-2xl font-bold text-success mt-1">
                {CONCEPTOS_GP.length - (conceptosPendientes?.length || 0)} / {CONCEPTOS_GP.length}
              </p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-success opacity-20" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Conceptos Pendientes</p>
              <p className="text-2xl font-bold text-warning mt-1">
                {conceptosPendientes?.length || 0}
              </p>
            </div>
            <AlertCircle className="h-10 w-10 text-warning opacity-20" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Gastos</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {gastosPersonales.length}
              </p>
            </div>
            <Calendar className="h-10 w-10 text-primary opacity-20" />
          </div>
        </Card>
      </div>

      {/* Conceptos Pendientes Alert */}
      {conceptosPendientes && conceptosPendientes.length > 0 && (
        <Card className="bg-warning/10 border-warning/20">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning">
                Conceptos Pendientes del Mes ({conceptosPendientes.length})
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Los siguientes conceptos aún no tienen gastos registrados este mes:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {conceptosPendientes.map((concepto: string) => (
                  <span
                    key={concepto}
                    className="px-3 py-1 bg-warning/20 text-warning rounded-md text-sm font-medium"
                  >
                    {concepto}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Inline Form - Agregar Gasto */}
      <Card>
        <form onSubmit={handleInlineSubmit} className="p-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Fecha</label>
              <input
                type="date"
                value={inlineFecha}
                onChange={(e) => setInlineFecha(e.target.value)}
                className="w-36 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Concepto</label>
              <select
                value={inlineConcepto}
                onChange={(e) => setInlineConcepto(e.target.value as ConceptoGP)}
                className="w-36 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CONCEPTOS_GP.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Monto</label>
              <input
                type="number"
                step="0.01"
                value={inlineMonto}
                onChange={(e) => setInlineMonto(e.target.value)}
                placeholder="0.00"
                className="w-32 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">Observaciones</label>
              <input
                type="text"
                value={inlineObs}
                onChange={(e) => setInlineObs(e.target.value)}
                placeholder="Opcional..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              type="submit"
              disabled={createGastoMutation.isPending}
              className="flex items-center gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
              {createGastoMutation.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabla de Gastos */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Concepto
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Observaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {gastosPersonalesAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    No hay gastos personales registrados este mes
                  </td>
                </tr>
              ) : (
                gastosPersonalesAMostrar.map((gasto: GastoPersonal) => (
                  <tr key={gasto.id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {formatDate(gasto.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                        {gasto.concepto}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-text-primary">
                      {formatCurrency(gasto.monto)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {gasto.observaciones || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          gasto.estado === 'Pagado'
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {gasto.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditarGasto(gasto)}
                          className="p-2 hover:bg-background-secondary rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4 text-primary" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ isOpen: true, id: gasto.id })}
                          className="p-2 hover:bg-background-secondary rounded-md transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </Card>

      {/* Modal Editar Gasto */}
      <Modal
        isOpen={modalGasto.isOpen}
        onClose={() => {
          setModalGasto({ isOpen: false, gasto: null });
          resetFormGasto();
        }}
        title="Editar Gasto Personal"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Fecha</label>
            <input
              type="date"
              value={formGasto.fecha}
              onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Concepto</label>
            <select
              value={formGasto.concepto}
              onChange={(e) => setFormGasto({ ...formGasto, concepto: e.target.value as ConceptoGP })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CONCEPTOS_GP.map((concepto) => (
                <option key={concepto} value={concepto}>
                  {concepto}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              value={formGasto.monto}
              onChange={(e) => setFormGasto({ ...formGasto, monto: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Estado</label>
            <select
              value={formGasto.estado}
              onChange={(e) => setFormGasto({ ...formGasto, estado: e.target.value as 'Pagado' | 'Pendiente' })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Pagado">Pagado</option>
              <option value="Pendiente">Pendiente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Observaciones</label>
            <textarea
              value={formGasto.observaciones}
              onChange={(e) => setFormGasto({ ...formGasto, observaciones: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Observaciones opcionales..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalGasto({ isOpen: false, gasto: null });
                resetFormGasto();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleGuardarGasto}>
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={() => {
          if (deleteDialog.id) {
            deleteGastoMutation.mutate(deleteDialog.id);
          }
        }}
        title="Eliminar Gasto Personal"
        message="¿Estás seguro de que deseas eliminar este gasto personal? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default GastosPersonales;
