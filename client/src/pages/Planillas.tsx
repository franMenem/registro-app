import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { Edit, Check, X } from 'lucide-react';
import { planillasApi, conceptosApi, type PlanillaRow, type Concepto } from '@/services/supabase';

// --- Column group definitions ---

interface ColDef {
  key: string;
  label: string;
}

interface ColGroup {
  label: string;
  headerCls: string;
  cols: ColDef[];
}

// Static columns: Cuentas corrientes (same for both planillas)
const CC_COLS: ColDef[] = [
  { key: 'ICBC', label: 'ICBC' },
  { key: 'FORD', label: 'FORD' },
  { key: 'SICARDI', label: 'SICARDI' },
  { key: 'PATAGONIA', label: 'PATAG.' },
  { key: 'IVECO', label: 'IVECO' },
  { key: 'CNH', label: 'CNH' },
  { key: 'GESTORIA_FORD', label: 'GEST.FORD' },
  { key: 'ALRA', label: 'ALRA' },
];

// Static columns: Otros gastos CAJA
const OTROS_GASTOS_COLS: ColDef[] = [
  { key: 'LIBRERIA', label: 'Libreria' },
  { key: 'MARIA', label: 'Maria' },
  { key: 'AGUA', label: 'Agua' },
  { key: 'EDESUR', label: 'Edesur' },
  { key: 'TERE', label: 'Tere' },
  { key: 'DAMI', label: 'Dami' },
  { key: 'MUMI', label: 'Mumi' },
];

// Concepto column_keys that "restan" instead of "suman"
const RESTAN_KEYS = new Set(['POSNET', 'POSNET_CAJA']);

/** Build column groups dynamically from conceptos */
function buildGroups(conceptos: Concepto[], tipo: 'RENTAS' | 'CAJA'): ColGroup[] {
  const tipoConceptos = conceptos.filter((c) => c.tipo === tipo);

  const ingresosCols = tipoConceptos
    .filter((c) => !RESTAN_KEYS.has(c.column_key))
    .map((c) => ({ key: c.column_key, label: c.nombre }));

  const restanConceptoCols = tipoConceptos
    .filter((c) => RESTAN_KEYS.has(c.column_key))
    .map((c) => ({ key: c.column_key, label: c.nombre }));

  const restanCols: ColDef[] = [
    ...restanConceptoCols,
    ...(tipo === 'CAJA'
      ? [{ key: 'VEP', label: 'VEP' }, { key: 'EPAGOS', label: 'ePagos' }]
      : []),
    { key: 'DEPOSITOS', label: 'Depositos' },
  ];

  const groups: ColGroup[] = [
    { label: 'Ingresos (+)', headerCls: 'bg-emerald-500/10 text-emerald-700', cols: ingresosCols },
    { label: 'Restan (-)', headerCls: 'bg-amber-500/10 text-amber-700', cols: restanCols },
  ];

  if (tipo === 'CAJA') {
    groups.push({
      label: 'Otros Gastos (-)',
      headerCls: 'bg-orange-500/10 text-orange-700',
      cols: OTROS_GASTOS_COLS,
    });
  }

  groups.push({
    label: 'Cuentas (-)',
    headerCls: 'bg-red-500/10 text-red-700',
    cols: CC_COLS,
  });

  return groups;
}

/** Calculate total for a planilla row given its column groups */
function calcularTotal(row: PlanillaRow, groups: ColGroup[]): number {
  let total = 0;
  for (const group of groups) {
    const isPositive = group.label.includes('(+)');
    const groupSum = group.cols.reduce((sum, col) => sum + (Number(row[col.key]) || 0), 0);
    total += isPositive ? groupSum : -groupSum;
  }
  return total;
}

// ============================================================================
// Reusable table component for a planilla (RENTAS or CAJA)
// Follows SRP: this component only renders the table, doesn't manage data fetching
// ============================================================================

interface PlanillaTableProps {
  title: string;
  groups: ColGroup[];
  data: PlanillaRow[];
  loading: boolean;
  editandoFecha: string | null;
  valoresEdit: PlanillaRow | null;
  onEdit: (dia: PlanillaRow) => void;
  onSave: () => void;
  onCancel: () => void;
  onChangeValue: (key: string, value: number) => void;
  saving: boolean;
}

