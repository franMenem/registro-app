import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import FormularioRentas from './pages/FormularioRentas';
import FormularioCaja from './pages/FormularioCaja';
import CuentasCorrientes from './pages/CuentasCorrientes';
import Planillas from './pages/Planillas';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="rentas" element={<FormularioRentas />} />
          <Route path="caja" element={<FormularioCaja />} />
          <Route path="cuentas" element={<CuentasCorrientes />} />
          <Route path="planillas" element={<Planillas />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
