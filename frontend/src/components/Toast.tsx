/**
 * @file Toast.tsx
 * @description Global toast notification system.
 *              Provides ToastProvider, useToast hook, and ToastItem component.
 *              Supports four severity levels: success, error, warning, info.
 *              Toasts auto-dismiss after a configurable duration (default 4 s).
 * @module components/Toast
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

interface ToastItemProps {
    toast: ToastMessage;
    onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
    const icons = {
        success: <CheckCircle size={20} className="text-green-400" />,
        error: <XCircle size={20} className="text-red-400" />,
        warning: <AlertTriangle size={20} className="text-yellow-400" />,
        info: <Info size={20} className="text-blue-400" />
    };

    const styles = {
        success: 'bg-green-900/90 border-green-500 text-green-100',
        error: 'bg-red-900/90 border-red-500 text-red-100',
        warning: 'bg-yellow-900/90 border-yellow-500 text-yellow-100',
        info: 'bg-blue-900/90 border-blue-500 text-blue-100'
    };

    return (
        <div className={`${styles[toast.type]} border-l-4 p-4 rounded-r-lg shadow-lg backdrop-blur-sm max-w-sm pointer-events-auto animate-slide-in`}>
            <div className="flex items-start gap-3">
                {icons[toast.type]}
                <p className="flex-1 text-sm font-medium">{toast.message}</p>
                <button onClick={onClose} className="text-gray-300 hover:text-white">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

// Standalone Toast component (for backward compatibility with main.jsx)
export default function Toast() {
    return null; // ToastProvider handles rendering now
}
