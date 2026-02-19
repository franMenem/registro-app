import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  Landmark,
  DollarSign,
  FileSpreadsheet,
  ShoppingCart,
  User,
  Users,
  BarChart2,
  Settings,
  CreditCard,
  X,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    path: '/rentas',
    label: 'Rentas',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    path: '/caja',
    label: 'Caja',
    icon: <Banknote className="h-5 w-5" />,
  },
  {
    path: '/cuentas',
    label: 'Cuentas Corrientes',
    icon: <Landmark className="h-5 w-5" />,
  },
  {
    path: '/efectivo',
    label: 'Control Efectivo',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    path: '/depositos',
    label: 'Depósitos',
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    path: '/clientes',
    label: 'Clientes',
    icon: <Users className="h-5 w-5" />,
  },
  {
    path: '/gastos-registro',
    label: 'Gastos Registro',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    path: '/gastos-personales',
    label: 'Gastos Personales',
    icon: <User className="h-5 w-5" />,
  },
  {
    path: '/gastos-mios',
    label: 'Mis Gastos',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    path: '/posnet-diario',
    label: 'Control POSNET',
    icon: <BarChart2 className="h-5 w-5" />,
  },
  {
    path: '/veps',
    label: 'VEPs',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    path: '/epagos',
    label: 'ePagos',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    path: '/formularios',
    label: 'Formularios',
    icon: <FileSpreadsheet className="h-5 w-5" />,
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

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const handleNavClick = () => {
    // Close sidebar on mobile after navigating
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-60 bg-sidebar-bg border-r border-sidebar-bg flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto
        `}
      >
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-7 w-7 text-white" />
            <h1 className="text-lg font-bold text-white">Registro Control</h1>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/70 hover:text-white p-1 -mr-1"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
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
    </>
  );
};
