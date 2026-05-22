import React, { useEffect, useRef, useCallback } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  className = '',
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Focus trap: store previous focus, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else {
      previousFocus.current?.focus();
    }
    return () => {
      if (!isOpen) return;
      previousFocus.current?.focus();
    };
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap within modal
  const handleTabTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal panel */}
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={handleTabTrap}
          className={`relative w-full ${SIZE_CLASSES[size]} bg-surface rounded-cwc-lg shadow-cwc-lg border border-cwc-border flex flex-col max-h-[90vh] animate-modal-fade-in ${className}`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-cwc-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>

          {/* Title */}
          {title && (
            <div className="px-6 pt-5 pb-3 border-b border-cwc-border">
              <h2 className="text-lg font-semibold text-text-primary pr-8">{title}</h2>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-cwc-border bg-surface-subtle rounded-b-cwc-lg">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Modal;