import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { gastosRegistralesApi, adelantosApi } from '@/services/api';

// 23 conceptos de gastos registrales
const CONCEPTOS_GR = [
  'ABL',
  'ACARA',
  'ADT',
  'AERPA',
  'AFIP',
  'AGUA',
  'ALEJANDRO',
  'AYSA',
  'CARCOS',
  'CARGAS_SOCIALES',
  'CONTADOR',
  'CORREO',
  'EDESUR',
  'EMERGENCIAS',
  'EXPENSAS',
  'FED_PATRONAL',
  'FIBERTEL',
  'LIBRERIA',
  'OTROS',
  'SUELDOS',
  'SUPERMERCADOS',
  'TELEFONOS',
  'TOTALNET',
] as const;

// Conceptos que NO requieren alerta mensual (para futura implementación)
// const SIN_ALERTA = ['ACARA', 'OTROS'];

// Conceptos con modal especial
const CON_MODAL_ESPECIAL = {
  ABL: 3, // 3 boletas
  AYSA: 4, // 4 boletas
};

type ConceptoGR = (typeof CONCEPTOS_GR)[number];

interface GastoRegistral {
  id: number;
  fecha: string;
  concepto: ConceptoGR;
  monto: number;
  observaciones: string | null;
  origen: 'MANUAL' | 'CAJA' | 'FORMULARIOS';
  estado: 'Pagado' | 'Pendiente';
  boleta1?: number;
  boleta2?: number;
  boleta3?: number;
  boleta4?: number;
  created_at: string;
}

interface Adelanto {
  id: number;
  empleado: 'DAMI' | 'MUMI';
  fecha_adelanto: string;
  monto: number;
  estado: 'Pendiente' | 'Descontado';
  fecha_descuento: string | null;
  observaciones: string | null;
  origen: 'MANUAL' | 'CAJA';
  created_at: string;
}

interface ResumenEmpleado {
  empleado: 'DAMI' | 'MUMI';
  pendientes_mes_actual: number;
  total_anio_actual: number;
  total_historico: number;
  adelantos_pendientes: Adelanto[];
  adelantos_descontados: Adelanto[];
}

