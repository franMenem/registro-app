# 🚀 Cómo Iniciar la Aplicación

## Opción 1: Script Automático (Más Fácil)

Desde el directorio `/Users/efmenem/Projects/registroApp`:

```bash
./start.sh
```

Este script:
- Limpia procesos anteriores
- Inicia el backend en puerto 3000
- Inicia el frontend en puerto 5173

## Opción 2: Comando npm

Desde el directorio `/Users/efmenem/Projects/registroApp`:

```bash
npm run dev
```

## Opción 3: Manual (dos terminales)

**Terminal 1 - Backend:**
```bash
cd /Users/efmenem/Projects/registroApp/server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /Users/efmenem/Projects/registroApp/client
npm run dev
```

## URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000

## Detener los servidores

Presiona `Ctrl + C` en la terminal donde están corriendo.

Si quedaron procesos colgados:
```bash
lsof -ti :3000 | xargs kill -9  # Matar backend
lsof -ti :5173 | xargs kill -9  # Matar frontend
```
