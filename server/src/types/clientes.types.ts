/**
 * Types para Clientes
 */

export interface Cliente {
  id: number;
  cuit: string;
  razon_social: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteCreate {
  cuit: string;
  razon_social: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
}

export interface ClienteUpdate {
  cuit?: string;
  razon_social?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
}

export interface ClienteFilters {
  search?: string; // Buscar por CUIT o razón social
}
