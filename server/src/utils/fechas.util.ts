import { startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, format, getDay } from 'date-fns';

/**
 * Calcula el rango de una semana laboral (Lunes a Viernes)
 */
export const calcularSemanaLaboral = (fecha: Date): { fechaInicio: string; fechaFin: string } => {
  // Obtener lunes de la semana
  const lunes = startOfWeek(fecha, { weekStartsOn: 1 });

  // Obtener viernes de la semana
  const viernes = addDays(lunes, 4);

  return {
    fechaInicio: format(lunes, 'yyyy-MM-dd'),
    fechaFin: format(viernes, 'yyyy-MM-dd'),
  };
};

/**
 * Calcula el próximo lunes después de una fecha
 */
export const calcularProximoLunes = (fecha: Date): string => {
  const dia = getDay(fecha);

  // Si es domingo (0), el próximo lunes es en 1 día
  // Si es lunes (1), el próximo lunes es en 7 días
  // Si es martes-sábado (2-6), calcular días hasta el siguiente lunes
  const diasHastaLunes = dia === 0 ? 1 : (8 - dia);

  const proximoLunes = addDays(fecha, diasHastaLunes);
  return format(proximoLunes, 'yyyy-MM-dd');
};

/**
 * Calcula el rango de una quincena
 */
export const calcularQuincena = (
  fecha: Date
): {
  quincena: 'PRIMERA' | 'SEGUNDA';
  fechaInicio: string;
  fechaFin: string;
  mes: number;
  anio: number;
} => {
  const dia = fecha.getDate();
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  if (dia <= 15) {
    // Primera quincena: día 1 al 15
    return {
      quincena: 'PRIMERA',
      fechaInicio: format(startOfMonth(fecha), 'yyyy-MM-dd'),
      fechaFin: format(new Date(anio, mes - 1, 15), 'yyyy-MM-dd'),
      mes,
      anio,
    };
  } else {
    // Segunda quincena: día 16 al fin de mes
    return {
      quincena: 'SEGUNDA',
      fechaInicio: format(new Date(anio, mes - 1, 16), 'yyyy-MM-dd'),
      fechaFin: format(endOfMonth(fecha), 'yyyy-MM-dd'),
      mes,
      anio,
    };
  }
};

/**
 * Calcula el 5to día corrido (NO hábil) después de una fecha
 */
export const calcular5toDiaCorrido = (fechaInicio: Date): string => {
  const fecha = addDays(fechaInicio, 5);
  return format(fecha, 'yyyy-MM-dd');
};

/**
 * Obtiene mes y año de una fecha
 */
export const obtenerMesAnio = (fecha: Date): { mes: number; anio: number } => {
  return {
    mes: fecha.getMonth() + 1,
    anio: fecha.getFullYear(),
  };
};
