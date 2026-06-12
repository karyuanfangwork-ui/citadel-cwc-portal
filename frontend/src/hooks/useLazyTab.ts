import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Lazy-load tab data — only fetches when the tab is activated.
 * Uses stale-while-revalidate: returns cached data immediately, then refreshes.
 *
 * @param tabId    The active tab identifier
 * @param fetcher  Async function that returns data for the given tab
 * @param enabled  Whether to fetch (e.g. app is loaded, user has permission)
 */
export function useLazyTab<T>(
  tabId: string,
  fetcher: (tabId: string) => Promise<T>,
  enabled: boolean = true,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, { data: T; ts: number }>>(new Map());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(tabId);
      if (mounted.current) {
        setData(result);
        cache.current.set(tabId, { data: result, ts: Date.now() });
      }
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || 'Failed to load tab data');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [tabId, fetcher, enabled]);

  // Fetch on tab activation
  useEffect(() => {
    if (!enabled) return;

    const cached = cache.current.get(tabId);
    if (cached) {
      // Stale-while-revalidate: show cached data, then refresh in background
      if (mounted.current) setData(cached.data);
      // Refresh if cache is > 60s old
      if (Date.now() - cached.ts > 60_000) {
        refresh();
      }
    } else {
      refresh();
    }
  }, [tabId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh };
}

export default useLazyTab;