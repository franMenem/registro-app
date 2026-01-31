import React, { useState } from 'react';

interface CUITInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export const CUITInput: React.FC<CUITInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '20-12345678-9',
  required = false,
}) => {
  const [displayValue, setDisplayValue] = useState(formatCUIT(value));

  function formatCUIT(input: string): string {
    // Remover todo excepto números
    const numbers = input.replace(/\D/g, '');

    // Limitar a 11 dígitos
    const limited = numbers.slice(0, 11);

    // Formatear: XX-XXXXXXXX-X
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 10) {
      return `${limited.slice(0, 2)}-${limited.slice(2)}`;
    } else {
      return `${limited.slice(0, 2)}-${limited.slice(2, 10)}-${limited.slice(10)}`;
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatCUIT(input);

    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatCUIT(pastedText);

    setDisplayValue(formatted);
    onChange(formatted);
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
      className={className}
      placeholder={placeholder}
      required={required}
      maxLength={13} // XX-XXXXXXXX-X = 13 caracteres
    />
  );
};
