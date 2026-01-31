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

export const validateCUIT = (cuit: string): boolean => {
  const cleaned = cuit.replace(/\D/g, '');
  return cleaned.length === 11 && /^(20|23|27|30|33)\d{9}$/.test(cleaned);
};
