import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/ui/Toast';
import { Calendar, DollarSign, AlertCircle, CheckCircle2, TrendingUp, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  posnetDiarioApi,
  type RegistroPosnet,
  type ResumenMensual,
} from '@/services/supabase';

const ControlPosnetDiario: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [mesActual, setMesActual] = useState(today.getMonth() + 1);
  const [anioActual, setAnioActual] = useState(today.getFullYear());
  const [editandoFecha, setEditandoFecha] = useState<string | null>(null);
  const [editandoTotalPosnet, setEditandoTotalPosnet] = useState<number>(0);
  const [valorTemporal, setValorTemporal] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: registros = [], refetch: refetchRegistros } = useQuery({
    queryKey: ['posnet-diario', mesActual, anioActual],
    queryFn: () => posnetDiarioApi.getRegistrosMes(mesActual, anioActual),
  });

  const { data: resumen } = useQuery<ResumenMensual>({
    queryKey: ['posnet-diario-resumen', mesActual, anioActual],
    queryFn: () => posnetDiarioApi.getResumen(mesActual, anioActual),
  });

  // Mutation para actualizar monto ingresado
  const actualizarMontoMutation = useMutation({
    mutationFn: ({ fecha, monto, totalPosnet }: { fecha: string; monto: number; totalPosnet: number }) =>
      posnetDiarioApi.actualizarMontoIngresado(fecha, monto, totalPosnet),
    onSuccess: () => {
      showToast.success('Monto actualizado correctamente');
      setEditandoFecha(null);
      setValorTemporal('');
      refetchRegistros();
      queryClient.invalidateQueries({ queryKey: ['posnet-diario-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });

  // Mutation para importar CSV
  const importarCSVMutation = useMutation({
    mutationFn: (contenido: string) => posnetDiarioApi.importarCSV(contenido),
    onSuccess: (data) => {
      const { insertados, actualizados, errores } = data;
      showToast.success(
        `Importación completada: ${insertados} insertados, ${actualizados} actualizados`
      );
      if (errores.length > 0) {
        showToast.error(`${errores.length} errores encontrados`);
      }
      refetchRegistros();
      queryClient.invalidateQueries({ queryKey: ['posnet-diario-resumen'] });
    },
    onError: (error: Error) => {
      showToast.error(`Error al importar: ${error.message}`);
    },
  });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleEditarClick = (registro: RegistroPosnet) => {
    setEditandoFecha(registro.fecha);
    setEditandoTotalPosnet(registro.total_posnet);
    setValorTemporal(registro.monto_ingresado_banco.toString());
  };

  const handleGuardar = () => {
    if (!editandoFecha) return;

    const monto = parseFloat(valorTemporal);
    if (isNaN(monto) || monto < 0) {
      showToast.error('Monto inválido');
      return;
    }

    actualizarMontoMutation.mutate({ fecha: editandoFecha, monto, totalPosnet: editandoTotalPosnet });
  };

  const handleCancelar = () => {
    setEditandoFecha(null);
    setEditandoTotalPosnet(0);
    setValorTemporal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGuardar();
    } else if (e.key === 'Escape') {
      handleCancelar();
    }
  };

  // Crear un mapa de registros por fecha
  const registrosMap = new Map<string, RegistroPosnet>();
  registros.forEach((reg: RegistroPosnet) => {
    registrosMap.set(reg.fecha, reg);
  });

  // Generar todos los días del mes
  const primerDia = startOfMonth(new Date(anioActual, mesActual - 1));
  const ultimoDia = endOfMonth(new Date(anioActual, mesActual - 1));
  const diasDelMes = eachDayOfInterval({ start: primerDia, end: ultimoDia });

  const registrosCompletos = diasDelMes.map((dia) => {
    const fechaStr = format(dia, 'yyyy-MM-dd');
    const registro = registrosMap.get(fechaStr);

    if (registro) {
      return registro;
    } else {
      // Registro vacío para días sin datos
      return {
        id: 0,
        fecha: fechaStr,
        monto_rentas: 0,
        monto_caja: 0,
        total_posnet: 0,
        monto_ingresado_banco: 0,
        diferencia: 0,
        created_at: '',
        updated_at: '',
      };
    }
  });

  const getDiferenciaColor = (diferencia: number) => {
    if (diferencia === 0) return 'text-success';
    if (diferencia > 0) return 'text-warning';
    return 'text-error';
  };

  const getDiferenciaIcon = (diferencia: number) => {
    if (diferencia === 0) return <CheckCircle2 className="h-4 w-4" />;
    if (diferencia > 0) return <AlertCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const handleMesChange = (delta: number) => {
    let nuevoMes = mesActual + delta;
    let nuevoAnio = anioActual;

    if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAnio--;
    } else if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAnio++;
    }

    setMesActual(nuevoMes);
    setAnioActual(nuevoAnio);
  };

  const handleImportarClick = () => {
    fileInputRef.current?.click();
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo CSV
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
      // Resetear el input para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">📊 Control POSNET Diario</h1>
          <p className="text-text-secondary mt-1">
            Seguimiento diario del POSNET con control de diferencias
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Botón Importar CSV */}
          <button
            onClick={handleImportarClick}
            disabled={importarCSVMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {importarCSVMutation.isPending ? 'Importando...' : 'Importar CSV'}
          </button>

          {/* Input file oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleArchivoSeleccionado}
            className="hidden"
          />

          {/* Selector de Mes/Año */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMesChange(-1)}
              className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-background transition-colors"
            >
              ←
            </button>
            <div className="text-center min-w-[200px]">
              <p className="text-xl font-bold text-text-primary">
                {format(new Date(anioActual, mesActual - 1), 'MMMM yyyy', { locale: es })}
              </p>
            </div>
            <button
              onClick={() => handleMesChange(1)}
              className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-background transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-text-secondary">Total POSNET</p>
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency(resumen?.total_posnet || 0)}
              </p>
              <p className="text-xs text-text-muted">
                RENTAS: {formatCurrency(resumen?.total_rentas || 0)} | CAJA:{' '}
                {formatCurrency(resumen?.total_caja || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-text-secondary">Total Ingresado</p>
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency(resumen?.total_ingresado || 0)}
              </p>
              <p className="text-xs text-text-muted">{resumen?.dias_ok || 0} días al día</p>
            </div>
          </div>
        </Card>

        <Card
          className={
            (resumen?.diferencia_acumulada || 0) === 0
              ? 'bg-success-light border-success'
              : (resumen?.diferencia_acumulada || 0) > 0
              ? 'bg-warning-light border-warning'
              : 'bg-error-light border-error'
          }
        >
          <div className="flex items-center gap-3">
            <AlertCircle
              className={`h-8 w-8 ${
                (resumen?.diferencia_acumulada || 0) === 0
                  ? 'text-success'
                  : (resumen?.diferencia_acumulada || 0) > 0
                  ? 'text-warning'
                  : 'text-error'
              }`}
            />
            <div>
              <p className="text-sm text-text-secondary">Diferencia Acumulada</p>
              <p
                className={`text-2xl font-bold ${
                  (resumen?.diferencia_acumulada || 0) === 0
                    ? 'text-success'
                    : (resumen?.diferencia_acumulada || 0) > 0
                    ? 'text-warning'
                    : 'text-error'
                }`}
              >
                {formatCurrency(resumen?.diferencia_acumulada || 0)}
              </p>
              <p className="text-xs text-text-muted">
                {resumen?.dias_falta_ingresar || 0} días falta ingresar
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-text-secondary">Días con Datos</p>
              <p className="text-2xl font-bold text-text-primary">{resumen?.total_dias || 0}</p>
              <p className="text-xs text-text-muted">
                {resumen?.dias_error || 0} días con error
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla */}
      <Card title="Detalle Diario">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">
                  Fecha
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Monto RENTAS
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Monto CAJA
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Total POSNET
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary bg-primary/10">
                  Monto Ingresado Banco
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary">
                  Diferencia
                </th>
              </tr>
            </thead>
            <tbody>
              {registrosCompletos.map((registro) => {
                const estaEditando = editandoFecha === registro.fecha;
                const tieneMovimientos = registro.total_posnet > 0;

                return (
                  <tr
                    key={registro.fecha}
                    className={`border-b border-border ${
                      tieneMovimientos ? 'hover:bg-background' : 'opacity-50'
                    }`}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-text-primary">
                      {format(new Date(registro.fecha + 'T00:00:00'), 'EEEE dd/MM', {
                        locale: es,
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-text-primary">
                      {tieneMovimientos ? formatCurrency(registro.monto_rentas) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-text-primary">
                      {tieneMovimientos ? formatCurrency(registro.monto_caja) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-text-primary">
                      {tieneMovimientos ? formatCurrency(registro.total_posnet) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right bg-primary/5">
                      {tieneMovimientos ? (
                        estaEditando ? (
                          <input
                            type="number"
                            step="0.01"
                            value={valorTemporal}
                            onChange={(e) => setValorTemporal(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleGuardar}
                            autoFocus
                            className="w-full px-2 py-1 rounded border border-primary bg-card text-right text-sm font-medium"
                          />
                        ) : (
                          <button
                            onClick={() => handleEditarClick(registro)}
                            className="w-full text-right px-2 py-1 rounded hover:bg-primary/10 transition-colors font-medium"
                          >
                            {formatCurrency(registro.monto_ingresado_banco)}
                          </button>
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      {tieneMovimientos ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-semibold ${getDiferenciaColor(registro.diferencia)}`}>
                            {formatCurrency(registro.diferencia)}
                          </span>
                          <span className={getDiferenciaColor(registro.diferencia)}>
                            {getDiferenciaIcon(registro.diferencia)}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leyenda */}
      <Card>
        <div className="flex items-center justify-around text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-text-secondary">Diferencia = 0 (OK)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span className="text-text-secondary">Diferencia {'>'} 0 (Falta ingresar)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-text-secondary">Diferencia {'<'} 0 (Error - ingresado de más)</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ControlPosnetDiario;
