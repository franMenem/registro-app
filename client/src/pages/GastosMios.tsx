import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateFromDB } from '@/utils/format';
import { formatCurrency } from '@/utils/format';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu';
import {
  gastosMiosApi,
  GastoMio,
  ResumenGastosMios,
} from '@/services/supabase/gastos-mios';
import {
  deudasApi,
  Deuda,
  DeudaPago,
  TipoPago,
  EstadoDeuda,
  ResumenDeudas,
} from '@/services/supabase/deudas';

const CONCEPTOS = [
  'Comida',
  'Animales',
  'Gas',
  'Electricidad',
  'Agua',
  'Expensas',
  'Padel',
  'Internet',
  'Streaming',
  'Transporte',
  'Salud',
  'Gimnasio',
  'Sueldo',
  'Otros',
] as const;

type Concepto = (typeof CONCEPTOS)[number];
type Categoria = 'GASTO' | 'INGRESO' | 'AHORRO';
type Tipo = 'FIJO' | 'VARIABLE';

const GastosMios: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();

  // ── Tab state ──
  const [tabActivo, setTabActivo] = useState<'gastos' | 'deudas'>('gastos');

  // ── Gastos state ──
  const [mesActual, setMesActual] = useState(today.getMonth() + 1);
  const [anioActual, setAnioActual] = useState(today.getFullYear());
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<Tipo | ''>('');
  const [modalGasto, setModalGasto] = useState<{
    isOpen: boolean;
    gasto: GastoMio | null;
  }>({ isOpen: false, gasto: null });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    concepto: string;
  }>({ isOpen: false, id: null, concepto: '' });
  const [formGasto, setFormGasto] = useState<{
    fecha: string;
    concepto: Concepto;
    monto: number;
    categoria: Categoria;
    tipo: Tipo;
    observaciones: string;
  }>({
    fecha: format(today, 'yyyy-MM-dd'),
    concepto: 'Comida',
    monto: 0,
    categoria: 'GASTO',
    tipo: 'VARIABLE',
    observaciones: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // ── Deudas state ──
  const [filtroEstadoDeuda, setFiltroEstadoDeuda] = useState<EstadoDeuda | ''>('');
  const [deudaExpandida, setDeudaExpandida] = useState<number | null>(null);
  const [modalDeuda, setModalDeuda] = useState<{
    isOpen: boolean;
    deuda: Deuda | null;
  }>({ isOpen: false, deuda: null });
  const [modalPago, setModalPago] = useState<{
    isOpen: boolean;
    deuda: Deuda | null;
  }>({ isOpen: false, deuda: null });
  const [deleteDeudaDialog, setDeleteDeudaDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    concepto: string;
    tienePagos: boolean;
  }>({ isOpen: false, id: null, concepto: '', tienePagos: false });
  const [deletePagoDialog, setDeletePagoDialog] = useState<{
    isOpen: boolean;
    pagoId: number | null;
  }>({ isOpen: false, pagoId: null });
  const [formDeuda, setFormDeuda] = useState({
    concepto: '',
    acreedor: '',
    monto_total: 0,
    tipo_pago: 'LIBRE' as TipoPago,
    cantidad_cuotas: 1,
    fecha_inicio: format(today, 'yyyy-MM-dd'),
    observaciones: '',
  });
  const [formPago, setFormPago] = useState({
    fecha: format(today, 'yyyy-MM-dd'),
    monto: 0,
    numero_cuota: null as number | null,
    observaciones: '',
  });
  const [currentPageDeudas, setCurrentPageDeudas] = useState(1);
  const [itemsPerPageDeudas, setItemsPerPageDeudas] = useState(50);

  // ════════════════════════════════════════════
  // QUERIES
  // ════════════════════════════════════════════

  // Gastos queries
  const { data: gastosMios = [] } = useQuery<GastoMio[]>({
    queryKey: ['gastos-mios', mesActual, anioActual, filtroCategoria, filtroTipo],
    queryFn: () =>
      gastosMiosApi.getAll({
        mes: mesActual,
        anio: anioActual,
        categoria: filtroCategoria || undefined,
        tipo: filtroTipo || undefined,
      }),
  });

  const { data: resumen } = useQuery<ResumenGastosMios>({
    queryKey: ['gastos-mios-resumen', mesActual, anioActual],
    queryFn: () => gastosMiosApi.getResumen(mesActual, anioActual),
  });

  // Deudas queries
  const { data: deudas = [] } = useQuery<Deuda[]>({
    queryKey: ['deudas', filtroEstadoDeuda],
    queryFn: () => deudasApi.getAll(filtroEstadoDeuda ? { estado: filtroEstadoDeuda } : undefined),
    enabled: tabActivo === 'deudas',
  });

  const { data: resumenDeudas } = useQuery<ResumenDeudas>({
    queryKey: ['deudas-resumen'],
    queryFn: () => deudasApi.getResumen(),
    enabled: tabActivo === 'deudas',
  });

  // ════════════════════════════════════════════
  // MUTATIONS — Gastos
  // ════════════════════════════════════════════

  const createMutation = useMutation({
    mutationFn: gastosMiosApi.create,
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetFormGasto();
      queryClient.invalidateQueries({ queryKey: ['gastos-mios'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-mios-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => gastosMiosApi.update(id, data),
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetFormGasto();
      queryClient.invalidateQueries({ queryKey: ['gastos-mios'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-mios-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: gastosMiosApi.delete,
    onSuccess: (response) => {
      showToast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null, concepto: '' });
      queryClient.invalidateQueries({ queryKey: ['gastos-mios'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-mios-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  // ════════════════════════════════════════════
  // MUTATIONS — Deudas
  // ════════════════════════════════════════════

  const invalidateDeudas = () => {
    queryClient.invalidateQueries({ queryKey: ['deudas'] });
    queryClient.invalidateQueries({ queryKey: ['deudas-resumen'] });
  };

  const createDeudaMutation = useMutation({
    mutationFn: deudasApi.create,
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalDeuda({ isOpen: false, deuda: null });
      resetFormDeuda();
      invalidateDeudas();
    },
    onError: (error: Error) => { showToast.error(error.message); },
  });

  const updateDeudaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => deudasApi.update(id, data),
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalDeuda({ isOpen: false, deuda: null });
      resetFormDeuda();
      invalidateDeudas();
    },
    onError: (error: Error) => { showToast.error(error.message); },
  });

  const deleteDeudaMutation = useMutation({
    mutationFn: deudasApi.delete,
    onSuccess: (response) => {
      showToast.success(response.message);
      setDeleteDeudaDialog({ isOpen: false, id: null, concepto: '', tienePagos: false });
      invalidateDeudas();
    },
    onError: (error: Error) => { showToast.error(error.message); },
  });

  const registrarPagoMutation = useMutation({
    mutationFn: ({ deudaId, pago }: { deudaId: number; pago: any }) =>
      deudasApi.registrarPago(deudaId, pago),
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalPago({ isOpen: false, deuda: null });
      resetFormPago();
      invalidateDeudas();
    },
    onError: (error: Error) => { showToast.error(error.message); },
  });

  const eliminarPagoMutation = useMutation({
    mutationFn: deudasApi.eliminarPago,
    onSuccess: (response) => {
      showToast.success(response.message);
      setDeletePagoDialog({ isOpen: false, pagoId: null });
      invalidateDeudas();
    },
    onError: (error: Error) => { showToast.error(error.message); },
  });

  // ════════════════════════════════════════════
  // HANDLERS — Gastos
  // ════════════════════════════════════════════

  const resetFormGasto = () => {
    setFormGasto({
      fecha: format(today, 'yyyy-MM-dd'),
      concepto: 'Comida',
      monto: 0,
      categoria: 'GASTO',
      tipo: 'VARIABLE',
      observaciones: '',
    });
  };

  const handleOpenCreate = () => {
    resetFormGasto();
    setModalGasto({ isOpen: true, gasto: null });
  };

  const handleOpenEdit = (gasto: GastoMio) => {
    setFormGasto({
      fecha: gasto.fecha,
      concepto: gasto.concepto,
      monto: gasto.monto,
      categoria: gasto.categoria,
      tipo: gasto.tipo,
      observaciones: gasto.observaciones || '',
    });
    setModalGasto({ isOpen: true, gasto });
  };

  const handleSubmitGasto = (e: React.FormEvent) => {
    e.preventDefault();
    if (formGasto.monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }
    if (modalGasto.gasto) {
      updateMutation.mutate({ id: modalGasto.gasto.id, data: formGasto });
    } else {
      createMutation.mutate(formGasto);
    }
  };

  const handleDeleteGasto = (id: number) => {
    deleteMutation.mutate(id);
  };

  // ════════════════════════════════════════════
  // HANDLERS — Deudas
  // ════════════════════════════════════════════

  const resetFormDeuda = () => {
    setFormDeuda({
      concepto: '',
      acreedor: '',
      monto_total: 0,
      tipo_pago: 'LIBRE',
      cantidad_cuotas: 1,
      fecha_inicio: format(today, 'yyyy-MM-dd'),
      observaciones: '',
    });
  };

  const resetFormPago = () => {
    setFormPago({
      fecha: format(today, 'yyyy-MM-dd'),
      monto: 0,
      numero_cuota: null,
      observaciones: '',
    });
  };

  const handleOpenCreateDeuda = () => {
    resetFormDeuda();
    setModalDeuda({ isOpen: true, deuda: null });
  };

  const handleOpenEditDeuda = (deuda: Deuda) => {
    setFormDeuda({
      concepto: deuda.concepto,
      acreedor: deuda.acreedor,
      monto_total: deuda.monto_total,
      tipo_pago: deuda.tipo_pago,
      cantidad_cuotas: deuda.cantidad_cuotas || 1,
      fecha_inicio: deuda.fecha_inicio,
      observaciones: deuda.observaciones || '',
    });
    setModalDeuda({ isOpen: true, deuda });
  };

  const handleSubmitDeuda = (e: React.FormEvent) => {
    e.preventDefault();
    if (formDeuda.monto_total <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }
    if (!formDeuda.concepto.trim()) {
      showToast.error('Ingrese un concepto');
      return;
    }
    if (!formDeuda.acreedor.trim()) {
      showToast.error('Ingrese un acreedor');
      return;
    }

    const data = {
      concepto: formDeuda.concepto,
      acreedor: formDeuda.acreedor,
      monto_total: formDeuda.monto_total,
      tipo_pago: formDeuda.tipo_pago,
      cantidad_cuotas: formDeuda.tipo_pago === 'CUOTAS' ? formDeuda.cantidad_cuotas : undefined,
      fecha_inicio: formDeuda.fecha_inicio,
      observaciones: formDeuda.observaciones || undefined,
    };

    if (modalDeuda.deuda) {
      updateDeudaMutation.mutate({ id: modalDeuda.deuda.id, data });
    } else {
      createDeudaMutation.mutate(data);
    }
  };

  const handleOpenPago = (deuda: Deuda) => {
    const nextCuota = deuda.tipo_pago === 'CUOTAS' ? deuda.pagos.length + 1 : null;
    setFormPago({
      fecha: format(today, 'yyyy-MM-dd'),
      monto: deuda.tipo_pago === 'CUOTAS' && deuda.monto_cuota ? deuda.monto_cuota : 0,
      numero_cuota: nextCuota,
      observaciones: '',
    });
    setModalPago({ isOpen: true, deuda });
  };

  const handleSubmitPago = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPago.deuda) return;
    if (formPago.monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }
    registrarPagoMutation.mutate({
      deudaId: modalPago.deuda.id,
      pago: {
        fecha: formPago.fecha,
        monto: formPago.monto,
        numero_cuota: formPago.numero_cuota || undefined,
        observaciones: formPago.observaciones || undefined,
      },
    });
  };

  // ════════════════════════════════════════════
  // PAGINATION & HELPERS
  // ════════════════════════════════════════════

  // Gastos pagination
  const totalItems = gastosMios.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const gastosAMostrar = gastosMios.slice(startIndex, endIndex);

  // Deudas pagination
  const totalDeudas = deudas.length;
  const startIndexDeudas = (currentPageDeudas - 1) * itemsPerPageDeudas;
  const endIndexDeudas = startIndexDeudas + itemsPerPageDeudas;
  const deudasAMostrar = deudas.slice(startIndexDeudas, endIndexDeudas);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [mesActual, anioActual, filtroCategoria, filtroTipo]);

  React.useEffect(() => {
    setCurrentPageDeudas(1);
  }, [filtroEstadoDeuda]);

  const getCategoriaIcon = (categoria: Categoria) => {
    switch (categoria) {
      case 'INGRESO':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'GASTO':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'AHORRO':
        return <Wallet className="h-4 w-4 text-blue-600" />;
    }
  };

  const getCategoriaColor = (categoria: Categoria) => {
    switch (categoria) {
      case 'INGRESO':
        return 'text-green-600 bg-green-50';
      case 'GASTO':
        return 'text-red-600 bg-red-50';
      case 'AHORRO':
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getEstadoDeudaColor = (estado: EstadoDeuda) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'text-yellow-700 bg-yellow-50';
      case 'EN_CURSO':
        return 'text-blue-700 bg-blue-50';
      case 'PAGADA':
        return 'text-green-700 bg-green-50';
    }
  };

  const getEstadoDeudaLabel = (estado: EstadoDeuda) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'EN_CURSO':
        return 'En Curso';
      case 'PAGADA':
        return 'Pagada';
    }
  };

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Gastos</h1>
          <p className="text-gray-500 mt-1">
            {tabActivo === 'gastos'
              ? 'Control de gastos e ingresos personales'
              : 'Seguimiento de deudas y pagos'}
          </p>
        </div>
        {tabActivo === 'gastos' ? (
          <Button onClick={handleOpenCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Registro
          </Button>
        ) : (
          <Button onClick={handleOpenCreateDeuda}>
            <Plus className="h-5 w-5 mr-2" />
            Nueva Deuda
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTabActivo('gastos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tabActivo === 'gastos'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Gastos
        </button>
        <button
          onClick={() => setTabActivo('deudas')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tabActivo === 'deudas'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Deudas
          {resumenDeudas && resumenDeudas.deudas_activas > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {resumenDeudas.deudas_activas}
            </span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* TAB: GASTOS                                 */}
      {/* ════════════════════════════════════════════ */}
      {tabActivo === 'gastos' && (
        <>
          {/* Filtros */}
          <Card>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                  <select
                    value={mesActual}
                    onChange={(e) => setMesActual(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                      <option key={mes} value={mes}>
                        {format(new Date(2024, mes - 1), 'MMMM', { locale: es })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <select
                    value={anioActual}
                    onChange={(e) => setAnioActual(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map((anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value as Categoria | '')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Todas</option>
                    <option value="GASTO">Gastos</option>
                    <option value="INGRESO">Ingresos</option>
                    <option value="AHORRO">Ahorros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value as Tipo | '')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Todos</option>
                    <option value="FIJO">Fijos</option>
                    <option value="VARIABLE">Variables</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Resumen */}
          {resumen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Balance Mensual</p>
                      <p
                        className={`text-2xl font-bold mt-2 ${
                          resumen.total_mes >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        ${resumen.total_mes.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ingresos</p>
                      <p className="text-2xl font-bold text-green-600 mt-2">
                        ${resumen.total_ingresos.toFixed(2)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Gastos</p>
                      <p className="text-2xl font-bold text-red-600 mt-2">
                        ${resumen.total_gastos.toFixed(2)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ahorros</p>
                      <p className="text-2xl font-bold text-blue-600 mt-2">
                        ${resumen.total_ahorros.toFixed(2)}
                      </p>
                    </div>
                    <Wallet className="h-8 w-8 text-blue-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tabla Gastos */}
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observaciones
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gastosAMostrar.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No hay registros para el mes seleccionado
                      </td>
                    </tr>
                  ) : (
                    gastosAMostrar.map((gasto) => (
                      <tr key={gasto.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(parseDateFromDB(gasto.fecha), 'dd/MM/yyyy', { locale: es })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {gasto.concepto}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoriaColor(
                              gasto.categoria
                            )}`}
                          >
                            {getCategoriaIcon(gasto.categoria)}
                            {gasto.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              gasto.tipo === 'FIJO'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {gasto.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span
                            className={
                              gasto.categoria === 'INGRESO'
                                ? 'text-green-600'
                                : gasto.categoria === 'GASTO'
                                ? 'text-red-600'
                                : 'text-blue-600'
                            }
                          >
                            {gasto.categoria === 'INGRESO' ? '+' : gasto.categoria === 'GASTO' ? '-' : ''}
                            ${gasto.monto.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {gasto.observaciones || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleOpenEdit(gasto)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteDialog({ isOpen: true, id: gasto.id, concepto: gasto.concepto })
                            }
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

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
        </>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: DEUDAS                                 */}
      {/* ════════════════════════════════════════════ */}
      {tabActivo === 'deudas' && (
        <>
          {/* Filtro */}
          <Card>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={filtroEstadoDeuda}
                    onChange={(e) => setFiltroEstadoDeuda(e.target.value as EstadoDeuda | '')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Todas</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="EN_CURSO">En Curso</option>
                    <option value="PAGADA">Pagadas</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Resumen Deudas */}
          {resumenDeudas && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Deuda</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">
                        {formatCurrency(resumenDeudas.total_deuda)}
                      </p>
                    </div>
                    <CreditCard className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Pagado</p>
                      <p className="text-2xl font-bold text-green-600 mt-2">
                        {formatCurrency(resumenDeudas.total_pagado)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pendiente</p>
                      <p className="text-2xl font-bold text-red-600 mt-2">
                        {formatCurrency(resumenDeudas.total_pendiente)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Deudas Activas</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">
                        {resumenDeudas.deudas_activas}
                      </p>
                      {resumenDeudas.deudas_pagadas > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          {resumenDeudas.deudas_pagadas} pagada{resumenDeudas.deudas_pagadas > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <DollarSign className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tabla Deudas */}
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acreedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Progreso</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deudasAMostrar.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        No hay deudas registradas
                      </td>
                    </tr>
                  ) : (
                    deudasAMostrar.map((deuda) => {
                      const pct = deuda.monto_total > 0
                        ? Math.min(100, (deuda.total_pagado / deuda.monto_total) * 100)
                        : 0;
                      const isExpanded = deudaExpandida === deuda.id;

                      const actionItems: ActionMenuItem[] = [];
                      if (deuda.estado !== 'PAGADA') {
                        actionItems.push({
                          label: 'Registrar Pago',
                          icon: DollarSign,
                          onClick: () => handleOpenPago(deuda),
                        });
                      }
                      actionItems.push({
                        label: 'Editar',
                        icon: Edit,
                        onClick: () => handleOpenEditDeuda(deuda),
                      });
                      actionItems.push({
                        label: 'Eliminar',
                        icon: Trash2,
                        onClick: () => setDeleteDeudaDialog({
                          isOpen: true,
                          id: deuda.id,
                          concepto: deuda.concepto,
                          tienePagos: deuda.pagos.length > 0,
                        }),
                        variant: 'danger',
                        divider: true,
                      });

                      return (
                        <React.Fragment key={deuda.id}>
                          <tr className="hover:bg-gray-50">
                            {/* Expand toggle */}
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setDeudaExpandida(isExpanded ? null : deuda.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {isExpanded
                                  ? <ChevronUp className="h-4 w-4" />
                                  : <ChevronDown className="h-4 w-4" />
                                }
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {deuda.concepto}
                              {deuda.tipo_pago === 'CUOTAS' && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({deuda.cantidad_cuotas} cuotas)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{deuda.acreedor}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              {formatCurrency(deuda.monto_total)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-green-600">
                              {formatCurrency(deuda.total_pagado)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-red-600">
                              {formatCurrency(deuda.saldo_pendiente)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-12 text-right">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              {deuda.tipo_pago === 'CUOTAS' && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {deuda.pagos.length}/{deuda.cantidad_cuotas} cuotas
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getEstadoDeudaColor(deuda.estado)}`}
                              >
                                {getEstadoDeudaLabel(deuda.estado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <ActionMenu items={actionItems} />
                            </td>
                          </tr>

                          {/* Expanded: pagos detail */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="px-0 py-0">
                                <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-700">
                                      Pagos realizados ({deuda.pagos.length})
                                    </h4>
                                    {deuda.tipo_pago === 'CUOTAS' && deuda.monto_cuota && (
                                      <p className="text-xs text-gray-500">
                                        Cuota: {formatCurrency(deuda.monto_cuota)}
                                      </p>
                                    )}
                                  </div>

                                  {deuda.pagos.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">Sin pagos registrados</p>
                                  ) : (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200">
                                          <th className="text-left py-2 text-xs text-gray-500 font-medium">#</th>
                                          <th className="text-left py-2 text-xs text-gray-500 font-medium">Fecha</th>
                                          <th className="text-right py-2 text-xs text-gray-500 font-medium">Monto</th>
                                          {deuda.tipo_pago === 'CUOTAS' && (
                                            <th className="text-left py-2 text-xs text-gray-500 font-medium">Cuota</th>
                                          )}
                                          <th className="text-left py-2 text-xs text-gray-500 font-medium">Obs</th>
                                          <th className="text-center py-2 text-xs text-gray-500 font-medium w-10"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {deuda.pagos.map((pago, idx) => (
                                          <tr key={pago.id} className="border-b border-gray-100">
                                            <td className="py-2 text-gray-500">{idx + 1}</td>
                                            <td className="py-2">
                                              {format(parseDateFromDB(pago.fecha), 'dd/MM/yyyy', { locale: es })}
                                            </td>
                                            <td className="py-2 text-right font-mono text-green-600">
                                              {formatCurrency(pago.monto)}
                                            </td>
                                            {deuda.tipo_pago === 'CUOTAS' && (
                                              <td className="py-2 text-gray-500">
                                                {pago.numero_cuota ? `#${pago.numero_cuota}` : '-'}
                                              </td>
                                            )}
                                            <td className="py-2 text-gray-500">{pago.observaciones || '-'}</td>
                                            <td className="py-2 text-center">
                                              <button
                                                onClick={() => setDeletePagoDialog({ isOpen: true, pagoId: pago.id })}
                                                className="text-red-400 hover:text-red-600"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}

                                  {deuda.estado !== 'PAGADA' && (
                                    <div className="mt-3">
                                      <Button
                                        size="sm"
                                        onClick={() => handleOpenPago(deuda)}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Registrar Pago
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalDeudas > 0 && (
              <Pagination
                currentPage={currentPageDeudas}
                totalItems={totalDeudas}
                itemsPerPage={itemsPerPageDeudas}
                onPageChange={setCurrentPageDeudas}
                onItemsPerPageChange={setItemsPerPageDeudas}
              />
            )}
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* MODALES                                     */}
      {/* ════════════════════════════════════════════ */}

      {/* Modal Crear/Editar Gasto */}
      <Modal
        isOpen={modalGasto.isOpen}
        onClose={() => setModalGasto({ isOpen: false, gasto: null })}
        title={modalGasto.gasto ? 'Editar Registro' : 'Nuevo Registro'}
      >
        <form onSubmit={handleSubmitGasto} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={formGasto.fecha}
              onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
            <select
              value={formGasto.concepto}
              onChange={(e) => setFormGasto({ ...formGasto, concepto: e.target.value as Concepto })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              {CONCEPTOS.map((concepto) => (
                <option key={concepto} value={concepto}>
                  {concepto}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={formGasto.categoria}
              onChange={(e) =>
                setFormGasto({ ...formGasto, categoria: e.target.value as Categoria })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="GASTO">Gasto</option>
              <option value="INGRESO">Ingreso</option>
              <option value="AHORRO">Ahorro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={formGasto.tipo}
              onChange={(e) => setFormGasto({ ...formGasto, tipo: e.target.value as Tipo })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="FIJO">Fijo</option>
              <option value="VARIABLE">Variable</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              value={formGasto.monto}
              onChange={(e) => setFormGasto({ ...formGasto, monto: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={formGasto.observaciones}
              onChange={(e) => setFormGasto({ ...formGasto, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalGasto({ isOpen: false, gasto: null })}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {modalGasto.gasto ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Crear/Editar Deuda */}
      <Modal
        isOpen={modalDeuda.isOpen}
        onClose={() => setModalDeuda({ isOpen: false, deuda: null })}
        title={modalDeuda.deuda ? 'Editar Deuda' : 'Nueva Deuda'}
      >
        <form onSubmit={handleSubmitDeuda} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
            <input
              type="text"
              value={formDeuda.concepto}
              onChange={(e) => setFormDeuda({ ...formDeuda, concepto: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Ej: Prestamo auto, Tarjeta visa..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acreedor</label>
            <input
              type="text"
              value={formDeuda.acreedor}
              onChange={(e) => setFormDeuda({ ...formDeuda, acreedor: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Ej: Banco ICBC, Juan Perez..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total</label>
            <input
              type="number"
              step="0.01"
              value={formDeuda.monto_total || ''}
              onChange={(e) => setFormDeuda({ ...formDeuda, monto_total: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pago</label>
            <select
              value={formDeuda.tipo_pago}
              onChange={(e) => setFormDeuda({ ...formDeuda, tipo_pago: e.target.value as TipoPago })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="LIBRE">Pagos libres</option>
              <option value="CUOTAS">Cuotas fijas</option>
            </select>
          </div>

          {formDeuda.tipo_pago === 'CUOTAS' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Cuotas</label>
              <input
                type="number"
                min="1"
                value={formDeuda.cantidad_cuotas}
                onChange={(e) => setFormDeuda({ ...formDeuda, cantidad_cuotas: parseInt(e.target.value) || 1 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
              {formDeuda.monto_total > 0 && formDeuda.cantidad_cuotas > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Monto por cuota: {formatCurrency(formDeuda.monto_total / formDeuda.cantidad_cuotas)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={formDeuda.fecha_inicio}
              onChange={(e) => setFormDeuda({ ...formDeuda, fecha_inicio: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={formDeuda.observaciones}
              onChange={(e) => setFormDeuda({ ...formDeuda, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalDeuda({ isOpen: false, deuda: null })}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={createDeudaMutation.isPending || updateDeudaMutation.isPending}>
              {modalDeuda.deuda ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Registrar Pago */}
      <Modal
        isOpen={modalPago.isOpen}
        onClose={() => setModalPago({ isOpen: false, deuda: null })}
        title="Registrar Pago"
      >
        {modalPago.deuda && (
          <form onSubmit={handleSubmitPago} className="space-y-4">
            {/* Context */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-700">{modalPago.deuda.concepto}</p>
              <p className="text-gray-500">
                Pendiente: <span className="font-semibold text-red-600">{formatCurrency(modalPago.deuda.saldo_pendiente)}</span>
                {' / '}Total: {formatCurrency(modalPago.deuda.monto_total)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={formPago.fecha}
                onChange={(e) => setFormPago({ ...formPago, fecha: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input
                type="number"
                step="0.01"
                value={formPago.monto || ''}
                onChange={(e) => setFormPago({ ...formPago, monto: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
              {modalPago.deuda.tipo_pago === 'CUOTAS' && modalPago.deuda.monto_cuota && (
                <button
                  type="button"
                  onClick={() => setFormPago({ ...formPago, monto: modalPago.deuda!.monto_cuota! })}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Usar monto cuota ({formatCurrency(modalPago.deuda.monto_cuota)})
                </button>
              )}
            </div>

            {modalPago.deuda.tipo_pago === 'CUOTAS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero de Cuota</label>
                <input
                  type="number"
                  min="1"
                  max={modalPago.deuda.cantidad_cuotas || undefined}
                  value={formPago.numero_cuota || ''}
                  onChange={(e) => setFormPago({ ...formPago, numero_cuota: parseInt(e.target.value) || null })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea
                value={formPago.observaciones}
                onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalPago({ isOpen: false, deuda: null })}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={registrarPagoMutation.isPending}>
                Registrar Pago
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Delete Gasto */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, concepto: '' })}
        onConfirm={() => deleteDialog.id && handleDeleteGasto(deleteDialog.id)}
        title="Eliminar Registro"
        message={`¿Esta seguro que desea eliminar el registro "${deleteDialog.concepto}"?`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Confirm Delete Deuda */}
      <ConfirmDialog
        isOpen={deleteDeudaDialog.isOpen}
        onClose={() => setDeleteDeudaDialog({ isOpen: false, id: null, concepto: '', tienePagos: false })}
        onConfirm={() => deleteDeudaDialog.id && deleteDeudaMutation.mutate(deleteDeudaDialog.id)}
        title="Eliminar Deuda"
        message={
          deleteDeudaDialog.tienePagos
            ? `¿Eliminar "${deleteDeudaDialog.concepto}"? Se eliminaran tambien todos los pagos registrados.`
            : `¿Eliminar "${deleteDeudaDialog.concepto}"?`
        }
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteDeudaMutation.isPending}
      />

      {/* Confirm Delete Pago */}
      <ConfirmDialog
        isOpen={deletePagoDialog.isOpen}
        onClose={() => setDeletePagoDialog({ isOpen: false, pagoId: null })}
        onConfirm={() => deletePagoDialog.pagoId && eliminarPagoMutation.mutate(deletePagoDialog.pagoId)}
        title="Eliminar Pago"
        message="¿Eliminar este pago? El saldo de la deuda se actualizara."
        confirmText="Eliminar"
        variant="danger"
        isLoading={eliminarPagoMutation.isPending}
      />
    </div>
  );
};

export default GastosMios;
