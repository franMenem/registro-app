# 📊 Guía de Migración de Datos

## Control POSNET Diario

### 🚀 Si tenés datos en formato Excel/Raw (RECOMENDADO para datos existentes)

Si ya tenés tus datos en Excel o en un formato "crudo" (con fechas en español, números con formato argentino, etc.), **usá el parser automático**.

**Paso 1: Preparar tu archivo raw**

Copiá tus datos desde Excel y pegalos en un archivo de texto:

```bash
# Crear archivo con tus datos
nano data/posnet_raw.txt
# O simplemente copiá y pegá desde Excel a un archivo .txt
```

Tu archivo puede tener este formato (con columnas separadas por tabulaciones):
```
Fecha           ...otras columnas...    POSNET_RENTAS   POSNET_CAJA     OK      Ingresado
Lunes 15/01/26  ...                     12500.50        8300.00         ok      20800.50
Martes 16/01/26 ...                     15200.00        9450.75         ok      24650.75
```

**Paso 2: Ejecutar el parser**

```bash
cd /Users/efmenem/Projects/registroApp/server

# Básico (usa configuración por defecto)
npm run parse:posnet data/posnet_raw.txt

# Con configuración personalizada
npm run parse:posnet data/posnet_raw.txt --rentas 9 --caja 10 --anio 2026
```

**Opciones disponibles:**
- `--rentas <col>`: Número de columna donde está POSNET RENTAS (empieza en 0)
- `--caja <col>`: Número de columna donde está POSNET CAJA
- `--ingresado <col>`: Número de columna con el monto ingresado (opcional, auto-detecta)
- `--anio <anio>`: Año de referencia para fechas (default: 2026)
- `--skip <n>`: Cuántas líneas de encabezado saltar (default: 1)

**Paso 3: Verificar el resultado**

El script te mostrará una vista previa y generará `data/posnet_clean.csv`

**Paso 4: Migrar a la base de datos**

```bash
npm run migrate:posnet csv data/posnet_clean.csv
```

✅ **Listo!** Tus datos están en la base de datos.

---

### 📋 Si querés preparar los datos manualmente

Tenés **dos opciones** para preparar tus datos:

---

### Opción 1: CSV (Recomendado - Más simple)

**Archivo:** `control_posnet.csv`

```csv
fecha,monto_rentas,monto_caja,monto_ingresado_banco
2026-01-15,12500.50,8300.00,20800.50
2026-01-16,15200.00,9450.75,24650.75
2026-01-17,13800.25,7890.00,21690.25
```

**Columnas:**
- `fecha`: Formato YYYY-MM-DD (ej: 2026-01-15)
- `monto_rentas`: Monto cobrado en RENTAS ese día
- `monto_caja`: Monto cobrado en CAJA ese día
- `monto_ingresado_banco`: Monto que efectivamente ingresó al banco (opcional, puede ser 0)

**Notas:**
- Primera línea es el encabezado (no la cambies)
- No uses separadores de miles (usa 12500.50, no 12,500.50)
- Decimales con punto, no coma (8300.00, no 8300,00)
- Los campos `total_posnet` y `diferencia` se calculan automáticamente

---

### Opción 2: JSON (Más flexible)

**Archivo:** `control_posnet.json`

```json
[
  {
    "fecha": "2026-01-15",
    "monto_rentas": 12500.50,
    "monto_caja": 8300.00,
    "monto_ingresado_banco": 20800.50
  },
  {
    "fecha": "2026-01-16",
    "monto_rentas": 15200.00,
    "monto_caja": 9450.75,
    "monto_ingresado_banco": 24650.75
  }
]
```

---

## 🚀 Cómo Ejecutar la Migración

### Paso 1: Preparar tu archivo

1. **Con Excel/Google Sheets:**
   - Creá una planilla con las columnas: `fecha`, `monto_rentas`, `monto_caja`, `monto_ingresado_banco`
   - Completá tus datos
   - Guardar como → CSV (con comas)

2. **Con un editor de texto:**
   - Copiá el formato del ejemplo CSV o JSON
   - Reemplazá con tus datos

### Paso 2: Copiar el archivo

Copiá tu archivo a la carpeta del servidor:

```bash
cp /ruta/a/tus/datos.csv /Users/efmenem/Projects/registroApp/server/data/control_posnet.csv
```

### Paso 3: Ejecutar la migración

**Para CSV:**
```bash
cd /Users/efmenem/Projects/registroApp/server
npm run migrate:posnet csv data/control_posnet.csv
```

**Para JSON:**
```bash
cd /Users/efmenem/Projects/registroApp/server
npm run migrate:posnet json data/control_posnet.json
```

### Paso 4: Verificar

El script te mostrará:
- ✓ Cuántos registros se insertaron
- ✓ Cuántos se actualizaron (si ya existían)
- ✗ Errores (si los hubo)

---

## 📁 Archivos de Ejemplo

Ya hay archivos de ejemplo en:
- `/server/data/control_posnet_ejemplo.csv`
- `/server/data/control_posnet_ejemplo.json`

Podés probar la migración con ellos:

```bash
npm run migrate:posnet csv data/control_posnet_ejemplo.csv
```

---

## ✅ Validaciones Automáticas

El script valida:
- ✓ Formato de fecha (YYYY-MM-DD)
- ✓ Montos numéricos válidos
- ✓ Duplicados (actualiza en lugar de fallar)
- ✓ Calcula automáticamente `total_posnet` y `diferencia`

---

## 🔄 Re-ejecutar la Migración

Si necesitás corregir datos, simplemente:
1. Editá tu archivo CSV/JSON
2. Volvé a ejecutar el comando
3. Los registros existentes se **actualizarán** (no se duplicarán)

---

## ❓ Problemas Comunes

### "Fecha inválida"
- Asegurate que el formato sea YYYY-MM-DD
- Ejemplo correcto: 2026-01-15
- Ejemplo incorrecto: 15/01/2026

### "Archivo no encontrado"
- Verificá que la ruta sea correcta
- Usá rutas relativas desde `/server`: `data/archivo.csv`
- O rutas absolutas: `/Users/.../archivo.csv`

### "Error al parsear CSV"
- Asegurate que las comas separen los campos
- No uses comas dentro de los valores
- Primera línea debe ser el encabezado

---

## 📞 Ayuda

Si tenés problemas, ejecutá el script sin argumentos para ver la ayuda:

```bash
npm run migrate:posnet
```

---

## 🎯 Próximas Migraciones

Una vez que termines con Control POSNET, podemos migrar:
- Clientes
- Gastos Personales
- Gastos Registrales
- Formularios
- Movimientos RENTAS/CAJA
