# Plan: Fix Planillas - Columnas faltantes y mapeos rotos

## Contexto

La página de Planillas no muestra todos los datos que se guardan en la DB. El servicio `planillas.ts` tiene mapeos incompletos y le faltan queries a tablas que fueron agregadas/modificadas en fixes recientes.

---

## BUGS DOCUMENTADOS

### Bug 1: GASTOS_REG_MAP incompleto (planillas.ts:47-51)
- **Actual**: Solo mapea 3 conceptos: Libreria, Agua, Edesur
- **Correcto**: Debe mapear los 12 que `procesar_caja_diario` inserta en `gastos_registrales`:
  - Libreria → LIBRERIA
  - Agua → AGUA
  - Edesur → EDESUR
  - Acara → ACARA
  - Cargas Sociales → CARGAS_SOCIALES
  - Otros → OTROS
  - Supermercado → SUPERMERCADO
  - Sec → SEC
  - Osecac → OSECAC
  - Maria → MARIA
  - Repo Caja Chica → REPO_CAJA_CHICA
  - Repo Rentas Chica → REPO_RENTAS_CHICA
- **Nota**: Los valores de `concepto` en `gastos_registrales` se generan con `INITCAP(REPLACE(LOWER(key), '_', ' '))`, así que los nombres son Title Case con espacios.

### Bug 2: ADELANTOS_MAP incorrecto (planillas.ts:54-59)
- **Actual**: Mapea Maria, Tere, Dami, Mumi a adelantos_empleados
- **Correcto**: Solo Dami y Mumi van a `adelantos_empleados`.
  - MARIA fue movida a `gastos_registrales` en el fix de regresión
  - TERE fue movida a `gastos_personales` en el fix de regresión
- **Fix**: Quitar Maria y Tere de ADELANTOS_MAP

### Bug 3: Falta query a gastos_personales (planillas.ts getCaja)
- `getCaja()` no consulta la tabla `gastos_personales`
- TERE se inserta allí con concepto='Tere' y estado='Pagado'
- **Fix**: Agregar GASTOS_PERSONALES_MAP = { 'Tere': 'TERE' } y query nueva

### Bug 4: Falta query a gastos_deposito (planillas.ts getCaja y getRentas)
- `getCaja()` y `getRentas()` no consultan `gastos_deposito`
- Los depósitos individuales (DEPOSITO_1..12) se insertan allí por procesar_*_diario
- **Fix**: Agregar query a `gastos_deposito` y mapear `numero_deposito` a `DEPOSITO_{n}`

### Bug 5: OTROS_GASTOS_COLS incompleto (Planillas.tsx:36-44)
- **Actual**: Solo 7 columnas: LIBRERIA, MARIA, AGUA, EDESUR, TERE, DAMI, MUMI
- **Correcto**: Debe tener las 15 columnas de FormularioCaja.tsx OTROS_GASTOS

### Bug 6: Falta grupo de columnas Depositos en Planillas.tsx
- Actualmente solo columna "Depositos" en "Restan"
- Debería haber grupo "Depositos (-)" con DEPOSITO_1..12 + total

### Bug 7: buildAllKeys no incluye deposit keys individuales (planillas.ts:127-135)
- Solo 'DEPOSITOS', falta 'DEPOSITO_1'..'DEPOSITO_12' y gastos_personales keys

---

## PLAN DE CORRECCIÓN

### Paso 1: Corregir planillas.ts (service)

**Archivo**: `client/src/services/supabase/planillas.ts`

#### 1a. Ampliar GASTOS_REG_MAP (línea 47)

Reemplazar:
```typescript
const GASTOS_REG_MAP: Record<string, string> = {
  'Libreria': 'LIBRERIA',
  'Agua': 'AGUA',
  'Edesur': 'EDESUR',
};
```

Con:
```typescript
const GASTOS_REG_MAP: Record<string, string> = {
  'Libreria': 'LIBRERIA',
  'Agua': 'AGUA',
  'Edesur': 'EDESUR',
  'Acara': 'ACARA',
  'Cargas Sociales': 'CARGAS_SOCIALES',
  'Otros': 'OTROS',
  'Supermercado': 'SUPERMERCADO',
  'Sec': 'SEC',
  'Osecac': 'OSECAC',
  'Maria': 'MARIA',
  'Repo Caja Chica': 'REPO_CAJA_CHICA',
  'Repo Rentas Chica': 'REPO_RENTAS_CHICA',
};
```

#### 1b. Corregir ADELANTOS_MAP (línea 54)

