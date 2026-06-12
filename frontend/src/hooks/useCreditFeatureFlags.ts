import { useState, useEffect, useCallback } from 'react';
import creditService from '../services/credit.service';

/**
 * Credit feature flags — fetched from the backend public endpoint.
 *
 * Maps flag keys like 'credit:ecl' → boolean.
 * Uses the public /feature-flags/public endpoint (credit:read permission).
 * Results are cached for the lifetime of the component (no polling).
 */
export function useCreditFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    creditService.getPublicFeatureFlags()
      .then(data => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const f of data) {
          map[f.key] = f.enabled;
        }
        setFlags(map);
      })
      .catch(() => {
        // Non-critical — flags default to false
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /** Check if a specific feature flag is enabled. Defaults to false if unknown. */
  const isFeatureEnabled = useCallback((key: string): boolean => {
    return flags[key] ?? false;
  }, [flags]);

  return { flags, loading, isFeatureEnabled };
}