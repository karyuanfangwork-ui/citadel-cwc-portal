import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: ToastMessage[];
    showToast: (type: ToastType, title: string, message: string, duration?: number) => void;
    success: (title: string, message: string, duration?: number) => void;
    error: (title: string, message: string, duration?: number) => void;
    warning: (title: string, message: string, duration?: number) => void;
    info: (title: string, message: string, duration?: number) => void;
    dismissToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((type: ToastType, title: string, message: string, duration: number = 5000) => {
        const id = Math.random().toString(36).slice(2);
        const toast: ToastMessage = { id, type, title, message, duration };
        
        setToasts((prev) => [...prev, toast]);

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }
    }, []);

    const success = useCallback((title: string, message: string, duration?: number) => {
        showToast('success', title, message, duration);
    }, [showToast]);

    const error = useCallback((title: string, message: string, duration?: number) => {
        showToast('error', title, message, duration);
    }, [showToast]);

    const warning = useCallback((title: string, message: string, duration?: number) => {
        showToast('warning', title, message, duration);
    }, [showToast]);

    const info = useCallback((title: string, message: string, duration?: number) => {
        showToast('info', title, message, duration);
    }, [showToast]);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, dismissToast, clearToasts }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export default ToastContext;
