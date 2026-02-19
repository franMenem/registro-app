import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, LogOut, Menu } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const formattedDateShort = format(today, "d MMM yyyy", { locale: es });
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-14 lg:h-16 bg-card border-b border-border px-4 lg:px-8 flex items-center justify-between gap-3 shrink-0">
      {/* Left: hamburger (mobile) + welcome */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-medium text-text-secondary truncate hidden sm:block">
          Bienvenido{user?.email ? `, ${user.email}` : ''}
        </h2>
      </div>

      {/* Right: date + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="capitalize hidden md:inline">{formattedDate}</span>
          <span className="capitalize md:hidden">{formattedDateShort}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-red-500 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
};
