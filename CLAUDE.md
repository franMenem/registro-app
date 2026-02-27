# CLAUDE.md - Contexto Migración RegistroApp a Supabase

**Fecha:** 2026-02-04
**Proyecto:** registroApp
**Objetivo:** Migrar backend de SQLite + Express → Supabase Full Stack
**Deploy:** Vercel

---

## 📊 ESTADO ACTUAL (Actualizado 2026-02-04)

### ✅ MIGRACIÓN COMPLETADA

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1: Setup Supabase | ✅ Completada | Proyecto, schema, RLS, usuario |
| Fase 2: Migración Datos | ✅ Completada | Todas las tablas sincronizadas |
| Fase 3: Cliente Supabase | ✅ Completada | Auth, servicios, cleanup |
| Fase 4: Deploy Vercel | ⏳ Pendiente | Último paso |

### Tech Stack Final
- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS
- **State:** TanStack Query v5 + React Router v6
- **Auth:** ✅ Supabase Auth (implementado)
- **Backend:** ❌ Express ELIMINADO - Ya no se usa
- **Database:** ✅ Supabase (Postgres) - Única fuente de verdad
- **API:** ✅ PostgREST directo + Funciones Postgres (RPC)
- **RLS:** ✅ Configurado y funcionando

---

## 🏗️ ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (React + Vite)                    │
├─────────────────────────────────────────────────────────────┤
│  src/lib/supabase.ts        │  Cliente Supabase             │
│  src/hooks/useAuth.ts       │  Auth hook                    │
│  src/contexts/AuthContext   │  Auth provider                │
│  src/services/supabase/*    │  APIs por módulo              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
├─────────────────────────────────────────────────────────────┤
│  PostgREST                  │  CRUD automático              │
│  Auth                       │  Autenticación                │
│  Funciones Postgres (RPC)   │  Lógica compleja              │
│  RLS                        │  Seguridad por fila           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS (Actualizada)

```
registroApp/
├── client/                         # React Frontend
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.ts        # ✅ Cliente Supabase
│   │   ├── hooks/
│   │   │   └── useAuth.ts         # ✅ Auth hook
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx    # ✅ Auth context provider
│   │   ├── services/
│   │   │   └── supabase/          # ✅ APIs migradas
│   │   │       ├── adelantos.ts
│   │   │       ├── clientes.ts
│   │   │       ├── conceptos.ts
│   │   │       ├── control-efectivo.ts
│   │   │       ├── controles.ts
│   │   │       ├── cuentas-corrientes.ts  # ✅ Con recalcularSaldos
│   │   │       ├── dashboard.ts
│   │   │       ├── depositos.ts           # ✅ Con importarCSV y sincronizar
│   │   │       ├── epagos.ts
│   │   │       ├── formularios.ts
│   │   │       ├── gastos-mios.ts
│   │   │       ├── gastos-personales.ts
│   │   │       ├── gastos-registrales.ts
│   │   │       ├── movimientos-diarios.ts
│   │   │       ├── reportes.ts
│   │   │       └── veps.ts
│   │   └── pages/                 # Todas las páginas migradas
│   ├── .env                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   └── .env.example               # ✅ Actualizado
│
├── supabase/                      # Supabase project
│   └── migrations/
│       ├── 20260203_postgres_functions_batch.sql  # Funciones batch
│       └── 20260204_fix_recalcular_saldos.sql     # ✅ Fix saldos CC
│
├── server/                        # ❌ YA NO SE USA (mantener como backup)
│
├── supabase_schema.sql            # Schema de referencia
├── CLAUDE.md                      # Este archivo
└── MIGRATION_PLAN.md              # Plan detallado de migración
```

---

## 🔧 SERVICIOS SUPABASE IMPLEMENTADOS

### client/src/services/supabase/

| Servicio | Archivo | Métodos |
|----------|---------|---------|
| Adelantos | adelantos.ts | getAll, getById, create, update, delete, getByEmpleado |
| Clientes | clientes.ts | getAll, getById, create, update, delete, search |
| Conceptos | conceptos.ts | getAll |
| Control Efectivo | control-efectivo.ts | getConfig, updateConfig, getMovimientos, createMovimiento |
| Controles | controles.ts | getSemanales, getQuincenales, marcarControlado |
| Cuentas CC | cuentas-corrientes.ts | getAll, getById, getMovimientos, createMovimiento, **recalcularSaldos**, **recalcularTodosLosSaldos** |
| Dashboard | dashboard.ts | getStats, getControlesPendientes, getAlertasPagos |
| Depósitos | depositos.ts | getAll, getById, create, update, delete, liquidar, aFavor, devolver, usarSaldo, asociarCuenta, **sincronizarMovimientos**, **importarCSV** |
| ePagos | epagos.ts | getAll, create, update, delete |
| Formularios | formularios.ts | getAll, getById, create, update, delete, getVencimientos, pagarVencimientos |
| Gastos Mios | gastos-mios.ts | getAll, create, update, delete, getByFecha |
| Gastos Personales | gastos-personales.ts | getAll, create, update, delete |
| Gastos Registrales | gastos-registrales.ts | getAll, create, update, delete |
| Movimientos Diarios | movimientos-diarios.ts | getRentasDiario, getCajaDiario, createMovimiento |
| Reportes | reportes.ts | getEvolucionSaldos, getComparativaMensual, getAnalisisFinanciero |
| VEPs | veps.ts | getAll, create, update, delete |

---

## 🐛 BUG FIX: Saldos Cuentas Corrientes (2026-02-04)

### Problema
Cuando `sincronizarMovimientos()` creaba movimientos desde depósitos, actualizaba `movimientos_cc.saldo_resultante` pero **NO** actualizaba `cuentas_corrientes.saldo_actual`.

Esto causaba que `crear_movimiento_cc()` leyera saldos desactualizados y calculara mal los saldos subsiguientes.

### Ejemplo del Bug
```
ICBC el 2/2: saldo_resultante = 2,756,329.10
Pero cuentas_corrientes.saldo_actual seguía en 10,431.76

El 3/2 se crearon movimientos EGRESO:
- CAJA: 1,389,844.00  → saldo calculado: 10,431.76 - 1,389,844 = -1,379,412.24 (INCORRECTO)
- RENTAS: 755,984.40  → saldo calculado: -1,379,412.24 - 755,984.40 = -2,135,396.64 (INCORRECTO)

Saldo correcto debería ser: 2,756,329.10 - 1,389,844 - 755,984.40 = 610,500.70
```

### Solución Implementada

**1. Funciones Postgres creadas** (`supabase/migrations/20260204_fix_recalcular_saldos.sql`):

```sql
-- Recalcular UNA cuenta
CREATE OR REPLACE FUNCTION recalcular_saldos_cuenta(p_cuenta_id BIGINT)
RETURNS TABLE(
  movimientos_actualizados INT,
  saldo_final NUMERIC(12,2)
)

-- Recalcular TODAS las cuentas
CREATE OR REPLACE FUNCTION recalcular_todos_los_saldos()
RETURNS TABLE(
  cuenta_id BIGINT,
  cuenta_nombre TEXT,
  movimientos INT,
  saldo_anterior NUMERIC(12,2),
  saldo_nuevo NUMERIC(12,2)
)
```

**2. Cliente actualizado** (`client/src/services/supabase/cuentas-corrientes.ts`):

```typescript
// Recalcular saldos de una cuenta
recalcularSaldos: async (cuentaId: number) => {
  const { data, error } = await supabase.rpc('recalcular_saldos_cuenta', {
    p_cuenta_id: cuentaId,
  });
  // ...
},

// Recalcular todas las cuentas
recalcularTodosLosSaldos: async () => {
  const { data, error } = await supabase.rpc('recalcular_todos_los_saldos');
  // ...
},
```

**3. Sincronización actualizada** (`client/src/services/supabase/depositos.ts`):

```typescript
// Después de crear todos los movimientos, recalcular cuentas afectadas
for (const cuentaId of cuentasAfectadas) {
  try {
    await supabase.rpc('recalcular_saldos_cuenta', { p_cuenta_id: cuentaId });
  } catch (err) {
    console.error(`Error recalculando saldos de cuenta ${cuentaId}:`, err);
  }
}
```

### Uso

```typescript
// Recalcular una cuenta específica
const resultado = await cuentasApi.recalcularSaldos(cuentaId);
console.log(`Movimientos: ${resultado.movimientos_actualizados}, Saldo: ${resultado.saldo_final}`);

// Recalcular TODAS las cuentas
const { cuentas, message } = await cuentasApi.recalcularTodosLosSaldos();
cuentas.forEach(c => {
  console.log(`${c.cuenta_nombre}: ${c.saldo_anterior} → ${c.saldo_nuevo}`);
});
```

---

## 🐛 BUG FIX: Formularios Checkbox (2026-02-04)

### Problema
Los checkboxes para marcar vencimientos como pagados solo aparecían para estado `PENDIENTE`, pero no para `VENCIDO`. El usuario no podía pagar vencimientos vencidos.

### Solución
Modificado `Formularios.tsx` línea 711:
```typescript
// Antes
{tabActivo === 'activos' && venc.estado === 'PENDIENTE' && (

// Después
{tabActivo === 'activos' && (venc.estado === 'PENDIENTE' || venc.estado === 'VENCIDO') && (
```

### Datos en Supabase
```
PAGADO: 927 vencimientos → Tab "Históricos"
PENDIENTE: 55 vencimientos → Tab "Activos" (con checkbox)
VENCIDO: 1838 vencimientos → Tab "Activos" (ahora con checkbox)
```

---

## 🗑️ ARCHIVOS ELIMINADOS (Cleanup)

### Eliminados del cliente:
- `client/src/services/api.ts` - Axios API (reemplazado por Supabase)
- `client/src/services/api.ts.bak` - Backup obsoleto
- `client/src/pages/Formularios.tsx.bak` - Backup obsoleto
- `client/src/pages/GastosPersonales.tsx.bak` - Backup obsoleto
- `client/src/pages/EPagos-backup.tsx.skip` - Backup obsoleto
- `client/src/pages/HistorialMovimientos.tsx.skip` - Backup obsoleto

### Eliminados del servidor:
- `server/src/controllers/formularios.controller.ts.bak` - Backup obsoleto

### Dependencia eliminada:
- `axios` removido de `client/package.json`

### Configuración limpiada:
- Proxy `localhost:3000` removido de `client/vite.config.ts`
- `.env.example` actualizado con variables Supabase
- Tab "Historial" eliminado del Sidebar (no era necesario)

---

## 🔌 CONEXIÓN SUPABASE

**Proyecto:** RegistroAPP
**Project ID:** sohcupgwfvwvicnstjto
**Region:** East US (North Virginia)
**Dashboard:** https://supabase.com/dashboard/project/sohcupgwfvwvicnstjto

### Variables de Entorno (.env)
```bash
VITE_SUPABASE_URL=https://sohcupgwfvwvicnstjto.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

---

## 📦 DATOS MIGRADOS

| Tabla | Registros | Status |
|-------|-----------|--------|
| movimientos_cc | 2012+ | ✅ |
| clientes | 18 | ✅ |
| depositos | 1132+ | ✅ |
| gastos_registrales | 384 | ✅ |
| movimientos | 738 | ✅ |
| movimientos_efectivo | 12 | ✅ |
| cuentas_corrientes | 5 | ✅ |
| Todas las demás | - | ✅ |

---

## 🚀 PRÓXIMOS PASOS

### Pendiente: Deploy a Vercel

1. **Crear proyecto en Vercel**
   ```bash
   cd client
   vercel
   ```

2. **Configurar variables de entorno en Vercel:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Build settings:**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Verificar en producción:**
   - Login funciona
   - Datos se cargan
   - Operaciones CRUD funcionan
   - Saldos se calculan correctamente

---

## 🔧 COMANDOS ÚTILES

### Supabase CLI
```bash
# Ver proyectos
supabase projects list

# Linkear proyecto
supabase link --project-ref sohcupgwfvwvicnstjto

# Ejecutar SQL directamente
supabase db execute --linked < migration.sql

# Ver logs
supabase logs --linked
```

### Desarrollo local
```bash
# Iniciar cliente
cd client && npm run dev

# Build para producción
cd client && npm run build

# Preview build
cd client && npm run preview
```

### Recalcular saldos (desde Supabase Dashboard SQL Editor)
```sql
-- Recalcular una cuenta específica
SELECT * FROM recalcular_saldos_cuenta(1);

-- Recalcular TODAS las cuentas
SELECT * FROM recalcular_todos_los_saldos();
```

---

## 📝 LÓGICA DE NEGOCIO: Cuentas Corrientes

### Tipos de Movimiento
- **INGRESO:** Suma al saldo (depósitos de clientes)
- **EGRESO:** Resta del saldo (gastos: caja, rentas, etc.)

### Flujo de Saldos
```
Cliente deposita $100,000 (INGRESO)
  → saldo_resultante = saldo_anterior + 100,000

Se usa para CAJA $30,000 (EGRESO)
  → saldo_resultante = saldo_anterior - 30,000

Se usa para RENTAS $20,000 (EGRESO)
  → saldo_resultante = saldo_anterior - 20,000

Saldo final = 100,000 - 30,000 - 20,000 = 50,000
```

### Sincronización de Depósitos
Cuando se sincroniza un depósito a una cuenta corriente:
1. Se crea movimiento INGRESO por el monto del depósito
2. Se crean movimientos EGRESO por cada concepto (caja, rentas, etc.)
3. Se llama `recalcular_saldos_cuenta()` para recalcular todos los saldos

---

---

## 🚨 REGLAS CRÍTICAS - Funciones Postgres procesar_*_diario (2026-02-09)

### NUNCA reescribir sin verificar TODOS los side-effects

`CREATE OR REPLACE FUNCTION` **pierde todo el contenido anterior**. El commit `9126b3a` introdujo 10 regresiones al reescribir estas funciones sin conservar fixes previos. Esto NO debe volver a pasar.

### procesar_caja_diario DEBE hacer:

| # | Side-effect | Tabla destino |
|---|------------|---------------|
| 1 | INSERT movimientos (conceptos dinámicos via column_key) | `movimientos` |
| 2 | INSERT control_veps y control_epagos (VEP/EPAGOS) | `control_veps`, `control_epagos` |
| 3 | INSERT gastos_deposito (DEPOSITO_1..12 con paréntesis correctos) | `gastos_deposito` |
| 4 | crear_movimiento_cc() para cuentas corrientes | `movimientos_cc` |
| 5 | INSERT gastos_registrales (12 items: LIBRERIA, AGUA, EDESUR, ACARA, CARGAS_SOCIALES, OTROS, SUPERMERCADO, SEC, OSECAC, MARIA, REPO_CAJA_CHICA, REPO_RENTAS_CHICA) | `gastos_registrales` |
| 6 | INSERT gastos_personales (TERE con concepto='Tere', estado='Pagado') | `gastos_personales` |
| 7 | INSERT adelantos_empleados (SOLO DAMI, MUMI - NO Maria, NO Tere) | `adelantos_empleados` |
| 8 | upsert_control_posnet() para POSNET CAJA | `control_posnet_diario` |
| 9 | crear_movimiento_cc('Gastos Formularios', ...) para Formularios | `movimientos_cc` |
| 10 | INSERT movimientos_efectivo (efectivo entregado) | `movimientos_efectivo` |

### procesar_rentas_diario DEBE hacer:

| # | Side-effect | Tabla destino |
|---|------------|---------------|
| 1 | INSERT movimientos (conceptos dinámicos via column_key) | `movimientos` |
| 2 | INSERT gastos_deposito (DEPOSITO_1..12) | `gastos_deposito` |
| 3 | crear_movimiento_cc() para cuentas corrientes (ICBC inline + resto en loop) | `movimientos_cc` |
| 4 | upsert_control_posnet() para POSNET | `control_posnet_diario` |
| 5 | INSERT movimientos_efectivo | `movimientos_efectivo` |

### Errores comunes a evitar:

1. **Paréntesis en depósitos**: `p_values->>('DEPOSITO_' || v_i)` (CON paréntesis). Sin ellos concatena al resultado, no al key.
2. **MARIA va a gastos_registrales**, NO a adelantos_empleados.
3. **TERE va a gastos_personales**, NO a adelantos_empleados.
4. **VEP/EPAGOS son items estáticos del UI**, NO conceptos de la tabla. Si se insertan en `conceptos` con tipo CAJA/RENTAS, aparecen como inputs duplicados.
5. **Triggers automáticos**: `trg_sync_controles` en `movimientos` sincroniza controles semanales/quincenales. NO llamar manualmente a `upsert_control_semanal/quincenal` (doble conteo).
6. **gastos_deposito cleanup**: Antes de insertar depósitos, hacer `DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'CAJA'/'RENTAS'` para re-submissions.

### Mapeos en planillas.ts (lectura):

Los datos se leen de vuelta en `planillas.ts` para mostrar en la página Planillas. Los mapeos deben coincidir con cómo se guardan:

| Dato | Se guarda en | Campo concepto en DB | Key en planilla |
|------|-------------|---------------------|-----------------|
| SUPERMERCADO | gastos_registrales | 'Supermercado' | SUPERMERCADO |
| MARIA | gastos_registrales | 'Maria' | MARIA |
| TERE | gastos_personales | 'Tere' | TERE |
| DAMI, MUMI | adelantos_empleados | 'Dami'/'Mumi' | DAMI/MUMI |
| DEPOSITO_N | gastos_deposito | numero_deposito=N | DEPOSITO_N |

---

---

## 🏛️ PRINCIPIOS DE CÓDIGO OBLIGATORIOS

Estos principios se aplican a **TODO** código generado o modificado. No son sugerencias, son reglas.

### SOLID
- **S - Single Responsibility:** Cada función/componente hace UNA cosa. Si necesitás describir con "y", dividilo.
- **O - Open/Closed:** Extender comportamiento sin modificar código existente. Usar composición y props.
- **L - Liskov Substitution:** Los subtipos deben ser intercambiables con sus tipos base.
- **I - Interface Segregation:** Interfaces/types pequeños y específicos. No forzar dependencias innecesarias.
- **D - Dependency Inversion:** Depender de abstracciones, no de implementaciones concretas.

### Otros principios obligatorios
- **DRY:** No duplicar lógica. Extraer funciones reutilizables cuando hay repetición real (no preventiva).
- **KISS:** La solución más simple que funcione. No sobre-ingeniar.
- **YAGNI:** No construir para requisitos futuros hipotéticos. Solo lo que se necesita ahora.
- **Clean Code:** Nombres descriptivos, funciones cortas, sin comentarios obvios, sin código muerto.

### ✅ CHECKLIST OBLIGATORIO — ejecutar ANTES y DESPUÉS de cada cambio

**ANTES de escribir código:**
- [ ] ¿La función/componente tiene UNA sola responsabilidad? (S)
- [ ] ¿Estoy extendiendo sin romper lo existente? (O)
- [ ] ¿Puedo reusar algo que ya existe, o estoy duplicando? (DRY)
- [ ] ¿Es la solución más simple posible para el problema actual? (KISS)
- [ ] ¿Estoy construyendo algo que no se necesita hoy? Si sí → no lo hagas (YAGNI)

**DESPUÉS de escribir código:**
- [ ] ¿El componente/función mezcla responsabilidades? Si sí → separar (S)
- [ ] ¿Rompí algún contrato existente (props, tipos, returns)? Si sí → corregir (L)
- [ ] ¿Agregué a una interfaz algo que no todos los consumidores necesitan? Si sí → segregar (I)
- [ ] ¿La lógica depende de implementaciones concretas en vez de abstracciones? (D)
- [ ] ¿Quedó código muerto, imports sin uso, o variables temporales? → limpiar

**Regla de oro:** Si no podés explicar el cambio en una oración sin usar "y también", revisá SRP.

---

**Última actualización:** 2026-02-26 - Checklist SOLID obligatorio pre/post implementación
