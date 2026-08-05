import React from 'react';

type ConfirmDialogVariant = 'danger' | 'primary' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  description?: string; // Optional longer description below the message
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<ConfirmDialogVariant, string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  primary: 'bg-brand-700 hover:bg-brand-800 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
  children,
}) => {
  if (!open) return null;

  const confirmBtnClass = variantStyles[confirmVariant] ?? variantStyles.primary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-text-primary mb-2">{title}</h2>
        <p className="text-sm text-text-secondary mb-1">{message}</p>
        {description && (
          <p className="text-xs text-text-tertiary mb-4 whitespace-pre-line">{description}</p>
        )}
        {children}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
            style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${confirmBtnClass}`}
            style={{ border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;