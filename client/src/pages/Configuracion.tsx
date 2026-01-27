import React from 'react';
import { Card } from '@/components/ui/Card';
import { Settings } from 'lucide-react';

const Configuracion: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Configuración</h1>
        <p className="text-muted mt-1">Configuración del sistema</p>
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Settings className="h-16 w-16 text-muted mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">
            Módulo en Desarrollo
          </h3>
          <p className="text-muted max-w-md">
            La sección de configuración estará disponible en una futura fase.
            Incluirá gestión de usuarios, backup automático y configuración de conceptos.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Configuracion;
