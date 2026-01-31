import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Cliente {
  id: number;
  cuit: string;
  razon_social: string;
}

interface ClienteSearchProps {
  clientes: Cliente[];
  value: number | undefined;
  onChange: (clienteId: number | undefined) => void;
  placeholder?: string;
  className?: string;
}

export const ClienteSearch: React.FC<ClienteSearchProps> = ({
  clientes,
  value,
  onChange,
  placeholder = 'Buscar cliente por CUIT o nombre...',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cuando cambia el value desde afuera, actualizar el cliente seleccionado
  useEffect(() => {
    if (value) {
      const cliente = clientes.find((c) => c.id === value);
      setSelectedCliente(cliente || null);
      setSearchTerm('');
    } else {
      setSelectedCliente(null);
      setSearchTerm('');
    }
  }, [value, clientes]);

  // Cerrar dropdown cuando se hace click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar clientes según el término de búsqueda
  const filteredClientes = searchTerm
    ? clientes.filter(
        (c) =>
          c.cuit.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.razon_social.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : clientes;

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setSearchTerm('');
    setShowDropdown(false);
    onChange(cliente.id);
  };

  const handleClearCliente = () => {
    setSelectedCliente(null);
    setSearchTerm('');
    onChange(undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {selectedCliente ? (
        // Mostrar cliente seleccionado
        <div className="flex items-center justify-between w-full px-3 py-2 border border-border rounded-lg bg-background">
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">
              {selectedCliente.razon_social}
            </p>
            <p className="text-xs text-text-secondary font-mono">{selectedCliente.cuit}</p>
          </div>
          <button
            type="button"
            onClick={handleClearCliente}
            className="p-1 hover:bg-background-secondary rounded"
          >
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>
      ) : (
        // Input de búsqueda
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {/* Dropdown con resultados */}
      {showDropdown && !selectedCliente && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredClientes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-secondary text-center">
              {searchTerm ? 'No se encontraron clientes' : 'Escribe para buscar...'}
            </div>
          ) : (
            <>
              {/* Opción "Ninguno" */}
              <button
                type="button"
                onClick={handleClearCliente}
                className="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-background-secondary border-b border-border"
              >
                Ninguno
              </button>

              {/* Lista de clientes */}
              {filteredClientes.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => handleSelectCliente(cliente)}
                  className="w-full px-4 py-2 text-left hover:bg-background-secondary transition-colors border-b border-border/50 last:border-b-0"
                >
                  <p className="text-sm font-medium text-text-primary">
                    {cliente.razon_social}
                  </p>
                  <p className="text-xs text-text-secondary font-mono">{cliente.cuit}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
