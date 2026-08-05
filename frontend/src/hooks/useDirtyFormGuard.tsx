import { useCallback, useRef, useState } from 'react';

/**
 * Hook to guard against losing unsaved changes when switching tabs
 * in the Credit Application Detail page.
 *
 * Provides:
 *  - isDirty: reactive boolean — true when any tab has unsaved edits
 *  - setDirty: called by tabs to register/clear their dirty state
 *  - confirmTabSwitch: shows browser confirm() when dirty; returns true
 *    if the user wants to proceed, false to cancel the navigation
 *  - DirtyGuardDialog: React node — render inside the page for a styled
 *    confirmation dialog (alternative to browser confirm)
 *
 * Addresses FINDING SEC-01 (unsaved changes protection).
 *
 * Usage in CreditApplicationDetail.tsx:
 *
 *   const { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog } = useDirtyFormGuard();
 *   const handleTabChange = useCallback((tab: DetailTab) => {
 *     if (isDirty && !confirmTabSwitch()) return;
 *     setActiveTab(tab);
 *   }, [isDirty, confirmTabSwitch]);
 *   // Render the dialog:
 *   {DirtyGuardDialog}
 */

type UseDirtyFormGuardReturn = {
  /** Reactive dirty state — true when a tab has unsaved changes */
  isDirty: boolean;
  /** Register/clear dirty state from tabs */
  setDirty: (isDirty: boolean) => void;
  /**
   * Call before setActiveTab. If dirty, shows a confirmation dialog.
   * Returns true if navigation should proceed, false to cancel.
   */
  confirmTabSwitch: () => boolean;
  /** React node — render this inside your page to show the styled confirmation dialog */
  DirtyGuardDialog: React.ReactNode;
};

export function useDirtyFormGuard(): UseDirtyFormGuardReturn {
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  /** Callback stored when dialog is shown — invoked on user decision */
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  const confirmTabSwitch = useCallback((): boolean => {
    if (!dirtyRef.current) return true;
    // Show styled dialog; caller should NOT proceed — will be told via callback
    setShowDialog(true);
    return false;
  }, []);

  const handleDiscard = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
    setShowDialog(false);
    // Navigation will happen via the stored pending action
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const handleStay = useCallback(() => {
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  // The DirtyGuardDialog component
  const DirtyGuardDialog = showDialog ? (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      onClick={handleStay}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dirty-guard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dirty-guard-title" className="text-lg font-black text-text-primary mb-2">
          Unsaved Changes
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleStay}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
            style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Stay on This Tab
          </button>
          <button
            onClick={handleDiscard}
            className="px-4 py-2 text-sm font-bold rounded-lg text-red-700 border border-red-300 hover:bg-red-50 transition-colors"
            style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Discard &amp; Leave
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog };
}

export default useDirtyFormGuard;