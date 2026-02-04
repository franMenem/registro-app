import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, LogOut } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-card border-b border-border px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-medium text-text-secondary">
          Bienvenido{user?.email ? `, ${user.email}` : ''}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{formattedDate}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-red-500 transition-colors"
          title="Cerrar sesion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
