import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import { Save, X, Calculator, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { movimientosApi } from '@/services/supabase';

interface ConceptoValues {
  // Conceptos que suman (5)
  ARANCEL: number;
  SUAT_SELLADO: number;
  SUCERP_SELLADO: number;
  CONSULTAS: number;
  FORMULARIOS: number;
  // Conceptos que restan (3)
  POSNET: number;
  VEP: number;
  EPAGOS: number;
  // Depósitos adicionales (12)
  DEPOSITO_1: number;
  DEPOSITO_2: number;
  DEPOSITO_3: number;
  DEPOSITO_4: number;
  DEPOSITO_5: number;
  DEPOSITO_6: number;
  DEPOSITO_7: number;
  DEPOSITO_8: number;
  DEPOSITO_9: number;
  DEPOSITO_10: number;
  DEPOSITO_11: number;
  DEPOSITO_12: number;
  // Otros gastos (12)
  LIBRERIA: number;
  MARIA: number;
  TERE: number;
  DAMI: number;
  MUMI: number;
  AGUA: number;
  CARGAS_SOCIALES: number;
  EDESUR: number;
  ACARA: number;
  SUPERMERCADO: number;
  SEC: number;
  OSECAC: number;
  OTROS: number;
  REPO_CAJA_CHICA: number;
  REPO_RENTAS_CHICA: number;
  // Gastos cuentas corrientes (8)
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
}

// Evaluar expresiones matemáticas simples (ej: "100+200+300" → 600)
const evaluateExpression = (expr: string): number | null => {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  // Solo permitir dígitos, operadores, paréntesis, puntos y espacios
  if (!/^[\d\s+\-*/().]+$/.test(trimmed)) return null;
  // Solo evaluar si tiene algún operador
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
          // Si es un número simple, actualizar en tiempo real
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

  const [values, setValues] = useState<ConceptoValues>({
    ARANCEL: 0,
    SUAT_SELLADO: 0,
    SUCERP_SELLADO: 0,
    CONSULTAS: 0,
    FORMULARIOS: 0,
    POSNET: 0,
    VEP: 0,
    EPAGOS: 0,
    DEPOSITO_1: 0,
    DEPOSITO_2: 0,
    DEPOSITO_3: 0,
    DEPOSITO_4: 0,
    DEPOSITO_5: 0,
    DEPOSITO_6: 0,
    DEPOSITO_7: 0,
    DEPOSITO_8: 0,
    DEPOSITO_9: 0,
    DEPOSITO_10: 0,
    DEPOSITO_11: 0,
    DEPOSITO_12: 0,
    LIBRERIA: 0,
    MARIA: 0,
    TERE: 0,
    DAMI: 0,
    MUMI: 0,
    AGUA: 0,
    CARGAS_SOCIALES: 0,
    EDESUR: 0,
    ACARA: 0,
    SUPERMERCADO: 0,
    SEC: 0,
    OSECAC: 0,
    OTROS: 0,
    REPO_CAJA_CHICA: 0,
    REPO_RENTAS_CHICA: 0,
    ICBC: 0,
    FORD: 0,
    SICARDI: 0,
    PATAGONIA: 0,
    IVECO: 0,
    CNH: 0,
    GESTORIA_FORD: 0,
    ALRA: 0,
  });

  const [entregado, setEntregado] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [diferenciaDialog, setDiferenciaDialog] = useState<{
    isOpen: boolean;
    diferencia: number;
  }>({ isOpen: false, diferencia: 0 });

  const [cancelDialog, setCancelDialog] = useState(false);

  // Calcular totales
  const totalSuman =
    values.ARANCEL +
    values.SUAT_SELLADO +
    values.SUCERP_SELLADO +
    values.CONSULTAS +
    values.FORMULARIOS;

  const totalRestan = values.POSNET + values.VEP + values.EPAGOS;

  const totalDepositos =
    values.DEPOSITO_1 +
    values.DEPOSITO_2 +
    values.DEPOSITO_3 +
    values.DEPOSITO_4 +
    values.DEPOSITO_5 +
    values.DEPOSITO_6 +
    values.DEPOSITO_7 +
    values.DEPOSITO_8 +
    values.DEPOSITO_9 +
    values.DEPOSITO_10 +
    values.DEPOSITO_11 +
    values.DEPOSITO_12;

  const totalOtrosGastos =
    values.LIBRERIA +
    values.MARIA +
    values.TERE +
    values.DAMI +
    values.MUMI +
    values.AGUA +
    values.CARGAS_SOCIALES +
    values.EDESUR +
    values.ACARA +
    values.SUPERMERCADO +
    values.SEC +
    values.OSECAC +
    values.OTROS +
    values.REPO_CAJA_CHICA +
    values.REPO_RENTAS_CHICA;

  const totalGastosCuentas =
    values.ICBC +
    values.FORD +
    values.SICARDI +
    values.PATAGONIA +
    values.IVECO +
    values.CNH +
    values.GESTORIA_FORD +
    values.ALRA;

  const total = totalSuman - totalRestan - totalDepositos - totalOtrosGastos - totalGastosCuentas;
  const diferencia = entregado - total;

  const handleInputChange = (concepto: keyof ConceptoValues, value: string) => {
    const numValue = parseFloat(value) || 0;
    setValues((prev) => ({ ...prev, [concepto]: numValue }));
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

      // Mostrar alertas adicionales si existen
      if (response.data.alertas && response.data.alertas.length > 0) {
        response.data.alertas.forEach((alerta: string, index: number) => {
          setTimeout(() => {
            showToast.info(alerta);
          }, index * 100);
        });
      }

      // Limpiar formulario
      setValues({
        ARANCEL: 0,
        SUAT_SELLADO: 0,
        SUCERP_SELLADO: 0,
        CONSULTAS: 0,
        FORMULARIOS: 0,
        POSNET: 0,
        VEP: 0,
        EPAGOS: 0,
        DEPOSITO_1: 0,
        DEPOSITO_2: 0,
        DEPOSITO_3: 0,
        DEPOSITO_4: 0,
        DEPOSITO_5: 0,
        DEPOSITO_6: 0,
        DEPOSITO_7: 0,
        DEPOSITO_8: 0,
        DEPOSITO_9: 0,
        DEPOSITO_10: 0,
        DEPOSITO_11: 0,
        DEPOSITO_12: 0,
        LIBRERIA: 0,
        MARIA: 0,
        TERE: 0,
        DAMI: 0,
        MUMI: 0,
        AGUA: 0,
        CARGAS_SOCIALES: 0,
        EDESUR: 0,
        ACARA: 0,
        SUPERMERCADO: 0,
        SEC: 0,
        OSECAC: 0,
        OTROS: 0,
        REPO_CAJA_CHICA: 0,
        REPO_RENTAS_CHICA: 0,
        ICBC: 0,
        FORD: 0,
        SICARDI: 0,
        PATAGONIA: 0,
        IVECO: 0,
        CNH: 0,
        GESTORIA_FORD: 0,
        ALRA: 0,
      });
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
      // Invalidar queries
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
    // Validar que al menos un concepto tenga valor
    const tieneValores = Object.values(values).some((v) => v > 0);
    if (!tieneValores) {
      showToast.error('Debe ingresar al menos un valor');
      return;
    }

    // Confirmar si la diferencia no es cero
    if (diferencia !== 0 && entregado > 0) {
      setDiferenciaDialog({ isOpen: true, diferencia });
      return;
    }

    saveMutation.mutate({
      fecha,
      values,
      entregado,
    });
  };

  const confirmSaveWithDiferencia = () => {
    saveMutation.mutate({
      fecha,
      values,
      entregado,
    });
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

            {/* Conceptos que SUMAN */}
            <div className="bg-success-light rounded-lg p-5 space-y-4 mb-5">
              <h3 className="text-xs font-semibold text-success uppercase tracking-wide">
                CONCEPTOS QUE SUMAN
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <ConceptoInput
                  label="ARANCEL"
                  value={values.ARANCEL}
                  onChange={(v) => handleInputChange('ARANCEL', v)}
                />
                <ConceptoInput
                  label="SUAT - SELLADO"
                  value={values.SUAT_SELLADO}
                  onChange={(v) => handleInputChange('SUAT_SELLADO', v)}
                />
                <ConceptoInput
                  label="SUCERP - SELLADO"
                  value={values.SUCERP_SELLADO}
                  onChange={(v) => handleInputChange('SUCERP_SELLADO', v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ConceptoInput
                  label="CONSULTAS"
                  value={values.CONSULTAS}
                  onChange={(v) => handleInputChange('CONSULTAS', v)}
                />
                <ConceptoInput
                  label="FORMULARIOS"
                  value={values.FORMULARIOS}
                  onChange={(v) => handleInputChange('FORMULARIOS', v)}
                />
              </div>
            </div>

            {/* Conceptos que RESTAN */}
            <div className="bg-error-light rounded-lg p-5 mb-5">
              <h3 className="text-xs font-semibold text-error uppercase tracking-wide mb-4">
                CONCEPTOS QUE RESTAN
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <ConceptoInput
                  label="POSNET"
                  value={values.POSNET}
                  onChange={(v) => handleInputChange('POSNET', v)}
                />
                <ConceptoInput
                  label="VEP"
                  value={values.VEP}
                  onChange={(v) => handleInputChange('VEP', v)}
                />
                <ConceptoInput
                  label="EPAGOS"
                  value={values.EPAGOS}
                  onChange={(v) => handleInputChange('EPAGOS', v)}
                />
              </div>
            </div>

            {/* Depósitos Adicionales */}
            <div className="bg-background rounded-lg p-5 mb-5">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">
                DEPOSITOS ADICIONALES
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="DEPOSITO 1"
                    value={values.DEPOSITO_1}
                    onChange={(v) => handleInputChange('DEPOSITO_1', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 2"
                    value={values.DEPOSITO_2}
                    onChange={(v) => handleInputChange('DEPOSITO_2', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 3"
                    value={values.DEPOSITO_3}
                    onChange={(v) => handleInputChange('DEPOSITO_3', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 4"
                    value={values.DEPOSITO_4}
                    onChange={(v) => handleInputChange('DEPOSITO_4', v)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="DEPOSITO 5"
                    value={values.DEPOSITO_5}
                    onChange={(v) => handleInputChange('DEPOSITO_5', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 6"
                    value={values.DEPOSITO_6}
                    onChange={(v) => handleInputChange('DEPOSITO_6', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 7"
                    value={values.DEPOSITO_7}
                    onChange={(v) => handleInputChange('DEPOSITO_7', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 8"
                    value={values.DEPOSITO_8}
                    onChange={(v) => handleInputChange('DEPOSITO_8', v)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="DEPOSITO 9"
                    value={values.DEPOSITO_9}
                    onChange={(v) => handleInputChange('DEPOSITO_9', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 10"
                    value={values.DEPOSITO_10}
                    onChange={(v) => handleInputChange('DEPOSITO_10', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 11"
                    value={values.DEPOSITO_11}
                    onChange={(v) => handleInputChange('DEPOSITO_11', v)}
                  />
                  <ConceptoInput
                    label="DEPOSITO 12"
                    value={values.DEPOSITO_12}
                    onChange={(v) => handleInputChange('DEPOSITO_12', v)}
                  />
                </div>
              </div>
            </div>

            {/* Otros Gastos */}
            <div className="bg-warning-light rounded-lg p-5">
              <h3 className="text-xs font-semibold text-warning uppercase tracking-wide mb-4">
                OTROS GASTOS
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="LIBRERIA"
                    value={values.LIBRERIA}
                    onChange={(v) => handleInputChange('LIBRERIA', v)}
                  />
                  <ConceptoInput
                    label="MARIA"
                    value={values.MARIA}
                    onChange={(v) => handleInputChange('MARIA', v)}
                  />
                  <ConceptoInput
                    label="TERE"
                    value={values.TERE}
                    onChange={(v) => handleInputChange('TERE', v)}
                  />
                  <ConceptoInput
                    label="DAMI"
                    value={values.DAMI}
                    onChange={(v) => handleInputChange('DAMI', v)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="MUMI"
                    value={values.MUMI}
                    onChange={(v) => handleInputChange('MUMI', v)}
                  />
                  <ConceptoInput
                    label="AGUA"
                    value={values.AGUA}
                    onChange={(v) => handleInputChange('AGUA', v)}
                  />
                  <ConceptoInput
                    label="CARGAS SOCIALES"
                    value={values.CARGAS_SOCIALES}
                    onChange={(v) => handleInputChange('CARGAS_SOCIALES', v)}
                  />
                  <ConceptoInput
                    label="EDESUR"
                    value={values.EDESUR}
                    onChange={(v) => handleInputChange('EDESUR', v)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="ACARA"
                    value={values.ACARA}
                    onChange={(v) => handleInputChange('ACARA', v)}
                  />
                  <ConceptoInput
                    label="SUPERMERCADO"
                    value={values.SUPERMERCADO}
                    onChange={(v) => handleInputChange('SUPERMERCADO', v)}
                  />
                  <ConceptoInput
                    label="SEC"
                    value={values.SEC}
                    onChange={(v) => handleInputChange('SEC', v)}
                  />
                  <ConceptoInput
                    label="OSECAC"
                    value={values.OSECAC}
                    onChange={(v) => handleInputChange('OSECAC', v)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <ConceptoInput
                    label="OTROS"
                    value={values.OTROS}
                    onChange={(v) => handleInputChange('OTROS', v)}
                  />
                  <ConceptoInput
                    label="REPO CAJA CHICA"
                    value={values.REPO_CAJA_CHICA}
                    onChange={(v) => handleInputChange('REPO_CAJA_CHICA', v)}
                  />
                  <ConceptoInput
                    label="REPO RENTAS CHICA"
                    value={values.REPO_RENTAS_CHICA}
                    onChange={(v) => handleInputChange('REPO_RENTAS_CHICA', v)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Gastos de Cuentas Corrientes */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5">
              Gastos de Cuentas Corrientes
            </h2>

            <div className="bg-background rounded-lg p-5 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <ConceptoInput
                  label="ICBC"
                  value={values.ICBC}
                  onChange={(v) => handleInputChange('ICBC', v)}
                />
                <ConceptoInput
                  label="FORD"
                  value={values.FORD}
                  onChange={(v) => handleInputChange('FORD', v)}
                />
                <ConceptoInput
                  label="SICARDI"
                  value={values.SICARDI}
                  onChange={(v) => handleInputChange('SICARDI', v)}
                />
                <ConceptoInput
                  label="PATAGONIA"
                  value={values.PATAGONIA}
                  onChange={(v) => handleInputChange('PATAGONIA', v)}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <ConceptoInput
                  label="IVECO"
                  value={values.IVECO}
                  onChange={(v) => handleInputChange('IVECO', v)}
                />
                <ConceptoInput
                  label="CNH"
                  value={values.CNH}
                  onChange={(v) => handleInputChange('CNH', v)}
                />
                <ConceptoInput
                  label="GESTORIA FORD"
                  value={values.GESTORIA_FORD}
                  onChange={(v) => handleInputChange('GESTORIA_FORD', v)}
                />
                <ConceptoInput
                  label="ALRA"
                  value={values.ALRA}
                  onChange={(v) => handleInputChange('ALRA', v)}
                />
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
                disabled={saveMutation.isPending}
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
