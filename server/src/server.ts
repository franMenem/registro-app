import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database';
import { errorHandler } from './middleware/errorHandler';

// Routes
import movimientosRoutes from './routes/movimientos.routes';
import conceptosRoutes from './routes/conceptos.routes';
import cuentasRoutes from './routes/cuentas.routes';
import controlesRoutes from './routes/controles.routes';
import dashboardRoutes from './routes/dashboard.routes';
import depositosRoutes from './routes/depositos.routes';
import gastosRegistralesRoutes from './routes/gastos-registrales.routes';
import adelantosRoutes from './routes/adelantos.routes';
import posnetDiarioRoutes from './routes/posnet-diario.routes';
import formulariosRoutes from './routes/formularios.routes';
import gastosPersonalesRoutes from './routes/gastos-personales.routes';
import clientesRoutes from './routes/clientes.routes';
import adminRoutes from './routes/admin.routes';
import vepsRoutes from './routes/veps.routes';
import epagosRoutes from './routes/epagos.routes';
import migracionRoutes from './routes/migracion.routes';
import efectivoRoutes from './routes/efectivo.routes';
import planillasRoutes from './routes/planillas.routes';
import reportesRoutes from './routes/reportes.routes';

// Load environment variables
dotenv.config();

// Initialize database
initDatabase();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Registro App API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/conceptos', conceptosRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/controles', controlesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/depositos', depositosRoutes);
app.use('/api/gastos-registrales', gastosRegistralesRoutes);
app.use('/api/adelantos', adelantosRoutes);
app.use('/api/posnet-diario', posnetDiarioRoutes);
app.use('/api/formularios', formulariosRoutes);
app.use('/api/gastos-personales', gastosPersonalesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/veps', vepsRoutes);
app.use('/api/epagos', epagosRoutes);
app.use('/api/migracion', migracionRoutes);
app.use('/api/efectivo', efectivoRoutes);
app.use('/api/planillas', planillasRoutes);
app.use('/api/reportes', reportesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   Registro App API                    ║
║   Server running on port ${PORT}       ║
║   Environment: ${process.env.NODE_ENV || 'development'}            ║
╚═══════════════════════════════════════╝
  `);
});

export default app;
