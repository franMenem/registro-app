# Errores cometidos por Claude - Registro para no repetir

## 2026-02-06: Bug precedencia operadores SQL (DEPOSITO_X)

**Archivo:** `supabase/migrations/20260206_gastos_deposito.sql`

**Error:** Escribi `p_values->>'DEPOSITO_' || v_i` en las RPCs `procesar_caja_diario` y `procesar_rentas_diario`. El operador `->>` tiene mayor precedencia que `||` en PostgreSQL, entonces se evaluaba como `(p_values->>'DEPOSITO_') || v_i` en vez de `p_values->>('DEPOSITO_' || v_i)`.

**Resultado:** Los DEPOSITO_X siempre devolvian NULL/0, no se insertaban registros en `gastos_deposito`.

**Fix:** Agregar parentesis: `p_values->>('DEPOSITO_' || v_i)`

**Leccion:** Siempre usar parentesis explicitos cuando se concatena strings para usar como key de JSONB con `->>`. No confiar en la precedencia implicita de operadores SQL.

---

## 2026-02-06: Dar ejemplo SQL incompleto como instruccion

**Error:** Cuando le dije al usuario que re-ejecute el SQL corregido, puse un ejemplo placeholder (`$$ -- (misma funcion pero con el fix)`) en vez de decir claramente "copia TODO el archivo". El usuario copio ese texto literal y obtuvo error de sintaxis.

**Resultado:** El usuario intento ejecutar SQL roto en Supabase.

**Leccion:** NUNCA dar ejemplos SQL parciales/placeholder cuando el usuario va a copiar y ejecutar. Siempre dar el archivo completo o decir explicitamente "copia el contenido del archivo X".

---

## 2026-02-06: Columna inexistente en SQL de rollback

**Error:** En el SQL para revertir el formulario CAJA, usé `tipo_origen` como columna de `movimientos_cc`, pero esa columna no existe. Las columnas reales son: `id, cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante, movimiento_origen_id, created_at`.

**Resultado:** El usuario obtuvo `ERROR: 42703: column "tipo_origen" does not exist`.

**Fix:** Usar `tipo_movimiento = 'EGRESO' AND concepto = 'CAJA'` en vez de `tipo_origen = 'CAJA'`.

**Leccion:** Antes de escribir SQL con columnas, SIEMPRE verificar el schema real (supabase_schema.sql). No inventar nombres de columnas de memoria.

---

## Reglas para no repetir

1. **SQL JSONB keys con concatenacion:** Siempre usar `p_values->>('key_' || variable)` con parentesis
2. **Instrucciones al usuario:** Dar instrucciones exactas y completas, nunca placeholders que puedan confundir
3. **Antes de `CREATE OR REPLACE FUNCTION`:** Siempre leer y comparar con la funcion original para no perder logica existente
4. **Testing:** Antes de entregar migraciones SQL, verificar mentalmente la precedencia de operadores
5. **Schema:** Antes de escribir DELETE/UPDATE SQL, verificar las columnas reales en `supabase_schema.sql`. No inventar nombres de columnas
