# Supabase Migration Plan - RegistroApp

**Overall Progress:** `100%` - Fase 2 Completada

## TLDR
Migrar el frontend de registroApp de axios + Express API a Supabase PostgREST directo. El backend Express se eliminará. Las páginas restantes requieren nuevos servicios Supabase y algunas necesitan Edge Functions para lógica compleja.

## Critical Decisions
- **PostgREST para CRUD simple**: Queries directas desde el cliente, sin backend intermedio
- **Edge Functions para lógica compleja**: Planillas, movimientos diarios, y reportes
- **RLS ya configurado**: Auth con `auth.uid() IS NOT NULL` en todas las tablas
- **Sin migración de datos pendiente**: La base ya está en Supabase (verificar `movimientos_cc`)

---

## Tasks:

### Fase 1: Setup y Módulos CRUD (Completado)

- [x] 🟩 **Step 1: Setup Supabase Client**
  - [x] 🟩 Crear `lib/supabase.ts` con cliente
  - [x] 🟩 Configurar variables de entorno

- [x] 🟩 **Step 2: Servicios CRUD Simples**
  - [x] 🟩 VEPs, ePagos, Clientes
  - [x] 🟩 Gastos (Registrales, Personales, Mios)
  - [x] 🟩 Adelantos, Control Efectivo, Conceptos

- [x] 🟩 **Step 3: Módulos Complejos - Primera Ola**
  - [x] 🟩 Cuentas Corrientes (service + page)
  - [x] 🟩 Depósitos (service + page)
  - [x] 🟩 Controles Semanales/Quincenales (service)
  - [x] 🟩 Dashboard (service + page)

---

### Fase 2: Módulos Pendientes

- [x] 🟩 **Step 4: Servicio Movimientos Diarios**
  - [x] 🟩 Crear `movimientos.ts` para CRUD de movimientos
  - [x] 🟩 Queries por fecha, tipo, concepto
  - [x] 🟩 Batch operations (createRentasDiario, createCajaDiario)
  - [x] 🟩 Control updates (semanal, quincenal, POSNET)
  - [x] 🟩 Account movements integration

- [x] 🟩 **Step 4.1: Review Fixes (movimientos.ts)**
  - [x] 🟩 Eliminar import no usado (controlesApi)
  - [x] 🟩 Reemplazar console.error con manejo de errores
  - [x] 🟩 Cambiar tipo `string` a `TipoMovimiento` en filters
  - [x] 🟩 Agregar manejo de errores en inserts secundarios

- [x] 🟩 **Step 4.2: Postgres Functions para Transacciones**
  - [x] 🟩 Crear `procesar_rentas_diario()` con transacción completa
  - [x] 🟩 Crear `procesar_caja_diario()` con transacción completa
  - [x] 🟩 Helpers: `upsert_control_semanal`, `upsert_control_quincenal`, `upsert_control_posnet`
  - [x] 🟩 Actualizar `movimientos.ts` para usar `supabase.rpc()`
  - [x] 🟩 Deploy migración a Supabase ✅

- [x] 🟩 **Step 5: Servicio Planillas**
  - [x] 🟩 Crear `planillas.ts` para agregaciones diarias
  - [x] 🟩 Queries de Rentas y Caja por rango de fechas
  - [x] 🟩 Update de valores diarios

- [x] 🟩 **Step 6: Migrar FormularioRentas.tsx**
  - [x] 🟩 Cambiar axios a servicio Supabase
  - [x] 🟩 Mantener lógica de cálculos automáticos

- [x] 🟩 **Step 7: Migrar FormularioCaja.tsx**
  - [x] 🟩 Cambiar axios a servicio Supabase
  - [x] 🟩 Mantener lógica de cálculos automáticos

- [x] 🟩 **Step 8: Migrar Planillas.tsx**
  - [x] 🟩 Cambiar axios a servicio Supabase
  - [x] 🟩 Actualizar queries de grilla

- [x] 🟩 **Step 9: Servicio Formularios (Vencimientos)**
  - [x] 🟩 Crear `formularios.ts` para formularios y vencimientos
  - [x] 🟩 Lógica de pago múltiple de vencimientos

- [x] 🟩 **Step 10: Migrar Formularios.tsx**
  - [x] 🟩 Cambiar a servicio Supabase
  - [x] 🟩 Mantener flujo de pago

- [x] 🟩 **Step 11: Servicio Control POSNET**
  - [x] 🟩 Crear `control-posnet.ts` para POSNET diario
  - [x] 🟩 Agregaciones mensuales

- [x] 🟩 **Step 12: Migrar ControlPosnetDiario.tsx**
  - [x] 🟩 Cambiar a servicio Supabase

- [x] 🟩 **Step 13: Servicio Reportes**
  - [x] 🟩 Crear `reportes.ts` para análisis financieros
  - [x] 🟩 Queries de evolución, comparativas

