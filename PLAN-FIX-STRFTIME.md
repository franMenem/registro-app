# Fix strftime() → Postgres EXTRACT()

**Overall Progress:** `100%`

## TLDR
Reemplazar 23 usos de `strftime()` (SQLite) por `EXTRACT()` y `TO_CHAR()` (Postgres) para que los filtros por mes/año y las sumas funcionen correctamente en Supabase.

## Critical Decisions
- **Usar EXTRACT() para comparaciones numéricas** - Más eficiente que TO_CHAR para filtros WHERE
- **Usar TO_CHAR() para formateo de strings** - Para agrupar por mes como '01', '02', etc.
- **Mantener compatibilidad de tipos** - EXTRACT retorna numeric, castear a INTEGER donde sea necesario

## Mapeo de Conversiones

| SQLite | Postgres | Uso |
|--------|----------|-----|
| `strftime('%m', fecha)` | `EXTRACT(MONTH FROM fecha)` | Filtro/comparación |
| `strftime('%Y', fecha)` | `EXTRACT(YEAR FROM fecha)` | Filtro/comparación |
| `strftime('%Y-%m', fecha)` | `TO_CHAR(fecha, 'YYYY-MM')` | Agrupación/formateo |
| `CAST(strftime('%m', fecha) AS INTEGER)` | `EXTRACT(MONTH FROM fecha)::INTEGER` | Ya es numérico |

---

## Tasks

- [x] 🟩 **Step 1: gastos-mios.service.ts** (5 cambios)
  - [x] 🟩 Línea 27: Filtro mes/año en getGastosMios()
  - [x] 🟩 Línea 243: COUNT DISTINCT meses
  - [x] 🟩 Líneas 279, 282, 283: Reporte mensual

- [x] 🟩 **Step 2: gastos-personales.service.ts** (4 cambios)
  - [x] 🟩 Línea 36: Filtro mes/año en getGastosPersonales()
  - [x] 🟩 Líneas 205, 219, 258: Queries con filtro mes/año

- [x] 🟩 **Step 3: gastos-registrales.service.ts** (5 cambios)
  - [x] 🟩 Línea 25: Filtro mes/año en getGastosRegistrales()
  - [x] 🟩 Líneas 209-210, 221-222: Queries adelantos

- [x] 🟩 **Step 4: adelantos.service.ts** (3 cambios)
  - [x] 🟩 Líneas 153-154: Filtro mes/año
  - [x] 🟩 Línea 170: Filtro año

- [x] 🟩 **Step 5: reportes.service.ts** (3 cambios)
  - [x] 🟩 Líneas 315, 320, 321: Reporte depósitos por mes

- [x] 🟩 **Step 6: admin.routes.ts** (6 cambios)
  - [x] 🟩 Línea 70: Limpieza gastos registrales (SELECT)
  - [x] 🟩 Línea 82: Limpieza gastos registrales (DELETE)
  - [x] 🟩 Línea 123: Limpieza gastos personales

- [ ] 🟥 **Step 7: Testing**
  - [ ] 🟥 Verificar filtros por mes/año funcionan
  - [ ] 🟥 Verificar sumas anuales aparecen
  - [ ] 🟥 Verificar reportes mensuales

---

## Archivos Modificados (6 total, 23 cambios)

| Archivo | Cambios | Estado |
|---------|---------|--------|
| gastos-mios.service.ts | 5 | 🟩 Done |
| gastos-personales.service.ts | 4 | 🟩 Done |
| gastos-registrales.service.ts | 5 | 🟩 Done |
| adelantos.service.ts | 3 | 🟩 Done |
| reportes.service.ts | 3 | 🟩 Done |
| admin.routes.ts | 6 | 🟩 Done |

---

## Resumen de Cambios

### Patrón Principal
```typescript
// ❌ ANTES (SQLite)
strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
params.push(mes.toString().padStart(2, '0'), anio.toString());

// ✅ DESPUÉS (Postgres)
EXTRACT(MONTH FROM fecha) = ? AND EXTRACT(YEAR FROM fecha) = ?
params.push(mes, anio);  // Integers directamente
```

### Notas Importantes
1. `EXTRACT()` retorna `numeric`, no necesita padding con '0'
2. Los parámetros ahora son números, no strings
3. Para agrupación por mes con formato string: usar `TO_CHAR(fecha, 'MM')`
4. Para COUNT DISTINCT: usar `TO_CHAR(fecha, 'YYYY-MM')`
