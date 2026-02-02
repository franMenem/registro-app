gi# Rollback Completo - Volver al Repo Remoto

**Fecha**: 2026-02-02
**Objetivo**: Borrar TODOS los cambios locales y volver al estado del repo remoto

---

## ⚠️ ADVERTENCIA

Esto **BORRARÁ PERMANENTEMENTE**:
- ✅ Todos los cambios no commiteados
- ✅ Todos los archivos nuevos
- ✅ Todas las modificaciones locales

**NO borrará**:
- ✅ La base de datos SQLite (`registro.db`)
- ✅ Los backups de la base de datos
- ✅ Los archivos exportados en `sql-export/`

---

## 🔄 OPCIÓN 1: Rollback Seguro (Recomendado)

Guarda tus cambios por si acaso, luego vuelve al repo remoto:

```bash
# 1. Ir al directorio del proyecto
cd /Users/efmenem/Projects/registroApp

# 2. Ver qué cambios hay (opcional)
git status

# 3. Guardar cambios en un stash (por si necesitas algo después)
git stash save "Backup antes de rollback - $(date +%Y%m%d-%H%M%S)"

# 4. Ver qué branch estás
git branch

# 5. Traer últimos cambios del remoto
git fetch origin

# 6. Resetear al estado del remoto (main o tu branch)
git reset --hard origin/main

# 7. Limpiar archivos no trackeados
git clean -fd

# 8. Verificar estado limpio
git status
# Debe decir: "nothing to commit, working tree clean"
```

---

## 🔄 OPCIÓN 2: Rollback Total (Más agresivo)

Si quieres estar 100% seguro de que todo está limpio:

```bash
# 1. Ir al directorio del proyecto
cd /Users/efmenem/Projects/registroApp

# 2. Ver estado actual
git status

# 3. Descartar TODOS los cambios (sin guardar)
git reset --hard HEAD

# 4. Borrar archivos no trackeados (nuevos archivos)
git clean -fdx
# -f = force
# -d = directories
# -x = ignora .gitignore (borra TODO incluso node_modules)

# 5. Traer del remoto
git fetch origin

# 6. Resetear al remoto
git reset --hard origin/main

# 7. Verificar
git status
```

⚠️ **Nota**: `git clean -fdx` borrará **node_modules**, así que tendrás que hacer `npm install` después.

---

## 🔄 OPCIÓN 3: Borrar y Re-clonar (Nuclear)

Si nada más funciona o quieres empezar totalmente limpio:

```bash
# 1. Salir del directorio
cd /Users/efmenem/Projects

# 2. Hacer backup de archivos importantes
cp -r registroApp/server/registro.db* ~/Desktop/backup-db/
cp -r registroApp/server/sql-export ~/Desktop/backup-sql-export/

# 3. Borrar el directorio completo
rm -rf registroApp

# 4. Re-clonar desde GitHub
git clone https://github.com/tu-usuario/registroApp.git

# 5. Entrar al proyecto
cd registroApp

# 6. Restaurar la base de datos
cp ~/Desktop/backup-db/registro.db* server/

# 7. Instalar dependencias
cd server && npm install
cd ../client && npm install
```

---

## ✅ Después del Rollback

### 1. Verificar que el código está limpio

```bash
cd /Users/efmenem/Projects/registroApp

# Ver estado de git
git status
# Debe decir: "nothing to commit, working tree clean"

# Ver último commit
git log --oneline -5

# Ver branch actual
git branch
# Debe mostrar: * main
```

### 2. Reinstalar dependencias (si usaste `git clean -fdx`)

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 3. Verificar que la app funciona

```bash
# Terminal 1 - Backend
cd server
npm run dev
# Debe iniciar en http://localhost:3000

# Terminal 2 - Frontend
cd client
npm run dev
# Debe iniciar en http://localhost:5173
```

Abrir navegador en `http://localhost:5173` y verificar que todo funciona.

---

## 📋 Archivos que quedan después del rollback

✅ **Estos archivos NO están en git** (no se borrarán):
- `server/registro.db` - Base de datos SQLite
- `server/registro.db-shm` - SQLite temp file
- `server/registro.db-wal` - SQLite WAL file
- `server/registro.db.backup-*` - Tus backups
- `server/sql-export/` - Scripts SQL generados

❌ **Estos archivos nuevos SE BORRARÁN** (no están en repo remoto):
- `PROBLEMAS-RESUELTOS.md`
- `SOLUCION-COMPLETA.md`
- `ESPECIFICACIONES-MIGRACION-SUPABASE.md`
- `MIGRAR-SOLO-MOVIMIENTOS.md`
- `ROLLBACK-COMPLETO.md` (este archivo)
- Cualquier otro archivo creado durante la migración

Si quieres guardar estos documentos:
```bash
# Antes del rollback
cp *.md ~/Desktop/backup-documentos/
```

---

## 🎯 Próximos Pasos (Después del Rollback)

Una vez que tengas el código limpio:

### Opción A: Migrar solo movimientos (Simple)

1. Seguir guía: `MIGRAR-SOLO-MOVIMIENTOS.md`
2. Ejecutar SQL en Supabase
3. Listo - no tocar código

### Opción B: Migración completa (Compleja)

1. Leer: `ESPECIFICACIONES-MIGRACION-SUPABASE.md`
2. Seguir plan de 6 fases
3. Hacer git commits frecuentes

---

## 🆘 Si Algo Sale Mal

### "No puedo hacer reset"
```bash
# Si dice que hay conflictos
git stash
git reset --hard origin/main
```

### "No sé en qué branch estoy"
```bash
git branch
# El que tiene * es el actual

# Para cambiar a main:
git checkout main
```

### "Borré algo importante"
```bash
# Si hiciste stash (Opción 1):
git stash list
git stash pop

# Si no hiciste stash pero commiteaste antes:
git reflog
# Busca el commit que quieres
git checkout <commit-hash>
```

### "Borré la base de datos por error"
```bash
# Restaurar del backup más reciente
cd server
cp registro.db.backup-20260131-210031 registro.db
```

---

## 📝 Comandos Resumidos (Copiar y pegar)

**Para rollback rápido y seguro**:
```bash
cd /Users/efmenem/Projects/registroApp
git stash
git fetch origin
git reset --hard origin/main
git clean -fd
git status
```

**Para verificar después**:
```bash
cd server && npm install && npm run dev  # Terminal 1
cd client && npm install && npm run dev  # Terminal 2
```

---

**Duración**: 2-5 minutos
**Riesgo**: Bajo (si sigues la Opción 1 con stash)
