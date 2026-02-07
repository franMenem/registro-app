# Supabase Migration Plan

**Overall Progress:** `25%`

## TLDR
Migrar registroApp de SQLite + Express a Supabase Full Stack. Eliminar backend Express, usar PostgREST para CRUD simple y Edge Functions para lógica compleja. Deploy en Vercel.

## Critical Decisions
- **Auth:** Supabase Auth con RLS (requiere `auth.uid()` en policies)
- **CRUD Simple:** PostgREST directo desde cliente (sin Edge Functions)
- **Lógica Compleja:** Edge Functions para recálculos, liquidaciones, etc.
- **Migración Incremental:** Módulo por módulo, Express sigue corriendo hasta completar

---

## Tasks:

- [x] 🟩 **Step 1: Setup Inicial**
  - [x] 🟩 Crear proyecto Supabase
  - [x] 🟩 Migrar schema (20 tablas)
  - [x] 🟩 Configurar RLS policies
  - [x] 🟩 Instalar @supabase/supabase-js

- [x] 🟩 **Step 2: Migrar Datos**
  - [x] 🟩 Export SQLite → Import Supabase (todas las tablas)
  - [x] 🟩 Validar integridad (conteos coinciden)

- [x] 🟩 **Step 3: Auth Flow**
  - [x] 🟩 Cliente Supabase (`lib/supabase.ts`)
  - [x] 🟩 useAuth hook
  - [x] 🟩 AuthContext provider
  - [x] 🟩 ProtectedRoute component
  - [x] 🟩 Login page
  - [x] 🟩 Logout en Header

- [x] 🟩 **Step 4: Primer Módulo CRUD (Gastos Mios)**
  - [x] 🟩 Servicio Supabase (`services/supabase/gastos-mios.ts`)
  - [x] 🟩 Refactor página para usar servicio
  - [x] 🟩 Probar CRUD completo

- [ ] 🟥 **Step 5: Módulos CRUD Simples**
  - [ ] 🟥 VEPs (`control_veps`)
  - [ ] 🟥 ePagos (`control_epagos`)
  - [ ] 🟥 Clientes
  - [ ] 🟥 Adelantos
  - [ ] 🟥 Gastos Registrales
  - [ ] 🟥 Gastos Personales
  - [ ] 🟥 Control Efectivo
  - [ ] 🟥 Conceptos

- [ ] 🟥 **Step 6: Edge Functions (Lógica Compleja)**
  - [ ] 🟥 `recalcular-saldos` (Cuentas Corrientes)
  - [ ] 🟥 `liquidar-deposito` (Depósitos)
  - [ ] 🟥 `pagar-vencimientos` (Formularios)
  - [ ] 🟥 `movimientos-diarios` (Rentas/Caja)
  - [ ] 🟥 `sincronizar-depositos`

- [ ] 🟥 **Step 7: Módulos Complejos**
  - [ ] 🟥 Cuentas Corrientes (usa Edge Function)
  - [ ] 🟥 Depósitos (usa Edge Function)
  - [ ] 🟥 Formularios (usa Edge Function)
  - [ ] 🟥 Movimientos Diarios
  - [ ] 🟥 Dashboard
  - [ ] 🟥 Reportes

- [ ] 🟥 **Step 8: Realtime (Opcional)**
  - [ ] 🟥 Habilitar en tablas críticas
  - [ ] 🟥 Subscriptions en componentes

- [ ] 🟥 **Step 9: Cleanup & Deploy**
  - [ ] 🟥 Eliminar backend Express
  - [ ] 🟥 Eliminar axios del cliente
  - [ ] 🟥 Configurar Vercel
  - [ ] 🟥 Deploy producción
  - [ ] 🟥 Validar en prod

---

## Notas
- El backend Express sigue necesario hasta completar Step 7
- Cada módulo se puede probar independientemente
- RLS ya configurado - usuarios deben estar logueados
