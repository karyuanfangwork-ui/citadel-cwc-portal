import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';

interface ModalWrapperProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

/** Hide browser-extension overlays (Edge autofill watermark, etc.) that inject
 *  elements at z-index 2147483647 and bleed through modal dialogs.
 *  These are often shadow-DOM elements, so we walk the DOM for any element
 *  with an extremely high inline z-index and temporarily hide it. */
function suppressExtensionOverlays() {
  const hidden: HTMLElement[] = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const style = el.style;
    if (!style || !style.zIndex) return;
    const z = parseInt(style.zIndex, 10);
    // Our modals max out at z-[9999]; anything ≥1 000 000 is a browser extension
    if (z >= 1_000_000) {
      const prev = style.display;
      el.setAttribute('data-prev-display', prev || '');
      style.display = 'none';
      hidden.push(el);
    }
  });
  return hidden;
}

function restoreExtensionOverlays(hidden: HTMLElement[]) {
  hidden.forEach((el) => {
    const prev = el.getAttribute('data-prev-display') || '';
    el.style.display = prev;
    el.removeAttribute('data-prev-display');
  });
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
  open, onClose, title, children, maxWidth = '560px',
}) => {
  const prevFocus = useRef<HTMLElement | null>(null);
  const hiddenOverlays = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      // Suppress browser-extension overlays that sit above our z-[9999]
      hiddenOverlays.current = suppressExtensionOverlays();
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
      restoreExtensionOverlays(hiddenOverlays.current);
      hiddenOverlays.current = [];
      if (prevFocus.current) prevFocus.current.focus();
    };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <FocusTrap active={open}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="bg-surface rounded-cwc-lg shadow-cwc-lg p-6 max-h-[90vh] overflow-y-auto isolate"
          style={{ maxWidth, width: '100%', margin: '0 16px' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">{title}</h2>
            <button
              aria-label="Close dialog"
              onClick={onClose}
              className="rounded-cwc-md p-1.5 hover:bg-surface-muted transition-colors text-text-tertiary"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {children}
        </div>
      </div>
    </FocusTrap>,
    document.body
  );
};

export default ModalWrapper;