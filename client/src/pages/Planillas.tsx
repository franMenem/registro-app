import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { Edit, Check, X } from 'lucide-react';
import { planillasApi, type DiaRentas, type DiaCaja } from '@/services/supabase';

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
            <thead className="bg-card-hover">
              <tr>
                <th className="sticky left-0 z-10 bg-card-hover px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">GIT</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUAT Alta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUAT Pat.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUAT Infr.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUCERP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUGIT</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">PROVINCIA</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Consulta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">POSNET</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">ICBC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rentasLoading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-text-muted">
                    Cargando...
                  </td>
                </tr>
              ) : rentas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-text-muted">
                    No hay datos
                  </td>
                </tr>
              ) : (
                rentas.map((dia) => {
                  const editando = editandoRentasFecha === dia.fecha;
                  const valores = editando ? valoresEditRentas! : dia;

                  return (
                    <tr key={dia.fecha} className={editando ? 'bg-primary/5' : ''}>
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 text-sm font-medium">
                        {formatDate(dia.fecha)}
                      </td>
                      {(['GIT', 'SUAT_ALTA', 'SUAT_PATENTES', 'SUAT_INFRACCIONES', 'SUCERP', 'SUGIT', 'PROVINCIA', 'CONSULTA', 'POSNET', 'ICBC'] as const).map((campo) => (
                        <td key={campo} className="px-4 py-3 text-sm text-right">
                          {editando ? (
                            <input
                              type="number"
                              step="0.01"
                              value={valores[campo]}
                              onChange={(e) =>
                                setValoresEditRentas({
                                  ...valoresEditRentas!,
                                  [campo]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-28 text-right rounded border border-border px-2 py-1 font-mono text-xs"
                            />
                          ) : (
                            <span className="font-mono">{formatCurrency(valores[campo])}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {formatCurrency(calcularTotalRentas(valores))}
                      </td>
                      <td className="px-4 py-3 text-center">
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
            <thead className="bg-card-hover">
              <tr>
                <th className="sticky left-0 z-10 bg-card-hover px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Arancel</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUAT Sell.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SUCERP Sell.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Consultas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Formularios</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">POSNET</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">VEP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">ePagos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cajaLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-muted">
                    Cargando...
                  </td>
                </tr>
              ) : caja.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-muted">
                    No hay datos
                  </td>
                </tr>
              ) : (
                caja.map((dia) => {
                  const editando = editandoCajaFecha === dia.fecha;
                  const valores = editando ? valoresEditCaja! : dia;

                  return (
                    <tr key={dia.fecha} className={editando ? 'bg-primary/5' : ''}>
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 text-sm font-medium">
                        {formatDate(dia.fecha)}
                      </td>
                      {(['ARANCEL', 'SUAT_SELLADO', 'SUCERP_SELLADO', 'CONSULTAS', 'FORMULARIOS', 'POSNET', 'VEP', 'EPAGOS'] as const).map((campo) => (
                        <td key={campo} className="px-4 py-3 text-sm text-right">
                          {editando ? (
                            <input
                              type="number"
                              step="0.01"
                              value={valores[campo]}
                              onChange={(e) =>
                                setValoresEditCaja({
                                  ...valoresEditCaja!,
                                  [campo]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-28 text-right rounded border border-border px-2 py-1 font-mono text-xs"
                            />
                          ) : (
                            <span className="font-mono">{formatCurrency(valores[campo])}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {formatCurrency(calcularTotalCaja(valores))}
                      </td>
                      <td className="px-4 py-3 text-center">
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
