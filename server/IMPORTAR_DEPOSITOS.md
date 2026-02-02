# 📥 Importación de Depósitos desde CSV

## Formato del CSV

```csv
Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion
```

### Columnas:

1. **Monto_Deposito**: El importe depositado (formato: 1.500.000,00 o 1500000.00)
2. **Fecha_Deposito**: Cuándo se realizó el depósito (formato: dd/mm/yyyy o yyyy-mm-dd)
3. **Fecha_Registro**: Cuándo se registró/usó (puede estar vacío)
4. **Estado**: Observaciones (puede ser texto, número, o vacío)
5. **CUIT_Denominacion**: Quién depositó (puede estar vacío)

## Reglas de Importación

### 📊 Determinación del Estado:

| Estado en CSV | CUIT_Denominacion | Estado Final | Saldo Actual |
|---------------|-------------------|--------------|--------------|
| **Número** (ej: 50000) | Cualquiera | `A_FAVOR` | Ese número |
| **Texto** (ej: "liquidado") | Cualquiera | `LIQUIDADO` | 0 |
| **Vacío** | Con valor | `PENDIENTE` | Monto original |
| Cualquiera | **Vacío** | `PENDIENTE` | Monto original |

### 🏦 Casos Especiales - Cuentas Corrientes:

Si el Estado menciona "a cuenta de ALRA", "a cuenta de ICBC" o "a cuenta de IVECO":
- ⚠️ **NO se asignará automáticamente** a la cuenta corriente
- Esto evita romper las cuentas actuales que están correctas
- `cuenta_id` quedará como `null`

## Ejemplo de CSV:

```csv
Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion
1500000,15/05/2024,,PENDIENTE,20-12345678-9
2000000,20/05/2024,22/05/2024,liquidado,27-98765432-1
500000,25/05/2024,26/05/2024,250000,20-11111111-1
3000000,30/05/2024,,,
1000000,01/06/2024,02/06/2024,a cuenta de ALRA,20-22222222-2
```

Resultado:
1. **$1.500.000** → Estado: PENDIENTE (tiene CUIT, sin estado específico)
2. **$2.000.000** → Estado: LIQUIDADO (estado es texto)
3. **$500.000** → Estado: A_FAVOR con saldo $250.000 (estado es número)
4. **$3.000.000** → Estado: PENDIENTE (CUIT vacío)
5. **$1.000.000** → Estado: según lógica, pero **NO se asigna a cuenta** ALRA automáticamente

## 🔄 Asociación con Cuentas Corrientes

### Al Asignar un Depósito a una Cuenta:
- ✅ Se crea automáticamente un movimiento **INGRESO** en la cuenta corriente
- ✅ Los saldos posteriores se **recalculan automáticamente**
- ✅ El `movimiento_origen_id` queda vinculado al depósito para rastreabilidad

### Al Desasociar un Depósito de una Cuenta:
- ✅ Se **elimina** el movimiento INGRESO de la cuenta corriente
- ✅ Los saldos posteriores se **recalculan automáticamente**
- ✅ El depósito vuelve a estar disponible

## 📡 Endpoints API

### Importar CSV:
```bash
POST /api/depositos/importar
Content-Type: application/json

{
  "contenido": "Monto_Deposito,Fecha_Deposito,Fecha_Registro,Estado,CUIT_Denominacion\n1500000,15/05/2024,,..."
}
```

**Respuesta:**
```json
{
  "data": {
    "insertados": 150,
    "procesados": 150,
    "errores": [],
    "pendientes": 50,
    "liquidados": 80,
    "aFavor": 20
  },
  "message": "Importación completada: 150 depósitos insertados de 150 procesados"
}
```

### Desasociar Depósito de Cuenta:
```bash
POST /api/depositos/:id/desasociar
```

**Respuesta:**
```json
{
  "data": {
    "id": 123,
    "cuenta_id": null,
    ...
  },
  "message": "Depósito desasociado correctamente. El INGRESO fue eliminado de la cuenta corriente."
}
```

## ⚠️ Notas Importantes:

1. **Validación Automática**: El sistema valida formatos de fecha y números automáticamente
2. **Transacciones**: La importación usa transacciones, si un depósito falla, se revierten todos
3. **Recálculo de Saldos**: Al asociar/desasociar, los saldos de cuentas corrientes se recalculan automáticamente
4. **Sin Duplicados en Importación**: Los depósitos del CSV **NO** verifican si ya existen (es una migración)
5. **Preservación de Cuentas**: Los depósitos con "a cuenta de..." NO se asignan automáticamente

## 🚀 Uso desde el Frontend

En la página de Depósitos, habrá un botón **"Importar CSV"** que:
1. Permite seleccionar un archivo CSV
2. Lo parsea y valida
3. Muestra un preview de los depósitos a importar
4. Al confirmar, envía al backend para procesamiento
5. Muestra resultado: insertados, pendientes, liquidados, a favor

## 🔍 Verificación Post-Importación

Después de importar, puedes:
1. Ir a **Depósitos** y filtrar por estado
2. Verificar en **Cuentas Corrientes** que los INGRESOS asociados estén correctos
3. Usar el endpoint `GET /api/depositos/estadisticas` para ver resumen general
