import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { Table, TableColumn } from '@/components/tables/Table';
import { MetricCard } from '@/components/ui/MetricCard';
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu';
import { depositosApi, Deposito, DepositoCreate, GastoDeposito } from '@/services/supabase/depositos';
import { cuentasApi } from '@/services/supabase/cuentas-corrientes';
import { clientesApi } from '@/services/supabase/clientes';
import { ClienteSearch } from '@/components/ui/ClienteSearch';
import { CuentaSearch } from '@/components/ui/CuentaSearch';
import { formatCurrency, formatDate } from '@/utils/format';

type EstadoDeposito = 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR' | 'A_CUENTA' | 'DEVUELTO';
import {
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Edit,
  Link,
  Unlink,
  RotateCcw,
  CreditCard,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const Depositos: React.FC = () => {
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

  // Inline quick-add form state
  const [inlineFecha, setInlineFecha] = useState(new Date().toISOString().split('T')[0]);
  const [inlineTitular, setInlineTitular] = useState('');
  const [inlineMonto, setInlineMonto] = useState('');
  const [inlineEstado, setInlineEstado] = useState<'PENDIENTE' | 'LIQUIDADO'>('PENDIENTE');
  const [inlineFechaUso, setInlineFechaUso] = useState('');

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

  const [duplicadoDialog, setDuplicadoDialog] = useState<{
    isOpen: boolean;
    cantidad: number;
    pendingData: DepositoCreate | null;
  }>({ isOpen: false, cantidad: 0, pendingData: null });

  // Fetch depósitos
  const { data: depositosData, isLoading, error: depositosError } = useQuery({
    queryKey: ['depositos', filtroEstado],
    queryFn: () =>
      depositosApi.getAll(filtroEstado !== 'TODOS' ? { estado: filtroEstado } : undefined),
  });

  const depositosRaw = depositosData?.depositos || [];

  // Aplicar filtros locales
  const depositosFiltrados = depositosRaw.filter((deposito) => {
    if (filtroTitular) {
      const searchLower = filtroTitular.toLowerCase();
      const matchTitular = deposito.titular.toLowerCase().includes(searchLower);
      const matchCliente = deposito.cliente_nombre?.toLowerCase().includes(searchLower);
      if (!matchTitular && !matchCliente) return false;
    }
    if (filtroMontoMin && deposito.monto_original < parseFloat(filtroMontoMin)) return false;
    if (filtroMontoMax && deposito.monto_original > parseFloat(filtroMontoMax)) return false;
    if (filtroObservaciones && deposito.observaciones) {
      if (!deposito.observaciones.toLowerCase().includes(filtroObservaciones.toLowerCase())) return false;
    } else if (filtroObservaciones) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    // Ordenar por fecha_uso desc (los que tienen fecha_uso primero, luego por fecha_ingreso)
    const fechaA = a.fecha_uso || '';
    const fechaB = b.fecha_uso || '';
    if (fechaA && fechaB) return fechaB.localeCompare(fechaA);
    if (fechaA && !fechaB) return -1;
    if (!fechaA && fechaB) return 1;
    return (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '');
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
  const { data: estadisticas } = useQuery({
    queryKey: ['depositos-estadisticas'],
    queryFn: depositosApi.getEstadisticas,
  });

  // Fetch depósitos no asociados
  const { data: depositosNoAsociados = [] } = useQuery({
    queryKey: ['depositos-no-asociados'],
    queryFn: depositosApi.getNoAsociados,
  });

  // Fetch cuentas corrientes para el select
  const { data: cuentasRaw = [] } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  // Fetch clientes para el select
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clientesApi.getAll(),
  });

  // Fetch gastos de depósito sin asignar
  const { data: gastosSinAsignar = [] } = useQuery({
    queryKey: ['gastos-sin-asignar'],
    queryFn: depositosApi.getGastosSinAsignar,
  });

  // Fetch depósitos elegibles para asignar gastos
  const { data: depositosElegibles = [] } = useQuery({
    queryKey: ['depositos-elegibles'],
    queryFn: depositosApi.getElegiblesParaGastos,
  });

  // Filtrar solo cuentas con nombres en mayúsculas
  const cuentas = cuentasRaw.filter((cuenta) => {
    return cuenta.nombre === cuenta.nombre.toUpperCase();
  });

  // Invalidar queries comunes
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['depositos'] });
    queryClient.invalidateQueries({ queryKey: ['depositos-estadisticas'] });
    queryClient.invalidateQueries({ queryKey: ['depositos-no-asociados'] });
    queryClient.invalidateQueries({ queryKey: ['depositos-elegibles'] });
    queryClient.invalidateQueries({ queryKey: ['gastos-sin-asignar'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
  };

  // Mutation para crear (inline + modal)
  const createMutation = useMutation({
    mutationFn: (data: DepositoCreate) => depositosApi.create(data),
    onSuccess: () => {
      showToast.success('Depósito creado correctamente');
      setShowModal(false);
      resetForm();
      // Reset inline form
      setInlineTitular('');
      setInlineMonto('');
      setInlineEstado('PENDIENTE');
      invalidateAll();
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
      invalidateAll();
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
      invalidateAll();
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al eliminar el depósito');
    },
  });

  // Mutation para eliminar gasto sin asignar
  const deleteGastoMutation = useMutation({
    mutationFn: (gastoId: number) => depositosApi.eliminarGasto(gastoId),
    onSuccess: () => {
      showToast.success('Gasto eliminado');
      queryClient.invalidateQueries({ queryKey: ['gastos-sin-asignar'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al eliminar el gasto');
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
      invalidateAll();
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
      invalidateAll();
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
      invalidateAll();
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
      invalidateAll();
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al desasociar depósito');
    },
  });

  // Mutation para asignar gasto
  const asignarGastoMutation = useMutation({
    mutationFn: ({ gastoId, depositoId }: { gastoId: number; depositoId: number }) =>
      depositosApi.asignarGasto(gastoId, depositoId),
    onSuccess: (result) => {
      showToast.success(result.message);
      invalidateAll();
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al asignar gasto');
    },
  });

  // Mostrar error crítico
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

  // Estado badge
  const estadoColors: Record<EstadoDeposito, string> = {
    PENDIENTE: 'bg-warning-light text-warning',
    LIQUIDADO: 'bg-success-light text-success',
    A_FAVOR: 'bg-primary-light text-primary',
    A_CUENTA: 'bg-secondary-light text-secondary',
    DEVUELTO: 'bg-error-light text-error',
  };

  const EstadoBadge: React.FC<{ estado: EstadoDeposito }> = ({ estado }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoColors[estado]}`}>
      {estado.replace('_', ' ')}
    </span>
  );

  // Build ActionMenu items for a deposit
  const getActionItems = (row: Deposito): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];

    if ((row.estado === 'PENDIENTE' || row.estado === 'A_FAVOR') && !row.cuenta_id) {
      items.push({
        label: 'Asociar Cuenta',
        icon: Link,
        onClick: () => handleAsociarCuenta(row.id),
      });
    }

    if (row.estado === 'PENDIENTE' || row.estado === 'A_CUENTA') {
      items.push({
        label: 'Liquidar',
        icon: CheckCircle,
        onClick: () => handleLiquidar(row.id),
      });
    }

    if ((row.estado === 'PENDIENTE' || row.estado === 'A_FAVOR') && !row.cuenta_id) {
      items.push({
        label: 'Usar Saldo',
        icon: CreditCard,
        onClick: () => handleUsarSaldo(row),
      });
      items.push({
        label: 'Devolver',
        icon: RotateCcw,
        onClick: () => handleDevolver(row.id),
      });
    }

    if (row.cuenta_id && (row.estado === 'PENDIENTE' || row.estado === 'A_FAVOR' || row.estado === 'A_CUENTA')) {
      items.push({
        label: 'Desasociar',
        icon: Unlink,
        onClick: () => handleDesasociarCuenta(row.id, row.titular),
      });
    }

    items.push({
      label: 'Eliminar',
      icon: Trash2,
      onClick: () => handleDelete(row.id, row.titular),
      variant: 'danger',
      divider: items.length > 0,
    });

    return items;
  };

  const columns: TableColumn[] = [
    { key: 'fecha_ingreso', label: 'Fecha Ingreso', width: '110px' },
    { key: 'fecha_uso', label: 'Fecha Uso', width: '110px' },
    { key: 'titular', label: 'Titular', width: '200px' },
    { key: 'monto_original', label: 'Monto Original', align: 'right', width: '130px' },
    { key: 'saldo_actual', label: 'Saldo Actual', align: 'right', width: '130px' },
    { key: 'estado', label: 'Estado', width: '110px' },
    { key: 'asociado_a', label: 'Asociado a', width: '160px' },
    { key: 'observaciones', label: 'Obs.', width: '140px' },
    { key: 'actions', label: '', align: 'center', width: '80px' },
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
        return (
          <span className="text-sm font-medium max-w-[200px] line-clamp-2 break-words whitespace-normal block">
            {row.cuenta_nombre || row.cliente_nombre || row.titular}
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
        return <EstadoBadge estado={row.estado} />;
      case 'asociado_a':
        if (row.cuenta_nombre) {
          return (
            <div className="text-sm">
              <span className="font-medium">{row.cuenta_nombre}</span>
              <span className="text-xs text-text-muted block">Cuenta CC</span>
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
        return row.observaciones ? (
          <span className="text-xs text-text-secondary truncate block max-w-[140px]" title={row.observaciones}>
            {row.observaciones}
          </span>
        ) : '-';
      case 'actions':
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleEdit(row)}
              className="p-1 rounded hover:bg-background-secondary text-text-secondary"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
            <ActionMenu items={getActionItems(row)} />
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
    setEditingDeposito(null);
  };

  // Verificar duplicados antes de crear
  const crearConVerificacion = async (data: DepositoCreate) => {
    try {
      const cantidad = await depositosApi.checkDuplicados(data.fecha_ingreso, data.monto_original);
      if (cantidad > 0) {
        setDuplicadoDialog({ isOpen: true, cantidad, pendingData: data });
        return;
      }
    } catch {
      // Si falla la verificación, crear igual
    }
    createMutation.mutate(data);
  };

  const confirmarCrearDuplicado = () => {
    if (duplicadoDialog.pendingData) {
      createMutation.mutate(duplicadoDialog.pendingData);
    }
    setDuplicadoDialog({ isOpen: false, cantidad: 0, pendingData: null });
  };

  // Inline form submit
  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(inlineMonto);
    if (!monto || monto <= 0) {
      showToast.error('El monto debe ser mayor a 0');
      return;
    }

    crearConVerificacion({
      monto_original: monto,
      fecha_ingreso: inlineFecha,
      titular: inlineTitular || 'Sin asignar',
      estado: inlineEstado,
      fecha_uso: inlineFechaUso || undefined,
    });
  };

  // Modal submit (edit only)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDeposito) {
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
      // Create from modal
      if (!formData.titular) {
        showToast.error('El titular es requerido');
        return;
      }
      if (formData.monto_original <= 0) {
        showToast.error('El monto debe ser mayor a 0');
        return;
      }

      crearConVerificacion({
        monto_original: formData.monto_original,
        fecha_ingreso: formData.fecha_ingreso,
        titular: formData.titular,
        observaciones: formData.observaciones || undefined,
        fecha_uso: formData.fecha_uso,
        cuenta_id: formData.cuenta_id,
        cliente_id: formData.cliente_id,
        estado: formData.fecha_uso ? 'LIQUIDADO' : 'PENDIENTE',
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
    setUsarSaldoData({ monto: 0, tipo_uso: 'CAJA', descripcion: '' });
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

    if (hayCuenta) {
      asociarCuentaMutation.mutate({
        depositoId: asociarCuentaDialog.depositoId,
        cuentaId: asociarCuentaDialog.cuentaId!,
      });
    }
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

  // Gastos: state for selected deposito per gasto
  const [gastoDepositoMap, setGastoDepositoMap] = useState<Record<number, number>>({});

  const handleAsignarGasto = (gasto: GastoDeposito) => {
    const depositoId = gastoDepositoMap[gasto.id];
    if (!depositoId) {
      showToast.error('Seleccione un depósito');
      return;
    }
    asignarGastoMutation.mutate({ gastoId: gasto.id, depositoId });
  };

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
        <Button
          variant="outline"
          icon={Plus}
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          Formulario completo
        </Button>
      </div>

      {/* Estadísticas */}
      {estadisticas && estadisticas.total !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Total" value={estadisticas.total.toString()} icon={DollarSign} iconColor="text-primary" />
          <MetricCard label="Pendientes" value={estadisticas.pendientes.toString()} icon={AlertCircle} iconColor="text-warning" />
          <MetricCard label="Liquidados" value={estadisticas.liquidados.toString()} icon={CheckCircle} iconColor="text-success" />
          <MetricCard label="A Favor" value={estadisticas.a_favor.toString()} icon={DollarSign} iconColor="text-primary" />
          <MetricCard label="A Cuenta" value={estadisticas.a_cuenta.toString()} icon={CheckCircle} iconColor="text-secondary" />
          <MetricCard label="Saldo Disp." value={formatCurrency(estadisticas.saldo_total_disponible)} icon={DollarSign} iconColor="text-success" />
        </div>
      )}

      {/* Inline Quick-Add Form */}
      <div className="bg-card rounded-xl border border-border p-4">
        <form onSubmit={handleInlineSubmit} className="flex items-end gap-3">
          <div className="w-36">
            <label className="block text-xs font-medium text-text-secondary mb-1">Fecha Ingreso</label>
            <input
              type="date"
              value={inlineFecha}
              onChange={(e) => setInlineFecha(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Titular</label>
            <input
              type="text"
              value={inlineTitular}
              onChange={(e) => setInlineTitular(e.target.value)}
              placeholder="Nombre del titular"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-text-secondary mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              value={inlineMonto}
              onChange={(e) => setInlineMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
            <select
              value={inlineEstado}
              onChange={(e) => setInlineEstado(e.target.value as 'PENDIENTE' | 'LIQUIDADO')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="LIQUIDADO">Liquidado</option>
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-text-secondary mb-1">Fecha Uso</label>
            <input
              type="date"
              value={inlineFechaUso}
              onChange={(e) => setInlineFechaUso(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createMutation.isPending}
            className="shrink-0"
          >
            {createMutation.isPending ? '...' : 'Agregar'}
          </Button>
        </form>
      </div>

      {/* Gastos de Depósito sin asignar */}
      {gastosSinAsignar.length > 0 && (
        <Card
          title="Gastos de Depósito sin asignar"
          subtitle={`${gastosSinAsignar.length} gasto${gastosSinAsignar.length > 1 ? 's' : ''} pendiente${gastosSinAsignar.length > 1 ? 's' : ''} de asignación`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">Fecha</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">Tipo</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">#</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-3 py-2">Monto</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2 w-64">Asignar a depósito</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase px-3 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {gastosSinAsignar.map((gasto) => (
                  <tr key={gasto.id} className="border-b border-border/50 hover:bg-background-secondary">
                    <td className="px-3 py-2">{formatDate(gasto.fecha)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${gasto.tipo === 'CAJA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {gasto.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">DEP {gasto.numero_deposito}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(gasto.monto)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={gastoDepositoMap[gasto.id] || ''}
                        onChange={(e) => setGastoDepositoMap((prev) => ({
                          ...prev,
                          [gasto.id]: e.target.value ? Number(e.target.value) : 0,
                        }))}
                        className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
                      >
                        <option value="">Seleccionar depósito...</option>
                        {depositosElegibles
                          .filter((d) => d.saldo_actual >= gasto.monto)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.titular} - {formatCurrency(d.saldo_actual)} ({formatDate(d.fecha_ingreso)})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAsignarGasto(gasto)}
                          disabled={!gastoDepositoMap[gasto.id] || asignarGastoMutation.isPending}
                        >
                          Asignar
                        </Button>
                        <button
                          onClick={() => deleteGastoMutation.mutate(gasto.id)}
                          disabled={deleteGastoMutation.isPending}
                          title="Eliminar gasto"
                          className="p-1.5 rounded text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Depósitos No Asociados — tabla compacta con botón Asociar */}
      {depositosNoAsociados.length > 0 && (
        <Card
          title="Depósitos sin asignar"
          subtitle={`${depositosNoAsociados.length} depósito${depositosNoAsociados.length > 1 ? 's' : ''} sin cuenta ni cliente`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">Fecha</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">Titular</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-3 py-2">Monto</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-3 py-2">Saldo</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase px-3 py-2">Estado</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase px-3 py-2 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {depositosNoAsociados.map((dep) => (
                  <tr key={dep.id} className="border-b border-border/50 hover:bg-background-secondary">
                    <td className="px-3 py-2">{formatDate(dep.fecha_ingreso)}</td>
                    <td className="px-3 py-2 font-medium">{dep.titular}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(dep.monto_original)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(dep.saldo_actual)}</td>
                    <td className="px-3 py-2"><EstadoBadge estado={dep.estado} /></td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Link}
                          onClick={() => handleAsociarCuenta(dep.id)}
                        >
                          Asociar
                        </Button>
                        <ActionMenu items={getActionItems(dep)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card title="Filtros">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Estado</label>
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
              <label className="block text-sm font-medium text-text-primary mb-1">Buscar por Titular/Cliente</label>
              <input
                type="text"
                value={filtroTitular}
                onChange={(e) => setFiltroTitular(e.target.value)}
                placeholder="Ingrese nombre del titular..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Buscar en Observaciones</label>
              <input
                type="text"
                value={filtroObservaciones}
                onChange={(e) => setFiltroObservaciones(e.target.value)}
                placeholder="Ingrese texto a buscar..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Monto Mínimo</label>
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
              <label className="block text-sm font-medium text-text-primary mb-1">Monto Máximo</label>
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
          <div className="text-sm text-text-secondary">
            Mostrando {depositos.length} de {depositosFiltrados.length} depósito{depositosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Tabla de Depósitos */}
      <Card
        title="Todos los Depósitos"
        subtitle={`Mostrando ${depositos.length} de ${depositosFiltrados.length} depósitos`}
      >
        <Table
          columns={columns}
          data={depositos}
          loading={isLoading}
          emptyMessage="No hay depósitos registrados"
          renderCell={renderCell}
          isRowClickable={(row) => row.estado === 'PENDIENTE' || row.estado === 'A_FAVOR' || row.estado === 'A_CUENTA'}
          onRowClick={(row) => handleEdit(row)}
        />

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
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              {editingDeposito ? 'Editar Depósito' : 'Nuevo Depósito'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Titular *</label>
                <input
                  type="text"
                  value={formData.titular}
                  onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto_original || ''}
                  onChange={(e) => setFormData({ ...formData, monto_original: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Fecha Ingreso *</label>
                  <input
                    type="date"
                    value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Fecha Uso</label>
                  <input
                    type="date"
                    value={formData.fecha_uso || ''}
                    onChange={(e) => setFormData({ ...formData, fecha_uso: e.target.value || undefined })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  />
                </div>
              </div>

              {/* Campos opcionales en colapsable */}
              <details className="border border-border rounded-lg">
                <summary className="px-4 py-2 text-sm font-medium text-text-secondary cursor-pointer hover:bg-background-secondary rounded-lg">
                  Campos opcionales
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Cuenta Corriente</label>
                    <CuentaSearch
                      cuentas={cuentas}
                      value={formData.cuenta_id}
                      onChange={(cuentaId) => setFormData({ ...formData, cuenta_id: cuentaId })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Cliente</label>
                    <ClienteSearch
                      clientes={clientes}
                      value={formData.cliente_id}
                      onChange={(clienteId) => setFormData({ ...formData, cliente_id: clienteId })}
                      onCreateCliente={async (data) => {
                        const { data: newCliente } = await clientesApi.create(data);
                        queryClient.invalidateQueries({ queryKey: ['clientes'] });
                        showToast.success(`Cliente "${newCliente.razon_social}" creado`);
                        return newCliente;
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Observaciones</label>
                    <textarea
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateMutation.isPending || createMutation.isPending}
                  className="flex-1"
                >
                  {(updateMutation.isPending || createMutation.isPending)
                    ? 'Guardando...'
                    : editingDeposito
                    ? 'Actualizar'
                    : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={updateMutation.isPending || createMutation.isPending}
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
                <label className="block text-sm font-medium text-text-primary mb-1">Monto a Usar *</label>
                <input
                  type="number"
                  step="0.01"
                  value={usarSaldoData.monto || ''}
                  onChange={(e) => setUsarSaldoData({ ...usarSaldoData, monto: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Tipo de Uso *</label>
                <select
                  value={usarSaldoData.tipo_uso}
                  onChange={(e) => setUsarSaldoData({ ...usarSaldoData, tipo_uso: e.target.value as 'CAJA' | 'RENTAS' })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  required
                >
                  <option value="CAJA">CAJA</option>
                  <option value="RENTAS">RENTAS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Descripción</label>
                <textarea
                  value={usarSaldoData.descripcion}
                  onChange={(e) => setUsarSaldoData({ ...usarSaldoData, descripcion: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                  rows={2}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" variant="primary" disabled={cambiarEstadoMutation.isPending} className="flex-1">
                  {cambiarEstadoMutation.isPending ? 'Procesando...' : 'Usar Saldo'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowUsarSaldoModal(false); setDepositoToUse(null); }}
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

      {/* Confirm Duplicate Dialog */}
      <ConfirmDialog
        isOpen={duplicadoDialog.isOpen}
        onClose={() => setDuplicadoDialog({ isOpen: false, cantidad: 0, pendingData: null })}
        onConfirm={confirmarCrearDuplicado}
        title="Posible depósito duplicado"
        message={`Ya existe${duplicadoDialog.cantidad === 1 ? '' : 'n'} ${duplicadoDialog.cantidad} depósito${duplicadoDialog.cantidad === 1 ? '' : 's'} con la misma fecha y monto. ¿Desea crear este depósito de todas formas?`}
        confirmText="Crear igual"
        cancelText="Cancelar"
        variant="warning"
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
            <h3 className="text-lg font-semibold text-text-primary mb-4">Asociar Depósito</h3>
            <p className="text-sm text-text-secondary mb-6">
              Seleccione una <strong>Cuenta Corriente</strong> o un <strong>Cliente</strong>.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Cuenta Corriente</label>
                <CuentaSearch
                  cuentas={cuentas}
                  value={asociarCuentaDialog.cuentaId || undefined}
                  onChange={(cuentaId) =>
                    setAsociarCuentaDialog({
                      ...asociarCuentaDialog,
                      cuentaId: cuentaId || null,
                      clienteId: cuentaId ? null : asociarCuentaDialog.clienteId,
                    })
                  }
                  disabled={!!asociarCuentaDialog.clienteId}
                />
                {asociarCuentaDialog.cuentaId && (
                  <p className="text-xs text-text-secondary mt-1">Se creará un movimiento INGRESO automáticamente</p>
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
                <label className="block text-sm font-medium text-text-primary mb-2">Cliente</label>
                <ClienteSearch
                  clientes={clientes}
                  value={asociarCuentaDialog.clienteId || undefined}
                  onChange={(clienteId) =>
                    setAsociarCuentaDialog({
                      ...asociarCuentaDialog,
                      clienteId: clienteId || null,
                      cuentaId: clienteId ? null : asociarCuentaDialog.cuentaId,
                    })
                  }
                  onCreateCliente={async (data) => {
                    const { data: newCliente } = await clientesApi.create(data);
                    queryClient.invalidateQueries({ queryKey: ['clientes'] });
                    showToast.success(`Cliente "${newCliente.razon_social}" creado`);
                    return newCliente;
                  }}
                />
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
                {(asociarCuentaMutation.isPending || asociarClienteMutation.isPending) ? 'Asociando...' : 'Asociar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Depositos;