const GastosRegistro: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [mesActual, setMesActual] = useState(today.getMonth() + 1);
  const [anioActual, setAnioActual] = useState(today.getFullYear());
  const [activeTab, setActiveTab] = useState<'gastos' | 'adelantos'>('gastos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empleadoTab, setEmpleadoTab] = useState<'DAMI' | 'MUMI'>('DAMI');

  // Modal states
  const [modalGasto, setModalGasto] = useState<{
    isOpen: boolean;
    gasto: GastoRegistral | null;
  }>({ isOpen: false, gasto: null });

  const [modalAdelanto, setModalAdelanto] = useState<{
    isOpen: boolean;
    adelanto: Adelanto | null;
  }>({ isOpen: false, adelanto: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    tipo: 'gasto' | 'adelanto';
  }>({ isOpen: false, id: null, tipo: 'gasto' });

  const [descontarDialog, setDescontarDialog] = useState<{
    isOpen: boolean;
    adelantoId: number | null;
  }>({ isOpen: false, adelantoId: null });

  // Form states para gastos
  const [formGasto, setFormGasto] = useState<{
    fecha: string;
    concepto: ConceptoGR;
    monto: number;
    observaciones: string;
    estado: 'Pagado' | 'Pendiente';
    boleta1?: number;
    boleta2?: number;
    boleta3?: number;
    boleta4?: number;
  }>({
    fecha: format(today, 'yyyy-MM-dd'),
    concepto: 'ABL',
    monto: 0,
    observaciones: '',
    estado: 'Pagado',
  });

  // Form states para adelantos
  const [formAdelanto, setFormAdelanto] = useState<{
    empleado: 'DAMI' | 'MUMI';
    fecha_adelanto: string;
    monto: number;
    observaciones: string;
  }>({
    empleado: 'DAMI',
    fecha_adelanto: format(today, 'yyyy-MM-dd'),
    monto: 0,
    observaciones: '',
  });

  // Queries
  const { data: gastosRegistrales = [], refetch: refetchGastos } = useQuery({
    queryKey: ['gastos-registrales', mesActual, anioActual],
    queryFn: () => gastosRegistralesApi.getAll({ mes: mesActual, anio: anioActual }),
  });

  const { data: resumenGastos } = useQuery({
    queryKey: ['gastos-registrales-resumen', mesActual, anioActual],
    queryFn: () => gastosRegistralesApi.getResumen(mesActual, anioActual),
  });

  const { data: conceptosPendientes = [] } = useQuery({
    queryKey: ['gastos-registrales-pendientes', mesActual, anioActual],
    queryFn: () => gastosRegistralesApi.getPendientes(mesActual, anioActual),
  });

  const { data: resumenDami } = useQuery({
    queryKey: ['adelantos-resumen', 'DAMI'],
    queryFn: () => adelantosApi.getResumen('DAMI'),
    enabled: activeTab === 'adelantos',
  });

  const { data: resumenMumi } = useQuery({
    queryKey: ['adelantos-resumen', 'MUMI'],
    queryFn: () => adelantosApi.getResumen('MUMI'),
    enabled: activeTab === 'adelantos',
  });

  // Mutations para gastos
  const createGastoMutation = useMutation({
    mutationFn: gastosRegistralesApi.create,
    onSuccess: (response) => {
      toast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetFormGasto();
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-pendientes'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateGastoMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) =>
      gastosRegistralesApi.update(id, datos),
    onSuccess: (response) => {
      toast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetFormGasto();
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteGastoMutation = useMutation({
    mutationFn: gastosRegistralesApi.delete,
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null, tipo: 'gasto' });
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => gastosRegistralesApi.importarCSV(contenido),
    onSuccess: (data) => {
      const { insertados, errores } = data;
      toast.success(`Importación completada: ${insertados} gastos insertados`);
      if (errores.length > 0) {
        toast.error(`${errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', errores);
      }
      refetchGastos();
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });

  // Mutations para adelantos
  const createAdelantoMutation = useMutation({
    mutationFn: adelantosApi.create,
    onSuccess: (response) => {
      toast.success(response.message);
      setModalAdelanto({ isOpen: false, adelanto: null });
      resetFormAdelanto();
      queryClient.invalidateQueries({ queryKey: ['adelantos-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const marcarDescontadoMutation = useMutation({
    mutationFn: ({ id, fecha }: { id: number; fecha: string }) =>
      adelantosApi.marcarDescontado(id, fecha),
    onSuccess: (response) => {
      toast.success(response.message);
      setDescontarDialog({ isOpen: false, adelantoId: null });
      queryClient.invalidateQueries({ queryKey: ['adelantos-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAdelantoMutation = useMutation({
    mutationFn: adelantosApi.delete,
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null, tipo: 'adelanto' });
      queryClient.invalidateQueries({ queryKey: ['adelantos-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const resetFormGasto = () => {
    setFormGasto({
      fecha: format(today, 'yyyy-MM-dd'),
      concepto: 'ABL',
      monto: 0,
      observaciones: '',
      estado: 'Pagado',
    });
  };

  const resetFormAdelanto = () => {
    setFormAdelanto({
      empleado: 'DAMI',
      fecha_adelanto: format(today, 'yyyy-MM-dd'),
      monto: 0,
      observaciones: '',
    });
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

  const handleOpenModalGasto = (gasto?: GastoRegistral) => {
    if (gasto) {
      setFormGasto({
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        monto: gasto.monto,
        observaciones: gasto.observaciones || '',
        estado: gasto.estado,
        boleta1: gasto.boleta1,
        boleta2: gasto.boleta2,
        boleta3: gasto.boleta3,
        boleta4: gasto.boleta4,
      });
      setModalGasto({ isOpen: true, gasto });
    } else {
      resetFormGasto();
      setModalGasto({ isOpen: true, gasto: null });
    }
  };

  const handleOpenModalAdelanto = (adelanto?: Adelanto) => {
    if (adelanto) {
      setFormAdelanto({
        empleado: adelanto.empleado,
        fecha_adelanto: adelanto.fecha_adelanto,
        monto: adelanto.monto,
        observaciones: adelanto.observaciones || '',
      });
      setModalAdelanto({ isOpen: true, adelanto });
    } else {
      setFormAdelanto({ ...formAdelanto, empleado: empleadoTab });
      setModalAdelanto({ isOpen: true, adelanto: null });
    }
  };

  const handleSaveGasto = () => {
    if (formGasto.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    const tieneModalEspecial = CON_MODAL_ESPECIAL[formGasto.concepto as keyof typeof CON_MODAL_ESPECIAL];

    if (tieneModalEspecial) {
      const numBoletas = tieneModalEspecial;
      const totalBoletas = (formGasto.boleta1 || 0) + (formGasto.boleta2 || 0) +
        (numBoletas >= 3 ? (formGasto.boleta3 || 0) : 0) +
        (numBoletas >= 4 ? (formGasto.boleta4 || 0) : 0);

      if (Math.abs(totalBoletas - formGasto.monto) > 0.01) {
        toast.error(`La suma de las boletas (${formatCurrency(totalBoletas)}) debe ser igual al monto total (${formatCurrency(formGasto.monto)})`);
        return;
      }
    }

    if (modalGasto.gasto) {
      updateGastoMutation.mutate({
        id: modalGasto.gasto.id,
        datos: formGasto,
      });
    } else {
      createGastoMutation.mutate(formGasto);
    }
  };

  const handleSaveAdelanto = () => {
    if (formAdelanto.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    createAdelantoMutation.mutate({
      ...formAdelanto,
      origen: 'MANUAL',
    });
  };

  const handleDelete = () => {
    if (deleteDialog.id === null) return;

    if (deleteDialog.tipo === 'gasto') {
      deleteGastoMutation.mutate(deleteDialog.id);
    } else {
      deleteAdelantoMutation.mutate(deleteDialog.id);
    }
  };

  const handleMarcarDescontado = () => {
    if (descontarDialog.adelantoId === null) return;
    marcarDescontadoMutation.mutate({
      id: descontarDialog.adelantoId,
      fecha: format(today, 'yyyy-MM-dd'),
    });
  };

  const resumenEmpleado = empleadoTab === 'DAMI' ? resumenDami : resumenMumi;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">💸 Gastos Registrales</h1>
          <p className="text-text-secondary mt-1">
            Gestión de gastos mensuales del registro y adelantos de empleados
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('gastos')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'gastos'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Gastos Registrales
        </button>
        <button
          onClick={() => setActiveTab('adelantos')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'adelantos'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Adelantos Empleados
        </button>
      </div>

      {/* Gastos Registrales Tab */}
      {activeTab === 'gastos' && (
        <>
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

          {/* Alertas y Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-error-light border-error">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-error" />
                <div>
                  <p className="text-sm text-text-secondary">Pendientes Mes Actual</p>
                  <p className="text-2xl font-bold text-error">{conceptosPendientes.length}</p>
                  <p className="text-xs text-text-muted">
                    {conceptosPendientes.length === 0
                      ? 'Todo al día'
                      : `${conceptosPendientes.join(', ')}`}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-text-secondary">Total Año {anioActual}</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(resumenGastos?.total_anio || 0)}
                  </p>
                  <p className="text-xs text-text-muted">{resumenGastos?.gastos_anio || 0} gastos</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-success" />
                <div>
                  <p className="text-sm text-text-secondary">Total Histórico</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(resumenGastos?.total_historico || 0)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {resumenGastos?.gastos_historico || 0} gastos
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabla de Gastos */}
          <Card
            title={`Gastos de ${format(new Date(anioActual, mesActual - 1), 'MMMM yyyy', { locale: es })}`}
            actions={
              <Button variant="primary" size="sm" icon={Plus} onClick={() => handleOpenModalGasto()}>
                Nuevo Gasto
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Fecha
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Concepto
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                      Monto
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Estado
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Origen
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gastosRegistrales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-text-muted">
                        No hay gastos registrados este mes
                      </td>
                    </tr>
                  ) : (
                    gastosRegistrales.map((gasto: GastoRegistral) => (
                      <tr key={gasto.id} className="border-b border-border hover:bg-background">
                        <td className="py-3 px-4 text-sm text-text-primary">
                          {format(new Date(gasto.fecha), 'dd/MM/yyyy')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text-primary">
                              {gasto.concepto}
                            </span>
                            {gasto.observaciones && (
                              <span className="text-xs text-text-muted">{gasto.observaciones}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-right text-text-primary">
                          {formatCurrency(gasto.monto)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              gasto.estado === 'Pagado'
                                ? 'bg-success-light text-success'
                                : 'bg-error-light text-error'
                            }`}
                          >
                            {gasto.estado === 'Pagado' && <CheckCircle2 className="h-3 w-3" />}
                            {gasto.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary">{gasto.origen}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModalGasto(gasto)}
                              className="p-1 text-text-secondary hover:text-primary transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteDialog({ isOpen: true, id: gasto.id, tipo: 'gasto' })
                              }
                              className="p-1 text-text-secondary hover:text-error transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Adelantos Tab */}
      {activeTab === 'adelantos' && (
        <>
          {/* Sub-tabs DAMI / MUMI */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setEmpleadoTab('DAMI')}
              className={`px-6 py-3 font-medium transition-colors ${
                empleadoTab === 'DAMI'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              DAMI
            </button>
            <button
              onClick={() => setEmpleadoTab('MUMI')}
              className={`px-6 py-3 font-medium transition-colors ${
                empleadoTab === 'MUMI'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              MUMI
            </button>
          </div>

          {/* Resumen Empleado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-warning-light border-warning">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-sm text-text-secondary">Pendientes Mes Actual</p>
                  <p className="text-2xl font-bold text-warning">
                    {formatCurrency(resumenEmpleado?.pendientes_mes_actual || 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-text-secondary">Total Año {anioActual}</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(resumenEmpleado?.total_anio_actual || 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-success" />
                <div>
                  <p className="text-sm text-text-secondary">Total Histórico</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(resumenEmpleado?.total_historico || 0)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Adelantos Pendientes */}
          <Card
            title="Adelantos Pendientes"
            actions={
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => handleOpenModalAdelanto()}
              >
                Nuevo Adelanto
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Fecha
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                      Monto
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Origen
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Observaciones
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!resumenEmpleado || resumenEmpleado.adelantos_pendientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted">
                        No hay adelantos pendientes
                      </td>
                    </tr>
                  ) : (
                    resumenEmpleado.adelantos_pendientes.map((adelanto: Adelanto) => (
                      <tr key={adelanto.id} className="border-b border-border hover:bg-background">
                        <td className="py-3 px-4 text-sm text-text-primary">
                          {format(new Date(adelanto.fecha_adelanto), 'dd/MM/yyyy')}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-right text-text-primary">
                          {formatCurrency(adelanto.monto)}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary">{adelanto.origen}</td>
                        <td className="py-3 px-4 text-sm text-text-muted">
                          {adelanto.observaciones || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                setDescontarDialog({ isOpen: true, adelantoId: adelanto.id })
                              }
                            >
                              Marcar Descontado
                            </Button>
                            <button
                              onClick={() =>
                                setDeleteDialog({
                                  isOpen: true,
                                  id: adelanto.id,
                                  tipo: 'adelanto',
                                })
                              }
                              className="p-1 text-text-secondary hover:text-error transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Adelantos Descontados */}
          <Card title="Adelantos Descontados">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Fecha Adelanto
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Fecha Descuento
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                      Monto
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                      Observaciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!resumenEmpleado || resumenEmpleado.adelantos_descontados.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted">
                        No hay adelantos descontados
                      </td>
                    </tr>
                  ) : (
                    resumenEmpleado.adelantos_descontados.map((adelanto: Adelanto) => (
                      <tr key={adelanto.id} className="border-b border-border">
                        <td className="py-3 px-4 text-sm text-text-primary">
                          {format(new Date(adelanto.fecha_adelanto), 'dd/MM/yyyy')}
                        </td>
                        <td className="py-3 px-4 text-sm text-success">
                          {adelanto.fecha_descuento
                            ? format(new Date(adelanto.fecha_descuento), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-right text-text-primary">
                          {formatCurrency(adelanto.monto)}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-muted">
                          {adelanto.observaciones || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Modal Gasto */}
      <Modal
        isOpen={modalGasto.isOpen}
        onClose={() => setModalGasto({ isOpen: false, gasto: null })}
        title={modalGasto.gasto ? 'Editar Gasto' : 'Nuevo Gasto'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Fecha</label>
              <input
                type="date"
                value={formGasto.fecha}
                onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Concepto
              </label>
              <select
                value={formGasto.concepto}
                onChange={(e) =>
                  setFormGasto({ ...formGasto, concepto: e.target.value as ConceptoGR })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                {CONCEPTOS_GR.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Monto</label>
              <input
                type="number"
                step="0.01"
                value={formGasto.monto || ''}
                onChange={(e) =>
                  setFormGasto({ ...formGasto, monto: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
                placeholder="$ 0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Estado</label>
              <select
                value={formGasto.estado}
                onChange={(e) =>
                  setFormGasto({ ...formGasto, estado: e.target.value as 'Pagado' | 'Pendiente' })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </div>
          </div>

          {/* Boletas especiales para ABL (3) y AYSA (4) */}
          {formGasto.concepto === 'ABL' && (
            <div className="bg-info-light rounded-lg p-4">
              <h4 className="text-sm font-semibold text-text-primary mb-3">Boletas ABL (3)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 1</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta1 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta1: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 2</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta2 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta2: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 3</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta3 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta3: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Total boletas: {formatCurrency((formGasto.boleta1 || 0) + (formGasto.boleta2 || 0) + (formGasto.boleta3 || 0))}
              </p>
            </div>
          )}

          {formGasto.concepto === 'AYSA' && (
            <div className="bg-info-light rounded-lg p-4">
              <h4 className="text-sm font-semibold text-text-primary mb-3">Boletas AYSA (4)</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 1</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta1 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta1: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 2</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta2 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta2: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 3</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta3 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta3: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Boleta 4</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGasto.boleta4 || ''}
                    onChange={(e) =>
                      setFormGasto({ ...formGasto, boleta4: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Total boletas: {formatCurrency((formGasto.boleta1 || 0) + (formGasto.boleta2 || 0) + (formGasto.boleta3 || 0) + (formGasto.boleta4 || 0))}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Observaciones
            </label>
            <textarea
              value={formGasto.observaciones}
              onChange={(e) => setFormGasto({ ...formGasto, observaciones: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              rows={3}
              placeholder="Observaciones opcionales..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSaveGasto}
              loading={createGastoMutation.isPending || updateGastoMutation.isPending}
              className="flex-1"
            >
              {modalGasto.gasto ? 'Actualizar' : 'Guardar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalGasto({ isOpen: false, gasto: null })}
              disabled={createGastoMutation.isPending || updateGastoMutation.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Adelanto */}
      <Modal
        isOpen={modalAdelanto.isOpen}
        onClose={() => setModalAdelanto({ isOpen: false, adelanto: null })}
        title="Nuevo Adelanto"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Empleado
              </label>
              <select
                value={formAdelanto.empleado}
                onChange={(e) =>
                  setFormAdelanto({
                    ...formAdelanto,
                    empleado: e.target.value as 'DAMI' | 'MUMI',
                  })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                <option value="DAMI">DAMI</option>
                <option value="MUMI">MUMI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Fecha</label>
              <input
                type="date"
                value={formAdelanto.fecha_adelanto}
                onChange={(e) =>
                  setFormAdelanto({ ...formAdelanto, fecha_adelanto: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Monto</label>
            <input
              type="number"
              step="0.01"
              value={formAdelanto.monto || ''}
              onChange={(e) =>
                setFormAdelanto({ ...formAdelanto, monto: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              placeholder="$ 0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Observaciones
            </label>
            <textarea
              value={formAdelanto.observaciones}
              onChange={(e) => setFormAdelanto({ ...formAdelanto, observaciones: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              rows={3}
              placeholder="Observaciones opcionales..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSaveAdelanto}
              loading={createAdelantoMutation.isPending}
              className="flex-1"
            >
              Guardar
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalAdelanto({ isOpen: false, adelanto: null })}
              disabled={createAdelantoMutation.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, tipo: 'gasto' })}
        onConfirm={handleDelete}
        title={`Eliminar ${deleteDialog.tipo === 'gasto' ? 'Gasto' : 'Adelanto'}`}
        message={`¿Está seguro que desea eliminar este ${
          deleteDialog.tipo === 'gasto' ? 'gasto' : 'adelanto'
        }? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteGastoMutation.isPending || deleteAdelantoMutation.isPending}
      />

      {/* Descontar Confirm Dialog */}
      <ConfirmDialog
        isOpen={descontarDialog.isOpen}
        onClose={() => setDescontarDialog({ isOpen: false, adelantoId: null })}
        onConfirm={handleMarcarDescontado}
        title="Marcar como Descontado"
        message="¿Confirma que desea marcar este adelanto como descontado? Se registrará con la fecha de hoy."
        confirmText="Confirmar"
        variant="info"
        isLoading={marcarDescontadoMutation.isPending}
      />
    </div>
  );
};

export default GastosRegistro;
