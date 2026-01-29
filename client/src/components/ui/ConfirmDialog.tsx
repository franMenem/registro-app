import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const variantColors = {
    danger: 'text-error',
    warning: 'text-warning',
    info: 'text-primary',
  };

  const variantBg = {
    danger: 'bg-error-light',
    warning: 'bg-warning-light',
    info: 'bg-primary-light',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
        <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg ${variantBg[variant]}`}>
          <AlertCircle className={`h-6 w-6 ${variantColors[variant]} flex-shrink-0`} />
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        </div>

        <div className="mb-6">
          <p className="text-text-primary whitespace-pre-line">{message}</p>
        </div>

        <div className="flex gap-4">
          <Button
            variant={variant === 'danger' ? 'primary' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
};
