import { useState, useCallback, useRef } from 'react';

/**
 * §3.8 — Hook for managing ProgressOverlay state on long-running operations.
 *
 * Usage:
 *   const { progress, show, hide, wrap } = useProgressOverlay();
 *
 *   // Manual control:
 *   show('Calculating risk score…');
 *   await someAsyncOp();
 *   hide();
 *
 *   // Or wrap an async call:
 *   const result = await wrap(
 *     () => creditService.runScorecard(appId, scorecardId),
 *     'Calculating risk score…',
 *     'This may take up to 30 seconds'
 *   );
 */

export interface ProgressOverlayState {
  message: string;
  subMessage?: string;
  progress?: number;
  onCancel?: () => void;
  visible: boolean;
}

export function useProgressOverlay() {
  const [state, setState] = useState<ProgressOverlayState>({ message: '', visible: false });
  const abortRef = useRef<AbortController | null>(null);

  const show = useCallback((message: string, subMessage?: string, progress?: number, onCancel?: () => void) => {
    setState({ message, subMessage, progress, onCancel, visible: true });
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setState(prev => prev.visible ? { ...prev, progress } : prev);
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /**
   * Wrap an async operation with progress overlay.
   * Shows the overlay before the call and hides it after.
   * If the operation throws, the overlay is hidden and the error is re-thrown.
   */
  const wrap = useCallback(async <T,>(
    fn: () => Promise<T>,
    message: string,
    subMessage?: string,
  ): Promise<T> => {
    setState({ message, subMessage, visible: true });
    try {
      const result = await fn();
      setState(prev => ({ ...prev, visible: false }));
      return result;
    } catch (err) {
      setState(prev => ({ ...prev, visible: false }));
      throw err;
    }
  }, []);

  /**
   * Wrap an async operation with determinate progress.
   * The caller is responsible for calling updateProgress() during the operation.
   */
  const wrapWithProgress = useCallback(<T,>(
    fn: () => Promise<T>,
    message: string,
    subMessage?: string,
    onCancel?: () => void,
  ): Promise<T> => {
    setState({ message, subMessage, progress: 0, onCancel, visible: true });
    return fn().then(
      (result) => { setState(prev => ({ ...prev, visible: false })); return result; },
      (err) => { setState(prev => ({ ...prev, visible: false })); throw err; },
    );
  }, []);

  return {
    ...state,
    show,
    hide,
    updateProgress,
    wrap,
    wrapWithProgress,
  };
}

export default useProgressOverlay;