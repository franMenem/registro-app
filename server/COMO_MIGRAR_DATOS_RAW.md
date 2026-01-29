# 🔄 Cómo Migrar tus Datos Raw (Excel/Texto)

## Paso a Paso para Convertir tus Datos Existentes

### 1️⃣ Preparar el archivo raw

**Opción A: Desde Excel**
1. Abrí tu archivo de Excel con los datos
2. Seleccioná todas las filas con datos (incluido el encabezado)
3. Copiá (Ctrl+C o Cmd+C)
4. Abrí un editor de texto y pegá
5. Guardá como `posnet_raw.txt` en la carpeta `data/`

**Opción B: Si ya tenés un archivo de texto**
1. Simplemente copialo a la carpeta `data/`

---

### 2️⃣ Identificar las columnas

Mirá la primera línea de tu archivo y contá las columnas **empezando desde 0**:

Ejemplo:
```
Fecha        GIT    SUAT   ...   POSNET_RENTAS   POSNET_CAJA   OK   Ingresado
  0          1       2     ...        9               10        11      12
```

En este ejemplo:
- **Columna 9** = POSNET RENTAS
- **Columna 10** = POSNET CAJA
- **Columna 12** = Monto Ingresado al Banco

---

### 3️⃣ Ejecutar el parser

Abrí la terminal y ejecutá:

```bash
cd /Users/efmenem/Projects/registroApp/server

npm run parse:posnet data/posnet_raw.txt --rentas 9 --caja 10
```

**Ajustá los números** según las columnas de TU archivo.

---

### 4️⃣ Verificar la salida

El script te mostrará una vista previa:

```
Vista previa (primeros 5 registros):
================================================================================
2026-01-15 | RENTAS: $12500.50 | CAJA: $8300.00 | Ingresado: $20800.50
2026-01-16 | RENTAS: $15200.00 | CAJA: $9450.75 | Ingresado: $24650.75
...
================================================================================

✅ Archivo CSV generado: data/posnet_clean.csv
```

**¿Se ven bien los números?** → Continuá al paso 5
**¿Algo está mal?** → Revisá los números de columna y volvé a ejecutar

---

### 5️⃣ Migrar a la base de datos

```bash
npm run migrate:posnet csv data/posnet_clean.csv
```

Esto insertará todos los registros en la base de datos.

---

## 🛠️ Solución de Problemas

### Problema: "No se procesaron registros"

**Causa:** Los números de columna están mal

**Solución:**
1. Abrí `data/posnet_raw.txt` en un editor
2. Mirá la primera línea con datos
3. Contá las columnas desde 0
4. Ejecutá de nuevo con los números correctos

### Problema: "Fecha inválida"

**Causa:** El formato de fecha no se reconoce

**Solución:** El parser acepta:
- `Lunes 15/01/2026`
- `15/01/2026`
- `15-01-2026`
- `2026-01-15`

Si tu formato es diferente, avisame y ajusto el parser.

### Problema: "Montos incorrectos"

**Causa:** El formato de números está confundiendo al parser

El parser acepta:
- `$1.234,56` (formato argentino)
- `1,234.56` (formato internacional)
- `1234.56` (sin separadores)

Si tenés otro formato, avisame.

---

## 📋 Ejemplo Completo

**Tu archivo raw (data/posnet_raw.txt):**
```
Fecha           GIT      SUAT     POSNET_RENTAS   POSNET_CAJA     Ingresado
Lunes 15/01     1200     3500     12500.50        8300.00         20800.50
Martes 16/01    1500     4000     15200.00        9450.75         24650.75
```

**Comando:**
```bash
npm run parse:posnet data/posnet_raw.txt --rentas 3 --caja 4 --anio 2026
```

**Resultado (data/posnet_clean.csv):**
```csv
fecha,monto_rentas,monto_caja,monto_ingresado_banco
2026-01-15,12500.50,8300.00,20800.50
2026-01-16,15200.00,9450.75,24650.75
```

**Migración:**
```bash
npm run migrate:posnet csv data/posnet_clean.csv
```

✅ **Listo!**

---

## 💡 Consejos

1. **Probá primero con pocas líneas:** Copiá solo 3-4 filas de tu Excel, ejecutá el parser, verificá que todo esté bien, y recién ahí procesá todo.

2. **No borres el archivo raw:** Guardá tu `posnet_raw.txt` por las dudas necesites volver a procesarlo.

3. **Podés re-ejecutar cuantas veces quieras:** Si algo sale mal, ajustá los parámetros y volvé a ejecutar. Los registros se actualizarán, no se duplicarán.

4. **Revisá la vista previa:** El script siempre muestra los primeros 5 registros para que verifiques antes de migrar.

---

## ❓ ¿Necesitás ayuda?

Si tenés un formato de datos diferente o algo no funciona, podemos ajustar el parser para que funcione con TUS datos específicos.

Mostrá:
1. Una muestra de tu archivo (2-3 líneas)
2. Qué columnas tienen POSNET RENTAS, POSNET CAJA, y Monto Ingresado
3. El error que te aparece (si hay)

Y ajustamos el script.
