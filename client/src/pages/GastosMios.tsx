import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import {
  gastosMiosApi,
  GastoMio,
  ResumenGastosMios,
} from '@/services/supabase/gastos-mios';

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
  const [mesActual, setMesActual] = useState(today.getMonth() + 1);
  const [anioActual, setAnioActual] = useState(today.getFullYear());

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<Tipo | ''>('');

  // Modal states
  const [modalGasto, setModalGasto] = useState<{
    isOpen: boolean;
    gasto: GastoMio | null;
  }>({ isOpen: false, gasto: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    concepto: string;
  }>({ isOpen: false, id: null, concepto: '' });

  // Form states
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

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Queries
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

  // Mutations
  const createMutation = useMutation({
    mutationFn: gastosMiosApi.create,
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalGasto({ isOpen: false, gasto: null });
      resetForm();
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
      resetForm();
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

  // Handlers
  const resetForm = () => {
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
    resetForm();
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

  const handleSubmit = (e: React.FormEvent) => {
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

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // Paginación
  const totalItems = gastosMios.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const gastosAMostrar = gastosMios.slice(startIndex, endIndex);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [mesActual, anioActual, filtroCategoria, filtroTipo]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Gastos</h1>
          <p className="text-gray-500 mt-1">Control de gastos e ingresos personales</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Registro
        </Button>
      </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
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

      {/* Tabla */}
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
                  Categoría
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
                      {format(new Date(gasto.fecha), 'dd/MM/yyyy', { locale: es })}
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

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={modalGasto.isOpen}
        onClose={() => setModalGasto({ isOpen: false, gasto: null })}
        title={modalGasto.gasto ? 'Editar Registro' : 'Nuevo Registro'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, concepto: '' })}
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
        title="Eliminar Registro"
        message={`¿Está seguro que desea eliminar el registro "${deleteDialog.concepto}"?`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default GastosMios;
