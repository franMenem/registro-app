import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clientesApi } from '@/services/api';

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

const Clientes: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [modalCliente, setModalCliente] = useState<{
    isOpen: boolean;
    cliente: Cliente | null;
  }>({ isOpen: false, cliente: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
  }>({ isOpen: false, id: null });

  // Form states
  const [formCliente, setFormCliente] = useState<{
    cuit: string;
    razon_social: string;
    email: string;
    telefono: string;
    direccion: string;
    observaciones: string;
  }>({
    cuit: '',
    razon_social: '',
    email: '',
    telefono: '',
    direccion: '',
    observaciones: '',
  });

  // Queries
  const { data: clientes = [], refetch: refetchClientes } = useQuery({
    queryKey: ['clientes', searchTerm],
    queryFn: () => clientesApi.getAll(searchTerm),
  });

  // Mutations
  const createClienteMutation = useMutation({
    mutationFn: clientesApi.create,
    onSuccess: (response) => {
      toast.success(response.message);
      setModalCliente({ isOpen: false, cliente: null });
      resetFormCliente();
      refetchClientes();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: any }) =>
      clientesApi.update(id, datos),
    onSuccess: (response) => {
      toast.success(response.message);
      setModalCliente({ isOpen: false, cliente: null });
      resetFormCliente();
      refetchClientes();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: clientesApi.delete,
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteDialog({ isOpen: false, id: null });
      refetchClientes();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const resetFormCliente = () => {
    setFormCliente({
      cuit: '',
      razon_social: '',
      email: '',
      telefono: '',
      direccion: '',
      observaciones: '',
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
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      observaciones: cliente.observaciones || '',
    });
    setModalCliente({ isOpen: true, cliente });
  };

  const handleGuardarCliente = () => {
    if (!formCliente.cuit || !formCliente.razon_social) {
      toast.error('CUIT y razón social son requeridos');
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

      {/* Summary Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Total Clientes</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {clientes.length}
            </p>
          </div>
          <Users className="h-10 w-10 text-primary opacity-20" />
        </div>
      </Card>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Dirección
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                clientes.map((cliente: Cliente) => (
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
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {cliente.telefono ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {cliente.telefono}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {cliente.direccion ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {cliente.direccion}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
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
              CUIT <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={formCliente.cuit}
              onChange={(e) => setFormCliente({ ...formCliente, cuit: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              placeholder="20-12345678-9"
            />
            <p className="text-xs text-text-secondary mt-1">Formato: XX-XXXXXXXX-X</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Razón Social <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={formCliente.razon_social}
              onChange={(e) => setFormCliente({ ...formCliente, razon_social: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Empresa SA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
            <input
              type="email"
              value={formCliente.email}
              onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="cliente@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Teléfono</label>
            <input
              type="text"
              value={formCliente.telefono}
              onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="011-4444-5555"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Dirección</label>
            <input
              type="text"
              value={formCliente.direccion}
              onChange={(e) => setFormCliente({ ...formCliente, direccion: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Av. Ejemplo 123, CABA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Observaciones</label>
            <textarea
              value={formCliente.observaciones}
              onChange={(e) => setFormCliente({ ...formCliente, observaciones: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Observaciones opcionales..."
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
