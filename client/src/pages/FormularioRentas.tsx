import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Save, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { conceptosApi, movimientosApi, dashboardApi } from '@/services/api';
import { formatCurrency, validateCUIT, formatCUIT, formatDate } from '@/utils/format';
import { MovimientoCreate } from '@/types';

const FormularioRentas: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<MovimientoCreate>>({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    tipo: 'RENTAS',
    cuit: '',
    concepto_id: undefined,
    monto: undefined,
    observaciones: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch conceptos RENTAS
  const { data: conceptos = [] } = useQuery({
    queryKey: ['conceptos', 'RENTAS'],
    queryFn: () => conceptosApi.getAll('RENTAS'),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  // Fetch recent movements
  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos', { tipo: 'RENTAS', limit: 5 }],
    queryFn: () => movimientosApi.getAll({ tipo: 'RENTAS', limit: 5 }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: movimientosApi.create,
    onSuccess: (response) => {
      toast.success('Movimiento guardado correctamente');

      // Show alerts if any
      if (response.alertas && response.alertas.length > 0) {
        response.alertas.forEach((alerta) => {
          toast.success(alerta, { duration: 6000 });
        });
      }

      // Reset form
      handleReset();

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'concepto_id' || name === 'monto' ? (value ? parseFloat(value) : undefined) : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }

    if (!formData.cuit) {
      newErrors.cuit = 'El CUIT es requerido';
    } else if (!validateCUIT(formData.cuit)) {
      newErrors.cuit = 'CUIT inválido (formato: 20-12345678-9)';
    }

    if (!formData.concepto_id) {
      newErrors.concepto_id = 'El concepto es requerido';
    }

    if (!formData.monto || formData.monto <= 0) {
      newErrors.monto = 'El monto debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Por favor corrija los errores del formulario');
      return;
    }

    createMutation.mutate(formData as MovimientoCreate);
  };

  const handleReset = () => {
    setFormData({
      fecha: format(new Date(), 'yyyy-MM-dd'),
      tipo: 'RENTAS',
      cuit: '',
      concepto_id: undefined,
      monto: undefined,
      observaciones: '',
    });
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Formulario RENTAS</h1>
        <p className="text-muted mt-1">Registrar nuevo movimiento de RENTAS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario - 2 columnas */}
        <div className="lg:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Fecha"
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  error={errors.fecha}
                  required
                />

                <Input
                  label="CUIT"
                  type="text"
                  name="cuit"
                  placeholder="20-12345678-9"
                  value={formData.cuit}
                  onChange={handleChange}
                  error={errors.cuit}
                  required
                />
              </div>

              <Select
                label="Concepto"
                name="concepto_id"
                value={formData.concepto_id || ''}
                onChange={handleChange}
                options={conceptos.map((c) => ({ value: c.id, label: c.nombre }))}
                error={errors.concepto_id}
                required
              />

              <Input
                label="Monto"
                type="number"
                name="monto"
                placeholder="0.00"
                prefix="$"
                step="0.01"
                value={formData.monto || ''}
                onChange={handleChange}
                error={errors.monto}
                required
              />

              <div>
                <label className="label mb-2 block">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange as any}
                  rows={3}
                  className="input w-full"
                  placeholder="Información adicional (opcional)"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  icon={Save}
                  loading={createMutation.isPending}
                >
                  Guardar
                </Button>
                <Button type="button" variant="outline" icon={RotateCcw} onClick={handleReset}>
                  Limpiar
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Resumen - 1 columna */}
        <div className="space-y-6">
          <MetricCard
            label="Total RENTAS Hoy"
            value={formatCurrency(stats?.total_rentas_hoy || 0)}
            subtitle={`${stats?.movimientos_count || 0} movimientos`}
          />

          <Card title="Últimos Movimientos">
            <div className="space-y-3">
              {movimientos.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No hay movimientos</p>
              ) : (
                movimientos.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex justify-between items-start p-3 rounded-lg bg-secondary-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {mov.concepto?.nombre || 'N/A'}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{formatDate(mov.fecha)}</p>
                    </div>
                    <span className="text-sm font-semibold text-secondary-900 ml-2">
                      {formatCurrency(mov.monto)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FormularioRentas;
