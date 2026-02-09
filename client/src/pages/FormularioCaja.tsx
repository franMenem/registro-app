import React, { useState, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import { Save, X, Calculator, Upload, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { movimientosApi, conceptosApi } from '@/services/supabase';

// Conceptos with these column_keys subtract from total instead of adding
const RESTAN_KEYS = new Set(['POSNET', 'POSNET_CAJA']);

// CC account column keys (these appear in their own section, not in the concepto section)
const CC_KEYS = ['ICBC', 'FORD', 'SICARDI', 'PATAGONIA', 'IVECO', 'CNH', 'GESTORIA_FORD', 'ALRA'];
const CC_KEY_SET = new Set(CC_KEYS);
const CC_LABELS: Record<string, string> = {
  ICBC: 'ICBC', FORD: 'FORD', SICARDI: 'SICARDI', PATAGONIA: 'PATAGONIA',
  IVECO: 'IVECO', CNH: 'CNH', GESTORIA_FORD: 'GESTORIA FORD', ALRA: 'ALRA',
};

// Static "restan" keys that are NOT from conceptos table (VEP, EPAGOS)
const STATIC_RESTAN = [
  { key: 'VEP', label: 'VEP' },
  { key: 'EPAGOS', label: 'EPAGOS' },
];

// Otros gastos keys (static, from gastos_registrales/adelantos tables)
const OTROS_GASTOS = [
  { key: 'LIBRERIA', label: 'LIBRERIA' },
  { key: 'MARIA', label: 'MARIA' },
  { key: 'TERE', label: 'TERE' },
  { key: 'DAMI', label: 'DAMI' },
  { key: 'MUMI', label: 'MUMI' },
  { key: 'AGUA', label: 'AGUA' },
  { key: 'CARGAS_SOCIALES', label: 'CARGAS SOCIALES' },
  { key: 'EDESUR', label: 'EDESUR' },
  { key: 'ACARA', label: 'ACARA' },
  { key: 'SUPERMERCADO', label: 'SUPERMERCADO' },
  { key: 'SEC', label: 'SEC' },
  { key: 'OSECAC', label: 'OSECAC' },
  { key: 'OTROS', label: 'OTROS' },
  { key: 'REPO_CAJA_CHICA', label: 'REPO CAJA CHICA' },
  { key: 'REPO_RENTAS_CHICA', label: 'REPO RENTAS CHICA' },
];

// Evaluar expresiones matemáticas simples (ej: "100+200+300" → 600)
const evaluateExpression = (expr: string): number | null => {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  if (!/^[\d\s+\-*/().]+$/.test(trimmed)) return null;
  if (!/[+\-*/]/.test(trimmed)) return null;
  try {
    const result = new Function(`return (${trimmed})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
};

// Mover el componente FUERA para evitar re-creación en cada render
const ConceptoInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [text, setText] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);

  const displayValue = isEditing ? text : (value ? value.toString() : '');

  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-text-primary mb-1.5">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={() => {
          setIsEditing(true);
          setText(value ? value.toString() : '');
        }}
        onChange={(e) => {
          setText(e.target.value);
          const num = parseFloat(e.target.value);
          if (!isNaN(num) && !/[+\-*/]/.test(e.target.value.slice(1))) {
            onChange(e.target.value);
          }
        }}
        onBlur={() => {
          const evaluated = evaluateExpression(text);
          if (evaluated !== null) {
            onChange(evaluated.toString());
            setText(evaluated.toString());
          } else if (text.trim()) {
            onChange(text);
          }
          setIsEditing(false);
        }}
        className={`w-full rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          value === 0 ? 'text-text-muted' : 'text-text-primary font-medium'
        }`}
        placeholder="$ 0,00"
      />
    </div>
  );
};

const FormularioCaja: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();

  const [fecha, setFecha] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [values, setValues] = useState<Record<string, number>>({});
  const [entregado, setEntregado] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [diferenciaDialog, setDiferenciaDialog] = useState<{
    isOpen: boolean;
    diferencia: number;
  }>({ isOpen: false, diferencia: 0 });
  const [cancelDialog, setCancelDialog] = useState(false);

  // Fetch conceptos CAJA from DB
  const { data: allConceptos = [], isLoading: conceptosLoading } = useQuery({
    queryKey: ['conceptos', 'CAJA'],
    queryFn: () => conceptosApi.getAll('CAJA'),
    staleTime: 5 * 60 * 1000,
  });

  // Split conceptos into suman/restan, excluding CC accounts
  const conceptosSuman = useMemo(
    () => allConceptos.filter(c => !RESTAN_KEYS.has(c.column_key) && !CC_KEY_SET.has(c.column_key)),
    [allConceptos]
  );
  const conceptosRestan = useMemo(
    () => allConceptos.filter(c => RESTAN_KEYS.has(c.column_key)),
    [allConceptos]
  );

  // Calcular totales
  const totalSuman = conceptosSuman.reduce((sum, c) => sum + (values[c.column_key] || 0), 0);

  const totalConceptosRestan = conceptosRestan.reduce((sum, c) => sum + (values[c.column_key] || 0), 0);
  const totalStaticRestan = STATIC_RESTAN.reduce((sum, s) => sum + (values[s.key] || 0), 0);
  const totalRestan = totalConceptosRestan + totalStaticRestan;

  const totalDepositos = Array.from({ length: 12 }, (_, i) => values[`DEPOSITO_${i + 1}`] || 0)
    .reduce((a, b) => a + b, 0);

  const totalOtrosGastos = OTROS_GASTOS.reduce((sum, g) => sum + (values[g.key] || 0), 0);

  const totalGastosCuentas = CC_KEYS.reduce((sum, key) => sum + (values[key] || 0), 0);

  const total = totalSuman - totalRestan - totalDepositos - totalOtrosGastos - totalGastosCuentas;
  const diferencia = entregado - total;

  const handleInputChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setValues((prev) => ({ ...prev, [key]: numValue }));
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Mutation para guardar
  const saveMutation = useMutation({
    mutationFn: movimientosApi.createCajaDiario,
    onSuccess: (response) => {
      showToast.success(response.message);

      if (response.data.alertas && response.data.alertas.length > 0) {
        response.data.alertas.forEach((alerta: string, index: number) => {
          setTimeout(() => {
            showToast.info(alerta);
          }, index * 100);
        });
      }

      // Limpiar formulario
      setValues({});
      setEntregado(0);

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['controles-semanales'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message || 'Error al guardar el registro');
    },
  });

  // Mutation para importar CSV
  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => movimientosApi.importarCSV(contenido),
    onSuccess: (data) => {
      const { insertados, errores } = data;
      showToast.success(
        `Importación completada: ${insertados} movimientos insertados`
      );
      if (errores.length > 0) {
        showToast.error(`${errores.length} errores encontrados. Revisa la consola.`);
        console.error('Errores de importación:', errores);
      }
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: Error) => {
      showToast.error(`Error al importar: ${error.message}`);
    },
  });

  const handleImportarClick = () => {
    fileInputRef.current?.click();
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showToast.error('Por favor seleccioná un archivo CSV');
      return;
    }

    try {
      const contenido = await file.text();
      importarCSVMutation.mutate(contenido);
    } catch (error) {
      showToast.error('Error al leer el archivo');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = () => {
    const tieneValores = Object.values(values).some((v) => v > 0);
    if (!tieneValores) {
      showToast.error('Debe ingresar al menos un valor');
      return;
    }

    if (diferencia !== 0 && entregado > 0) {
      setDiferenciaDialog({ isOpen: true, diferencia });
      return;
    }

    saveMutation.mutate({ fecha, values, entregado });
  };

  const confirmSaveWithDiferencia = () => {
    saveMutation.mutate({ fecha, values, entregado });
    setDiferenciaDialog({ isOpen: false, diferencia: 0 });
  };

  const handleCancel = () => {
    if (Object.values(values).some((v) => v > 0) || entregado > 0) {
      setCancelDialog(true);
    } else {
      navigate('/');
    }
  };

  const confirmCancel = () => {
    navigate('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Nuevo Movimiento CAJA</h1>
          <p className="text-text-secondary mt-1">
            Registrar movimientos del día de hoy
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleImportarClick}
            disabled={importarCSVMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {importarCSVMutation.isPending ? 'Importando...' : 'Importar CSV'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleArchivoSeleccionado}
            className="hidden"
          />
        </div>
      </div>

      {/* Selector de Fecha */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-text-primary">Fecha del movimiento:</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
          <span className="text-sm text-text-muted">
            {format(new Date(fecha + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Columna Izquierda - Formulario */}
        <div className="space-y-6">
          {/* Card 1: Información Básica */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5">
              Información Básica
            </h2>

            {conceptosLoading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Cargando conceptos...
              </div>
            ) : (
              <>
                {/* Conceptos que SUMAN (dynamic from DB) */}
                {conceptosSuman.length > 0 && (
                  <div className="bg-success-light rounded-lg p-5 space-y-4 mb-5">
                    <h3 className="text-xs font-semibold text-success uppercase tracking-wide">
                      CONCEPTOS QUE SUMAN
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      {conceptosSuman.map(c => (
                        <ConceptoInput
                          key={c.id}
                          label={c.nombre}
                          value={values[c.column_key] || 0}
                          onChange={(v) => handleInputChange(c.column_key, v)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Conceptos que RESTAN (dynamic + static VEP/EPAGOS) */}
                <div className="bg-error-light rounded-lg p-5 mb-5">
                  <h3 className="text-xs font-semibold text-error uppercase tracking-wide mb-4">
                    CONCEPTOS QUE RESTAN
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {conceptosRestan.map(c => (
                      <ConceptoInput
                        key={c.id}
                        label={c.nombre}
                        value={values[c.column_key] || 0}
                        onChange={(v) => handleInputChange(c.column_key, v)}
                      />
                    ))}
                    {STATIC_RESTAN.map(s => (
                      <ConceptoInput
                        key={s.key}
                        label={s.label}
                        value={values[s.key] || 0}
                        onChange={(v) => handleInputChange(s.key, v)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Depósitos Adicionales (static) */}
            <div className="bg-background rounded-lg p-5 mb-5">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">
                DEPOSITOS ADICIONALES
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <ConceptoInput
                    key={n}
                    label={`DEPOSITO ${n}`}
                    value={values[`DEPOSITO_${n}`] || 0}
                    onChange={(v) => handleInputChange(`DEPOSITO_${n}`, v)}
                  />
                ))}
              </div>
            </div>

            {/* Otros Gastos (static) */}
            <div className="bg-warning-light rounded-lg p-5">
              <h3 className="text-xs font-semibold text-warning uppercase tracking-wide mb-4">
                OTROS GASTOS
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {OTROS_GASTOS.map(g => (
                  <ConceptoInput
                    key={g.key}
                    label={g.label}
                    value={values[g.key] || 0}
                    onChange={(v) => handleInputChange(g.key, v)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Gastos de Cuentas Corrientes (static) */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5">
              Gastos de Cuentas Corrientes
            </h2>

            <div className="bg-background rounded-lg p-5 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {CC_KEYS.map(key => (
                  <ConceptoInput
                    key={key}
                    label={CC_LABELS[key] || key}
                    value={values[key] || 0}
                    onChange={(v) => handleInputChange(key, v)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha - Resumen */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-text-primary">RESUMEN</h2>
            </div>

            {/* Entregado Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Entregado
              </label>
              <input
                type="number"
                step="0.01"
                value={entregado || ''}
                onChange={(e) => setEntregado(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="$ 0,00"
              />
            </div>

            {/* Total */}
            <div className="space-y-1">
              <p className="text-sm text-text-secondary">Total</p>
              <p className="text-2xl font-bold text-text-primary font-mono">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Diferencia */}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-secondary">DIFERENCIA</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-xl font-bold font-mono ${
                    diferencia > 0
                      ? 'text-success'
                      : diferencia < 0
                      ? 'text-error'
                      : 'text-text-primary'
                  }`}
                >
                  {formatCurrency(diferencia)}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <Button
                variant="primary"
                size="md"
                icon={Save}
                onClick={handleSave}
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending || conceptosLoading}
                className="w-full"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar y Nuevo'}
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={X}
                onClick={handleCancel}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                Cancelar
              </Button>
              <p className="text-xs text-text-muted text-center">
                Ctrl + Enter para guardar rápido
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Diferencia Confirm Dialog */}
      <ConfirmDialog
        isOpen={diferenciaDialog.isOpen}
        onClose={() => setDiferenciaDialog({ isOpen: false, diferencia: 0 })}
        onConfirm={confirmSaveWithDiferencia}
        title="Confirmar Diferencia"
        message={
          diferenciaDialog.diferencia > 0
            ? `Hay una diferencia positiva de ${formatCurrency(diferenciaDialog.diferencia)}.\n\n¿Desea continuar?`
            : `Hay una diferencia negativa de ${formatCurrency(Math.abs(diferenciaDialog.diferencia))}.\n\n¿Desea continuar?`
        }
        confirmText="Continuar"
        cancelText="Cancelar"
        variant="warning"
        isLoading={saveMutation.isPending}
      />

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={cancelDialog}
        onClose={() => setCancelDialog(false)}
        onConfirm={confirmCancel}
        title="Cancelar Movimiento"
        message="¿Está seguro que desea cancelar?\n\nSe perderán los datos ingresados."
        confirmText="Sí, cancelar"
        cancelText="No, continuar"
        variant="warning"
      />
    </div>
  );
};

export default FormularioCaja;
