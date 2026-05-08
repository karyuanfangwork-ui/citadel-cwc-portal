import React from 'react';
import { useToast, ToastMessage } from '../context/ToastContext';

const ToastIcon: React.FC<{ type: string }> = ({ type }) => {
    const icons: Record<string, string> = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
    };

    const colors: Record<string, string> = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-blue-600',
    };

    return (
        <span className={`material-symbols-outlined text-xl ${colors[type] || colors.info}`}>
            {icons[type] || icons.info}
        </span>
    );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    const bgColors: Record<string, string> = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-yellow-50 border-yellow-200',
        info: 'bg-blue-50 border-blue-200',
    };

    const titleColors: Record<string, string> = {
        success: 'text-green-900',
        error: 'text-red-900',
        warning: 'text-yellow-900',
        info: 'text-blue-900',
    };

    const messageColors: Record<string, string> = {
        success: 'text-green-700',
        error: 'text-red-700',
        warning: 'text-yellow-700',
        info: 'text-blue-700',
    };

    return (
        <div
            className={`w-full max-w-sm bg-white border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in-right ${bgColors[toast.type]}`}
            style={{ borderLeftWidth: '4px' }}
        >
            <ToastIcon type={toast.type} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${titleColors[toast.type]}`}>{toast.title}</p>
                <p className={`text-xs mt-0.5 ${messageColors[toast.type]} break-words`}>{toast.message}</p>
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                aria-label="Close notification"
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
            >
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    );
};

const ToastContainer: React.FC = () => {
    const { toasts, dismissToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div role="status" aria-live="polite" aria-label="Notifications" className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
        </div>
    );
};

export default ToastContainer;
