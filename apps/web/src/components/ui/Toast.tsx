'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody } from '@/heroui';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const toastManager = {
  toasts: [] as Toast[],
  listeners: [] as Array<(toasts: Toast[]) => void>,

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  },

  show(message: string, type: ToastType = 'info') {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast = { id, message, type };
    this.toasts.push(toast);
    this.notify();

    setTimeout(() => {
      this.remove(id);
    }, 3000);
  },

  remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  },
};

export const toast = {
  success: (message: string) => toastManager.show(message, 'success'),
  error: (message: string) => toastManager.show(message, 'error'),
  info: (message: string) => toastManager.show(message, 'info'),
  warning: (message: string) => toastManager.show(message, 'warning'),
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-success-50 dark:bg-success-950/30 border-success-200 dark:border-success-800 text-success-700 dark:text-success-400',
  error: 'bg-danger-50 dark:bg-danger-950/30 border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400',
  info: 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400',
  warning: 'bg-warning-50 dark:bg-warning-950/30 border-warning-200 dark:border-warning-800 text-warning-700 dark:text-warning-400',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          const colorClass = colors[toast.type];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
            >
              <Card className={`${colorClass} border min-w-[300px] max-w-[400px] shadow-lg`}>
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <p className="flex-1 text-sm font-medium">{toast.message}</p>
                    <button
                      onClick={() => toastManager.remove(toast.id)}
                      className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

