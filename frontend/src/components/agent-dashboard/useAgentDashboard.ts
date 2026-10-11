import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { AgentDashboardResponse, agentDashboardService, DashboardQuery } from '../../services/agent-dashboard.service';

const REFRESH_INTERVAL_MS = 60_000;
const SEARCH_DEBOUNCE_MS = 700;

function sameQueryExceptSearch(left: DashboardQuery, right: DashboardQuery): boolean {
  const { search: _leftSearch, ...leftFilters } = left;
  const { search: _rightSearch, ...rightFilters } = right;
  return JSON.stringify(leftFilters) === JSON.stringify(rightFilters);
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: number; response?: { status?: number } };
  return value.status ?? value.response?.status;
}

export function useAgentDashboard(query: DashboardQuery) {
  const debouncedSearch = useDebouncedValue(query.search ?? '', SEARCH_DEBOUNCE_MS);
  const queryKey = JSON.stringify({ ...query, search: debouncedSearch || undefined });
  const effectiveQuery = useMemo(() => JSON.parse(queryKey) as DashboardQuery, [queryKey]);
  const [stored, setStored] = useState<{ key: string; data: AgentDashboardResponse } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; error: unknown } | null>(null);
  const [staleKey, setStaleKey] = useState<string | null>(null);
  const [pollingDisabledKey, setPollingDisabledKey] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const lastSuccessAt = useRef(0);

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const hadData = stored?.key === queryKey;
    setLoadingKey(hadData ? null : queryKey);
    setRefreshingKey(hadData ? queryKey : null);
    setErrorState((current) => current?.key === queryKey ? current : null);

    agentDashboardService.get(effectiveQuery, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      lastSuccessAt.current = Date.now();
      setStored({ key: queryKey, data });
      setLoadingKey(null);
      setRefreshingKey(null);
      setErrorState(null);
      setStaleKey(null);
      setPollingDisabledKey(null);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadingKey(null);
      setRefreshingKey(null);
      setErrorState({ key: queryKey, error });
      if (hadData) setStaleKey(queryKey);
      if (errorStatus(error) === 401 || errorStatus(error) === 403) setPollingDisabledKey(queryKey);
    });

    return () => controller.abort();
  }, [queryKey, effectiveQuery, refreshVersion]);

  useEffect(() => {
    if (pollingDisabledKey === queryKey) return;
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSuccessAt.current >= REFRESH_INTERVAL_MS) refresh();
    };
    const interval = window.setInterval(refreshIfStale, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [pollingDisabledKey, queryKey, refresh]);

  const data = stored?.key === queryKey
    ? stored.data
    : stored && sameQueryExceptSearch(effectiveQuery, JSON.parse(stored.key) as DashboardQuery)
      ? stored.data
      : null;
  const storedQuery = stored ? JSON.parse(stored.key) as DashboardQuery : null;
  const searching = Boolean(data && (query.search ?? '') !== (storedQuery?.search ?? ''));
  return {
    data,
    searching,
    initialLoading: !data && loadingKey === queryKey,
    refreshing: Boolean(data) && refreshingKey === queryKey,
    error: errorState?.key === queryKey ? errorState.error : null,
    stale: staleKey === queryKey,
    refresh,
  };
}
