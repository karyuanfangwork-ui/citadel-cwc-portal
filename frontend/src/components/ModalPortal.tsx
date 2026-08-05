import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Hide browser-extension overlays (Edge autofill watermark, etc.) that inject
 *  elements at z-index 2147483647 and bleed through modal dialogs. */
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

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const el = useRef(document.createElement('div'));
  const [mounted, setMounted] = useState(false);
  const hiddenOverlays = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const root = document.body;
    root.appendChild(el.current);
    setMounted(true);

    // Mark <body> so global CSS can suppress browser-extension overlays
    document.body.classList.add('modal-open');
    // Suppress browser-extension overlays that sit above our z-[9999]
    hiddenOverlays.current = suppressExtensionOverlays();

    return () => {
      root.removeChild(el.current);
      document.body.classList.remove('modal-open');
      restoreExtensionOverlays(hiddenOverlays.current);
      hiddenOverlays.current = [];
    };
  }, []);

  if (!mounted) return null;

  return createPortal(children, el.current);
};

export default ModalPortal;