import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  Wallet,
  CreditCard,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    path: '/rentas',
    label: 'Formulario RENTAS',
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    path: '/caja',
    label: 'Formulario CAJA',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    path: '/cuentas',
    label: 'Cuentas Corrientes',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    path: '/planillas',
    label: 'Planillas',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    path: '/reportes',
    label: 'Reportes',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    path: '/configuracion',
    label: 'Configuración',
    icon: <Settings className="h-5 w-5" />,
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Registro App</h1>
        <p className="text-xs text-muted mt-1">Gestión Financiera</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-secondary-700 hover:bg-secondary-50'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted text-center">
          Versión 1.0.0
        </p>
      </div>
    </aside>
  );
};
