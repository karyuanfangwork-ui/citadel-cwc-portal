import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reusable autosave hook for CA Memo tabs.
 *
 * Tracks dirty fields, debounces saves, registers browser beforeunload
 * guard, and exposes saving/savedAt/error/dirty state.
 *
 * Usage:
 *   const { save, saving, savedAt, dirty, error, clearDirty } = useAutosave({
 *     saveFn: async () => { const updated = await api.update(id, payload); return updated; },
 *     debounceMs: 1500,
 *   });
 *
 * - Call `markDirty(key?)` after each field change to register unsaved state.
 * - Call `save()` explicitly on blur or on demand.
 * - `beforeunload` guard is auto-registered while dirty.
 */
type UseAutosaveOptions<T = unknown> = {
  /** The async function that persists changes. Should return the updated object. */
  saveFn: () => Promise<T>;
  /** Debounce interval in ms for auto-save (default: 1500). Set to 0 to disable auto. */
  debounceMs?: number;
  /** Whether to suppress save when read-only (default: false). */
  readOnly?: boolean;
  /** Called after a successful save with the returned object. */
  onSaved?: (result: T) => void;
};

type UseAutosaveReturn<T> = {
  /** Trigger an explicit save (flushes debounce). */
  save: () => Promise<T | undefined>;
  /** True while a save is in flight. */
  saving: boolean;
  /** Timestamp of the last successful save. */
  savedAt: Date | null;
  /** Whether there are unsaved changes. */
  dirty: boolean;
  /** Last error message, null if no error. */
  error: string | null;
  /** Manually mark the form as dirty. */
  markDirty: () => void;
  /** Clear dirty state without saving (e.g. after external sync). */
  clearDirty: () => void;
  /** Clear error state. */
  clearError: () => void;
};

export default function useAutosave<T = unknown>(
  opts: UseAutosaveOptions<T>
): UseAutosaveReturn<T> {
  const { saveFn, debounceMs = 1500, readOnly = false, onSaved } = opts;

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Browser beforeunload guard ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but set for legacy support
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Save impl ───────────────────────────────────────────────────────
  const save = useCallback(async (): Promise<T | undefined> => {
    if (readOnly) return undefined;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveFn();
      setSavedAt(new Date());
      setDirty(false);
      onSaved?.(result);
      return result;
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Save failed';
      setError(msg);
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [saveFn, readOnly, onSaved]);

  // ── Auto-save debounce ─────────────────────────────────────────────
  useEffect(() => {
    if (!dirty || readOnly || debounceMs === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
    }, debounceMs);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [dirty, readOnly, debounceMs, save]);

  const markDirty = useCallback(() => setDirty(true), []);
  const clearDirty = useCallback(() => setDirty(false), []);
  const clearError = useCallback(() => setError(null), []);

  return { save, saving, savedAt, dirty, error, markDirty, clearDirty, clearError };
}