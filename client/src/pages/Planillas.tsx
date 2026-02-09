import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { Edit, Check, X } from 'lucide-react';
import { planillasApi, type DiaRentas, type DiaCaja } from '@/services/supabase';

// --- Column group definitions ---

interface ColGroup<T> {
  label: string;
  headerCls: string;
  cols: { key: keyof T; label: string }[];
}

const RENTAS_GROUPS: ColGroup<DiaRentas>[] = [
  {
    label: 'Ingresos (+)',
    headerCls: 'bg-emerald-500/10 text-emerald-700',
    cols: [
      { key: 'GIT', label: 'GIT' },
      { key: 'SUAT_ALTA', label: 'SUAT Alta' },
      { key: 'SUAT_PATENTES', label: 'SUAT Pat.' },
      { key: 'SUAT_INFRACCIONES', label: 'SUAT Infr.' },
      { key: 'CONSULTA', label: 'Consulta' },
      { key: 'SUCERP', label: 'SUCERP' },
      { key: 'SUGIT', label: 'SUGIT' },
      { key: 'PROVINCIA', label: 'Provincia' },
    ],
  },
  {
    label: 'Restan (−)',
    headerCls: 'bg-amber-500/10 text-amber-700',
    cols: [
      { key: 'POSNET', label: 'POSNET' },
      { key: 'DEPOSITOS', label: 'Depósitos' },
    ],
  },
  {
    label: 'Cuentas (−)',
    headerCls: 'bg-red-500/10 text-red-700',
    cols: [
      { key: 'ICBC', label: 'ICBC' },
      { key: 'FORD', label: 'FORD' },
      { key: 'SICARDI', label: 'SICARDI' },
      { key: 'PATAGONIA', label: 'PATAG.' },
      { key: 'IVECO', label: 'IVECO' },
      { key: 'CNH', label: 'CNH' },
      { key: 'GESTORIA_FORD', label: 'GEST.FORD' },
      { key: 'ALRA', label: 'ALRA' },
    ],
  },
];

const CAJA_GROUPS: ColGroup<DiaCaja>[] = [
  {
    label: 'Ingresos (+)',
    headerCls: 'bg-emerald-500/10 text-emerald-700',
    cols: [
      { key: 'ARANCEL', label: 'Arancel' },
      { key: 'SUAT_SELLADO', label: 'SUAT Sell.' },
      { key: 'SUCERP_SELLADO', label: 'SUCERP Sell.' },
      { key: 'CONSULTAS', label: 'Consultas' },
      { key: 'FORMULARIOS', label: 'Formularios' },
    ],
  },
  {
    label: 'Restan (−)',
    headerCls: 'bg-amber-500/10 text-amber-700',
    cols: [
      { key: 'POSNET', label: 'POSNET' },
      { key: 'VEP', label: 'VEP' },
      { key: 'EPAGOS', label: 'ePagos' },
      { key: 'DEPOSITOS', label: 'Depósitos' },
    ],
  },
  {
    label: 'Otros Gastos (−)',
    headerCls: 'bg-orange-500/10 text-orange-700',
    cols: [
      { key: 'LIBRERIA', label: 'Librería' },
      { key: 'MARIA', label: 'María' },
      { key: 'AGUA', label: 'Agua' },
      { key: 'EDESUR', label: 'Edesur' },
      { key: 'TERE', label: 'Tere' },
      { key: 'DAMI', label: 'Dami' },
      { key: 'MUMI', label: 'Mumi' },
    ],
  },
  {
    label: 'Cuentas (−)',
    headerCls: 'bg-red-500/10 text-red-700',
    cols: [
      { key: 'ICBC', label: 'ICBC' },
      { key: 'FORD', label: 'FORD' },
      { key: 'SICARDI', label: 'SICARDI' },
      { key: 'PATAGONIA', label: 'PATAG.' },
      { key: 'IVECO', label: 'IVECO' },
      { key: 'CNH', label: 'CNH' },
      { key: 'GESTORIA_FORD', label: 'GEST.FORD' },
      { key: 'ALRA', label: 'ALRA' },
    ],
  },
];

const RENTAS_ALL_COLS = RENTAS_GROUPS.flatMap((g) => g.cols);
const CAJA_ALL_COLS = CAJA_GROUPS.flatMap((g) => g.cols);
const RENTAS_COL_COUNT = RENTAS_ALL_COLS.length + 5; // fecha + data cols + total + entregado + dif + acciones
const CAJA_COL_COUNT = CAJA_ALL_COLS.length + 5;

