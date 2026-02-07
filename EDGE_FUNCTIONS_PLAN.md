# Plan: Postgres Functions para Integridad Transaccional

**Fecha:** 2026-02-03
**Estado:** ✅ Implementado - Opción B (Solo Postgres RPC)
**Progreso:** `100%`

---

## 🎯 Objetivo

Crear Postgres Functions para las operaciones batch que requieren integridad transaccional.

**Problema resuelto:** `movimientos.ts` ejecutaba 10+ inserts individuales sin transacción. Si fallaba una operación intermedia, los datos quedaban inconsistentes.

**Solución implementada:** Postgres Functions con transacciones automáticas. Si cualquier operación falla, todo se revierte automáticamente.

---

## ✅ Implementación Completada

### Archivos Creados/Modificados

| Archivo | Cambio | Estado |
|---------|--------|--------|
| `supabase/migrations/20260203_postgres_functions_batch.sql` | Nuevas funciones Postgres | ✅ Creado |
| `client/src/services/supabase/movimientos.ts` | Usar RPC en lugar de inserts | ✅ Modificado |

---

## 📦 Postgres Functions Creadas

### Funciones Helper (Reutilizables)

```sql
-- Cálculo de fechas para controles
get_next_monday(p_date DATE) → DATE
get_week_start(p_date DATE) → DATE
get_week_end(p_date DATE) → DATE
get_quincena_info(p_date DATE) → TABLE(quincena, mes, anio, fecha_inicio, fecha_fin, fecha_pago)

-- Operaciones UPSERT atómicas
upsert_control_semanal(p_concepto_id, p_fecha, p_monto) → VOID
upsert_control_quincenal(p_concepto_id, p_fecha, p_monto) → VOID
upsert_control_posnet(p_fecha, p_monto, p_tipo) → VOID
crear_movimiento_cc(p_cuenta_nombre, p_fecha, p_tipo, p_concepto, p_monto) → BIGINT
```

### Funciones Principales

```sql
-- Procesa formulario RENTAS diario con transacción completa
procesar_rentas_diario(p_fecha DATE, p_values JSONB, p_entregado NUMERIC)
RETURNS JSONB

-- Procesa formulario CAJA diario con transacción completa
procesar_caja_diario(p_fecha DATE, p_values JSONB, p_entregado NUMERIC)
RETURNS JSONB
```

---

## 🔄 Cambio en Cliente

### Antes (10+ llamadas sin transacción)
```typescript
createRentasDiario: async (payload) => {
  // Insert movimiento 1
  await supabase.from('movimientos').insert(...);
  // Insert movimiento 2
  await supabase.from('movimientos').insert(...);
  // Update control semanal
  await supabase.from('controles_semanales').upsert(...);
  // ... 7+ operaciones más sin rollback
}
```

### Después (1 llamada transaccional)
```typescript
createRentasDiario: async (payload) => {
  const { data, error } = await supabase.rpc('procesar_rentas_diario', {
    p_fecha: fecha,
    p_values: values,
    p_entregado: entregado,
  });

  if (error) throw new Error(error.message);
  return data;
}
```

---

## 🚀 Deploy Pendiente

Para activar las funciones en Supabase:

```bash
# Opción 1: Push directo (desarrollo)
supabase db push

# Opción 2: Ejecutar migración manualmente
# Copiar contenido de supabase/migrations/20260203_postgres_functions_batch.sql
# Pegarlo en Supabase Dashboard → SQL Editor → Ejecutar
```

---

## 📊 Beneficios Obtenidos

| Aspecto | Antes | Después |
|---------|-------|---------|
| Llamadas de red | 10+ | 1 |
| Transaccionalidad | ❌ No | ✅ Sí |
| Si falla insert #5 | Inserts 1-4 quedan | Todo se revierte |
| Performance | Lenta | Rápida |
| Código cliente | ~400 líneas | ~30 líneas |

---

## ⚠️ Nota Importante

Los movimientos **individuales** (función `create`) siguen usando la lógica client-side con helpers locales. Esto es intencional porque:

1. Son operaciones simples de 2-3 inserts
2. Tienen lógica de negocio específica por concepto
3. El usuario ve alertas en tiempo real

Si se requiere transaccionalidad para movimientos individuales, se puede crear una función `procesar_movimiento_individual()` siguiendo el mismo patrón.

---

## 📋 Checklist Final

- [x] Crear funciones helper Postgres
- [x] Crear `procesar_rentas_diario()`
- [x] Crear `procesar_caja_diario()`
- [x] Actualizar `movimientos.ts` para usar RPC
- [x] Verificar build compila
- [x] Ejecutar migración en Supabase ✅
- [x] Testing en ambiente real ✅ (RENTAS + CAJA funcionando)

---

**Decisión tomada:** Opción B (Solo Postgres RPC) - más simple, suficiente para este caso de uso.
