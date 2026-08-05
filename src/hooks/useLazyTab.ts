/**
 * P2-4: useLazyTab — lazy-loads tab data only when the tab is activated.
 *
 * Instead of firing 10+ API calls on page load, each tab component uses
 * this hook to fetch its data only when it becomes the active tab.
 * Data is cached after first fetch and refetched on explicit refresh.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useLazyTab(activeTab === 'financials', () =>
 *     creditService.getFinancials(applicationId)
 *   );
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseLazyTabResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Force a refetch regardless of cache */
  refetch: () => Promise<void>;
  /** True if data has been fetched at least once (even if stale) */
  initialized: boolean;
}

/**
 * Lazy-loads data for a tab only when it becomes active.
 *
 * @param isActive - Whether this tab is currently the active tab
 * @param fetcher - Async function that fetches the tab's data
 * @param deps - Additional dependencies that should trigger a refetch when changed
 */
export function useLazyTab<T>(
  isActive: boolean,
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): UseLazyTabResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Track whether we've fetched for the current deps
  const depsKey = JSON.stringify(deps);
  const lastFetchedDepsKey = useRef<string | null>(null);
  const abortRef = useRef<boolean>(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Skip if already fetched with same deps (unless force refresh)
    if (!forceRefresh && lastFetchedDepsKey.current === depsKey && initialized) {
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      if (!abortRef.current) {
        setData(result);
        setInitialized(true);
        lastFetchedDepsKey.current = depsKey;
      }
    } catch (e: any) {
      if (!abortRef.current) {
        setError(e?.message || 'Failed to load data');
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher, depsKey, initialized]);

  // Fetch when tab becomes active (but not on every re-render)
  useEffect(() => {
    if (isActive) {
      fetchData();
    }

    return () => {
      abortRef.current = true;
    };
  }, [isActive, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refetch, initialized };
}

export default useLazyTab;