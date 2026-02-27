import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FormularioRentas = lazy(() => import('./pages/FormularioRentas'));
const FormularioCaja = lazy(() => import('./pages/FormularioCaja'));
const CuentasCorrientes = lazy(() => import('./pages/CuentasCorrientes'));
const Depositos = lazy(() => import('./pages/Depositos'));
const DepositosImport = lazy(() => import('./pages/DepositosImport'));
const GastosRegistro = lazy(() => import('./pages/GastosRegistro'));
const GastosPersonales = lazy(() => import('./pages/GastosPersonales'));
const GastosMios = lazy(() => import('./pages/GastosMios'));
const ControlPosnetDiario = lazy(() => import('./pages/ControlPosnetDiario'));
const Formularios = lazy(() => import('./pages/Formularios'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Planillas = lazy(() => import('./pages/Planillas'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const VEPs = lazy(() => import('./pages/VEPs'));
const EPagos = lazy(() => import('./pages/EPagos'));
const ControlEfectivo = lazy(() => import('./pages/ControlEfectivo'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
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
              <Route path="reportes" element={<Reportes />} />
              <Route path="configuracion" element={<Configuracion />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
