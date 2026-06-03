// frontend/src/utils/__tests__/creditSort.test.ts
import { describe, it, expect } from 'vitest';
import { sortApplications } from '../creditSort';
import type { CreditApplication, ApplicationState } from '../../services/credit.service';

const base: CreditApplication = {
  id: '1',
  applicationNo: 'CA-001',
  borrowerProfileId: 'bp-1',
  productType: 'TERM_LOAN',
  requestedAmount: 0,
  requestedTenor: null,
  currency: 'MYR',
  purpose: null,
  state: 'DRAFT',
  riskRating: null,
  rmId: null,
  analystId: null,
  submittedAt: null,
  decisionedAt: null,
  rejectionReason: null,
  withdrawalReason: null,
  closedAt: null,
  withdrawnAt: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  borrowerProfile: undefined,
  rm: undefined,
};

const make = (overrides: Partial<CreditApplication>): CreditApplication => ({ ...base, ...overrides });

describe('sortApplications', () => {
  describe('amount column', () => {
    it('sorts ascending', () => {
      const apps = [make({ id: 'a', requestedAmount: 5000 }), make({ id: 'b', requestedAmount: 1000 })];
      const result = sortApplications(apps, 'amount', 'asc');
      expect(result.map(a => a.id)).toEqual(['b', 'a']);
    });

    it('sorts descending', () => {
      const apps = [make({ id: 'a', requestedAmount: 1000 }), make({ id: 'b', requestedAmount: 5000 })];
      const result = sortApplications(apps, 'amount', 'desc');
      expect(result.map(a => a.id)).toEqual(['b', 'a']);
    });
  });

  describe('sla column', () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago → overdue
    const recent = new Date(Date.now() - 1 * 86400000).toISOString(); // 1 day ago → ok

    it('puts overdue first when ascending', () => {
      const apps = [
        make({ id: 'ok',      createdAt: recent, state: 'KYC_REVIEW' }),
        make({ id: 'overdue', createdAt: old,    state: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'asc');
      expect(result[0].id).toBe('overdue');
    });

    it('puts healthy first when descending', () => {
      const apps = [
        make({ id: 'ok',      createdAt: recent, state: 'KYC_REVIEW' }),
        make({ id: 'overdue', createdAt: old,    state: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'desc');
      expect(result[0].id).toBe('ok');
    });

    it('puts no-SLA (DRAFT) last regardless of direction', () => {
      const apps = [
        make({ id: 'draft',   createdAt: old, state: 'DRAFT' }),
        make({ id: 'overdue', createdAt: old, state: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'asc');
      expect(result[result.length - 1].id).toBe('draft');
    });
  });

  it('returns a new array (does not mutate input)', () => {
    const apps = [make({ id: 'a' }), make({ id: 'b' })];
    const result = sortApplications(apps, 'amount', 'asc');
    expect(result).not.toBe(apps);
  });
});