const Planillas: React.FC = () => {
  const queryClient = useQueryClient();

  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
  });

  const [editandoRentasFecha, setEditandoRentasFecha] = useState<string | null>(null);
  const [editandoCajaFecha, setEditandoCajaFecha] = useState<string | null>(null);
  const [valoresEditRentas, setValoresEditRentas] = useState<DiaRentas | null>(null);
  const [valoresEditCaja, setValoresEditCaja] = useState<DiaCaja | null>(null);

  // Queries
  const { data: rentasData, isLoading: rentasLoading } = useQuery({
    queryKey: ['planillas-rentas', filtros],
    queryFn: () =>
      planillasApi.getRentas({
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined,
      }),
  });

  const { data: cajaData, isLoading: cajaLoading } = useQuery({
    queryKey: ['planillas-caja', filtros],
    queryFn: () =>
      planillasApi.getCaja({
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined,
      }),
  });

  // Mutations
  const updateRentasMutation = useMutation({
    mutationFn: ({ fecha, valores }: { fecha: string; valores: DiaRentas }) =>
      planillasApi.updateRentas(fecha, valores),
    onSuccess: (data) => {
      showToast.success(data.message);
      data.alertas?.forEach((alerta: string) => showToast.success(alerta));
      setEditandoRentasFecha(null);
      queryClient.invalidateQueries({ queryKey: ['planillas-rentas'] });
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al actualizar');
    },
  });

  const updateCajaMutation = useMutation({
    mutationFn: ({ fecha, valores }: { fecha: string; valores: DiaCaja }) =>
      planillasApi.updateCaja(fecha, valores),
    onSuccess: (data) => {
      showToast.success(data.message);
      data.alertas?.forEach((alerta: string) => showToast.success(alerta));
      setEditandoCajaFecha(null);
      queryClient.invalidateQueries({ queryKey: ['planillas-caja'] });
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-registrales'] });
      queryClient.invalidateQueries({ queryKey: ['veps'] });
      queryClient.invalidateQueries({ queryKey: ['epagos'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al actualizar');
    },
  });

  const handleEditRentas = (dia: DiaRentas) => {
    setEditandoRentasFecha(dia.fecha);
    setValoresEditRentas({ ...dia });
  };

  const handleEditCaja = (dia: DiaCaja) => {
    setEditandoCajaFecha(dia.fecha);
    setValoresEditCaja({ ...dia });
  };

  const handleSaveRentas = () => {
    if (editandoRentasFecha && valoresEditRentas) {
      updateRentasMutation.mutate({
        fecha: editandoRentasFecha,
        valores: valoresEditRentas,
      });
    }
  };

  const handleSaveCaja = () => {
    if (editandoCajaFecha && valoresEditCaja) {
      updateCajaMutation.mutate({
        fecha: editandoCajaFecha,
        valores: valoresEditCaja,
      });
    }
  };

  const handleCancelRentas = () => {
    setEditandoRentasFecha(null);
    setValoresEditRentas(null);
  };

  const handleCancelCaja = () => {
    setEditandoCajaFecha(null);
    setValoresEditCaja(null);
  };

  const calcularTotalRentas = (dia: DiaRentas) => {
    const totalSuman = dia.GIT + dia.SUAT_ALTA + dia.SUAT_PATENTES + dia.SUAT_INFRACCIONES + dia.CONSULTA + dia.SUCERP + dia.SUGIT + dia.PROVINCIA;
    const totalRestan = dia.POSNET + dia.DEPOSITOS;
    const totalGastos = dia.ICBC + dia.FORD + dia.SICARDI + dia.PATAGONIA + dia.IVECO + dia.CNH + dia.GESTORIA_FORD + dia.ALRA;
    return totalSuman - totalRestan - totalGastos;
  };

  const calcularTotalCaja = (dia: DiaCaja) => {
    const totalSuman = dia.ARANCEL + dia.SUAT_SELLADO + dia.SUCERP_SELLADO + dia.CONSULTAS + dia.FORMULARIOS;
    const totalRestan = dia.POSNET + dia.VEP + dia.EPAGOS + (dia.DEPOSITOS || 0);
    const totalOtrosGastos = (dia.LIBRERIA || 0) + (dia.MARIA || 0) + (dia.TERE || 0) + (dia.DAMI || 0) + (dia.MUMI || 0) + (dia.AGUA || 0) + (dia.EDESUR || 0);
    const totalCuentas = (dia.ICBC || 0) + (dia.FORD || 0) + (dia.SICARDI || 0) + (dia.PATAGONIA || 0) + (dia.IVECO || 0) + (dia.CNH || 0) + (dia.GESTORIA_FORD || 0) + (dia.ALRA || 0);
    return totalSuman - totalRestan - totalOtrosGastos - totalCuentas;
  };

  const rentas: DiaRentas[] = rentasData || [];
  const caja: DiaCaja[] = cajaData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Planillas</h1>
        <p className="text-text-secondary mt-1">Vista y edición de movimientos diarios</p>
      </div>

      {/* Filtros */}
      <Card title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Desde
            </label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
              className="w-full rounded border border-border px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Hasta
            </label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
              className="w-full rounded border border-border px-4 py-2"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setFiltros({ fechaDesde: '', fechaHasta: '' })}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla RENTAS */}
      <Card title="Planilla RENTAS">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              {/* Group header row */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-10 bg-card-hover px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase border-b border-border"
                >
                  Fecha
                </th>
                {RENTAS_GROUPS.map((group) => (
                  <th
                    key={group.label}
                    colSpan={group.cols.length}
                    className={`px-2 py-1.5 text-center text-xs font-semibold uppercase border-b border-l border-border ${group.headerCls}`}
                  >
                    {group.label}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Total
                </th>
                <th
                  rowSpan={2}
                  className="bg-blue-500/10 text-blue-700 px-3 py-2 text-right text-xs font-semibold uppercase border-b border-l border-border"
                >
                  Entregado
                </th>
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Dif.
                </th>
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Acciones
                </th>
              </tr>
              {/* Column names row */}
              <tr className="bg-card-hover">
                {RENTAS_ALL_COLS.map((col) => (
                  <th
                    key={col.key as string}
                    className={`px-2 py-2 text-right text-[11px] font-medium text-text-secondary uppercase whitespace-nowrap${
                      // Add left border at group boundaries
                      RENTAS_GROUPS.some((g) => g.cols[0]?.key === col.key) ? ' border-l border-border' : ''
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rentasLoading ? (
                <tr>
                  <td colSpan={RENTAS_COL_COUNT} className="px-4 py-8 text-center text-text-muted">
                    Cargando...
                  </td>
                </tr>
              ) : rentas.length === 0 ? (
                <tr>
                  <td colSpan={RENTAS_COL_COUNT} className="px-4 py-8 text-center text-text-muted">
                    No hay datos
                  </td>
                </tr>
              ) : (
                rentas.map((dia) => {
                  const editando = editandoRentasFecha === dia.fecha;
                  const valores = editando ? valoresEditRentas! : dia;

                  return (
                    <tr key={dia.fecha} className={editando ? 'bg-primary/5' : ''}>
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm font-medium whitespace-nowrap">
                        {formatDate(dia.fecha)}
                      </td>
                      {RENTAS_ALL_COLS.map(({ key }) => (
                        <td key={key as string} className="px-2 py-2 text-right">
                          {editando ? (
                            <input
                              type="number"
                              step="0.01"
                              value={valores[key] as number}
                              onChange={(e) =>
                                setValoresEditRentas({
                                  ...valoresEditRentas!,
                                  [key]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-20 text-right rounded border border-border px-1.5 py-1 font-mono text-xs"
                            />
                          ) : (
                            <span className="font-mono text-xs">
                              {formatCurrency(valores[key] as number)}
                            </span>
                          )}
                        </td>
                      ))}
                      {(() => {
                        const total = calcularTotalRentas(valores);
                        const dif = valores.EFECTIVO - total;
                        return (
                          <>
                            <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                              <span className="font-mono text-sm">{formatCurrency(total)}</span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap bg-blue-500/5">
                              <span className="font-mono text-sm font-semibold text-blue-700">
                                {valores.EFECTIVO > 0 ? formatCurrency(valores.EFECTIVO) : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {valores.EFECTIVO > 0 ? (
                                <span className={`font-mono text-xs font-semibold ${
                                  dif === 0 ? 'text-success' : 'text-error'
                                }`}>
                                  {dif === 0 ? '$0' : (dif > 0 ? '+' : '') + formatCurrency(dif)}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td className="px-3 py-2 text-center">
                        {editando ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={handleSaveRentas}
                              disabled={updateRentasMutation.isPending}
                              className="text-success hover:text-success/80 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelRentas}
                              disabled={updateRentasMutation.isPending}
                              className="text-error hover:text-error/80 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditRentas(dia)}
                            className="text-primary hover:text-primary/80"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tabla CAJA */}
      <Card title="Planilla CAJA">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              {/* Group header row */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-10 bg-card-hover px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase border-b border-border"
                >
                  Fecha
                </th>
                {CAJA_GROUPS.map((group) => (
                  <th
                    key={group.label}
                    colSpan={group.cols.length}
                    className={`px-2 py-1.5 text-center text-xs font-semibold uppercase border-b border-l border-border ${group.headerCls}`}
                  >
                    {group.label}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Total
                </th>
                <th
                  rowSpan={2}
                  className="bg-blue-500/10 text-blue-700 px-3 py-2 text-right text-xs font-semibold uppercase border-b border-l border-border"
                >
                  Entregado
                </th>
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Dif.
                </th>
                <th
                  rowSpan={2}
                  className="bg-card-hover px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase border-b border-l border-border"
                >
                  Acciones
                </th>
              </tr>
              {/* Column names row */}
              <tr className="bg-card-hover">
                {CAJA_ALL_COLS.map((col) => (
                  <th
                    key={col.key as string}
                    className={`px-2 py-2 text-right text-[11px] font-medium text-text-secondary uppercase whitespace-nowrap${
                      CAJA_GROUPS.some((g) => g.cols[0]?.key === col.key) ? ' border-l border-border' : ''
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cajaLoading ? (
                <tr>
                  <td colSpan={CAJA_COL_COUNT} className="px-4 py-8 text-center text-text-muted">
                    Cargando...
                  </td>
                </tr>
              ) : caja.length === 0 ? (
                <tr>
                  <td colSpan={CAJA_COL_COUNT} className="px-4 py-8 text-center text-text-muted">
                    No hay datos
                  </td>
                </tr>
              ) : (
                caja.map((dia) => {
                  const editando = editandoCajaFecha === dia.fecha;
                  const valores = editando ? valoresEditCaja! : dia;

                  return (
                    <tr key={dia.fecha} className={editando ? 'bg-primary/5' : ''}>
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm font-medium whitespace-nowrap">
                        {formatDate(dia.fecha)}
                      </td>
                      {CAJA_ALL_COLS.map(({ key }) => (
                        <td key={key as string} className="px-2 py-2 text-right">
                          {editando ? (
                            <input
                              type="number"
                              step="0.01"
                              value={valores[key] as number}
                              onChange={(e) =>
                                setValoresEditCaja({
                                  ...valoresEditCaja!,
                                  [key]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-20 text-right rounded border border-border px-1.5 py-1 font-mono text-xs"
                            />
                          ) : (
                            <span className="font-mono text-xs">
                              {formatCurrency(valores[key] as number)}
                            </span>
                          )}
                        </td>
                      ))}
                      {(() => {
                        const total = calcularTotalCaja(valores);
                        const dif = valores.EFECTIVO - total;
                        return (
                          <>
                            <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                              <span className="font-mono text-sm">{formatCurrency(total)}</span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap bg-blue-500/5">
                              <span className="font-mono text-sm font-semibold text-blue-700">
                                {valores.EFECTIVO > 0 ? formatCurrency(valores.EFECTIVO) : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {valores.EFECTIVO > 0 ? (
                                <span className={`font-mono text-xs font-semibold ${
                                  dif === 0 ? 'text-success' : 'text-error'
                                }`}>
                                  {dif === 0 ? '$0' : (dif > 0 ? '+' : '') + formatCurrency(dif)}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td className="px-3 py-2 text-center">
                        {editando ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={handleSaveCaja}
                              disabled={updateCajaMutation.isPending}
                              className="text-success hover:text-success/80 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelCaja}
                              disabled={updateCajaMutation.isPending}
                              className="text-error hover:text-error/80 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditCaja(dia)}
                            className="text-primary hover:text-primary/80"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Planillas;
