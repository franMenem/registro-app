#!/bin/bash

# Script para iniciar ambos servidores (frontend y backend)

echo "🚀 Iniciando servidores de Registro App..."

# Matar procesos anteriores en puerto 3000 y 5173
echo "🧹 Limpiando procesos anteriores..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Esperar un momento
sleep 1

# Iniciar ambos servidores con npm run dev desde el root
echo "✅ Iniciando backend y frontend..."
npm run dev
