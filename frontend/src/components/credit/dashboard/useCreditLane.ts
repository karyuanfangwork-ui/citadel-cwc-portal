import { useCallback, useState } from 'react';
import { hasPermission } from '../../../utils/permissions';
import type { User } from '../../../context/AuthContext';

export type CreditLane = 'rm' | 'approver' | 'manager';
export const CREDIT_LANE_STORAGE_KEY = 'credit.lane';

export const LANE_LABELS: Record<CreditLane, string> = {
  rm: 'My deals',
  approver: 'Decisions',
  manager: 'Portfolio',
};

export function availableLanes(user: User | null): CreditLane[] {
  const lanes: CreditLane[] = ['rm'];
  if (hasPermission(user, 'credit:approve')) lanes.push('approver');
  if (hasPermission(user, 'credit:admin')) lanes.push('manager');
  return lanes;
}

function inferLane(lanes: CreditLane[]): CreditLane {
  if (lanes.includes('manager')) return 'manager';
  if (lanes.includes('approver')) return 'approver';
  return 'rm';
}

function readStoredLane(): CreditLane | null {
  try {
    const raw = localStorage.getItem(CREDIT_LANE_STORAGE_KEY);
    return raw === 'rm' || raw === 'approver' || raw === 'manager' ? raw : null;
  } catch {
    return null;
  }
}

export function useCreditLane(user: User | null) {
  const lanes = availableLanes(user);
  const [lane, setLaneState] = useState<CreditLane>(() => {
    const stored = readStoredLane();
    return stored && lanes.includes(stored) ? stored : inferLane(lanes);
  });

  const setLane = useCallback((next: CreditLane) => {
    if (!lanes.includes(next)) return;
    setLaneState(next);
    try { localStorage.setItem(CREDIT_LANE_STORAGE_KEY, next); } catch { /* storage unavailable */ }
  }, [lanes]);

  return { lane, lanes, setLane };
}