Reemplazar:
```typescript
const ADELANTOS_MAP: Record<string, string> = {
  'Maria': 'MARIA',
  'Tere': 'TERE',
  'Dami': 'DAMI',
  'Mumi': 'MUMI',
};
```

Con:
```typescript
const ADELANTOS_MAP: Record<string, string> = {
  'Dami': 'DAMI',
  'Mumi': 'MUMI',
};
```

#### 1c. Agregar GASTOS_PERSONALES_MAP (después de ADELANTOS_MAP)

```typescript
/** Gastos personales (only in CAJA) */
const GASTOS_PERSONALES_MAP: Record<string, string> = {
  'Tere': 'TERE',
};
```

#### 1d. Actualizar buildAllKeys (línea 127)

Reemplazar:
```typescript
function buildAllKeys(conceptoKeys: string[], tipo: 'RENTAS' | 'CAJA'): string[] {
  const keys = [...conceptoKeys, ...CC_KEYS, 'DEPOSITOS', 'EFECTIVO'];
  if (tipo === 'CAJA') {
    keys.push('VEP', 'EPAGOS');
    keys.push(...Object.values(GASTOS_REG_MAP));
    keys.push(...Object.values(ADELANTOS_MAP));
  }
  return keys;
}
```

Con:
```typescript
function buildAllKeys(conceptoKeys: string[], tipo: 'RENTAS' | 'CAJA'): string[] {
  const depositKeys = Array.from({ length: 12 }, (_, i) => `DEPOSITO_${i + 1}`);
  const keys = [...conceptoKeys, ...CC_KEYS, 'DEPOSITOS', ...depositKeys, 'EFECTIVO'];
  if (tipo === 'CAJA') {
    keys.push('VEP', 'EPAGOS');
    keys.push(...Object.values(GASTOS_REG_MAP));
    keys.push(...Object.values(ADELANTOS_MAP));
    keys.push(...Object.values(GASTOS_PERSONALES_MAP));
  }
  return keys;
}
```

#### 1e. Agregar query gastos_deposito en getRentas (~línea 168)

Agregar query paralela:
```typescript
// 4. Gastos deposito (individual deposits)
let depositosQuery = supabase
  .from('gastos_deposito')
  .select('fecha, numero_deposito, monto')
  .eq('tipo', 'RENTAS');
if (filters.fechaDesde) depositosQuery = depositosQuery.gte('fecha', filters.fechaDesde);
if (filters.fechaHasta) depositosQuery = depositosQuery.lte('fecha', filters.fechaHasta);
```

Agregar al Promise.all y procesar:
```typescript
const [movResult, ccResult, efectivoResult, depositosResult] =
  await Promise.all([movQuery, ccQuery, efectivoQuery, depositosQuery]);

// ... after existing processing ...

// Process gastos deposito
if (!depositosResult.error) {
  for (const d of depositosResult.data || []) {
    const dia = getOrCreate(byFecha, d.fecha, allKeys);
    const depKey = `DEPOSITO_${d.numero_deposito}`;
    dia[depKey] = (dia[depKey] || 0) + Number(d.monto || 0);
    dia.DEPOSITOS = (dia.DEPOSITOS || 0) + Number(d.monto || 0);
  }
}
```

#### 1f. Agregar queries gastos_deposito y gastos_personales en getCaja

Agregar 2 queries paralelas nuevas:
```typescript
// 8. Gastos deposito (individual deposits)
const depositosQuery = addDateFilters(
  supabase
    .from('gastos_deposito')
    .select('fecha, numero_deposito, monto')
    .eq('tipo', 'CAJA'),
  'fecha'
);

// 9. Gastos personales (TERE)
const gastosPersonalesQuery = addDateFilters(
  supabase
    .from('gastos_personales')
    .select('fecha, concepto, monto'),
  'fecha'
);
```

Agregar ambas al Promise.all y procesar:
```typescript
const [..., depositosResult, gastosPersonalesResult] =
  await Promise.all([..., depositosQuery, gastosPersonalesQuery]);

// Process gastos deposito (individual deposits)
if (!depositosResult.error) {
  for (const d of depositosResult.data || []) {
    const dia = getOrCreate(byFecha, d.fecha, allKeys);
    const depKey = `DEPOSITO_${d.numero_deposito}`;
    dia[depKey] = (dia[depKey] || 0) + Number(d.monto || 0);
    dia.DEPOSITOS = (dia.DEPOSITOS || 0) + Number(d.monto || 0);
  }
}

// Process gastos personales
if (!gastosPersonalesResult.error) {
  for (const g of gastosPersonalesResult.data || []) {
    const dia = getOrCreate(byFecha, g.fecha, allKeys);
    const key = GASTOS_PERSONALES_MAP[g.concepto];
    if (key) {
      dia[key] = (dia[key] || 0) + Number(g.monto || 0);
    }
  }
}
```

