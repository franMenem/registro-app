# Guía de Instalación y Configuración

## Requisitos Previos

- Node.js 18+ instalado
- npm o yarn

## Instalación

### 1. Instalar todas las dependencias

```bash
# Instalar dependencias del proyecto raíz
npm install

# Instalar dependencias del cliente
cd client && npm install

# Instalar dependencias del servidor
cd ../server && npm install
```

### 2. Configurar variables de entorno

Los archivos `.env` ya están creados con las configuraciones por defecto:

**Server (.env):**
```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./registro.db
```

**Client (.env):**
```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Inicializar la base de datos

```bash
cd server
npm run db:init
```

Este comando:
- Crea la base de datos SQLite (`registro.db`)
- Ejecuta el schema (crea todas las tablas)
- Ejecuta el seed (inserta datos iniciales: conceptos y cuentas)

## Ejecución

### Modo Desarrollo (Recomendado)

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto ejecuta simultáneamente:
- **Frontend (Vite):** http://localhost:5173
- **Backend (Express):** http://localhost:3000

### Modo Desarrollo Individual

**Solo Frontend:**
```bash
cd client
npm run dev
```

**Solo Backend:**
```bash
cd server
npm run dev
```

## Verificación

### 1. Health Check del API

Abre en tu navegador o usa curl:

```bash
curl http://localhost:3000/api/health
```

Deberías ver:
```json
{
  "status": "ok",
  "message": "Registro App API is running",
  "timestamp": "2026-01-27T..."
}
```

### 2. Verificar Conceptos

```bash
curl http://localhost:3000/api/conceptos
```

Deberías ver 16 conceptos (10 RENTAS + 6 CAJA).

### 3. Verificar Cuentas Corrientes

```bash
curl http://localhost:3000/api/cuentas
```

Deberías ver 8 cuentas corrientes.

### 4. Abrir el Frontend

Abre tu navegador en: http://localhost:5173

Verás el Dashboard con las 4 métricas principales.

## Pruebas del Flujo Completo

### Test 1: Crear Movimiento RENTAS con GIT

1. Ve a "Formulario RENTAS" (http://localhost:5173/rentas)
2. Completa el formulario:
   - Fecha: Hoy
   - CUIT: 20-12345678-9
   - Concepto: GIT
   - Monto: 1000
3. Click en "Guardar"
4. Verás una confirmación y un mensaje de alerta indicando que se creó el control semanal

### Test 2: Verificar Control Semanal

1. Ve a "Planillas" (http://localhost:5173/planillas)
2. En la tabla "Controles Semanales" deberías ver:
   - GIT con el monto registrado
   - Fecha de pago programada (próximo lunes)
   - Estado: Pendiente

### Test 3: Movimiento ICBC (va a Cuenta Corriente)

1. Ve a "Formulario RENTAS"
2. Completa:
   - CUIT: 20-12345678-9
   - Concepto: ICBC
   - Monto: 500
3. Guardar
4. Verás alerta: "Egreso registrado en cuenta corriente 'Gastos Bancarios'"
5. Ve a "Cuentas Corrientes" → Tab "Gastos Bancarios"
6. Verás el movimiento de egreso por $500
7. El saldo debería ser -$500

### Test 4: Control Quincenal (ARBA)

1. Ve a "Formulario RENTAS"
2. Completa:
   - Concepto: PROVINCIA (ARBA)
   - Monto: 2000
3. Guardar
4. Ve a "Planillas" → "Controles Quincenales"
5. Verás el control de ARBA con fecha de pago 5 días corridos después del fin de quincena

### Test 5: Dashboard

1. Regresa al Dashboard (/)
2. Verifica que las métricas se actualicen:
   - Total RENTAS Hoy: suma de todos los movimientos RENTAS de hoy
   - Movimientos Hoy: cantidad total
3. La tabla "Últimos Movimientos" muestra todos los movimientos creados

## Estructura de URLs

- `/` - Dashboard
- `/rentas` - Formulario RENTAS
- `/caja` - Formulario CAJA
- `/cuentas` - Cuentas Corrientes (8 tabs)
- `/planillas` - Controles semanales y quincenales
- `/reportes` - Reportes (placeholder para fase 2)
- `/configuracion` - Configuración (placeholder para fase 2)

## API Endpoints Disponibles

### Movimientos
- `GET /api/movimientos` - Listar movimientos (con filtros)
- `POST /api/movimientos` - Crear movimiento
- `GET /api/movimientos/:id` - Obtener movimiento
- `PUT /api/movimientos/:id` - Actualizar movimiento
- `DELETE /api/movimientos/:id` - Eliminar movimiento

### Conceptos
- `GET /api/conceptos?tipo=RENTAS|CAJA` - Listar conceptos

### Cuentas Corrientes
- `GET /api/cuentas` - Listar cuentas
- `GET /api/cuentas/:id` - Obtener cuenta
- `GET /api/cuentas/:id/movimientos` - Movimientos de cuenta
- `POST /api/cuentas/:id/movimientos` - Crear movimiento manual

### Controles
- `GET /api/controles/semanales` - Listar controles semanales
- `GET /api/controles/quincenales` - Listar controles quincenales
- `GET /api/controles/posnet` - Listar controles POSNET
- `PUT /api/controles/semanales/:id/pagar` - Marcar como pagado
- `PUT /api/controles/quincenales/:id/pagar` - Marcar como pagado

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas del dashboard

## Build para Producción

### Backend
```bash
cd server
npm run build
npm start
```

### Frontend
```bash
cd client
npm run build
```

Los archivos se generarán en `client/dist/` y pueden ser servidos con cualquier servidor web estático.

## Troubleshooting

### Error de compilación en better-sqlite3

Si tienes problemas instalando `better-sqlite3`, asegúrate de tener:
- Node.js 18+
- Python 3 instalado
- En macOS: Xcode Command Line Tools (`xcode-select --install`)

### Puerto ya en uso

Si los puertos 3000 o 5173 están ocupados:

1. Cambia el puerto del servidor en `server/.env`:
   ```env
   PORT=3001
   ```

2. Actualiza la URL del API en `client/.env`:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

### Base de datos corrupta

Si necesitas resetear la base de datos:
```bash
cd server
rm registro.db
npm run db:init
```

## Soporte

Para reportar problemas o solicitar ayuda, contacta al equipo de desarrollo.
