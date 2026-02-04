import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { depositosApi } from '@/services/supabase';

interface DepositoPreview {
  monto_deposito: number;
  fecha_deposito: string;
  fecha_registro?: string;
  estado: string;
  cuit_denominacion: string;
  titular: string;
  estadoFinal?: 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR';
  saldoActual?: number;
}

interface ImportResult {
  insertados: number;
  procesados: number;
  errores: string[];
  pendientes: number;
  liquidados: number;
  aFavor: number;
}

export default function DepositosImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [depositos, setDepositos] = useState<DepositoPreview[]>([]);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parsearFecha = (fechaStr: string): string => {
    if (!fechaStr || fechaStr.trim() === '') {
      return new Date().toISOString().split('T')[0];
    }

    // Si ya está en formato ISO (yyyy-mm-dd), retornar tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
      return fechaStr.trim();
    }

    // Parsear formato dd/mm/yyyy o dd-mm-yyyy
    const partes = fechaStr.trim().split(/[-/]/);

    if (partes.length === 3) {
      let dia = partes[0].padStart(2, '0');
      let mes = partes[1].padStart(2, '0');
      let anio = partes[2];

      // Si el año es de 2 dígitos, convertir a 4
      if (anio.length === 2) {
        const anioNum = parseInt(anio);
        anio = anioNum >= 50 ? `19${anio}` : `20${anio}`;
      }

      return `${anio}-${mes}-${dia}`;
    }

    // Si no se puede parsear, retornar fecha actual
    return new Date().toISOString().split('T')[0];
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      const parsed: DepositoPreview[] = [];

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const campos = lines[i].split(',');

        if (campos.length < 2) continue;

        const montoStr = campos[0]?.trim() || '0';
        const fechaDepositoStr = campos[1]?.trim() || '';
        const fechaRegistroStr = campos[2]?.trim() || '';
        const estado = campos[3]?.trim() || '';
        const cuitDenominacion = campos[4]?.trim() || '';

        // Parsear fechas al formato yyyy-mm-dd
        const fechaDeposito = parsearFecha(fechaDepositoStr);
        const fechaRegistro = fechaRegistroStr ? parsearFecha(fechaRegistroStr) : undefined;

        // Determinar estado final y saldo
        const { estadoFinal, saldoActual } = determinarEstado(estado, cuitDenominacion);

        // Limpiar número
        const monto = limpiarNumero(montoStr);

        if (monto > 0) {
          parsed.push({
            monto_deposito: monto,
            fecha_deposito: fechaDeposito,
            fecha_registro: fechaRegistro,
            estado,
            cuit_denominacion: cuitDenominacion,
            titular: cuitDenominacion || 'Sin identificar',
            estadoFinal,
            saldoActual: estadoFinal === 'A_FAVOR' ? saldoActual : monto,
          });
        }
      }

      setDepositos(parsed);
    };
    reader.readAsText(file);
  };

  const limpiarNumero = (valor: string): number => {
    if (!valor || valor.trim() === '' || valor.trim() === '-') {
      return 0;
    }

    let limpio = valor.replace(/\s/g, '').trim();

    const tieneComaDecimal = /,\d{1,2}$/.test(limpio);
    const tienePuntoDecimal = /\.\d{1,2}$/.test(limpio);

    if (tieneComaDecimal) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else if (tienePuntoDecimal) {
      limpio = limpio.replace(/,/g, '');
    } else {
      limpio = limpio.replace(/[^\d]/g, '');
    }

    return parseFloat(limpio) || 0;
  };

  const determinarEstado = (estado: string, cuitDenominacion: string): {
    estadoFinal: 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR';
    saldoActual: number;
  } => {
    if (!cuitDenominacion || cuitDenominacion.trim() === '') {
      return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
    }

    if (!estado || estado.trim() === '') {
      return { estadoFinal: 'PENDIENTE', saldoActual: 0 };
    }

    const estadoLimpio = estado.replace(/\s/g, '').trim();
    const esNumero = /^[\d.,\-]+$/.test(estadoLimpio);

    if (esNumero) {
      try {
        const saldo = limpiarNumero(estadoLimpio);
        return { estadoFinal: 'A_FAVOR', saldoActual: saldo };
      } catch {
        return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
      }
    }

    return { estadoFinal: 'LIQUIDADO', saldoActual: 0 };
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const contenido = e.target?.result as string;
          const data = await depositosApi.importarCSV(contenido);
          setResultado(data);
          showToast.success(data.message);
        } catch (error: any) {
          showToast.error(error.message || 'Error al importar depósitos');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error: any) {
      showToast.error(error.message || 'Error al importar depósitos');
      setLoading(false);
    }
  };

  const getEstadoBadgeColor = (estado?: string) => {
    switch (estado) {
      case 'LIQUIDADO':
        return 'bg-green-100 text-green-800';
      case 'A_FAVOR':
        return 'bg-yellow-100 text-yellow-800';
      case 'PENDIENTE':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '') return '-';

    // Verificar que sea formato yyyy-mm-dd
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const [year, month, day] = dateStr.split('-');

    // Validar que las partes existan
    if (!year || !month || !day) return '-';

    return `${day}/${month}/${year}`;
  };

  const stats = {
    total: depositos.length,
    pendientes: depositos.filter(d => d.estadoFinal === 'PENDIENTE').length,
    liquidados: depositos.filter(d => d.estadoFinal === 'LIQUIDADO').length,
    aFavor: depositos.filter(d => d.estadoFinal === 'A_FAVOR').length,
    montoTotal: depositos.reduce((sum, d) => sum + d.monto_deposito, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Importar Depósitos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importa depósitos desde un archivo CSV
          </p>
        </div>
        <button
          onClick={() => navigate('/depositos')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {/* Upload Section */}
      {!resultado && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Selecciona un archivo CSV
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              Formato: Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion
            </p>
            <label className="relative cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Seleccionar archivo
              </div>
            </label>
            {file && (
              <p className="text-sm text-gray-600 mt-4">
                Archivo seleccionado: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {depositos.length > 0 && !resultado && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pendientes</p>
                  <p className="text-2xl font-semibold text-blue-600">{stats.pendientes}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Liquidados</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.liquidados}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">A Favor</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats.aFavor}</p>
                </div>
                <DollarSign className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Monto Total</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(stats.montoTotal)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Vista previa ({depositos.length} depósitos)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Depósito
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Titular
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observaciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {depositos.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(dep.fecha_deposito)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {dep.titular}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(dep.monto_deposito)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEstadoBadgeColor(dep.estadoFinal)}`}>
                          {dep.estadoFinal}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(dep.saldoActual || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {dep.estado || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setFile(null);
                setDepositos([]);
              }}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Importación
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Results Section */}
      {resultado && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-center text-gray-900 mb-2">
            Importación Completada
          </h3>
          <p className="text-center text-gray-600 mb-6">
            Se importaron {resultado.insertados} de {resultado.procesados} depósitos
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Total Insertados</p>
              <p className="text-2xl font-semibold text-gray-900">{resultado.insertados}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600 mb-1">Pendientes</p>
              <p className="text-2xl font-semibold text-blue-900">{resultado.pendientes}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 mb-1">Liquidados</p>
              <p className="text-2xl font-semibold text-green-900">{resultado.liquidados}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-600 mb-1">A Favor</p>
              <p className="text-2xl font-semibold text-yellow-900">{resultado.aFavor}</p>
            </div>
          </div>

          {resultado.errores.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-red-800 mb-2">Errores encontrados:</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {resultado.errores.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/depositos')}
              className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Ver Depósitos
            </button>
            <button
              onClick={() => {
                setFile(null);
                setDepositos([]);
                setResultado(null);
              }}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Importar Otro Archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
