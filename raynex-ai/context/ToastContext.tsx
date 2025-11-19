import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '../types';

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              min-w-[300px] p-4 rounded-lg shadow-lg border-l-4 text-white animate-slide-up
              ${toast.type === 'success' ? 'bg-dark-surface border-green-500' : ''}
              ${toast.type === 'error' ? 'bg-dark-surface border-red-500' : ''}
              ${toast.type === 'info' ? 'bg-dark-surface border-blue-500' : ''}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};