import { format as dateFnsFormat, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    // Si la fecha es string sin hora (formato yyyy-mm-dd), agregar hora del mediodía
    // para evitar problemas de zona horaria
    const dateStr = date.includes('T') ? date : date + 'T12:00:00';
    const dateObj = parseISO(dateStr);
    return dateFnsFormat(dateObj, 'dd/MM/yyyy', { locale: es });
  }
  return dateFnsFormat(date, 'dd/MM/yyyy', { locale: es });
};

export const formatDateTime = (date: string | Date): string => {
  if (typeof date === 'string') {
    // Si la fecha es string sin hora, agregar hora del mediodía
    const dateStr = date.includes('T') ? date : date + 'T12:00:00';
    const dateObj = parseISO(dateStr);
    return dateFnsFormat(dateObj, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
  }
  return dateFnsFormat(date, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
};

export const formatCUIT = (cuit: string): string => {
  // Remove non-digits
  const cleaned = cuit.replace(/\D/g, '');

  // Format as XX-XXXXXXXX-X
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
  }

  return cuit;
};

/**
 * Formatea CUIT progresivamente mientras el usuario escribe.
 * Usado en inputs con máscara (CUITInput, ClienteSearch).
 */
export const formatCUITInput = (input: string): string => {
  const numbers = input.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);

  if (limited.length <= 2) {
    return limited;
  } else if (limited.length <= 10) {
    return `${limited.slice(0, 2)}-${limited.slice(2)}`;
  } else {
    return `${limited.slice(0, 2)}-${limited.slice(2, 10)}-${limited.slice(10)}`;
  }
};

export const validateCUIT = (cuit: string): boolean => {
  const cleaned = cuit.replace(/\D/g, '');
  return cleaned.length === 11 && /^(20|23|27|30|33)\d{9}$/.test(cleaned);
};

/**
 * Parsea fechas ISO que vienen de Supabase/DB como strings.
 * Usa parseISO de date-fns para evitar el bug de timezone donde
 * new Date("2026-02-05") se interpreta como UTC y muestra el día anterior.
 * Retorna Invalid Date (sin tirar) si el string está vacío o es inválido.
 */
export const parseDateFromDB = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date(NaN);
  return parseISO(dateString);
};

/**
 * Formatea una fecha de DB de forma segura.
 * Retorna el fallback si la fecha es inválida o vacía.
 */
export const formatDateFromDB = (
  dateString: string | null | undefined,
  fmt: string,
  fallback = '-'
): string => {
  if (!dateString) return fallback;
  const date = parseISO(dateString);
  if (isNaN(date.getTime())) return fallback;
  return dateFnsFormat(date, fmt);
};
