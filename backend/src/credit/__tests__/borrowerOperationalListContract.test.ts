import { describe, expect, it } from '@jest/globals';
import { scopeOperationalBorrowerQuery } from '../controllers/borrowerProfile.controller';
import { getAppliedOperationalSort, getOperationalBorrowerOrderBy } from '../services/borrowerProfile.service';

describe('production borrower list contract', () => {
  it('forces ordinary users to their authenticated branch and ignores query overrides', () => {
    expect(scopeOperationalBorrowerQuery(
      { branchId: 'query-branch', page: 1, limit: 20, sortBy: 'updatedAt', sortDirection: 'desc' },
      { permissions: ['credit:read'], branchId: 'user-branch' },
    ).branchId).toBe('user-branch');
  });

  it('uses the requested branch scope for credit administrators', () => {
    expect(scopeOperationalBorrowerQuery(
      { branchId: 'query-branch', page: 1, limit: 20, sortBy: 'updatedAt', sortDirection: 'desc' },
      { permissions: ['credit:read', 'credit:admin'], branchId: 'user-branch' },
    ).branchId).toBe('query-branch');
  });

  it('maps all database-sortable fields to real Prisma order fields', () => {
    expect(getOperationalBorrowerOrderBy('status', 'asc')).toEqual({ lifecycleStatus: 'asc' });
    expect(getOperationalBorrowerOrderBy('totalExposure', 'desc')).toEqual({ totalExposure: 'desc' });
    expect(getOperationalBorrowerOrderBy('activeApplicationCount', 'desc')).toEqual({ updatedAt: 'desc' });
  });

  it('reports the honest fallback for computed active-application sorting', () => {
    expect(getAppliedOperationalSort('activeApplicationCount', 'desc')).toMatchObject({
      field: 'updatedAt',
      direction: 'desc',
    });
    expect(getAppliedOperationalSort('activeApplicationCount', 'desc')).toHaveProperty('fallback');
  });
});
