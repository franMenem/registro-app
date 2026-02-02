import toast, { Toaster } from 'react-hot-toast';

// Configuración global
export const toastConfig = {
  duration: 4000,
  position: 'top-right' as const,
  style: {
    background: '#363636',
    color: '#fff',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
};

// Helpers tipados para mostrar diferentes tipos de notificaciones
export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      icon: '✅',
      style: {
        background: '#10b981',
        color: '#fff',
      },
    });
  },

  error: (message: string) => {
    toast.error(message, {
      icon: '❌',
      style: {
        background: '#ef4444',
        color: '#fff',
      },
    });
  },

  info: (message: string) => {
    toast(message, {
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#fff',
      },
    });
  },

  warning: (message: string) => {
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#fff',
      },
    });
  },

  loading: (message: string) => {
    return toast.loading(message);
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },
};

// Componente para agregar al App.tsx
export function ToastProvider() {
  return <Toaster position="top-right" reverseOrder={false} />;
}
