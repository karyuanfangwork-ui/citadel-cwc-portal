import React, { useEffect, useRef } from 'react';

type DrawerSide = 'right' | 'left';
type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl';

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: DrawerSide;
  width?: DrawerWidth;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const WIDTH_CLASSES: Record<DrawerWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const SIDE_CLASSES: Record<DrawerSide, string> = {
  right: 'right-0',
  left: 'left-0',
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  side = 'right',
  width = 'md',
  className = '',
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Focus panel on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`
          fixed top-0 bottom-0 z-[70] w-full ${WIDTH_CLASSES[width]} ${SIDE_CLASSES[side]}
          bg-surface shadow-cwc-lg flex flex-col
          transition-transform duration-300 ease-in-out
          ${side === 'right' ? 'border-l border-cwc-border' : 'border-r border-cwc-border'}
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cwc-border">
          {title ? (
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-cwc-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors ml-auto"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-cwc-border bg-surface-subtle">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

export default Drawer;