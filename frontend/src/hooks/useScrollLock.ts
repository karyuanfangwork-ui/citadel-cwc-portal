import { useEffect } from 'react';

/**
 * Locks body scroll when `locked` is true.
 * Restores the previous overflow value on cleanup.
 * Use in any component that renders a modal/drawer overlay to prevent
 * background content from scrolling while the overlay is visible.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}