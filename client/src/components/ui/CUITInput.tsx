import React, { useState } from 'react';
import { formatCUITInput } from '@/utils/format';

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
  const [displayValue, setDisplayValue] = useState(formatCUITInput(value));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatCUITInput(input);

    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatCUITInput(pastedText);

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
      maxLength={13}
    />
  );
};
