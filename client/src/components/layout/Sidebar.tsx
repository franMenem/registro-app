import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  Landmark,
  FileSpreadsheet,
  BarChart2,
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
    label: 'RENTAS',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    path: '/caja',
    label: 'CAJA',
    icon: <Banknote className="h-5 w-5" />,
  },
  {
    path: '/cuentas',
    label: 'Cuentas Corrientes',
    icon: <Landmark className="h-5 w-5" />,
  },
  {
    path: '/planillas',
    label: 'Planillas',
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    path: '/reportes',
    label: 'Reportes',
    icon: <BarChart2 className="h-5 w-5" />,
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
    <aside className="w-60 bg-sidebar-bg border-r border-sidebar-bg flex flex-col h-full">
      <div className="p-5 flex items-center gap-3">
        <BarChart2 className="h-7 w-7 text-white" />
        <div>
          <h1 className="text-lg font-bold text-white">Registro Control</h1>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-white font-semibold'
                  : 'text-sidebar-text hover:bg-sidebar-bg/50 font-medium'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
