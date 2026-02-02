import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import FormularioRentas from './pages/FormularioRentas';
import FormularioCaja from './pages/FormularioCaja';
import CuentasCorrientes from './pages/CuentasCorrientes';
import Depositos from './pages/Depositos';
import DepositosImport from './pages/DepositosImport';
import GastosRegistro from './pages/GastosRegistro';
import GastosPersonales from './pages/GastosPersonales';
import GastosMios from './pages/GastosMios';
import ControlPosnetDiario from './pages/ControlPosnetDiario';
import Formularios from './pages/Formularios';
import Clientes from './pages/Clientes';
import Planillas from './pages/Planillas';
import HistorialMovimientos from './pages/HistorialMovimientos';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';
import VEPs from './pages/VEPs';
import EPagos from './pages/EPagos';
import ControlEfectivo from './pages/ControlEfectivo';
import { ToastProvider } from './components/ui/Toast';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="rentas" element={<FormularioRentas />} />
          <Route path="caja" element={<FormularioCaja />} />
          <Route path="cuentas" element={<CuentasCorrientes />} />
          <Route path="efectivo" element={<ControlEfectivo />} />
          <Route path="depositos" element={<Depositos />} />
          <Route path="depositos/importar" element={<DepositosImport />} />
          <Route path="gastos-registro" element={<GastosRegistro />} />
          <Route path="gastos-personales" element={<GastosPersonales />} />
          <Route path="gastos-mios" element={<GastosMios />} />
          <Route path="posnet-diario" element={<ControlPosnetDiario />} />
          <Route path="veps" element={<VEPs />} />
          <Route path="epagos" element={<EPagos />} />
          <Route path="formularios" element={<Formularios />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="planillas" element={<Planillas />} />
          <Route path="historial" element={<HistorialMovimientos />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
