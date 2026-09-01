import { useCallback, useEffect, useMemo, useState } from 'react';
import creditService, {
  normalizeApplication,
  type ApplicationSnapshotDetail,
  type ApplicationSnapshotSummary,
  type CreditApplication,
} from '../services/credit.service';
import {
  resolveSnapshotMode,
  type SnapshotViewMode,
} from '../components/credit/applicationSnapshotView';

export interface UseApplicationSnapshotResult {
  mode: SnapshotViewMode;
  effectiveMode: SnapshotViewMode;
  snapshot: ApplicationSnapshotSummary | null;
  snapshotApplication: CreditApplication | null;
  resolvedApplication: CreditApplication;
  snapshots: ApplicationSnapshotSummary[];
  loading: boolean;
  error: string | null;
  viewingLive: boolean;
  setViewingLive: (value: boolean) => void;
}

export function useApplicationSnapshot(
  applicationId: string,
  state: string | null | undefined,
  liveApplication: CreditApplication,
): UseApplicationSnapshotResult {
  const [snapshots, setSnapshots] = useState<ApplicationSnapshotSummary[]>([]);
  const [detail, setDetail] = useState<ApplicationSnapshotDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingLive, setViewingLive] = useState(false);

  const resolution = useMemo(() => resolveSnapshotMode(state, snapshots), [state, snapshots]);

  useEffect(() => {
    if (!applicationId || !isDecidedForFetch(state)) {
      setSnapshots([]);
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const list = await creditService.getApplicationSnapshots(applicationId);
        if (cancelled) return;
        setSnapshots(list);

        const chosen = resolveSnapshotMode(state, list).snapshot;
        if (!chosen) {
          setDetail(null);
          return;
        }

        const full = await creditService.getApplicationSnapshot(applicationId, chosen.id);
        if (cancelled) return;
        setDetail(full);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load snapshot');
        setSnapshots([]);
        setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, state]);

  const snapshotApplication = useMemo(() => {
    if (!detail?.payload) return null;
    return normalizeApplication(detail.payload);
  }, [detail]);

  const showingSnapshot = resolution.mode === 'snapshot' && !viewingLive && !!snapshotApplication;
  const setViewingLiveStable = useCallback((value: boolean) => setViewingLive(value), []);

  return {
    mode: resolution.mode,
    effectiveMode: showingSnapshot ? 'snapshot' : resolution.mode === 'snapshot' ? 'live' : resolution.mode,
    snapshot: resolution.snapshot,
    snapshotApplication,
    resolvedApplication: showingSnapshot ? (snapshotApplication as CreditApplication) : liveApplication,
    snapshots,
    loading,
    error,
    viewingLive,
    setViewingLive: setViewingLiveStable,
  };
}

function isDecidedForFetch(state: string | null | undefined): boolean {
  return resolveSnapshotMode(state, []).mode !== 'live';
}
