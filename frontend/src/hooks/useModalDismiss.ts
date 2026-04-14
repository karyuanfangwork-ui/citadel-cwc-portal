import { useEffect } from 'react';

/**
 * Adds Escape key and backdrop-click dismiss to a modal.
 *
 * Usage:
 *   const { handleBackdropClick } = useModalDismiss(onClose);
 *   // Add onClick={handleBackdropClick} to the outer backdrop div.
 */
export function useModalDismiss(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return { handleBackdropClick };
}
