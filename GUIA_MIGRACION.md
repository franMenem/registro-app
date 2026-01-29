# 🚀 Guía de Migración de Datos

## 📋 Orden Recomendado de Migración

### **Nivel 1: Sin dependencias** (Empezar por acá)
1. ✅ **Control POSNET Diario** - Completamente independiente
2. ✅ **Movimientos RENTAS** - Solo depende de conceptos (se crean automáticamente)

### **Nivel 2: Dependencias moderadas**
3. 🔄 **Movimientos CAJA** - Depende de conceptos y puede crear movimientos en cuentas corrientes
4. 🔄 **Cuentas Corrientes** - Depende de movimientos existentes

### **Nivel 3: Dependencias complejas**
5. 📦 **Gastos Registro** - Usa cuentas corrientes
6. 📦 **Gastos Personales** - Usa cuentas corrientes
7. 📦 **Adelantos Empleados** - Independiente pero menos prioritario
8. 📦 **Clientes** - Para depósitos con CUIT

---

## 📝 Formatos de Importación

### 1️⃣ Control POSNET Diario

**Formato CSV:**
```csv
fecha,posnet_rentas,posnet_caja,monto_ingresado
04/08/2025,800000.50,450000.00,1250450.50
05/08/2025,750000.00,420000.00,1170000.00
```

**Campos:**
- `fecha`: DD/MM/YYYY o YYYY-MM-DD
- `posnet_rentas`: Monto cobrado con POSNET en RENTAS (solo números, puede tener . o , como decimal)
- `posnet_caja`: Monto cobrado con POSNET en CAJA
- `monto_ingresado`: Monto que realmente ingresó al banco

**Importar desde UI:**
- Ir a: Control POSNET → Botón "Importar CSV"

---

### 2️⃣ Movimientos RENTAS

**Formato CSV:**
```csv
fecha,tipo,concepto,monto,cuit,observaciones
04/08/2025,RENTAS,GIT,800718.77,,
05/08/2025,RENTAS,SUAT - Alta,66897.52,,Pago semanal
06/08/2025,RENTAS,PROVINCIA,5096671.20,,ARBA quincenal
```

**Campos:**
- `fecha`: DD/MM/YYYY o YYYY-MM-DD
- `tipo`: Siempre "RENTAS"
- `concepto`: Nombre del concepto (GIT, SUAT - Alta, PROVINCIA, CONSULTA, POSNET, DEPOSITOS, ICBC, FORD, SICARDI, PATAGONIA, etc.)
- `monto`: Monto en pesos (acepta formato argentino $1.234,56 o internacional 1234.56)
- `cuit`: OPCIONAL - Solo si aplica (ej: para clientes específicos)
- `observaciones`: OPCIONAL - Cualquier nota adicional

**Conceptos RENTAS disponibles:**
- GIT
- SUAT - Alta
- SUAT - Patentes
- SUAT - Infracciones
- CONSULTA (o Consulta)
- SUCERP
- SUGIT (o Sugit)
- PROVINCIA (se mapea automáticamente a "PROVINCIA (ARBA)")
- POSNET
- DEPOSITOS
- ICBC
- FORD
- SICARDI
- PATAGONIA
- IVECO
- CNH
- GESTORIA FORD
- ALRA

**Importar desde UI:**
- Ir a: Rentas → Botón "Importar CSV" (azul)

**⚠️ IMPORTANTE:**
- El concepto se crea automáticamente si no existe
- Si el concepto es semanal (GIT, SUAT, SUCERP, SUGIT) → Crea/actualiza control semanal
- Si el concepto es quincenal (PROVINCIA/ARBA) → Crea/actualiza control quincenal
- Si el concepto es ICBC, FORD, etc. → Crea movimiento en cuenta corriente correspondiente

---

### 3️⃣ Movimientos CAJA

**Formato CSV:**
```csv
fecha,tipo,concepto,monto,cuit,observaciones
04/08/2025,CAJA,Arancel,500000.00,,
05/08/2025,CAJA,SUAT - Sellado,25000.00,,
06/08/2025,CAJA,Formularios,15000.00,,
```

**Campos:**
- `fecha`: DD/MM/YYYY o YYYY-MM-DD
- `tipo`: Siempre "CAJA"
- `concepto`: Nombre del concepto de CAJA
- `monto`: Monto en pesos
- `cuit`: OPCIONAL
- `observaciones`: OPCIONAL

**Conceptos CAJA disponibles:**
- Arancel
- SUAT - Sellado
- SUCERP - Sellado
- Consultas (o Consultas CAJA)
- Formularios
- POSNET (o POSNET CAJA)
- VEP
- EPAGOS
- DEPOSITO 1, DEPOSITO 2, ..., DEPOSITO 12
- LIBRERIA
- MARIA
- TERE, DAMI, MUMI
- AGUA
- CARGAS SOCIALES
- EDESUR
- ACARA
- OTROS
- REPO CAJA CHICA
- REPO RENTAS CHICA
- ICBC, FORD, SICARDI, PATAGONIA, IVECO, CNH, GESTORIA FORD, ALRA

**Importar desde UI:**
- Ir a: Caja → Botón "Importar CSV" (azul)

