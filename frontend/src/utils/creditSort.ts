// frontend/src/utils/creditSort.ts
import type { CreditApplication, ApplicationState } from '../services/credit.service';

export type SortColumn = 'amount' | 'sla' | 'state';
export type SortDir = 'asc' | 'desc';

// Mirrors getSLAInfo logic — returns remaining days (negative = overdue, null = no SLA)
function slaRemainingDays(createdAt: string, state: ApplicationState): number | null {
  const slaMap: Partial<Record<ApplicationState, number>> = {
    DRAFT: 7, SUBMITTED: 3, KYC_REVIEW: 5, UNDERWRITING: 7, CREDIT_ASSESSMENT: 5,
    COMMITTEE_REVIEW: 3, OFFER: 5, ACCEPTED: 3,
  };
  const limit = slaMap[state];
  if (!limit) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return limit - days;
}

export function sortApplications(
  apps: CreditApplication[],
  column: SortColumn,
  dir: SortDir,
): CreditApplication[] {
  const sorted = [...apps];

  sorted.sort((a, b) => {
    if (column === 'amount') {
      const diff = (a.requestedAmount ?? 0) - (b.requestedAmount ?? 0);
      return dir === 'asc' ? diff : -diff;
    }

    if (column === 'state') {
      const aState = (a.state || a.status) as string;
      const bState = (b.state || b.status) as string;
      const diff = aState.localeCompare(bState);
      return dir === 'asc' ? diff : -diff;
    }

    // sla: null (no SLA) always last
    const aState = (a.state || a.status) as ApplicationState;
    const bState = (b.state || b.status) as ApplicationState;
    const aRem = slaRemainingDays(a.createdAt, aState);
    const bRem = slaRemainingDays(b.createdAt, bState);

    if (aRem === null && bRem === null) return 0;
    if (aRem === null) return 1;
    if (bRem === null) return -1;

    const diff = aRem - bRem;
    return dir === 'asc' ? diff : -diff;
  });

  return sorted;
}