- [x] 🟩 **Step 14: Migrar Reportes.tsx**
  - [x] 🟩 Cambiar a servicio Supabase

- [x] 🟩 **Step 15: Migrar Configuracion.tsx**
  - [x] 🟩 Cambiar a servicios Supabase existentes
  - [x] 🟩 Crear admin.ts para operaciones de limpieza

---

### Fase 3: Limpieza y Deploy

- [x] 🟩 **Step 16: Eliminar código legacy**
  - [x] 🟩 Eliminar `services/api.ts`
  - [x] 🟩 Eliminar dependencia axios
  - [x] 🟩 Limpiar archivos .bak y .skip

- [x] 🟩 **Step 17: Testing Final**
  - [x] 🟩 Verificar todas las páginas funcionan (19 páginas, todas con imports Supabase)
  - [x] 🟩 Verificar build sin errores (TypeScript ✅, Vite ✅)
  - [x] 🟩 Dev server inicia correctamente

- [ ] 🟥 **Step 18: Deploy a Vercel**
  - [ ] 🟥 Configurar variables de entorno
  - [ ] 🟥 Deploy y validación

---

## Archivos Migrados

| Archivo | Servicio Requerido | Complejidad | Estado |
|---------|-------------------|-------------|--------|
| FormularioRentas.tsx | movimientos.ts | 🔴 Alta | ✅ Migrado |
| FormularioCaja.tsx | movimientos.ts | 🔴 Alta | ✅ Migrado |
| Planillas.tsx | planillas.ts | 🔴 Alta | ✅ Migrado |
| Formularios.tsx | formularios.ts | 🔴 Alta | ✅ Migrado |
| Reportes.tsx | reportes.ts | 🔴 Alta | ✅ Migrado |
| ControlPosnetDiario.tsx | control-posnet.ts | 🟡 Media | ✅ Migrado |
| Configuracion.tsx | admin.ts | 🟢 Baja | ✅ Migrado |
| DepositosImport.tsx | depositos.ts | 🟢 Baja | ✅ Migrado |

## Servicios Supabase Existentes

```
client/src/services/supabase/
├── index.ts           ✅ Exports centralizados
├── veps.ts            ✅
├── epagos.ts          ✅
├── clientes.ts        ✅
├── adelantos.ts       ✅
├── gastos-registrales.ts ✅
├── gastos-personales.ts  ✅
├── gastos-mios.ts     ✅
├── control-efectivo.ts   ✅
├── conceptos.ts       ✅
├── cuentas-corrientes.ts ✅
├── depositos.ts       ✅
├── controles.ts       ✅
├── dashboard.ts       ✅
├── movimientos.ts     ✅ (CRUD + batch operations)
├── planillas.ts       ✅
├── formularios.ts     ✅
├── control-posnet.ts  ✅
├── reportes.ts        ✅
└── admin.ts           ✅
```

---

## Code Review Notes

### movimientos.ts ✅ All issues fixed
- ~~**MEDIUM**: Unused import `controlesApi`~~ ✅ Removed
- ~~**MEDIUM**: 2x `console.error` statements in production code~~ ✅ Replaced with alertas
- ~~**MEDIUM**: Filter `tipo` should be `TipoMovimiento` not `string`~~ ✅ Fixed
- ~~**LOW**: Multiple unchecked insert errors~~ ✅ Added error handling with alertas

### ✅ Transactional Integrity - SOLVED
~~Las operaciones batch (createRentasDiario, createCajaDiario) no tienen integridad transaccional.~~

**Solución implementada:** Postgres Functions con transacciones automáticas.
- `procesar_rentas_diario()` y `procesar_caja_diario()` ejecutan todo en una transacción
- Si cualquier operación falla, todo se revierte automáticamente
- Ver `EDGE_FUNCTIONS_PLAN.md` para detalles

**Migración desplegada y testeada:**
```
supabase/migrations/20260203_postgres_functions_batch.sql ✅
```

**Testing:** FormularioRentas ✅ | FormularioCaja ✅

### ✅ Bug Corregido: Cuentas Corrientes
**Problema original:** Los saldos en `cuentas_corrientes` se calculaban mal cuando se creaban movimientos desde los formularios CAJA/RENTAS.

**Causa:** `sincronizarMovimientos()` y otras funciones creaban movimientos pero NO actualizaban `cuentas_corrientes.saldo_actual`, causando que `crear_movimiento_cc()` leyera saldos desactualizados.

**Solución implementada (2026-02-04):**
1. ✅ Función Postgres `recalcular_saldos_cuenta(cuenta_id)` - recalcula saldos de una cuenta
2. ✅ Función Postgres `recalcular_todos_los_saldos()` - recalcula todas las cuentas
3. ✅ `sincronizarMovimientos()` ahora llama a `recalcular_saldos_cuenta` después de crear movimientos
4. ✅ Métodos `cuentasApi.recalcularSaldos()` y `cuentasApi.recalcularTodosLosSaldos()` en el cliente