---

### 4️⃣ Consultas y Formularios

**¿Qué son?**
- **Consultas**: Trámites de consulta que se cobran (tanto en RENTAS como en CAJA)
- **Formularios**: Compra de formularios del proveedor

**Formato para Consultas (RENTAS):**
```csv
fecha,tipo,concepto,monto,cuit,observaciones
04/08/2025,RENTAS,Consulta,7600.00,,Consulta trámite ABC-123
05/08/2025,RENTAS,Consulta,5000.00,,
```

**Formato para Consultas (CAJA):**
```csv
fecha,tipo,concepto,monto,cuit,observaciones
04/08/2025,CAJA,Consultas,3500.00,,
05/08/2025,CAJA,Consultas,4200.00,,
```

**Formato para Formularios (CAJA):**
```csv
fecha,tipo,concepto,monto,cuit,observaciones
04/08/2025,CAJA,Formularios,15000.00,,Compra proveedor
10/08/2025,CAJA,Formularios,22000.00,,Resma nueva
```

**¿Dónde se agregan?**
- Las **Consultas** van como movimientos normales (RENTAS o CAJA según corresponda)
- Los **Formularios** van como movimientos CAJA y actualizan la cuenta corriente "Gastos Formularios" automáticamente

**Importar:**
- Mismo método que movimientos RENTAS/CAJA (botón "Importar CSV")

---

### 5️⃣ Cuentas Corrientes (movimientos manuales)

**Formato CSV:**
```csv
fecha,cuenta_id,tipo_movimiento,concepto,monto,observaciones
04/08/2025,1,EGRESO,Comisión bancaria,1500.00,Comisión mes agosto
05/08/2025,2,INGRESO,Depósito,50000.00,
```

**Campos:**
- `fecha`: DD/MM/YYYY o YYYY-MM-DD
- `cuenta_id`: ID de la cuenta (ver tabla abajo)
- `tipo_movimiento`: INGRESO o EGRESO
- `concepto`: Descripción del movimiento
- `monto`: Monto en pesos (siempre positivo)
- `observaciones`: OPCIONAL

**IDs de Cuentas Corrientes:**
```
1  - Gastos Bancarios (RENTAS)
2  - Gastos Link (RENTAS)
3  - Gastos Bancarios CAJA
4  - Gastos Formularios (CAJA)
5  - Librería
6  - María
7  - Agua
8  - Edesur
9  - ICBC
10 - FORD
11 - SICARDI
12 - PATAGONIA
13 - IVECO
14 - CNH
15 - GESTORIA FORD
16 - ALRA
```

**⚠️ Nota:**
- La mayoría de movimientos en cuentas corrientes se crean **automáticamente** cuando importás movimientos RENTAS/CAJA
- Ejemplo: Si importás un movimiento de ICBC en RENTAS, automáticamente se crea un EGRESO en la cuenta "ICBC"
- Solo necesitás importar movimientos manuales que NO estén relacionados con movimientos de RENTAS/CAJA

---

## 🔧 Comandos útiles

```bash
# Limpiar datos de POSNET y CAJA
cd server
npm run db:clean

# Ver estado de la base de datos
sqlite3 registro.db "SELECT tipo, COUNT(*) as total, SUM(monto) as suma FROM movimientos GROUP BY tipo"

# Ver conceptos creados
sqlite3 registro.db "SELECT * FROM conceptos ORDER BY tipo, nombre"

# Ver controles semanales
sqlite3 registro.db "SELECT * FROM controles_semanales ORDER BY fecha_inicio DESC LIMIT 10"
```

---

## 📊 Recomendación de Orden

### Paso 1: Control POSNET (✅ COMPLETAR PRIMERO)
```
1. Preparar archivo CSV con formato correcto
2. Importar desde UI: Control POSNET → Importar CSV
3. Verificar en página Control POSNET que todos los registros aparezcan
```

### Paso 2: Movimientos RENTAS (✅ SEGUNDO)
```
1. Preparar CSV con TODOS los movimientos RENTAS
2. Asegurarse que los conceptos estén correctos
3. Importar desde UI: Rentas → Importar CSV
4. Verificar en Historial que todo aparezca
5. Verificar en Planillas que se crearon controles semanales/quincenales
```

### Paso 3: Movimientos CAJA (🔄 TERCERO)
```
1. Preparar CSV con TODOS los movimientos CAJA
2. Importar desde UI: Caja → Importar CSV
3. Verificar en Historial
4. Verificar en Cuentas Corrientes que se actualizaron los saldos
```

### Paso 4: Ajustes Manuales (🔧 FINAL)
```
1. Revisar Cuentas Corrientes
2. Agregar movimientos manuales si falta algo
3. Verificar totales y saldos
```

---

## ❓ ¿Por dónde empiezo?

**YA IMPORTASTE:** Movimientos RENTAS (687 registros) ✅

**PRÓXIMO PASO:** Control POSNET
- Es independiente
- Más simple
- Te permite practicar el formato
- No afecta otras tablas

**Prepará tu archivo CSV de POSNET con:**
```csv
fecha,posnet_rentas,posnet_caja,monto_ingresado
```

Y avisame cuando esté listo para importar!
