import { useEffect, useRef, useCallback, useState } from 'react';

const DRAFT_PREFIX = 'cwc_draft_';

/**
 * Hook that auto-saves form data to localStorage with debounce,
 * restores on mount, and provides draft status info.
 */
export function useDraftSave<T extends Record<string, any>>(
  key: string,
  data: T,
  setData: (data: T) => void,
  debounceMs: number = 2000,
) {
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `${DRAFT_PREFIX}${key}`;

  // Save draft with debounce
  useEffect(() => {
    // Don't save empty/default state
    const isEmpty = !data.summary && !data.description && Object.keys(data.customFields || {}).length === 0;
    if (isEmpty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        setLastSaved(new Date());
        setHasDraft(true);
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, storageKey, debounceMs]);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.summary || parsed.description || Object.keys(parsed.customFields || {}).length > 0)) {
          setHasDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed);
        setLastSaved(new Date());
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [storageKey, setData]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const discardAndRestore = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return { hasDraft, lastSaved, restoreDraft, clearDraft, discardAndRestore };
}

/**
 * Component that shows a draft-save status chip.
 */
export function DraftSaveChip({ hasDraft, lastSaved, onRestore, onClear }: {
  hasDraft: boolean;
  lastSaved: Date | null;
  onRestore: () => void;
  onClear: () => void;
}) {
  if (!hasDraft) return null;

  const timeAgo = lastSaved
    ? `Saved ${formatTimeAgo(lastSaved)}`
    : 'Draft available';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-cwc-lg text-xs font-medium text-amber-800">
      <span className="material-symbols-outlined text-sm text-amber-600">save_as</span>
      <span>{timeAgo}</span>
      <button
        type="button"
        onClick={onRestore}
        className="ml-1 px-2 py-0.5 bg-amber-200/60 hover:bg-amber-300 rounded text-amber-900 font-semibold transition-colors"
      >
        Restore
      </button>
      <button
        type="button"
        onClick={onClear}
        className="px-2 py-0.5 text-amber-600 hover:text-amber-800 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}