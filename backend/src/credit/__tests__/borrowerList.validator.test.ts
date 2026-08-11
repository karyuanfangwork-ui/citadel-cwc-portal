import { describe, expect, it } from '@jest/globals';
import { borrowerListQuerySchema } from '../validators/borrowerList.validator';

describe('borrower operational list query contract', () => {
  it('applies safe defaults and coerces pagination values', () => {
    const result = borrowerListQuerySchema.parse({ query: { page: '2', limit: '40' } });
    expect(result.query).toMatchObject({ page: 2, limit: 40, sortBy: 'updatedAt', sortDirection: 'desc' });
  });

  it('rejects unbounded page sizes and unsupported sort fields', () => {
    expect(() => borrowerListQuerySchema.parse({ query: { limit: '10' } })).toThrow();
    expect(() => borrowerListQuerySchema.parse({ query: { sortBy: 'email' } })).toThrow();
  });

  it('accepts the operational filters used by the UI', () => {
    const result = borrowerListQuerySchema.parse({
      query: {
        segment: 'SME',
        status: 'ACTIVE',
        hasActiveApplication: 'true',
        sortBy: 'totalExposure',
        sortDirection: 'asc',
      },
    });
    expect(result.query).toMatchObject({ segment: 'SME', status: 'ACTIVE', hasActiveApplication: true });
  });
});
