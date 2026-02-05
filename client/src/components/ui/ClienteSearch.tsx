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

// Función para formatear CUIT con guiones
function formatCUIT(input: string): string {
  const numbers = input.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);
  if (limited.length <= 2) {
    return limited;
  } else if (limited.length <= 10) {
    return `${limited.slice(0, 2)}-${limited.slice(2)}`;
  } else {
    return `${limited.slice(0, 2)}-${limited.slice(2, 10)}-${limited.slice(10)}`;
  }
}

export const ClienteSearch: React.FC<ClienteSearchProps> = ({
  clientes,
  value,
  onChange,
  className = '',
}) => {
  const [searchCuit, setSearchCuit] = useState('');
  const [searchRazonSocial, setSearchRazonSocial] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cuando cambia el value desde afuera, actualizar el cliente seleccionado
  useEffect(() => {
    if (value) {
      const cliente = clientes.find((c) => c.id === value);
      setSelectedCliente(cliente || null);
      setSearchCuit('');
      setSearchRazonSocial('');
    } else {
      setSelectedCliente(null);
      setSearchCuit('');
      setSearchRazonSocial('');
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

  // Filtrar clientes según los términos de búsqueda
  const filteredClientes = clientes.filter((cliente) => {
    const cuitNormalizado = searchCuit.replace(/-/g, '').toLowerCase();
    const clienteCuitNormalizado = cliente.cuit.replace(/-/g, '').toLowerCase();

    const matchCuit = !searchCuit || clienteCuitNormalizado.includes(cuitNormalizado);
    const matchRazon = !searchRazonSocial || cliente.razon_social.toLowerCase().includes(searchRazonSocial.toLowerCase());

    return matchCuit && matchRazon;
  });

  const hasSearchTerms = searchCuit || searchRazonSocial;

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setSearchCuit('');
    setSearchRazonSocial('');
    setShowDropdown(false);
    onChange(cliente.id);
  };

  const handleClearCliente = () => {
    setSelectedCliente(null);
    setSearchCuit('');
    setSearchRazonSocial('');
    onChange(undefined);
  };

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCUIT(e.target.value);
    setSearchCuit(formatted);
    setShowDropdown(true);
  };

  const handleCuitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatCUIT(pastedText);
    setSearchCuit(formatted);
    setShowDropdown(true);
  };

  const handleRazonSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchRazonSocial(e.target.value);
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
        // Inputs de búsqueda
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">CUIT</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  value={searchCuit}
                  onChange={handleCuitChange}
                  onPaste={handleCuitPaste}
                  onFocus={handleInputFocus}
                  placeholder="20-12345678-9"
                  maxLength={13}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Razón Social</label>
              <input
                type="text"
                value={searchRazonSocial}
                onChange={handleRazonSocialChange}
                onFocus={handleInputFocus}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dropdown con resultados */}
      {showDropdown && !selectedCliente && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredClientes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-secondary text-center">
              {hasSearchTerms ? 'No se encontraron clientes' : 'Escribe para buscar...'}
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
