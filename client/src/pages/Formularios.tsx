import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  FileText,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formulariosApi } from '@/services/api';

interface Vencimiento {
  id: number;
  formulario_id: number;
  numero_vencimiento: number;
  fecha_vencimiento: string;
  monto: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  fecha_pago: string | null;
  gasto_registral_id: number | null;
}

interface Formulario {
  id: number;
  numero: string;
  descripcion: string | null;
  monto: number;
  fecha_compra: string;
  proveedor: string | null;
  vencimientos: Vencimiento[];
  created_at: string;
}

const Formularios: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [modalFormulario, setModalFormulario] = useState<{
    isOpen: boolean;
    formulario: Formulario | null;
  }>({ isOpen: false, formulario: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
  }>({ isOpen: false, id: null });

  const [pagarDialog, setPagarDialog] = useState<{
    isOpen: boolean;
    vencimientos: number[];
  }>({ isOpen: false, vencimientos: [] });

  // Form state
  const [formData, setFormData] = useState({
    numero: '',
    descripcion: '',
    monto: 0,
    fecha_compra: format(today, 'yyyy-MM-dd'),
    proveedor: '',
    vencimientos: [
      { numero_vencimiento: 1, fecha_vencimiento: '', monto: 0 },
      { numero_vencimiento: 2, fecha_vencimiento: '', monto: 0 },
      { numero_vencimiento: 3, fecha_vencimiento: '', monto: 0 },
    ],
  });

  // Selección múltiple
  const [vencimientosSeleccionados, setVencimientosSeleccionados] = useState<Set<number>>(
    new Set()
  );

  // Tab activo: 'activos' o 'historicos'
  const [tabActivo, setTabActivo] = useState<'activos' | 'historicos'>('activos');

  // Filtros para históricos
  const [filtros, setFiltros] = useState({
    numero: '',
    descripcion: '',
    montoDesde: '',
    montoHasta: '',
  });

  // Queries
  const { data: formularios = [], refetch: refetchFormularios } = useQuery({
    queryKey: ['formularios'],
    queryFn: formulariosApi.getAll,
  });

  const { data: resumen } = useQuery({
    queryKey: ['formularios-resumen'],
    queryFn: formulariosApi.getResumen,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: formulariosApi.create,
    onSuccess: (response) => {
      toast.success(response.message);
      setModalFormulario({ isOpen: false, formulario: null });
      resetForm();
      refetchFormularios();
      queryClient.invalidateQueries({ queryKey: ['formularios-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) => formulariosApi.update(id, datos),
    onSuccess: (response) => {
      toast.success(response.message);
      setModalFormulario({ isOpen: false, formulario: null });
      resetForm();
      refetchFormularios();
      queryClient.invalidateQueries({ queryKey: ['formularios-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: formulariosApi.delete,
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null });
      refetchFormularios();
      queryClient.invalidateQueries({ queryKey: ['formularios-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const pagarMutation = useMutation({
    mutationFn: ({ ids, fecha }: { ids: number[]; fecha: string }) =>
      formulariosApi.pagarVencimientos(ids, fecha),
    onSuccess: (response) => {
      toast.success(response.message);
      toast.success(`Gasto CARCOS creado por ${formatCurrency(response.data.total_pagado)}`);
      setPagarDialog({ isOpen: false, vencimientos: [] });
      setVencimientosSeleccionados(new Set());
      refetchFormularios();
      queryClient.invalidateQueries({ queryKey: ['formularios-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => formulariosApi.importarCSV(contenido),
    onSuccess: (data) => {
      toast.success(`Importación completada: ${data.insertados} formularios insertados`);
      if (data.errores.length > 0) {
        toast.error(`${data.errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', data.errores);
      }
      refetchFormularios();
      queryClient.invalidateQueries({ queryKey: ['formularios-resumen'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
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

  const resetForm = () => {
    setFormData({
      numero: '',
      descripcion: '',
      monto: 0,
      fecha_compra: format(today, 'yyyy-MM-dd'),
      proveedor: '',
      vencimientos: [
        { numero_vencimiento: 1, fecha_vencimiento: '', monto: 0 },
        { numero_vencimiento: 2, fecha_vencimiento: '', monto: 0 },
        { numero_vencimiento: 3, fecha_vencimiento: '', monto: 0 },
      ],
    });
  };

  const handleOpenModal = (formulario?: Formulario) => {
    if (formulario) {
      setFormData({
        numero: formulario.numero,
        descripcion: formulario.descripcion || '',
        monto: formulario.monto,
        fecha_compra: formulario.fecha_compra,
        proveedor: formulario.proveedor || '',
        vencimientos: formulario.vencimientos.map((v) => ({
          numero_vencimiento: v.numero_vencimiento,
          fecha_vencimiento: v.fecha_vencimiento,
          monto: v.monto,
        })),
      });
      setModalFormulario({ isOpen: true, formulario });
    } else {
      resetForm();
      setModalFormulario({ isOpen: true, formulario: null });
    }
  };

  const handleSave = () => {
    // Validaciones
    if (!formData.numero.trim()) {
      toast.error('El número de formulario es requerido');
      return;
    }

    if (formData.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    // Validar vencimientos: el monto total debe ser igual al primer vencimiento
    // Los 3 vencimientos son opciones de pago (con recargos), no cuotas que suman
    const primerVencimiento = formData.vencimientos[0].monto;
    if (Math.abs(primerVencimiento - formData.monto) > 0.01) {
      toast.error(
        `El monto total (${formatCurrency(formData.monto)}) debe ser igual al monto del primer vencimiento (${formatCurrency(primerVencimiento)})`
      );
      return;
    }

    for (const venc of formData.vencimientos) {
      if (!venc.fecha_vencimiento) {
        toast.error(`La fecha del vencimiento ${venc.numero_vencimiento} es requerida`);
        return;
      }
      if (venc.monto <= 0) {
        toast.error(`El monto del vencimiento ${venc.numero_vencimiento} debe ser mayor a 0`);
        return;
      }
    }

    // Validar que el segundo y tercer vencimiento sean >= al primero (tienen recargos)
    if (formData.vencimientos[1].monto < formData.vencimientos[0].monto) {
      toast.error('El segundo vencimiento debe ser mayor o igual al primero');
      return;
    }
    if (formData.vencimientos[2].monto < formData.vencimientos[1].monto) {
      toast.error('El tercer vencimiento debe ser mayor o igual al segundo');
      return;
    }

    if (modalFormulario.formulario) {
      updateMutation.mutate({
        id: modalFormulario.formulario.id,
        datos: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deleteDialog.id === null) return;
    deleteMutation.mutate(deleteDialog.id);
  };

  const handleToggleVencimiento = (vencimientoId: number) => {
    const newSet = new Set(vencimientosSeleccionados);
    if (newSet.has(vencimientoId)) {
      newSet.delete(vencimientoId);
    } else {
      newSet.add(vencimientoId);
    }
    setVencimientosSeleccionados(newSet);
  };

  const handlePagarSeleccionados = () => {
    if (vencimientosSeleccionados.size === 0) {
      toast.error('Debe seleccionar al menos un vencimiento');
      return;
    }

    setPagarDialog({
      isOpen: true,
      vencimientos: Array.from(vencimientosSeleccionados),
    });
  };

  const handleConfirmarPago = () => {
    pagarMutation.mutate({
      ids: pagarDialog.vencimientos,
      fecha: format(today, 'yyyy-MM-dd'),
    });
  };

  const totalSeleccionado = formularios
    .flatMap((f: Formulario) => f.vencimientos)
    .filter((v: Vencimiento) => vencimientosSeleccionados.has(v.id))
    .reduce((sum: number, v: Vencimiento) => sum + v.monto, 0);

  // Función para aplicar filtros
  const aplicarFiltros = (lista: Formulario[]) => {
    return lista.filter((f: Formulario) => {
      // Filtro por número
      if (filtros.numero && !f.numero.toLowerCase().includes(filtros.numero.toLowerCase())) {
        return false;
      }

      // Filtro por descripción
      if (
        filtros.descripcion &&
        !f.descripcion?.toLowerCase().includes(filtros.descripcion.toLowerCase())
      ) {
        return false;
      }

      // Filtro por monto desde
      if (filtros.montoDesde && f.monto < parseFloat(filtros.montoDesde)) {
        return false;
      }

      // Filtro por monto hasta
      if (filtros.montoHasta && f.monto > parseFloat(filtros.montoHasta)) {
        return false;
      }

      return true;
    });
  };

  // Filtrar formularios según tab activo
  let formulariosActivos = formularios.filter((f: Formulario) =>
    f.vencimientos.every((v) => v.estado === 'PENDIENTE' || v.estado === 'VENCIDO')
  );

  let formulariosHistoricos = formularios.filter((f: Formulario) =>
    f.vencimientos.some((v) => v.estado === 'PAGADO')
  );

  // Aplicar filtros
  formulariosActivos = aplicarFiltros(formulariosActivos);
  formulariosHistoricos = aplicarFiltros(formulariosHistoricos);

  // Ordenar activos por fecha de vencimiento pendiente más antigua (los más vencidos primero)
  formulariosActivos.sort((a, b) => {
    // Encontrar el vencimiento pendiente más antiguo de cada formulario
    const vencimientoPendienteA = a.vencimientos
      .filter(v => v.estado === 'PENDIENTE')
      .sort((v1, v2) => new Date(v1.fecha_vencimiento).getTime() - new Date(v2.fecha_vencimiento).getTime())[0];

    const vencimientoPendienteB = b.vencimientos
      .filter(v => v.estado === 'PENDIENTE')
      .sort((v1, v2) => new Date(v1.fecha_vencimiento).getTime() - new Date(v2.fecha_vencimiento).getTime())[0];

    // Si no tienen vencimientos pendientes, usar el primer vencimiento
    const fechaA = vencimientoPendienteA ? new Date(vencimientoPendienteA.fecha_vencimiento) : new Date(a.vencimientos[0].fecha_vencimiento);
    const fechaB = vencimientoPendienteB ? new Date(vencimientoPendienteB.fecha_vencimiento) : new Date(b.vencimientos[0].fecha_vencimiento);

    return fechaA.getTime() - fechaB.getTime(); // Más antigua primero
  });

  const formulariosAMostrar = tabActivo === 'activos' ? formulariosActivos : formulariosHistoricos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">📄 Formularios</h1>
          <p className="text-text-secondary mt-1">
            Gestión de formularios con 3 vencimientos cada uno
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

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-text-secondary">Total Formularios</p>
              <p className="text-2xl font-bold text-text-primary">
                {resumen?.total_formularios || 0}
              </p>
              <p className="text-xs text-text-muted">
                {resumen?.total_vencimientos || 0} vencimientos
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-warning-light border-warning">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm text-text-secondary">Vencimientos Pendientes</p>
              <p className="text-2xl font-bold text-warning">
                {resumen?.vencimientos_pendientes || 0}
              </p>
              <p className="text-xs text-text-muted">
                {formatCurrency(resumen?.monto_pendiente || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-success-light border-success">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-text-secondary">Vencimientos Pagados</p>
              <p className="text-2xl font-bold text-success">
                {resumen?.vencimientos_pagados || 0}
              </p>
              <p className="text-xs text-text-muted">
                {formatCurrency(resumen?.monto_pagado || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-text-secondary">Total Invertido</p>
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency((resumen?.monto_pendiente || 0) + (resumen?.monto_pagado || 0))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Acciones */}
      {tabActivo === 'activos' && vencimientosSeleccionados.size > 0 && (
        <Card className="bg-primary/5 border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text-primary">
                {vencimientosSeleccionados.size} vencimiento(s) seleccionado(s)
              </p>
              <p className="text-sm text-text-secondary">
                Total: {formatCurrency(totalSeleccionado)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setVencimientosSeleccionados(new Set())}>
                Limpiar Selección
              </Button>
              <Button variant="primary" onClick={handlePagarSeleccionados}>
                Marcar como Pagados
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => {
            setTabActivo('activos');
            setVencimientosSeleccionados(new Set());
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tabActivo === 'activos'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Activos ({formulariosActivos.length})
        </button>
        <button
          onClick={() => {
            setTabActivo('historicos');
            setVencimientosSeleccionados(new Set());
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tabActivo === 'historicos'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Históricos ({formulariosHistoricos.length})
        </button>
      </div>

      {/* Filtros para activos e históricos */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Número de Factura
            </label>
            <input
              type="text"
              value={filtros.numero}
              onChange={(e) => setFiltros({ ...filtros, numero: e.target.value })}
              placeholder="Buscar por número..."
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={filtros.descripcion}
              onChange={(e) => setFiltros({ ...filtros, descripcion: e.target.value })}
              placeholder="Buscar por descripción..."
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Monto Desde
            </label>
            <input
              type="number"
              value={filtros.montoDesde}
              onChange={(e) => setFiltros({ ...filtros, montoDesde: e.target.value })}
              placeholder="$ 0"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Monto Hasta
            </label>
            <input
              type="number"
              value={filtros.montoHasta}
              onChange={(e) => setFiltros({ ...filtros, montoHasta: e.target.value })}
              placeholder="$ 999999"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Mostrar resultados y botón limpiar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <p className="text-sm text-text-secondary">
            Mostrando {formulariosAMostrar.length} formulario(s)
          </p>
          {(filtros.numero || filtros.descripcion || filtros.montoDesde || filtros.montoHasta) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFiltros({ numero: '', descripcion: '', montoDesde: '', montoHasta: '' })
              }
            >
              Limpiar Filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Tabla */}
      <Card
        title={tabActivo === 'activos' ? 'Formularios Activos' : 'Formularios Históricos'}
        actions={
          tabActivo === 'activos' && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => handleOpenModal()}>
              Nuevo Formulario
            </Button>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                  Número
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                  Descripción
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Monto Total
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                  Vencimientos
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {formulariosAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted">
                    {tabActivo === 'activos'
                      ? 'No hay formularios activos'
                      : 'No hay formularios históricos'}
                  </td>
                </tr>
              ) : (
                formulariosAMostrar.map((formulario: Formulario) => (
                  <tr key={formulario.id} className="border-b border-border hover:bg-background">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-primary">
                          {formulario.numero}
                        </span>
                        <span className="text-xs text-text-muted">
                          {format(new Date(formulario.fecha_compra), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-primary">
                          {formulario.descripcion || '-'}
                        </span>
                        {formulario.proveedor && (
                          <span className="text-xs text-text-muted">{formulario.proveedor}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-right text-text-primary">
                      {formatCurrency(formulario.monto)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {formulario.vencimientos.map((venc) => (
                          <div
                            key={venc.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            {tabActivo === 'activos' && venc.estado === 'PENDIENTE' && (
                              <input
                                type="checkbox"
                                checked={vencimientosSeleccionados.has(venc.id)}
                                onChange={() => handleToggleVencimiento(venc.id)}
                                className="cursor-pointer"
                              />
                            )}
                            <span
                              className={
                                venc.estado === 'PAGADO'
                                  ? 'text-success font-medium'
                                  : venc.estado === 'VENCIDO'
                                  ? 'text-text-muted font-medium'
                                  : 'text-text-secondary'
                              }
                            >
                              Venc {venc.numero_vencimiento}:
                            </span>
                            <span className="text-text-primary">
                              {format(new Date(venc.fecha_vencimiento), 'dd/MM/yy')}
                            </span>
                            <span className="font-medium text-text-primary">
                              {formatCurrency(venc.monto)}
                            </span>
                            {venc.estado === 'PAGADO' && (
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            )}
                            {venc.estado === 'VENCIDO' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                                VENCIDO
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {tabActivo === 'activos' && (
                          <>
                            <button
                              onClick={() => handleOpenModal(formulario)}
                              className="p-1 text-text-secondary hover:text-primary transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteDialog({ isOpen: true, id: formulario.id })}
                              className="p-1 text-text-secondary hover:text-error transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {tabActivo === 'historicos' && (
                          <span className="text-xs text-text-muted italic">
                            Formulario pagado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Formulario */}
      <Modal
        isOpen={modalFormulario.isOpen}
        onClose={() => setModalFormulario({ isOpen: false, formulario: null })}
        title={modalFormulario.formulario ? 'Editar Formulario' : 'Nuevo Formulario'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Número Formulario
              </label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
                placeholder="Ej: F-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Fecha Compra
              </label>
              <input
                type="date"
                value={formData.fecha_compra}
                onChange={(e) => setFormData({ ...formData, fecha_compra: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Monto Total
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monto || ''}
                onChange={(e) =>
                  setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
                placeholder="$ 0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Proveedor
              </label>
              <input
                type="text"
                value={formData.proveedor}
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
                placeholder="Ej: Proveedor ABC"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm"
              rows={2}
              placeholder="Descripción opcional"
            />
          </div>

          {/* Vencimientos */}
          <div className="bg-background rounded-lg p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              Vencimientos (3 obligatorios)
            </h4>
            <div className="space-y-3">
              {formData.vencimientos.map((venc, index) => (
                <div key={index} className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Vencimiento {venc.numero_vencimiento}
                    </label>
                    <input
                      type="date"
                      value={venc.fecha_vencimiento}
                      onChange={(e) => {
                        const newVenc = [...formData.vencimientos];
                        newVenc[index].fecha_vencimiento = e.target.value;
                        setFormData({ ...formData, vencimientos: newVenc });
                      }}
                      className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={venc.monto || ''}
                      onChange={(e) => {
                        const newVenc = [...formData.vencimientos];
                        newVenc[index].monto = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, vencimientos: newVenc });
                      }}
                      className="w-full rounded border border-border bg-card px-3 py-1.5 text-sm"
                      placeholder="$ 0,00"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-xs text-text-muted">
                      {venc.monto > 0 && formatCurrency(venc.monto)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Total vencimientos:{' '}
              {formatCurrency(formData.vencimientos.reduce((sum, v) => sum + v.monto, 0))}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
            >
              {modalFormulario.formulario ? 'Actualizar' : 'Guardar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalFormulario({ isOpen: false, formulario: null })}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Eliminar Formulario"
        message="¿Está seguro que desea eliminar este formulario? No se puede eliminar si tiene vencimientos pagados."
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Pagar Dialog */}
      <ConfirmDialog
        isOpen={pagarDialog.isOpen}
        onClose={() => setPagarDialog({ isOpen: false, vencimientos: [] })}
        onConfirm={handleConfirmarPago}
        title="Confirmar Pago de Vencimientos"
        message={`¿Confirma el pago de ${pagarDialog.vencimientos.length} vencimiento(s) por un total de ${formatCurrency(totalSeleccionado)}?\n\nSe creará automáticamente un gasto en Gastos Registrales (CARCOS) con la fecha de hoy.`}
        confirmText="Confirmar Pago"
        variant="info"
        isLoading={pagarMutation.isPending}
      />
    </div>
  );
};

export default Formularios;
