# App Gestión Registro Automotor

Aplicación web completa para gestión financiera de registro automotor en Argentina.

## Stack Tecnológico

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Base de Datos:** SQLite
- **Estructura:** Monorepo (client + server)

## Estructura del Proyecto

```
registroApp/
├── client/          # Frontend React
├── server/          # Backend Node.js
└── README.md
```

## Instalación

```bash
# Instalar todas las dependencias
npm run install:all

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build
```

## URLs de Desarrollo

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/api/health

## Características Fase 1

- ✅ Dashboard con métricas
- ✅ Formularios RENTAS y CAJA
- ✅ Controles automáticos (semanales/quincenales)
- ✅ Cuentas Corrientes (8 cuentas)
- ✅ Control POSNET
- ✅ Gestión de movimientos

## Conceptos RENTAS

1. GIT (semanal)
2. SUAT - Alta (semanal)
3. SUAT - Patentes (semanal)
4. SUAT - Infracciones (semanal)
5. SUCERP (semanal)
6. SUGIT (semanal)
7. PROVINCIA (ARBA) (quincenal)
8. Consulta
9. POSNET (control manual)
10. ICBC (a cuenta corriente)

## Conceptos CAJA

1. Arancel (mensual)
2. SUAT - Sellado (semanal)
3. SUCERP - Sellado (semanal)
4. Formularios (a cuenta corriente)
5. POSNET (control manual)
6. DEPOSITOS

## Cuentas Corrientes

1. Gastos Bancarios (RENTAS)
2. Gastos Link (RENTAS)
3. Gastos Bancarios CAJA
4. Gastos Formularios
5. Librería
6. María
7. Agua
8. Edesur

## Licencia

MIT
