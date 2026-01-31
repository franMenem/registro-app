import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epagosApi } from '@/services/api';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';

export default function EPagos() {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
  });

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    observaciones: '',
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    fecha: '',
    monto: 0,
    observaciones: '',
  });

  // Query para obtener ePagos
  const { data: epagosData, isLoading } = useQuery({
    queryKey: ['epagos', filters],
    queryFn: () =>
      epagosApi.getAll({
        fecha_desde: filters.fechaDesde || undefined,
        fecha_hasta: filters.fechaHasta || undefined,
      }),
  });

  const epagos = epagosData?.data || [];
  const totales = epagosData?.totales || {
    total_general: 0,
  };

  // Mutation para crear ePago
  const createMutation = useMutation({
    mutationFn: epagosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epagos'] });
      toast.success('ePago registrado correctamente');
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        observaciones: '',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para actualizar ePago
  const updateMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) => epagosApi.update(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epagos'] });
      toast.success('ePago actualizado correctamente');
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para eliminar ePago
  const deleteMutation = useMutation({
    mutationFn: epagosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epagos'] });
      toast.success('ePago eliminado correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    createMutation.mutate({
      fecha: formData.fecha,
      monto: parseFloat(formData.monto),
      tipo: 'CAJA',
      observaciones: formData.observaciones,
    });
  };

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    setEditValues({
      fecha: row.fecha,
      monto: row.monto,
      observaciones: row.observaciones || '',
    });
  };

  const handleSave = () => {
    if (!editValues.monto || editValues.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    updateMutation.mutate({
      id: editingId!,
      datos: {
        ...editValues,
        tipo: 'CAJA',
      },
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Está seguro que desea eliminar este ePago?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Control ePagos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Registro y control de pagos mediante ePagos
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Registrar Nuevo ePago (CAJA)</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <input
              type="text"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Opcional"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>

      {/* Totales */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500">Total ePagos (CAJA)</h3>
        <p className="mt-2 text-3xl font-bold text-blue-600">
          {formatCurrency(totales.total_general)}
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Observaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {epagos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No hay registros de ePagos
                  </td>
                </tr>
              ) : (
                epagos.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === row.id ? (
                        <input
                          type="date"
                          value={editValues.fecha}
                          onChange={(e) =>
                            setEditValues({ ...editValues, fecha: e.target.value })
                          }
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                          disabled={updateMutation.isPending}
                        />
                      ) : (
                        formatDate(row.fecha)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === row.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.monto}
                          onChange={(e) =>
                            setEditValues({ ...editValues, monto: parseFloat(e.target.value) })
                          }
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                          disabled={updateMutation.isPending}
                        />
                      ) : (
                        formatCurrency(row.monto)
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {editingId === row.id ? (
                        <input
                          type="text"
                          value={editValues.observaciones}
                          onChange={(e) =>
                            setEditValues({ ...editValues, observaciones: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          disabled={updateMutation.isPending}
                        />
                      ) : (
                        row.observaciones || '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {editingId === row.id ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={updateMutation.isPending}
                            className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(row)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
