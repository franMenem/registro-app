# 🚀 Quick Start Guide

## Instalación Rápida (5 minutos)

### 1. Instalar Dependencias
```bash
# Desde la raíz del proyecto
npm run install:all
```

### 2. Inicializar Base de Datos
```bash
cd server
npm run db:init
cd ..
```

### 3. Ejecutar Aplicación
```bash
npm run dev
```

**✅ Listo!** Abre tu navegador en: http://localhost:5173

---

## 📋 Verificación Rápida

### Backend OK?
```bash
curl http://localhost:3000/api/health
```
Deberías ver: `{"status":"ok","message":"Registro App API is running",...}`

### Datos OK?
```bash
curl http://localhost:3000/api/conceptos | grep -c nombre
```
Deberías ver: `16` (conceptos cargados)

---

## 🎯 Prueba Rápida del Sistema

1. **Dashboard** (http://localhost:5173)
   - Ver 4 métricas en 0

2. **Crear Movimiento RENTAS** (http://localhost:5173/rentas)
   - Fecha: Hoy
   - CUIT: `20-12345678-9`
   - Concepto: `GIT`
   - Monto: `1000`
   - Click "Guardar"
   - ✅ Verás alerta de control semanal creado

3. **Ver Control Creado** (http://localhost:5173/planillas)
   - Busca "GIT" en Controles Semanales
   - ✅ Verás $1,000 con fecha de pago próximo lunes

4. **Crear Movimiento a Cuenta** (http://localhost:5173/rentas)
   - CUIT: `20-12345678-9`
   - Concepto: `ICBC`
   - Monto: `500`
   - ✅ Verás alerta de egreso en cuenta

5. **Ver Cuenta Actualizada** (http://localhost:5173/cuentas)
   - Tab "Gastos Bancarios"
   - ✅ Verás movimiento de -$500, saldo: -$500

---

## 📊 Estructura de URLs

| URL | Página | Estado |
|-----|--------|---------|
| `/` | Dashboard | ✅ Funcional |
| `/rentas` | Formulario RENTAS | ✅ Funcional |
| `/caja` | Formulario CAJA | ✅ Funcional |
| `/cuentas` | Cuentas Corrientes | ✅ Funcional |
| `/planillas` | Controles | ✅ Funcional |
| `/reportes` | Reportes | 🚧 Fase 2 |
| `/configuracion` | Configuración | 🚧 Fase 2 |

---

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev                  # Cliente + Servidor
npm run dev:client          # Solo cliente
npm run dev:server          # Solo servidor

# Base de Datos
cd server
npm run db:init             # Resetear BD

# Build Producción
npm run build               # Cliente + Servidor
npm run build:client        # Solo cliente
npm run build:server        # Solo servidor
```

---

## 🐛 Problemas Comunes

**Puerto ocupado?**
```bash
# Cambiar puerto en server/.env
PORT=3001
# Actualizar en client/.env
VITE_API_URL=http://localhost:3001/api
```

**BD corrupta?**
```bash
cd server
rm registro.db
npm run db:init
```

**Dependencias rotas?**
```bash
rm -rf node_modules client/node_modules server/node_modules
npm run install:all
```

---

## 📚 Documentación Completa

- **SETUP.md** - Guía detallada de instalación y configuración
- **IMPLEMENTATION_SUMMARY.md** - Resumen técnico completo
- **README.md** - Información general del proyecto

---

## ✨ Características Implementadas

### ✅ Fase 1 (COMPLETA)
- Dashboard con métricas en tiempo real
- Formularios RENTAS y CAJA con validaciones
- Controles automáticos semanales (GIT, SUAT, etc.)
- Controles automáticos quincenales (ARBA)
- 8 Cuentas Corrientes con gestión completa
- Control mensual POSNET
- 20 API endpoints RESTful
- Base de datos SQLite con 9 tablas

### 🚧 Próximas Fases
- **Fase 2:** Gastos mensuales, adelantos empleados
- **Fase 3:** Reportes con gráficos, exportar Excel/PDF
- **Fase 4:** Configuración avanzada, backups, logs

---

## 💡 Consejos

1. **Siempre inicializa la BD** antes de la primera ejecución
2. **No edites registro.db** directamente, usa la aplicación
3. **Revisa las alertas** después de crear movimientos
4. **Los controles son automáticos** - no los crees manualmente
5. **POSNET requiere revisión manual** - solo se registra

---

**Versión:** 1.0.0
**Fecha:** 27 de Enero 2026
**Estado:** ✅ Producción Ready (Fase 1)

**¡Disfruta la aplicación!** 🎉
