# Changelog

## [Unreleased]

### Added
- **Supabase Auth**: Sistema de autenticación completo
  - Login page (`/login`)
  - Protected routes (redirect automático si no autenticado)
  - Logout button en header
  - Session persistence via Supabase
- **Supabase Client**: Cliente configurado para queries directas
  - `client/src/lib/supabase.ts`
  - `client/src/services/supabase/gastos-mios.ts`
- **Auth Hooks & Context**
  - `useAuth` hook para manejo de sesión
  - `AuthContext` para estado global
  - `ProtectedRoute` component

### Changed
- **Gastos Mios**: Refactorizado para usar Supabase directamente (sin Express)
  - Queries via PostgREST
  - Resumen calculado client-side
- **Header**: Muestra email del usuario + botón logout

### Security
- RLS policies activas en Supabase (requiere `auth.uid()`)
- Env vars validadas al inicio

---

## Migración SQLite → Supabase

### Datos Migrados
- `movimientos_cc`: 2012 registros
- `clientes`: 18 registros
- `depositos`: 1132 registros
- `gastos_registrales`: 384 registros
- `movimientos`: 738 registros
- `movimientos_efectivo`: 12 registros

### Pendiente
- Refactorizar otros módulos CRUD (VEPs, ePagos, Clientes, etc.)
- Edge Functions para lógica compleja
- Eliminar backend Express cuando todo migrado
