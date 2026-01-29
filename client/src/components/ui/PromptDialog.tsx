import React, { useState, useEffect } from 'react';
import { Button } from './Button';

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'number' | 'date' | 'textarea';
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  inputType = 'text',
}) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
        <h2 className="text-2xl font-bold text-text-primary mb-4">{title}</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <p className="text-text-secondary mb-3">{message}</p>
            {inputType === 'textarea' ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                autoFocus
              />
            ) : (
              <input
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" variant="primary" className="flex-1">
              {confirmText}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {cancelText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
