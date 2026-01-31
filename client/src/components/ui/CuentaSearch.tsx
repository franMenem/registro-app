import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Cuenta {
  id: number;
  nombre: string;
  tipo: string;
}

interface CuentaSearchProps {
  cuentas: Cuenta[];
  value: number | undefined;
  onChange: (cuentaId: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CuentaSearch: React.FC<CuentaSearchProps> = ({
  cuentas,
  value,
  onChange,
  placeholder = 'Buscar cuenta corriente...',
  className = '',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<Cuenta | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cuando cambia el value desde afuera, actualizar la cuenta seleccionada
  useEffect(() => {
    if (value) {
      const cuenta = cuentas.find((c) => c.id === value);
      setSelectedCuenta(cuenta || null);
      setSearchTerm('');
    } else {
      setSelectedCuenta(null);
      setSearchTerm('');
    }
  }, [value, cuentas]);

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

  // Filtrar cuentas según el término de búsqueda
  const filteredCuentas = searchTerm
    ? cuentas.filter((c) =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : cuentas;

  const handleSelectCuenta = (cuenta: Cuenta) => {
    setSelectedCuenta(cuenta);
    setSearchTerm('');
    setShowDropdown(false);
    onChange(cuenta.id);
  };

  const handleClearCuenta = () => {
    setSelectedCuenta(null);
    setSearchTerm('');
    onChange(undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setShowDropdown(true);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {selectedCuenta ? (
        // Mostrar cuenta seleccionada
        <div
          className={`flex items-center justify-between w-full px-3 py-2 border border-border rounded-lg ${
            disabled ? 'bg-muted opacity-60 cursor-not-allowed' : 'bg-background'
          }`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{selectedCuenta.nombre}</p>
            <p className="text-xs text-text-secondary">{selectedCuenta.tipo}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClearCuenta}
              className="p-1 hover:bg-background-secondary rounded"
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          )}
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
            disabled={disabled}
            className={`w-full pl-10 pr-4 py-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
              disabled
                ? 'bg-muted opacity-60 cursor-not-allowed'
                : 'bg-background'
            }`}
          />
        </div>
      )}

      {/* Dropdown con resultados */}
      {showDropdown && !selectedCuenta && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredCuentas.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-secondary text-center">
              {searchTerm ? 'No se encontraron cuentas' : 'Escribe para buscar...'}
            </div>
          ) : (
            <>
              {/* Opción "Ninguna" */}
              <button
                type="button"
                onClick={handleClearCuenta}
                className="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-background-secondary border-b border-border"
              >
                Ninguna
              </button>

              {/* Lista de cuentas */}
              {filteredCuentas.map((cuenta) => (
                <button
                  key={cuenta.id}
                  type="button"
                  onClick={() => handleSelectCuenta(cuenta)}
                  className="w-full px-4 py-2 text-left hover:bg-background-secondary transition-colors border-b border-border/50 last:border-b-0"
                >
                  <p className="text-sm font-medium text-text-primary">{cuenta.nombre}</p>
                  <p className="text-xs text-text-secondary">{cuenta.tipo}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