const PlanillaTable: React.FC<PlanillaTableProps> = ({
  title,
  groups,
  data,
  loading,
  editandoFecha,
  valoresEdit,
  onEdit,
  onSave,
  onCancel,
  onChangeValue,
  saving,
}) => {
  const allCols = useMemo(() => groups.flatMap((g) => g.cols), [groups]);
  const colCount = allCols.length + 5; // fecha + data cols + total + entregado + dif + acciones

  return (
    <Card title={title}>
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
              {groups.map((group) => (
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
              {allCols.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 text-right text-[11px] font-medium text-text-secondary uppercase whitespace-nowrap${
                    groups.some((g) => g.cols[0]?.key === col.key) ? ' border-l border-border' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-text-muted">
                  Cargando...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-text-muted">
                  No hay datos
                </td>
              </tr>
            ) : (
              data.map((dia) => {
                const editando = editandoFecha === dia.fecha;
                const valores = editando ? valoresEdit! : dia;

                return (
                  <tr key={dia.fecha} className={editando ? 'bg-primary/5' : ''}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm font-medium whitespace-nowrap">
                      {formatDate(dia.fecha)}
                    </td>
                    {allCols.map(({ key }) => (
                      <td key={key} className="px-2 py-2 text-right">
                        {editando ? (
                          <input
                            type="number"
                            step="0.01"
                            value={valores[key] as number}
                            onChange={(e) => onChangeValue(key, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right rounded border border-border px-1.5 py-1 font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono text-xs">
                            {formatCurrency(Number(valores[key]) || 0)}
                          </span>
                        )}
                      </td>
                    ))}
                    {(() => {
                      const total = calcularTotal(valores, groups);
                      const efectivo = Number(valores.EFECTIVO) || 0;
                      const dif = efectivo - total;
                      return (
                        <>
                          <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                            <span className="font-mono text-sm">{formatCurrency(total)}</span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap bg-blue-500/5">
                            <span className="font-mono text-sm font-semibold text-blue-700">
                              {efectivo > 0 ? formatCurrency(efectivo) : '\u2014'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {efectivo > 0 ? (
                              <span className={`font-mono text-xs font-semibold ${
                                dif === 0 ? 'text-success' : 'text-error'
                              }`}>
                                {dif === 0 ? '$0' : (dif > 0 ? '+' : '') + formatCurrency(dif)}
                              </span>
                            ) : (
                              <span className="text-text-muted">{'\u2014'}</span>
                            )}
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-3 py-2 text-center">
                      {editando ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={onSave}
                            disabled={saving}
                            className="text-success hover:text-success/80 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={onCancel}
                            disabled={saving}
                            className="text-error hover:text-error/80 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onEdit(dia)}
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
  );
};

// ============================================================================
// Main page component
// ============================================================================

const Planillas: React.FC = () => {
  const queryClient = useQueryClient();

  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
  });

  const [editandoRentasFecha, setEditandoRentasFecha] = useState<string | null>(null);
  const [editandoCajaFecha, setEditandoCajaFecha] = useState<string | null>(null);
  const [valoresEditRentas, setValoresEditRentas] = useState<PlanillaRow | null>(null);
  const [valoresEditCaja, setValoresEditCaja] = useState<PlanillaRow | null>(null);

  // Fetch conceptos to build dynamic column groups
  const { data: conceptos = [] } = useQuery({
    queryKey: ['conceptos'],
    queryFn: () => conceptosApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 min cache - conceptos change rarely
  });

  // Build column groups from conceptos
  const rentasGroups = useMemo(() => buildGroups(conceptos, 'RENTAS'), [conceptos]);
  const cajaGroups = useMemo(() => buildGroups(conceptos, 'CAJA'), [conceptos]);

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
    mutationFn: ({ fecha, valores }: { fecha: string; valores: PlanillaRow }) =>
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
    mutationFn: ({ fecha, valores }: { fecha: string; valores: PlanillaRow }) =>
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

  const rentas: PlanillaRow[] = rentasData || [];
  const caja: PlanillaRow[] = cajaData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Planillas</h1>
        <p className="text-text-secondary mt-1">Vista y edicion de movimientos diarios</p>
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
      <PlanillaTable
        title="Planilla RENTAS"
        groups={rentasGroups}
        data={rentas}
        loading={rentasLoading}
        editandoFecha={editandoRentasFecha}
        valoresEdit={valoresEditRentas}
        onEdit={(dia) => {
          setEditandoRentasFecha(dia.fecha);
          setValoresEditRentas({ ...dia });
        }}
        onSave={() => {
          if (editandoRentasFecha && valoresEditRentas) {
            updateRentasMutation.mutate({ fecha: editandoRentasFecha, valores: valoresEditRentas });
          }
        }}
        onCancel={() => {
          setEditandoRentasFecha(null);
          setValoresEditRentas(null);
        }}
        onChangeValue={(key, value) =>
          setValoresEditRentas((prev) => (prev ? { ...prev, [key]: value } : prev))
        }
        saving={updateRentasMutation.isPending}
      />

      {/* Tabla CAJA */}
      <PlanillaTable
        title="Planilla CAJA"
        groups={cajaGroups}
        data={caja}
        loading={cajaLoading}
        editandoFecha={editandoCajaFecha}
        valoresEdit={valoresEditCaja}
        onEdit={(dia) => {
          setEditandoCajaFecha(dia.fecha);
          setValoresEditCaja({ ...dia });
        }}
        onSave={() => {
          if (editandoCajaFecha && valoresEditCaja) {
            updateCajaMutation.mutate({ fecha: editandoCajaFecha, valores: valoresEditCaja });
          }
        }}
        onCancel={() => {
          setEditandoCajaFecha(null);
          setValoresEditCaja(null);
        }}
        onChangeValue={(key, value) =>
          setValoresEditCaja((prev) => (prev ? { ...prev, [key]: value } : prev))
        }
        saving={updateCajaMutation.isPending}
      />
    </div>
  );
};

export default Planillas;