---

### Paso 2: Corregir Planillas.tsx (UI)

**Archivo**: `client/src/pages/Planillas.tsx`

#### 2a. Ampliar OTROS_GASTOS_COLS (línea 36)

Reemplazar:
```typescript
const OTROS_GASTOS_COLS: ColDef[] = [
  { key: 'LIBRERIA', label: 'Libreria' },
  { key: 'MARIA', label: 'Maria' },
  { key: 'AGUA', label: 'Agua' },
  { key: 'EDESUR', label: 'Edesur' },
  { key: 'TERE', label: 'Tere' },
  { key: 'DAMI', label: 'Dami' },
  { key: 'MUMI', label: 'Mumi' },
];
```

Con (mismo orden que FormularioCaja.tsx):
```typescript
const OTROS_GASTOS_COLS: ColDef[] = [
  { key: 'LIBRERIA', label: 'Libreria' },
  { key: 'MARIA', label: 'Maria' },
  { key: 'TERE', label: 'Tere' },
  { key: 'DAMI', label: 'Dami' },
  { key: 'MUMI', label: 'Mumi' },
  { key: 'AGUA', label: 'Agua' },
  { key: 'CARGAS_SOCIALES', label: 'Cargas Soc.' },
  { key: 'EDESUR', label: 'Edesur' },
  { key: 'ACARA', label: 'Acara' },
  { key: 'SUPERMERCADO', label: 'Supermercado' },
  { key: 'SEC', label: 'SEC' },
  { key: 'OSECAC', label: 'OSECAC' },
  { key: 'OTROS', label: 'Otros' },
  { key: 'REPO_CAJA_CHICA', label: 'Rep.Caja Ch.' },
  { key: 'REPO_RENTAS_CHICA', label: 'Rep.Rentas Ch.' },
];
```

#### 2b. Agregar grupo Depositos en buildGroups (línea 50)

Quitar 'DEPOSITOS' de restanCols. Agregar grupo separado "Depositos (-)" con DEPOSITO_1..12 + total.

Cambiar restanCols (línea 61-67) quitando DEPOSITOS:
```typescript
const restanCols: ColDef[] = [
  ...restanConceptoCols,
  ...(tipo === 'CAJA'
    ? [{ key: 'VEP', label: 'VEP' }, { key: 'EPAGOS', label: 'ePagos' }]
    : []),
];
```

Agregar depositCols:
```typescript
const depositCols: ColDef[] = Array.from({ length: 12 }, (_, i) => ({
  key: `DEPOSITO_${i + 1}`,
  label: `Dep.${i + 1}`,
}));
depositCols.push({ key: 'DEPOSITOS', label: 'Total Dep.' });
```

Insertar grupo Depositos entre Restan y Otros Gastos:
```typescript
const groups: ColGroup[] = [
  { label: 'Ingresos (+)', headerCls: 'bg-emerald-500/10 text-emerald-700', cols: ingresosCols },
  { label: 'Restan (-)', headerCls: 'bg-amber-500/10 text-amber-700', cols: restanCols },
  { label: 'Depositos (-)', headerCls: 'bg-purple-500/10 text-purple-700', cols: depositCols },
];

if (tipo === 'CAJA') {
  groups.push({
    label: 'Otros Gastos (-)',
    headerCls: 'bg-orange-500/10 text-orange-700',
    cols: OTROS_GASTOS_COLS,
  });
}

groups.push({
  label: 'Cuentas (-)',
  headerCls: 'bg-red-500/10 text-red-700',
  cols: CC_COLS,
});

return groups;
```

---

## Archivos a modificar
1. `client/src/services/supabase/planillas.ts` - Mapeos + queries + buildAllKeys
2. `client/src/pages/Planillas.tsx` - Columnas UI

## NO se necesitan migraciones SQL
Los datos ya se guardan correctamente en la DB. El problema es solo de lectura/display.

## Verificación post-fix
1. Abrir Planillas → tabla CAJA
2. Verificar que aparecen las 15 columnas de "Otros Gastos"
3. Verificar que aparecen las 12+1 columnas de depósitos
4. Cargar un registro de Caja con SUPERMERCADO=$100 → verificar que aparece en planilla
5. Cargar un registro de Caja con TERE=$50 → verificar que aparece en planilla
6. Cargar un registro con DEPOSITO_1=$500 → verificar que aparece en columna Dep.1
7. Abrir Planillas → tabla RENTAS → verificar depósitos individuales
