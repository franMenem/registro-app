import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import { Save, X, Calculator, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { movimientosApi } from '@/services/api';

interface ConceptoValues {
  // Conceptos que suman
  GIT: number;
  SUAT_ALTA: number;
  SUAT_PATENTES: number;
  SUAT_INFRACCIONES: number;
  CONSULTA: number;
  SUCERP: number;
  SUGIT: number;
  PROVINCIA: number;
  // Conceptos que restan
  POSNET: number;
  DEPOSITOS: number;
  // Gastos cuentas corrientes
  ICBC: number;
  FORD: number;
  SICARDI: number;
  PATAGONIA: number;
  IVECO: number;
  CNH: number;
  GESTORIA_FORD: number;
  ALRA: number;
}

// Mover el componente FUERA para evitar re-creación en cada render
const ConceptoInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex-1">
    <label className="block text-sm font-medium text-text-primary mb-1.5">{label}</label>
    <input
      type="number"
      step="0.01"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        value === 0 ? 'text-text-muted' : 'text-text-primary font-medium'
      }`}
      placeholder="$ 0,00"
    />
  </div>
);

const FormularioRentas: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();

  const [fecha, setFecha] = useState<string>(format(today, 'yyyy-MM-dd'));

  const [values, setValues] = useState<ConceptoValues>({
    GIT: 0,
    SUAT_ALTA: 0,
    SUAT_PATENTES: 0,
    SUAT_INFRACCIONES: 0,
    CONSULTA: 0,
    SUCERP: 0,
    SUGIT: 0,
    PROVINCIA: 0,
    POSNET: 0,
    DEPOSITOS: 0,
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
    values.GIT +
    values.SUAT_ALTA +
    values.SUAT_PATENTES +
    values.SUAT_INFRACCIONES +
    values.CONSULTA +
    values.SUCERP +
    values.SUGIT +
    values.PROVINCIA;

  const totalRestan = values.POSNET + values.DEPOSITOS;

  const totalGastos =
    values.ICBC +
    values.FORD +
    values.SICARDI +
    values.PATAGONIA +
    values.IVECO +
    values.CNH +
    values.GESTORIA_FORD +
    values.ALRA;

  const total = totalSuman - totalRestan - totalGastos;
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
    mutationFn: movimientosApi.createRentasDiario,
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
        GIT: 0,
        SUAT_ALTA: 0,
        SUAT_PATENTES: 0,
        SUAT_INFRACCIONES: 0,
        CONSULTA: 0,
        SUCERP: 0,
        SUGIT: 0,
        PROVINCIA: 0,
        POSNET: 0,
        DEPOSITOS: 0,
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
      queryClient.invalidateQueries({ queryKey: ['controles-quincenales'] });
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
          <h1 className="text-3xl font-bold text-text-primary">Nuevo Movimiento RENTAS</h1>
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
              <div className="grid grid-cols-4 gap-4">
                <ConceptoInput
                  label="GIT"
                  value={values.GIT}
                  onChange={(v) => handleInputChange('GIT', v)}
                />
                <ConceptoInput
                  label="SUAT - ALTA"
                  value={values.SUAT_ALTA}
                  onChange={(v) => handleInputChange('SUAT_ALTA', v)}
                />
                <ConceptoInput
                  label="SUAT - PATENTES"
                  value={values.SUAT_PATENTES}
                  onChange={(v) => handleInputChange('SUAT_PATENTES', v)}
                />
                <ConceptoInput
                  label="SUAT - INFRACCIONES"
                  value={values.SUAT_INFRACCIONES}
                  onChange={(v) => handleInputChange('SUAT_INFRACCIONES', v)}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <ConceptoInput
                  label="CONSULTA"
                  value={values.CONSULTA}
                  onChange={(v) => handleInputChange('CONSULTA', v)}
                />
                <ConceptoInput
                  label="SUCERP"
                  value={values.SUCERP}
                  onChange={(v) => handleInputChange('SUCERP', v)}
                />
                <ConceptoInput
                  label="SUGIT"
                  value={values.SUGIT}
                  onChange={(v) => handleInputChange('SUGIT', v)}
                />
                <ConceptoInput
                  label="PROVINCIA"
                  value={values.PROVINCIA}
                  onChange={(v) => handleInputChange('PROVINCIA', v)}
                />
              </div>
            </div>

            {/* Conceptos que RESTAN */}
            <div className="bg-error-light rounded-lg p-5">
              <h3 className="text-xs font-semibold text-error uppercase tracking-wide mb-4">
                CONCEPTOS QUE RESTAN
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <ConceptoInput
                  label="POSNET"
                  value={values.POSNET}
                  onChange={(v) => handleInputChange('POSNET', v)}
                />
                <ConceptoInput
                  label="DEPOSITOS"
                  value={values.DEPOSITOS}
                  onChange={(v) => handleInputChange('DEPOSITOS', v)}
                />
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

export default FormularioRentas;
