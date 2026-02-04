import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { reportesApi, cuentasApi, clientesApi } from '@/services/supabase';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Download,
  Calendar,
  Filter,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Reportes: React.FC = () => {
  const [seccionActiva, setSeccionActiva] = useState<
    'depositos' | 'cuentas' | 'clientes' | 'financiero'
  >('depositos');

  // Filtros generales
  const [fechaDesde, setFechaDesde] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<number | undefined>();
  const [clienteSeleccionado, setClienteSeleccionado] = useState<number | undefined>();

  // Año para comparativas
  const [anioComparativa, setAnioComparativa] = useState<number>(new Date().getFullYear());

  // Mes para resumen mensual
  const [mesResumen, setMesResumen] = useState<number>(new Date().getMonth() + 1);
  const [anioResumen, setAnioResumen] = useState<number>(new Date().getFullYear());

  // Fetch cuentas y clientes para filtros
  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas'],
    queryFn: cuentasApi.getAll,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clientesApi.getAll(),
  });

  // ==================== QUERIES DE DEPÓSITOS ====================
  const { data: depositosPorEstado = [], isLoading: loadingEstado } = useQuery({
    queryKey: ['reportes-depositos-estado', fechaDesde, fechaHasta],
    queryFn: () => reportesApi.getDepositosPorEstado({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }),
  });

  const { data: depositosPorCliente = [], isLoading: loadingCliente } = useQuery({
    queryKey: ['reportes-depositos-cliente', fechaDesde, fechaHasta, clienteSeleccionado],
    queryFn: () =>
      reportesApi.getDepositosPorCliente({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        cliente_id: clienteSeleccionado,
      }),
  });

  const { data: topDepositos = [], isLoading: loadingTopDepositos } = useQuery({
    queryKey: ['reportes-top-depositos'],
    queryFn: () => reportesApi.getTopDepositos(10),
  });

  // ==================== QUERIES DE CUENTAS ====================
  const { data: balanceCuentas = [], isLoading: loadingBalance } = useQuery({
    queryKey: ['reportes-balance-cuentas'],
    queryFn: reportesApi.getBalanceCuentas,
  });

  const { data: cuentasSaldoNegativo = [], isLoading: loadingSaldoNegativo } = useQuery({
    queryKey: ['reportes-saldo-negativo'],
    queryFn: reportesApi.getCuentasConSaldoNegativo,
  });

  const { data: evolucionSaldos = [] } = useQuery({
    queryKey: ['reportes-evolucion-saldos', cuentaSeleccionada, fechaDesde, fechaHasta],
    queryFn: () =>
      cuentaSeleccionada
        ? reportesApi.getEvolucionSaldos(cuentaSeleccionada, fechaDesde, fechaHasta)
        : Promise.resolve([]),
    enabled: !!cuentaSeleccionada,
  });

  // ==================== QUERIES DE CLIENTES ====================
  const { data: clientesTopDepositos = [], isLoading: loadingTopClientes } = useQuery({
    queryKey: ['reportes-clientes-top'],
    queryFn: () => reportesApi.getClientesConMasDepositos(10),
  });

  const { data: clientesSaldosActivos = [], isLoading: loadingSaldosActivos } = useQuery({
    queryKey: ['reportes-clientes-saldos-activos'],
    queryFn: reportesApi.getClientesConSaldosActivos,
  });

  // ==================== QUERIES FINANCIERAS ====================
  const { data: resumenMensual = [], isLoading: loadingResumenMensual } = useQuery({
    queryKey: ['reportes-resumen-mensual', anioResumen, mesResumen],
    queryFn: () => reportesApi.getResumenMensual(anioResumen, mesResumen),
  });

  const { data: comparativaMensual = [], isLoading: loadingComparativa } = useQuery({
    queryKey: ['reportes-comparativa-mensual', anioComparativa],
    queryFn: () => reportesApi.getComparativaMensual(anioComparativa),
  });

  const { data: flujoCaja = [], isLoading: loadingFlujo } = useQuery({
    queryKey: ['reportes-flujo-caja'],
    queryFn: reportesApi.getFlujoCajaProyectado,
  });

  const { data: topMovimientos = [], isLoading: loadingTopMovimientos } = useQuery({
    queryKey: ['reportes-top-movimientos'],
    queryFn: () => reportesApi.getTopMovimientos(10),
  });

  // ==================== FUNCIONES DE EXPORTACIÓN ====================
  const exportarCSV = (datos: any[], nombre: string) => {
    if (!datos || datos.length === 0) {
      showToast.error('No hay datos para exportar');
      return;
    }

    const headers = Object.keys(datos[0]).join(',');
    const rows = datos.map((row) => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombre}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast.success('CSV exportado correctamente');
  };

  // ==================== RENDERIZADO ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Reportes</h1>
          <p className="text-text-secondary mt-1">Análisis y reportes financieros</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Filter}>
            Filtros
          </Button>
        </div>
      </div>

      {/* Tabs de secciones */}
      <Card>
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            onClick={() => setSeccionActiva('depositos')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              seccionActiva === 'depositos'
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-secondary/80'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Depósitos
          </button>
          <button
            onClick={() => setSeccionActiva('cuentas')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              seccionActiva === 'cuentas'
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-secondary/80'
            }`}
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Cuentas Corrientes
          </button>
          <button
            onClick={() => setSeccionActiva('clientes')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              seccionActiva === 'clientes'
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-secondary/80'
            }`}
          >
            <Users className="inline h-4 w-4 mr-2" />
            Clientes
          </button>
          <button
            onClick={() => setSeccionActiva('financiero')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              seccionActiva === 'financiero'
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-secondary/80'
            }`}
          >
            <TrendingUp className="inline h-4 w-4 mr-2" />
            Financiero General
          </button>
        </div>

        {/* Filtros generales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
            />
          </div>

          {seccionActiva === 'depositos' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Filtrar por Cliente
              </label>
              <select
                value={clienteSeleccionado || ''}
                onChange={(e) =>
                  setClienteSeleccionado(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              >
                <option value="">Todos</option>
                {clientes.map((cliente: any) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razon_social}
                  </option>
                ))}
              </select>
            </div>
          )}

          {seccionActiva === 'cuentas' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Seleccionar Cuenta
              </label>
              <select
                value={cuentaSeleccionada || ''}
                onChange={(e) =>
                  setCuentaSeleccionada(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              >
                <option value="">Seleccione...</option>
                {cuentas
                  .filter((c) => c.nombre === c.nombre.toUpperCase())
                  .map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Contenido según sección activa */}
      {seccionActiva === 'depositos' && (
        <div className="space-y-6">
          {/* Depósitos por Estado */}
          <Card
            title="Depósitos por Estado"
            subtitle="Distribución de depósitos según su estado"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(depositosPorEstado, 'depositos-por-estado')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingEstado ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={depositosPorEstado}
                      dataKey="cantidad"
                      nameKey="estado"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {depositosPorEstado.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Estado</th>
                        <th className="text-right py-2 px-3">Cantidad</th>
                        <th className="text-right py-2 px-3">Total Monto</th>
                        <th className="text-right py-2 px-3">Total Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depositosPorEstado.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{item.estado}</td>
                          <td className="py-2 px-3 text-right">{item.cantidad}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.total_monto)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.total_saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Depósitos por Cliente */}
          <Card
            title="Depósitos por Cliente"
            subtitle="Total depositado por cada cliente"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(depositosPorCliente, 'depositos-por-cliente')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingCliente ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : depositosPorCliente.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                No hay depósitos asociados a clientes en este período
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={depositosPorCliente.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="razon_social" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_depositado" fill="#3b82f6" name="Total Depositado" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Cliente</th>
                        <th className="text-right py-2 px-3">Cantidad</th>
                        <th className="text-right py-2 px-3">Total</th>
                        <th className="text-right py-2 px-3">Saldo Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depositosPorCliente.slice(0, 10).map((item: any, index: number) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{item.razon_social}</td>
                          <td className="py-2 px-3 text-right">{item.cantidad_depositos}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.total_depositado)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.saldo_actual_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Top 10 Mayores Depósitos */}
          <Card
            title="Top 10 Mayores Depósitos"
            subtitle="Los depósitos con mayor monto original"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(topDepositos, 'top-depositos')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingTopDepositos ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Titular</th>
                      <th className="text-left py-2 px-3">Cliente</th>
                      <th className="text-left py-2 px-3">Fecha Ingreso</th>
                      <th className="text-right py-2 px-3">Monto Original</th>
                      <th className="text-right py-2 px-3">Saldo Actual</th>
                      <th className="text-left py-2 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDepositos.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium">{item.titular}</td>
                        <td className="py-2 px-3 text-text-secondary">
                          {item.cliente_nombre || '-'}
                        </td>
                        <td className="py-2 px-3">{formatDate(item.fecha_ingreso)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {formatCurrency(item.monto_original)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(item.saldo_actual)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-xs px-2 py-1 rounded bg-primary-light text-primary">
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {seccionActiva === 'cuentas' && (
        <div className="space-y-6">
          {/* Balance de Cuentas */}
          <Card
            title="Balance de Cuentas Corrientes"
            subtitle="Estado actual de todas las cuentas"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(balanceCuentas, 'balance-cuentas')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingBalance ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={balanceCuentas}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="saldo_actual" fill="#10b981" name="Saldo Actual" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Cuenta</th>
                        <th className="text-right py-2 px-3">Movimientos</th>
                        <th className="text-right py-2 px-3">Ingresos</th>
                        <th className="text-right py-2 px-3">Egresos</th>
                        <th className="text-right py-2 px-3">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceCuentas.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{item.nombre}</td>
                          <td className="py-2 px-3 text-right">{item.total_movimientos}</td>
                          <td className="py-2 px-3 text-right font-mono text-success">
                            {formatCurrency(item.total_ingresos || 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-error">
                            {formatCurrency(item.total_egresos || 0)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-semibold ${
                              item.saldo_actual < 0 ? 'text-error' : 'text-success'
                            }`}
                          >
                            {formatCurrency(item.saldo_actual)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Evolución de Saldos */}
          {cuentaSeleccionada && evolucionSaldos.length > 0 && (
            <Card
              title="Evolución de Saldo"
              subtitle={`Histórico de saldo de la cuenta seleccionada`}
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={evolucionSaldos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="saldo_resultante"
                    stroke="#3b82f6"
                    name="Saldo"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Cuentas con Saldo Negativo */}
          {cuentasSaldoNegativo.length > 0 && (
            <Card
              title="⚠️ Cuentas con Saldo Negativo"
              subtitle="Cuentas que requieren atención"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Cuenta</th>
                      <th className="text-left py-2 px-3">Tipo</th>
                      <th className="text-right py-2 px-3">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasSaldoNegativo.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-border/50 bg-error-light">
                        <td className="py-2 px-3 font-medium">{item.nombre}</td>
                        <td className="py-2 px-3">{item.tipo}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-error">
                          {formatCurrency(item.saldo_actual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {seccionActiva === 'clientes' && (
        <div className="space-y-6">
          {/* Top Clientes con Más Depósitos */}
          <Card
            title="Top 10 Clientes con Más Depósitos"
            subtitle="Clientes con mayor cantidad de depósitos"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(clientesTopDepositos, 'top-clientes-depositos')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingTopClientes ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clientesTopDepositos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="razon_social" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cantidad_depositos" fill="#8b5cf6" name="Cantidad Depósitos" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Cliente</th>
                        <th className="text-right py-2 px-3">Cantidad</th>
                        <th className="text-right py-2 px-3">Total Depositado</th>
                        <th className="text-right py-2 px-3">Saldo Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesTopDepositos.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{item.razon_social}</td>
                          <td className="py-2 px-3 text-right">{item.cantidad_depositos}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.total_depositado)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.saldo_activo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Clientes con Saldos Activos */}
          <Card
            title="Clientes con Saldos Activos"
            subtitle="Clientes con depósitos pendientes de liquidar"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(clientesSaldosActivos, 'clientes-saldos-activos')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingSaldosActivos ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : clientesSaldosActivos.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                No hay clientes con saldos activos
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Cliente</th>
                      <th className="text-left py-2 px-3">CUIT</th>
                      <th className="text-right py-2 px-3">Depósitos Activos</th>
                      <th className="text-right py-2 px-3">Saldo Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesSaldosActivos.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium">{item.razon_social}</td>
                        <td className="py-2 px-3 font-mono text-text-secondary">{item.cuit}</td>
                        <td className="py-2 px-3 text-right">
                          {item.cantidad_depositos_activos}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-success">
                          {formatCurrency(item.saldo_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {seccionActiva === 'financiero' && (
        <div className="space-y-6">
          {/* Resumen Mensual */}
          <Card title="Resumen Mensual" subtitle="Ingresos y egresos del mes seleccionado">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Año</label>
                <input
                  type="number"
                  value={anioResumen}
                  onChange={(e) => setAnioResumen(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Mes</label>
                <select
                  value={mesResumen}
                  onChange={(e) => setMesResumen(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleDateString('es-AR', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingResumenMensual ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resumenMensual}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concepto" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="monto" fill="#f59e0b" name="Monto" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Concepto</th>
                        <th className="text-right py-2 px-3">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMensual.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{item.concepto}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {formatCurrency(item.monto || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Comparativa Mensual */}
          <Card title="Comparativa Mensual" subtitle="Evolución mes a mes del año">
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-1">Año</label>
              <input
                type="number"
                value={anioComparativa}
                onChange={(e) => setAnioComparativa(Number(e.target.value))}
                className="w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2 text-text-primary"
              />
            </div>

            {loadingComparativa ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={comparativaMensual.map((item: any) => ({
                    ...item,
                    mes: new Date(2000, parseInt(item.mes) - 1).toLocaleDateString('es-AR', {
                      month: 'short',
                    }),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total_depositado"
                    stroke="#3b82f6"
                    name="Total Depositado"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_liquidado"
                    stroke="#10b981"
                    name="Total Liquidado"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Flujo de Caja Proyectado */}
          <Card title="Flujo de Caja Proyectado" subtitle="Estado financiero actual">
            {loadingFlujo ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {flujoCaja.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="p-6 rounded-lg border-2 border-primary bg-primary-light"
                  >
                    <p className="text-sm text-text-secondary mb-2">{item.concepto}</p>
                    <p className="text-3xl font-bold text-text-primary font-mono">
                      {formatCurrency(item.monto || 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Movimientos */}
          <Card
            title="Top 10 Mayores Movimientos"
            subtitle="Los movimientos más grandes registrados"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => exportarCSV(topMovimientos, 'top-movimientos')}
              >
                Exportar CSV
              </Button>
            }
          >
            {loadingTopMovimientos ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Fecha</th>
                      <th className="text-left py-2 px-3">Cuenta</th>
                      <th className="text-left py-2 px-3">Concepto</th>
                      <th className="text-left py-2 px-3">Tipo</th>
                      <th className="text-right py-2 px-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMovimientos.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-2 px-3">{formatDate(item.fecha)}</td>
                        <td className="py-2 px-3 font-medium">{item.cuenta_nombre}</td>
                        <td className="py-2 px-3">{item.concepto}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              item.tipo_movimiento === 'INGRESO'
                                ? 'bg-success-light text-success'
                                : 'bg-error-light text-error'
                            }`}
                          >
                            {item.tipo_movimiento}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {formatCurrency(item.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reportes;
