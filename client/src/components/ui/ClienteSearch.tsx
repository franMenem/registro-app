import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus, Loader2 } from 'lucide-react';
import { formatCUITInput } from '@/utils/format';

interface Cliente {
  id: number;
  cuit: string;
  razon_social: string;
}

interface ClienteSearchProps {
  clientes: Cliente[];
  value: number | undefined;
  onChange: (clienteId: number | undefined) => void;
  onCreateCliente?: (data: { cuit: string; razon_social: string }) => Promise<Cliente>;
  placeholder?: string;
  className?: string;
}

export const ClienteSearch: React.FC<ClienteSearchProps> = ({
  clientes,
  value,
  onChange,
  onCreateCliente,
  className = '',
}) => {
  const [searchCuit, setSearchCuit] = useState('');
  const [searchRazonSocial, setSearchRazonSocial] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCuit, setCreateCuit] = useState('');
  const [createRazonSocial, setCreateRazonSocial] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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
    const formatted = formatCUITInput(e.target.value);
    setSearchCuit(formatted);
    setShowDropdown(true);
  };

  const handleCuitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatCUITInput(pastedText);
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

  const handleOpenCreateForm = () => {
    setCreateCuit(searchCuit);
    setCreateRazonSocial(searchRazonSocial);
    setShowCreateForm(true);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setCreateCuit('');
    setCreateRazonSocial('');
  };

  const handleSubmitCreate = async () => {
    if (!onCreateCliente || !createCuit || !createRazonSocial) return;
    setIsCreating(true);
    try {
      const newCliente = await onCreateCliente({ cuit: createCuit, razon_social: createRazonSocial });
      handleSelectCliente(newCliente);
      setShowCreateForm(false);
      setCreateCuit('');
      setCreateRazonSocial('');
    } catch {
      // error handling is done by the parent via toast
    } finally {
      setIsCreating(false);
    }
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
          {showCreateForm ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nuevo cliente</p>
              <div>
                <label className="block text-xs text-text-secondary mb-1">CUIT *</label>
                <input
                  type="text"
                  value={createCuit}
                  onChange={(e) => setCreateCuit(formatCUITInput(e.target.value))}
                  placeholder="20-12345678-9"
                  maxLength={13}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Razón Social *</label>
                <input
                  type="text"
                  value={createRazonSocial}
                  onChange={(e) => setCreateRazonSocial(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  disabled={isCreating}
                  className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCreate}
                  disabled={isCreating || !createCuit || !createRazonSocial}
                  className="flex-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  {isCreating ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          ) : (
            <>
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

              {/* Botón crear cliente */}
              {onCreateCliente && (
                <button
                  type="button"
                  onClick={handleOpenCreateForm}
                  className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-primary/10 transition-colors border-t border-border flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Crear cliente nuevo
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
