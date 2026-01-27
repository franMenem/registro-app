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
