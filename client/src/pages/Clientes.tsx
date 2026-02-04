import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  Mail,
  Eye,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { CUITInput } from '@/components/ui/CUITInput';
import { clientesApi } from '@/services/supabase/clientes';

interface Cliente {
  id: number;
  cuit: string;
  razon_social: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

interface ClienteConDepositos extends Cliente {
  depositos: any[];
  total_depositado: number;
  cantidad_depositos: number;
}

interface Resumen {
  total_clientes: number;
  clientes_con_depositos: number;
  total_depositado: number;
}

const Clientes: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Modal states
  const [modalCliente, setModalCliente] = useState<{
    isOpen: boolean;
    cliente: Cliente | null;
  }>({ isOpen: false, cliente: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
  }>({ isOpen: false, id: null });

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    cliente: ClienteConDepositos | null;
  }>({ isOpen: false, cliente: null });

  // Form states (simplificado según requerimientos)
  const [formCliente, setFormCliente] = useState<{
    cuit: string;
    razon_social: string;
    email: string;
  }>({
    cuit: '',
    razon_social: '',
    email: '',
  });

  // Queries
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', searchTerm],
    queryFn: () => clientesApi.getAll(searchTerm),
  });

  const { data: resumen } = useQuery<Resumen>({
    queryKey: ['clientes-resumen'],
    queryFn: () => clientesApi.getResumen(),
  });

  // Mutations
  const createClienteMutation = useMutation({
    mutationFn: clientesApi.create,
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalCliente({ isOpen: false, cliente: null });
      resetFormCliente();
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) =>
      clientesApi.update(id, datos),
    onSuccess: (response) => {
      showToast.success(response.message);
      setModalCliente({ isOpen: false, cliente: null });
      resetFormCliente();
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: clientesApi.delete,
    onSuccess: (response) => {
      showToast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  // Handlers
  const resetFormCliente = () => {
    setFormCliente({
      cuit: '',
      razon_social: '',
      email: '',
    });
  };

  const handleOpenNuevoCliente = () => {
    resetFormCliente();
    setModalCliente({ isOpen: true, cliente: null });
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setFormCliente({
      cuit: cliente.cuit,
      razon_social: cliente.razon_social,
      email: cliente.email || '',
    });
    setModalCliente({ isOpen: true, cliente });
  };

  const handleVerDepositos = async (id: number) => {
    try {
      const cliente = await clientesApi.getConDepositos(id);
      setDetailModal({ isOpen: true, cliente });
    } catch (error: any) {
      showToast.error(error.message || 'Error al cargar depósitos');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleGuardarCliente = () => {
    if (!formCliente.cuit || !formCliente.razon_social) {
      showToast.error('CUIT y razón social son requeridos');
      return;
    }

    if (modalCliente.cliente) {
      // Editar
      updateClienteMutation.mutate({
        id: modalCliente.cliente.id,
        datos: formCliente,
      });
    } else {
      // Crear
      createClienteMutation.mutate(formCliente);
    }
  };

  // Aplicar paginación
  const totalItems = clientes.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const clientesAMostrar = clientes.slice(startIndex, endIndex);

  // Reset page cuando cambia searchTerm
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Clientes</h1>
          <p className="text-text-secondary mt-1">
            Gestión de clientes con CUIT y razón social
          </p>
        </div>
        <Button onClick={handleOpenNuevoCliente} className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-text-secondary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por CUIT o razón social..."
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-text-secondary hover:text-text-primary"
            >
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Clientes</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {resumen?.total_clientes || 0}
              </p>
            </div>
            <Users className="h-10 w-10 text-primary opacity-20" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Con Depósitos</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {resumen?.clientes_con_depositos || 0}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-success opacity-20" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Depositado</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {formatCurrency(resumen?.total_depositado || 0)}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-info opacity-20" />
          </div>
        </Card>
      </div>

      {/* Tabla de Clientes */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  CUIT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Razón Social
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {clientesAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                clientesAMostrar.map((cliente: Cliente) => (
                  <tr key={cliente.id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium font-mono">
                        {cliente.cuit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {cliente.razon_social}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {cliente.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {cliente.email}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleVerDepositos(cliente.id)}
                          className="p-2 hover:bg-background-secondary rounded-md transition-colors"
                          title="Ver Depósitos"
                        >
                          <Eye className="h-4 w-4 text-info" />
                        </button>
                        <button
                          onClick={() => handleEditarCliente(cliente)}
                          className="p-2 hover:bg-background-secondary rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4 text-primary" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ isOpen: true, id: cliente.id })}
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

      {/* Modal Crear/Editar Cliente */}
      <Modal
        isOpen={modalCliente.isOpen}
        onClose={() => {
          setModalCliente({ isOpen: false, cliente: null });
          resetFormCliente();
        }}
        title={modalCliente.cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              CUIT/CUIL <span className="text-error">*</span>
            </label>
            <CUITInput
              value={formCliente.cuit}
              onChange={(value) => setFormCliente({ ...formCliente, cuit: value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Nombre / Razón Social <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={formCliente.razon_social}
              onChange={(e) => setFormCliente({ ...formCliente, razon_social: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nombre completo o razón social"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Email <span className="text-text-muted text-xs">(opcional)</span>
            </label>
            <input
              type="email"
              value={formCliente.email}
              onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="cliente@ejemplo.com"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalCliente({ isOpen: false, cliente: null });
                resetFormCliente();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleGuardarCliente}>
              {modalCliente.cliente ? 'Guardar Cambios' : 'Crear Cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalle de Cliente con Depósitos */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, cliente: null })}
        title="Detalle de Cliente"
      >
        {detailModal.cliente && (
          <div className="space-y-4">
            {/* Info del cliente */}
            <div className="bg-background-secondary rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-text-secondary uppercase">CUIT</p>
                <p className="text-sm font-mono font-medium text-text-primary">
                  {detailModal.cliente.cuit}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase">Razón Social</p>
                <p className="text-sm font-medium text-text-primary">
                  {detailModal.cliente.razon_social}
                </p>
              </div>
              {detailModal.cliente.email && (
                <div>
                  <p className="text-xs text-text-secondary uppercase">Email</p>
                  <p className="text-sm text-text-primary">{detailModal.cliente.email}</p>
                </div>
              )}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Total Depositado</span>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(detailModal.cliente.total_depositado)}
                  </span>
                </div>
              </div>
            </div>

            {/* Depósitos */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Depósitos ({detailModal.cliente.cantidad_depositos})
              </h3>

              {detailModal.cliente.depositos.length === 0 ? (
                <p className="text-center text-text-secondary py-6">
                  No hay depósitos registrados
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-background-secondary sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">
                          Cuenta
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailModal.cliente.depositos.map((deposito: any) => (
                        <tr key={deposito.id} className="hover:bg-background-secondary/50">
                          <td className="px-4 py-2 text-sm text-text-primary">
                            {formatDate(deposito.fecha_ingreso)}
                          </td>
                          <td className="px-4 py-2 text-sm text-text-secondary">
                            {deposito.cuenta_nombre}
                          </td>
                          <td className="px-4 py-2 text-sm text-text-primary text-right font-medium">
                            {formatCurrency(deposito.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={() => {
          if (deleteDialog.id) {
            deleteClienteMutation.mutate(deleteDialog.id);
          }
        }}
        title="Eliminar Cliente"
        message="¿Estás seguro de que deseas eliminar este cliente? Si tiene movimientos asociados no podrá ser eliminado."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default Clientes;
