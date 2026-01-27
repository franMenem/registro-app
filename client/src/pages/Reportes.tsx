import React from 'react';
import { Card } from '@/components/ui/Card';
import { BarChart3 } from 'lucide-react';

const Reportes: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Reportes</h1>
        <p className="text-text-secondary mt-1">Análisis y reportes financieros</p>
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="h-16 w-16 text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Módulo en Desarrollo
          </h3>
          <p className="text-text-secondary max-w-md">
            La sección de reportes estará disponible en la próxima fase del proyecto.
            Incluirá gráficos, exportación a Excel/PDF y análisis detallados.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Reportes;
