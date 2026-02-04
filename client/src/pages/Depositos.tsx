import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Table, TableColumn } from '@/components/tables/Table';
import { MetricCard } from '@/components/ui/MetricCard';
import { depositosApi, Deposito, DepositoCreate } from '@/services/supabase/depositos';
import { cuentasApi } from '@/services/supabase/cuentas-corrientes';
import { clientesApi } from '@/services/supabase/clientes';
import { ClienteSearch } from '@/components/ui/ClienteSearch';
import { CuentaSearch } from '@/components/ui/CuentaSearch';
import { formatCurrency, formatDate } from '@/utils/format';

type EstadoDeposito = 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR' | 'A_CUENTA' | 'DEVUELTO';
import { Plus, Trash2, DollarSign, AlertCircle, CheckCircle, Edit, Upload, Copy } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const Depositos: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<EstadoDeposito | 'TODOS'>('TODOS');
  const [filtroTitular, setFiltroTitular] = useState<string>('');
  const [filtroMontoMin, setFiltroMontoMin] = useState<string>('');
  const [filtroMontoMax, setFiltroMontoMax] = useState<string>('');
  const [filtroObservaciones, setFiltroObservaciones] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showUsarSaldoModal, setShowUsarSaldoModal] = useState(false);
  const [depositoToUse, setDepositoToUse] = useState<Deposito | null>(null);
  const [usarSaldoData, setUsarSaldoData] = useState({
    monto: 0,
    tipo_uso: 'CAJA' as 'CAJA' | 'RENTAS',
    descripcion: '',
  });
  const [editingDeposito, setEditingDeposito] = useState<Deposito | null>(null);
  const [formData, setFormData] = useState<DepositoCreate & { fecha_uso?: string }>({
    monto_original: 0,
    fecha_ingreso: new Date().toISOString().split('T')[0],
    titular: '',
    observaciones: '',
    cuenta_id: undefined,
    cliente_id: undefined,
    fecha_uso: undefined,
  });

  // Batch deposits (para crear múltiples a la vez)
  const [depositosBatch, setDepositosBatch] = useState<Array<{
    titular: string;
    monto: string;
    fecha_ingreso: string;
    observaciones: string;
    cuenta_id: number | undefined;
    cliente_id: number | undefined;
  }>>(
    Array(6).fill(null).map(() => ({
      titular: '',
      monto: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      observaciones: '',
      cuenta_id: undefined,
      cliente_id: undefined,
    }))
  );
  const [fechaUsoBatch, setFechaUsoBatch] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
    titular: string;
  }>({ isOpen: false, depositoId: null, titular: '' });

  const [liquidarDialog, setLiquidarDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
  }>({ isOpen: false, depositoId: null });

  const [devolverDialog, setDevolverDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
  }>({ isOpen: false, depositoId: null });

  const [asociarCuentaDialog, setAsociarCuentaDialog] = useState<{
    isOpen: boolean;
    depositoId: number | null;
    cuentaId: number | null;
    clienteId: number | null;
  }>({ isOpen: false, depositoId: null, cuentaId: null, clienteId: null });

  // Fetch depósitos
  const { data: depositosData, isLoading, error: depositosError } = useQuery({
    queryKey: ['depositos', filtroEstado],
    queryFn: () =>
      depositosApi.getAll(filtroEstado !== 'TODOS' ? { estado: filtroEstado } : undefined),
  });

  const depositosRaw = depositosData?.depositos || [];

  // Aplicar filtros locales
  const depositosFiltrados = depositosRaw.filter((deposito) => {
    // Filtro por titular (busca en titular original o en cliente_nombre)
    if (filtroTitular) {
      const searchLower = filtroTitular.toLowerCase();
      const matchTitular = deposito.titular.toLowerCase().includes(searchLower);
      const matchCliente = deposito.cliente_nombre?.toLowerCase().includes(searchLower);

      if (!matchTitular && !matchCliente) {
        return false;
      }
    }

    // Filtro por monto mínimo
    if (filtroMontoMin && deposito.monto_original < parseFloat(filtroMontoMin)) {
      return false;
    }

    // Filtro por monto máximo
    if (filtroMontoMax && deposito.monto_original > parseFloat(filtroMontoMax)) {
      return false;
    }

    // Filtro por observaciones
    if (filtroObservaciones && deposito.observaciones) {
      if (!deposito.observaciones.toLowerCase().includes(filtroObservaciones.toLowerCase())) {
        return false;
      }
    } else if (filtroObservaciones) {
      return false; // No tiene observaciones pero el filtro está activo
    }

    return true;
  });

  // Calcular paginación
  const totalPages = Math.ceil(depositosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const depositos = depositosFiltrados.slice(startIndex, endIndex);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, filtroTitular, filtroMontoMin, filtroMontoMax, filtroObservaciones]);

  // Fetch estadísticas
  const { data: estadisticas, error: estadisticasError } = useQuery({
    queryKey: ['depositos-estadisticas'],
    queryFn: depositosApi.getEstadisticas,
  });

  // Fetch depósitos no asociados
  const { data: depositosNoAsociados = [], error: noAsociadosError } = useQuery({
    queryKey: ['depositos-no-asociados'],
    queryFn: depositosApi.getNoAsociados,
  });

  // Fetch cuentas corrientes para el select
  const { data: cuentasRaw = [], error: cuentasError } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  // Fetch clientes para el select
  const { data: clientes = [], error: clientesError } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clientesApi.getAll(),
  });

  // Filtrar solo cuentas con nombres en mayúsculas
  const cuentas = cuentasRaw.filter((cuenta) => {
    // Verificar si el nombre está completamente en mayúsculas
    // (puede tener espacios pero todas las letras deben ser mayúsculas)
    return cuenta.nombre === cuenta.nombre.toUpperCase();
  });

  // Mutation para crear
  const createMutation = useMutation({
    mutationFn: (data: DepositoCreate) => depositosApi.create(data),
    onSuccess: () => {
      showToast.success('Depósito creado correctamente');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al crear el depósito');
    },
  });

  // Mutation para actualizar
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deposito> }) =>
      depositosApi.update(id, data),
    onSuccess: () => {
      showToast.success('Depósito actualizado correctamente');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al actualizar el depósito');
    },
  });

  // Mutation para eliminar
  const deleteMutation = useMutation({
    mutationFn: (id: number) => depositosApi.delete(id),
    onSuccess: () => {
      showToast.success('Depósito eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al eliminar el depósito');
    },
  });

  // Mutation para cambiar estado
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, accion, data }: { id: number; accion: string; data?: any }) => {
      switch (accion) {
        case 'liquidar':
          return depositosApi.liquidar(id, data.fecha_uso);
        case 'a-favor':
          return depositosApi.marcarAFavor(id, data.saldo_restante);
        case 'devolver':
          return depositosApi.devolver(id, data.fecha_devolucion);
        case 'usar-saldo':
          return depositosApi.usarSaldo(id, data.monto, data.tipo_uso, data.descripcion);
        default:
          throw new Error('Acción no válida');
      }
    },
    onSuccess: () => {
      showToast.success('Estado actualizado correctamente');
      setShowUsarSaldoModal(false);
      setDepositoToUse(null);
      setUsarSaldoData({ monto: 0, tipo_uso: 'CAJA', descripcion: '' });
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al cambiar el estado');
    },
  });

  // Mutation para asociar cuenta
  const asociarCuentaMutation = useMutation({
    mutationFn: ({ depositoId, cuentaId }: { depositoId: number; cuentaId: number }) =>
      depositosApi.asociarCuenta(depositoId, cuentaId),
    onSuccess: () => {
      showToast.success('Depósito asociado a cuenta corriente. Se creó un INGRESO automáticamente.');
      setAsociarCuentaDialog({ isOpen: false, depositoId: null, cuentaId: null, clienteId: null });
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al asociar depósito');
    },
  });

  // Mutation para asociar cliente
  const asociarClienteMutation = useMutation({
    mutationFn: ({ depositoId, clienteId }: { depositoId: number; clienteId: number }) =>
      depositosApi.update(depositoId, { cliente_id: clienteId }),
    onSuccess: () => {
      showToast.success('Depósito asociado a cliente correctamente.');
      setAsociarCuentaDialog({ isOpen: false, depositoId: null, cuentaId: null, clienteId: null });
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al asociar depósito a cliente');
    },
  });

  // Mutation para desasociar cuenta
  const desasociarCuentaMutation = useMutation({
    mutationFn: (depositoId: number) => depositosApi.desasociarCuenta(depositoId),
    onSuccess: () => {
      showToast.success('Depósito desasociado. El INGRESO fue eliminado de la cuenta corriente.');
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
      queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al desasociar depósito');
    },
  });

  // Mostrar error crítico solo si no se pueden cargar los depósitos
  if (depositosError) {
    return (
      <div className="p-6">
        <div className="bg-error-light border border-error text-error px-4 py-3 rounded">
          <p className="font-bold">Error al cargar depósitos</p>
          <p>{(depositosError as Error).message}</p>
        </div>
      </div>
    );
  }

  const columns: TableColumn[] = [
    { key: 'fecha_ingreso', label: 'Fecha Ingreso', width: '120px' },
    { key: 'fecha_uso', label: 'Fecha Uso', width: '120px' },
    { key: 'titular', label: 'Titular', width: '180px' },
    { key: 'monto_original', label: 'Monto Original', align: 'right', width: '130px' },
    { key: 'saldo_actual', label: 'Saldo Actual', align: 'right', width: '130px' },
    { key: 'estado', label: 'Estado', width: '110px' },
    { key: 'tipo_uso', label: 'Tipo Uso', width: '100px' },
    { key: 'asociado_a', label: 'Asociado a', width: '180px' },
    { key: 'observaciones', label: 'Observaciones', width: '180px' },
    { key: 'actions', label: 'Acciones', align: 'center', width: '220px' },
  ];

  const renderCell = (column: TableColumn, row: Deposito) => {
    switch (column.key) {
      case 'fecha_ingreso':
        return formatDate(row.fecha_ingreso);
      case 'fecha_uso':
        return row.fecha_uso ? (
          <span className="text-sm">{formatDate(row.fecha_uso)}</span>
        ) : (
          <span className="text-text-muted">-</span>
        );
      case 'titular':
        // Mostrar cliente_nombre si existe, sino titular original
        return (
          <span className="text-sm font-medium">
            {row.cliente_nombre || row.titular}
          </span>
        );
      case 'monto_original':
        return (
          <span className="font-semibold font-mono">
            {formatCurrency(row.monto_original)}
          </span>
        );
      case 'saldo_actual':
        return (
          <span className="font-semibold font-mono">
            {formatCurrency(row.saldo_actual)}
          </span>
        );
      case 'estado':
        const estadoColors: Record<EstadoDeposito, string> = {
          PENDIENTE: 'bg-warning-light text-warning',
          LIQUIDADO: 'bg-success-light text-success',
          A_FAVOR: 'bg-primary-light text-primary',
          A_CUENTA: 'bg-secondary-light text-secondary',
          DEVUELTO: 'bg-error-light text-error',
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              estadoColors[row.estado]
            }`}
          >
            {row.estado.replace('_', ' ')}
          </span>
        );
      case 'tipo_uso':
        return row.tipo_uso ? (
          <span className="text-xs text-text-secondary">
            {row.tipo_uso}
          </span>
        ) : (
          '-'
        );
      case 'asociado_a':
        // Mostrar cuenta_nombre o cliente_nombre (lo que tenga)
        if (row.cuenta_nombre) {
          return (
            <div className="text-sm">
              <span className="font-medium">{row.cuenta_nombre}</span>
              <span className="text-xs text-text-muted block">Cuenta Corriente</span>
            </div>
          );
        }
        if (row.cliente_nombre) {
          return (
            <div className="text-sm">
              <span className="font-medium">{row.cliente_nombre}</span>
              <span className="text-xs text-text-muted block">Cliente</span>
            </div>
          );
        }
        return <span className="text-text-muted">-</span>;
      case 'observaciones':
        return row.observaciones || '-';
      case 'actions':
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {row.estado === 'PENDIENTE' && (
              <>
                {!row.cuenta_id ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAsociarCuenta(row.id)}
                      disabled={asociarCuentaMutation.isPending}
                    >
                      Asociar Cuenta
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLiquidar(row.id)}
                      disabled={cambiarEstadoMutation.isPending}
                    >
                      Liquidar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUsarSaldo(row)}
                      disabled={cambiarEstadoMutation.isPending}
                    >
                      Usar Saldo
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDevolver(row.id)}
                      disabled={cambiarEstadoMutation.isPending}
                    >
                      Devolver
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDesasociarCuenta(row.id, row.titular)}
                    disabled={desasociarCuentaMutation.isPending}
                  >
                    Desasociar
                  </Button>
                )}
              </>
            )}
            {row.estado === 'A_FAVOR' && (
              <>
                {!row.cuenta_id ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAsociarCuenta(row.id)}
                      disabled={asociarCuentaMutation.isPending}
                    >
                      Asociar Cuenta
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUsarSaldo(row)}
                      disabled={cambiarEstadoMutation.isPending}
                    >
                      Usar Saldo
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDevolver(row.id)}
                      disabled={cambiarEstadoMutation.isPending}
                    >
                      Devolver
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDesasociarCuenta(row.id, row.titular)}
                    disabled={desasociarCuentaMutation.isPending}
                  >
                    Desasociar
                  </Button>
                )}
              </>
            )}
            {row.estado === 'A_CUENTA' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDesasociarCuenta(row.id, row.titular)}
                disabled={desasociarCuentaMutation.isPending}
              >
                Desasociar
              </Button>
            )}
            <button
              onClick={() => handleEdit(row)}
              className="text-primary hover:text-primary/80"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDuplicate(row)}
              className="text-secondary hover:text-secondary/80"
              title="Duplicar"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(row.id, row.titular)}
              className="text-error hover:text-error/80"
              title="Eliminar"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      default:
        return row[column.key as keyof Deposito];
    }
  };

  const resetForm = () => {
    setFormData({
      monto_original: 0,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      fecha_uso: undefined,
      titular: '',
      observaciones: '',
      cuenta_id: undefined,
      cliente_id: undefined,
    });
    setDepositosBatch(
      Array(6).fill(null).map(() => ({
        titular: '',
        monto: '',
        fecha_ingreso: new Date().toISOString().split('T')[0],
        observaciones: '',
        cuenta_id: undefined,
        cliente_id: undefined,
      }))
    );
    setFechaUsoBatch('');
    setEditingDeposito(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDeposito) {
      // Modo edición: validar y actualizar un solo depósito
      if (!formData.titular) {
        showToast.error('El titular es requerido');
        return;
      }

      if (formData.monto_original <= 0) {
        showToast.error('El monto debe ser mayor a 0');
        return;
      }

      updateMutation.mutate({
        id: editingDeposito.id,
        data: {
          titular: formData.titular,
          fecha_ingreso: formData.fecha_ingreso,
          fecha_uso: formData.fecha_uso,
          monto_original: formData.monto_original,
          observaciones: formData.observaciones,
          cuenta_id: formData.cuenta_id,
          cliente_id: formData.cliente_id,
        },
      });
    } else {
      // Modo creación batch: procesar múltiples depósitos
      const depositosValidos = depositosBatch.filter((dep) => {
        const monto = parseFloat(dep.monto);
        return !isNaN(monto) && monto > 0;
      });

      if (depositosValidos.length === 0) {
        showToast.error('Debe ingresar al menos un depósito con monto válido');
        return;
      }

      // Crear cada depósito
      const promises = depositosValidos.map((dep) =>
        depositosApi.create({
          monto_original: parseFloat(dep.monto),
          fecha_ingreso: dep.fecha_ingreso,
          titular: dep.titular || 'Sin asignar',
          observaciones: dep.observaciones || undefined,
          fecha_uso: fechaUsoBatch || undefined,
          cuenta_id: dep.cuenta_id,
          cliente_id: dep.cliente_id,
        })
      );

      Promise.all(promises)
        .then(() => {
          showToast.success(`${depositosValidos.length} depósito(s) creado(s) correctamente`);
          setShowModal(false);
          resetForm();
          queryClient.invalidateQueries({ queryKey: ['depositos'] });
          queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
          queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
        })
        .catch((error) => {
          showToast.error('Error al crear los depósitos: ' + error.message);
        });
    }
  };

  const handleEdit = (deposito: Deposito) => {
    setEditingDeposito(deposito);
    setFormData({
      monto_original: deposito.monto_original,
      fecha_ingreso: deposito.fecha_ingreso,
      fecha_uso: deposito.fecha_uso || undefined,
      titular: deposito.titular,
      observaciones: deposito.observaciones || '',
      cuenta_id: deposito.cuenta_id || undefined,
      cliente_id: deposito.cliente_id || undefined,
    });
    setShowModal(true);
  };

  const handleDuplicate = (deposito: Deposito) => {
    // Copiar todos los datos del depósito pero en modo creación
    setEditingDeposito(null); // null = modo creación

    // Pre-llenar el primer slot del batch con los datos del depósito a duplicar
    const newBatch = depositosBatch.map((dep, index) => {
      if (index === 0) {
        // Primer slot con datos del depósito original
        return {
          titular: deposito.titular,
          monto: deposito.monto_original.toString(),
          fecha_ingreso: new Date().toISOString().split('T')[0], // Fecha de hoy
          observaciones: deposito.observaciones || '',
          cuenta_id: deposito.cuenta_id || undefined,
          cliente_id: deposito.cliente_id || undefined,
        };
      }
      return dep; // Resto vacíos
    });

    setDepositosBatch(newBatch);
    setFechaUsoBatch(''); // No copiar fecha de uso
    setShowModal(true);
    showToast.success('Depósito listo para duplicar. Modifica los datos si es necesario.');
  };

  const handleDelete = (id: number, titular: string) => {
    setDeleteDialog({ isOpen: true, depositoId: id, titular });
  };

  const confirmDelete = () => {
    if (deleteDialog.depositoId) {
      deleteMutation.mutate(deleteDialog.depositoId);
      setDeleteDialog({ isOpen: false, depositoId: null, titular: '' });
    }
  };

  const handleLiquidar = (id: number) => {
    setLiquidarDialog({ isOpen: true, depositoId: id });
  };

  const confirmLiquidar = (fechaUso: string) => {
    if (liquidarDialog.depositoId && fechaUso) {
      cambiarEstadoMutation.mutate({
        id: liquidarDialog.depositoId,
        accion: 'liquidar',
        data: { fecha_uso: fechaUso },
      });
      setLiquidarDialog({ isOpen: false, depositoId: null });
    }
  };

  const handleDevolver = (id: number) => {
    setDevolverDialog({ isOpen: true, depositoId: id });
  };

  const confirmDevolver = (fechaDevolucion: string) => {
    if (devolverDialog.depositoId && fechaDevolucion) {
      cambiarEstadoMutation.mutate({
        id: devolverDialog.depositoId,
        accion: 'devolver',
        data: { fecha_devolucion: fechaDevolucion },
      });
      setDevolverDialog({ isOpen: false, depositoId: null });
    }
  };

  const handleUsarSaldo = (deposito: Deposito) => {
    setDepositoToUse(deposito);
    setUsarSaldoData({
      monto: 0,
      tipo_uso: 'CAJA',
      descripcion: '',
    });
    setShowUsarSaldoModal(true);
  };

  const handleSubmitUsarSaldo = () => {
    if (!depositoToUse) return;

    if (usarSaldoData.monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }

    if (usarSaldoData.monto > depositoToUse.saldo_actual) {
      showToast.error(`El monto no puede superar el saldo disponible (${formatCurrency(depositoToUse.saldo_actual)})`);
      return;
    }

    cambiarEstadoMutation.mutate({
      id: depositoToUse.id,
      accion: 'usar-saldo',
      data: usarSaldoData,
    });
  };

  const handleAsociarCuenta = (depositoId: number) => {
    setAsociarCuentaDialog({ isOpen: true, depositoId, cuentaId: null, clienteId: null });
  };

  const confirmAsociarCuenta = () => {
    if (!asociarCuentaDialog.depositoId) {
      showToast.error('Error: Depósito no identificado');
      return;
    }

    // Verificar que se haya seleccionado cuenta O cliente (no ambos, no ninguno)
    const hayCuenta = !!asociarCuentaDialog.cuentaId;
    const hayCliente = !!asociarCuentaDialog.clienteId;

    if (!hayCuenta && !hayCliente) {
      showToast.error('Debe seleccionar una cuenta corriente o un cliente');
      return;
    }

    if (hayCuenta && hayCliente) {
      showToast.error('Solo puede seleccionar cuenta corriente O cliente, no ambos');
      return;
    }

    // Asociar a cuenta corriente
    if (hayCuenta) {
      asociarCuentaMutation.mutate({
        depositoId: asociarCuentaDialog.depositoId,
        cuentaId: asociarCuentaDialog.cuentaId!,
      });
    }

    // Asociar a cliente
    if (hayCliente) {
      asociarClienteMutation.mutate({
        depositoId: asociarCuentaDialog.depositoId,
        clienteId: asociarCuentaDialog.clienteId!,
      });
    }
  };

  const handleDesasociarCuenta = (depositoId: number, titular: string) => {
    if (window.confirm(`¿Está seguro de desasociar el depósito de "${titular}"?\n\nSe eliminará el INGRESO de la cuenta corriente y los saldos se recalcularán automáticamente.`)) {
      desasociarCuentaMutation.mutate(depositoId);
    }
  };

  // Si está cargando
  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Cargando depósitos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Depósitos</h1>
          <p className="text-text-secondary mt-1">Gestión de depósitos y saldos a favor</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Upload} onClick={() => navigate('/depositos/importar')}>
            Importar CSV
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
            Nuevo Depósito
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && estadisticas.total !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            label="Total"
            value={estadisticas.total.toString()}
            icon={DollarSign}
            iconColor="text-primary"
          />
          <MetricCard
            label="Pendientes"
            value={estadisticas.pendientes.toString()}
            icon={AlertCircle}
            iconColor="text-warning"
          />
          <MetricCard
            label="Liquidados"
            value={estadisticas.liquidados.toString()}
            icon={CheckCircle}
            iconColor="text-success"
          />
          <MetricCard
            label="A Favor"
            value={estadisticas.a_favor.toString()}
            icon={DollarSign}
            iconColor="text-primary"
          />
          <MetricCard
            label="A Cuenta"
            value={estadisticas.a_cuenta.toString()}
            icon={CheckCircle}
            iconColor="text-secondary"
          />
          <MetricCard
            label="Saldo Disponible"
            value={formatCurrency(estadisticas.saldo_total_disponible)}
            icon={DollarSign}
            iconColor="text-success"
          />
        </div>
      )}

      {/* Filtros */}
      <Card title="Filtros">
        <div className="space-y-4">
          {/* Primera fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              >
                <option value="TODOS">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="LIQUIDADO">Liquidados</option>
                <option value="A_FAVOR">A Favor</option>
                <option value="A_CUENTA">A Cuenta</option>
                <option value="DEVUELTO">Devueltos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Buscar por Titular/Cliente
              </label>
              <input
                type="text"
                value={filtroTitular}
                onChange={(e) => setFiltroTitular(e.target.value)}
                placeholder="Ingrese nombre del titular..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Buscar en Observaciones
              </label>
              <input
                type="text"
                value={filtroObservaciones}
                onChange={(e) => setFiltroObservaciones(e.target.value)}
                placeholder="Ingrese texto a buscar..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>
          </div>

          {/* Segunda fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Monto Original Mínimo
              </label>
              <input
                type="number"
                step="0.01"
                value={filtroMontoMin}
                onChange={(e) => setFiltroMontoMin(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Monto Original Máximo
              </label>
              <input
                type="number"
                step="0.01"
                value={filtroMontoMax}
                onChange={(e) => setFiltroMontoMax(e.target.value)}
                placeholder="999999.99"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFiltroTitular('');
                  setFiltroMontoMin('');
                  setFiltroMontoMax('');
                  setFiltroObservaciones('');
                  setFiltroEstado('TODOS');
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-text-secondary">
            Mostrando {depositos.length} de {depositosRaw.length} depósito{depositosRaw.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Depósitos No Asociados */}
      {depositosNoAsociados.length > 0 && (
        <Card
          title="⚠️ Depósitos No Asociados"
          subtitle={`${depositosNoAsociados.length} depósito${depositosNoAsociados.length > 1 ? 's' : ''} sin asociar a movimientos`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {depositosNoAsociados.map((deposito) => (
              <div
                key={deposito.id}
                className="flex flex-col p-3 rounded-lg border border-warning bg-warning-light"
              >
                <p className="font-medium text-text-primary truncate">{deposito.titular}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {formatDate(deposito.fecha_ingreso)}
                </p>
                <p className="text-lg font-semibold text-text-primary font-mono mt-2">
                  {formatCurrency(deposito.saldo_actual)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla de Depósitos */}
      <Card
        title="Todos los Depósitos"
        subtitle={`Mostrando ${depositos.length} de ${depositosFiltrados.length} depósitos`}
      >
        <div className="mb-3 px-6 py-2 bg-info-light border-l-4 border-info rounded-r-lg">
          <p className="text-sm text-text-secondary">
            💡 <strong>Tip:</strong> Haz clic en cualquier depósito no asociado (PENDIENTE o A FAVOR) para editarlo rápidamente
          </p>
        </div>
        <Table
          columns={columns}
          data={depositos}
          loading={isLoading}
          emptyMessage="No hay depósitos registrados"
          renderCell={renderCell}
          isRowClickable={(row) => row.estado === 'PENDIENTE' || row.estado === 'A_FAVOR'}
          onRowClick={(row) => handleEdit(row)}
        />

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-4">
            <div className="text-sm text-text-secondary">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md border border-border bg-background text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md border border-border bg-background text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal para crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-background rounded-lg shadow-lg w-full ${editingDeposito ? 'max-w-md' : 'max-w-4xl max-h-[90vh] overflow-y-auto'} p-6`}>
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              {editingDeposito ? 'Editar Depósito' : 'Nuevos Depósitos (Múltiples)'}
            </h2>

            {!editingDeposito && (
              <div className="mb-4 p-3 bg-info-light border-l-4 border-info rounded-r-lg">
                <p className="text-sm text-text-secondary">
                  💡 <strong>Carga múltiple de depósitos:</strong> Completa hasta 6 depósitos a la vez. Cada uno con su propia fecha de ingreso. Si dejas el titular vacío, se guardará como "Sin asignar". Solo se crearán los que tengan monto.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {editingDeposito ? (
                /* Formulario de edición (un solo depósito) */
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Titular *
                    </label>
                    <input
                      type="text"
                      value={formData.titular}
                      onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Monto *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monto_original}
                      onChange={(e) =>
                        setFormData({ ...formData, monto_original: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Fecha de Ingreso *
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_ingreso}
                      onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Fecha de Uso (opcional)
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_uso || ''}
                      onChange={(e) => setFormData({ ...formData, fecha_uso: e.target.value || undefined })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Cuenta Corriente (opcional)
                    </label>
                    <CuentaSearch
                      cuentas={cuentas}
                      value={formData.cuenta_id}
                      onChange={(cuentaId) =>
                        setFormData({ ...formData, cuenta_id: cuentaId })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Cliente (opcional)
                    </label>
                    <ClienteSearch
                      clientes={clientes}
                      value={formData.cliente_id}
                      onChange={(clienteId) =>
                        setFormData({ ...formData, cliente_id: clienteId })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Observaciones
                    </label>
                    <textarea
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                /* Formulario batch (múltiples depósitos) */
                <>
                  {/* Fecha de uso común (opcional) */}
                  <div className="mb-4 pb-4 border-b border-border">
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Fecha de Uso (opcional, para todos)
                    </label>
                    <input
                      type="date"
                      value={fechaUsoBatch}
                      onChange={(e) => setFechaUsoBatch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      Si completas esta fecha, se aplicará a todos los depósitos
                    </p>
                  </div>

                  {/* Tabla de depósitos */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2 w-8">#</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2 w-32">Fecha Ingreso *</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2">Titular</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2 w-28">Monto *</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2 w-40">Cuenta</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2 w-40">Cliente</th>
                          <th className="text-left text-xs font-medium text-text-secondary uppercase px-2 py-2">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {depositosBatch.map((dep, index) => (
                          <tr key={index} className="border-b border-border/50">
                            <td className="px-2 py-2 text-sm text-text-secondary">{index + 1}</td>
                            <td className="px-2 py-2">
                              <input
                                type="date"
                                value={dep.fecha_ingreso}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].fecha_ingreso = e.target.value;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={dep.titular}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].titular = e.target.value;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                                placeholder="Opcional"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={dep.monto}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].monto = e.target.value;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={dep.cuenta_id || ''}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].cuenta_id = e.target.value ? Number(e.target.value) : undefined;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              >
                                <option value="">Ninguna</option>
                                {cuentas.map((cuenta) => (
                                  <option key={cuenta.id} value={cuenta.id}>
                                    {cuenta.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={dep.cliente_id || ''}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].cliente_id = e.target.value ? Number(e.target.value) : undefined;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              >
                                <option value="">Ninguno</option>
                                {clientes.map((cliente: any) => (
                                  <option key={cliente.id} value={cliente.id}>
                                    {cliente.razon_social}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={dep.observaciones}
                                onChange={(e) => {
                                  const newBatch = [...depositosBatch];
                                  newBatch[index].observaciones = e.target.value;
                                  setDepositosBatch(newBatch);
                                }}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                                placeholder="Opcional"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending
                    ? 'Guardando...'
                    : editingDeposito
                    ? 'Actualizar'
                    : 'Crear Depósitos'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para usar saldo */}
      {showUsarSaldoModal && depositoToUse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">Usar Saldo del Depósito</h2>

            <div className="mb-4 p-4 bg-primary-light rounded-lg">
              <p className="text-sm text-text-secondary">Titular: <span className="font-semibold text-text-primary">{depositoToUse.titular}</span></p>
              <p className="text-sm text-text-secondary">Saldo Disponible: <span className="font-semibold text-text-primary">{formatCurrency(depositoToUse.saldo_actual)}</span></p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitUsarSaldo(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Monto a Usar *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={usarSaldoData.monto}
                  onChange={(e) =>
                    setUsarSaldoData({ ...usarSaldoData, monto: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Tipo de Uso *
                </label>
                <select
                  value={usarSaldoData.tipo_uso}
                  onChange={(e) =>
                    setUsarSaldoData({ ...usarSaldoData, tipo_uso: e.target.value as 'CAJA' | 'RENTAS' })
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                >
                  <option value="CAJA">CAJA</option>
                  <option value="RENTAS">RENTAS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={usarSaldoData.descripcion}
                  onChange={(e) => setUsarSaldoData({ ...usarSaldoData, descripcion: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  rows={3}
                  placeholder="Ej: Pago de gastos varios, Compra de insumos, etc."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={cambiarEstadoMutation.isPending}
                  className="flex-1"
                >
                  {cambiarEstadoMutation.isPending ? 'Procesando...' : 'Usar Saldo'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUsarSaldoModal(false);
                    setDepositoToUse(null);
                  }}
                  disabled={cambiarEstadoMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, depositoId: null, titular: '' })}
        onConfirm={confirmDelete}
        title="Eliminar Depósito"
        message={`¿Está seguro que desea eliminar el depósito de "${deleteDialog.titular}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Liquidar Prompt Dialog */}
      <PromptDialog
        isOpen={liquidarDialog.isOpen}
        onClose={() => setLiquidarDialog({ isOpen: false, depositoId: null })}
        onConfirm={confirmLiquidar}
        title="Liquidar Depósito"
        message="Ingrese la fecha de uso del depósito:"
        placeholder="YYYY-MM-DD"
        defaultValue={new Date().toISOString().split('T')[0]}
        confirmText="Liquidar"
        cancelText="Cancelar"
        inputType="date"
      />

      {/* Devolver Prompt Dialog */}
      <PromptDialog
        isOpen={devolverDialog.isOpen}
        onClose={() => setDevolverDialog({ isOpen: false, depositoId: null })}
        onConfirm={confirmDevolver}
        title="Devolver Depósito"
        message="Ingrese la fecha de devolución del depósito:"
        placeholder="YYYY-MM-DD"
        defaultValue={new Date().toISOString().split('T')[0]}
        confirmText="Devolver"
        cancelText="Cancelar"
        inputType="date"
      />

      {/* Asociar Cuenta Modal */}
      {asociarCuentaDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Asociar Depósito
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              Seleccione una <strong>Cuenta Corriente</strong> o un <strong>Cliente</strong>.
              Solo uno puede estar seleccionado.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Cuenta Corriente
                </label>
                <CuentaSearch
                  cuentas={cuentas}
                  value={asociarCuentaDialog.cuentaId || undefined}
                  onChange={(cuentaId) =>
                    setAsociarCuentaDialog({
                      ...asociarCuentaDialog,
                      cuentaId: cuentaId || null,
                      clienteId: cuentaId ? null : asociarCuentaDialog.clienteId, // Si selecciona cuenta, limpia cliente
                    })
                  }
                  disabled={!!asociarCuentaDialog.clienteId}
                />
                {asociarCuentaDialog.cuentaId && (
                  <p className="text-xs text-text-secondary mt-1">
                    Se creará un movimiento INGRESO automáticamente
                  </p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-text-muted">O</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Cliente
                </label>
                <ClienteSearch
                  clientes={clientes}
                  value={asociarCuentaDialog.clienteId || undefined}
                  onChange={(clienteId) =>
                    setAsociarCuentaDialog({
                      ...asociarCuentaDialog,
                      clienteId: clienteId || null,
                      cuentaId: clienteId ? null : asociarCuentaDialog.cuentaId, // Si selecciona cliente, limpia cuenta
                    })
                  }
                />
                {asociarCuentaDialog.clienteId && (
                  <p className="text-xs text-text-secondary mt-1">
                    El depósito quedará asociado al cliente
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setAsociarCuentaDialog({ isOpen: false, depositoId: null, cuentaId: null, clienteId: null })}
                disabled={asociarCuentaMutation.isPending || asociarClienteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={confirmAsociarCuenta}
                disabled={
                  (!asociarCuentaDialog.cuentaId && !asociarCuentaDialog.clienteId) ||
                  asociarCuentaMutation.isPending ||
                  asociarClienteMutation.isPending
                }
              >
                {(asociarCuentaMutation.isPending || asociarClienteMutation.isPending)
                  ? 'Asociando...'
                  : 'Asociar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Depositos;
