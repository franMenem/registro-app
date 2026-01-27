import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from 'lucide-react';

export const Header: React.FC = () => {
  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-secondary-900">
          Bienvenido
        </h2>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted">
        <Calendar className="h-4 w-4" />
        <span className="capitalize">{formattedDate}</span>
      </div>
    </header>
  );
};
