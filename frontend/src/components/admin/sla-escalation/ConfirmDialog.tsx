import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
    const dialogRef = useFocusTrap(open);
    const cancelRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onCancel}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sla-confirm-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    <span className="material-symbols-outlined">{variant === 'danger' ? 'warning' : 'help'}</span>
                </div>
                <h2 id="sla-confirm-title" className="text-lg font-black text-[#101418]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#44546f]">{message}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-[#44546f] hover:bg-gray-50">Cancel</button>
                    <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}
