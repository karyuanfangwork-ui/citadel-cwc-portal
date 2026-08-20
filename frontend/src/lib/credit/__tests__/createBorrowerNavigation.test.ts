import { describe, expect, it } from 'vitest';
import { getPostCreateDestination } from '../createBorrowerNavigation';

describe('getPostCreateDestination', () => {
  it('returns to a new credit application with the created borrower when requested', () => {
    expect(getPostCreateDestination('borrower-42', 'application')).toBe('/credit/applications/new?borrowerId=borrower-42');
  });

  it('keeps the borrower detail destination without an application return context', () => {
    expect(getPostCreateDestination('borrower-42', null)).toBe('/credit/borrowers/borrower-42');
  });
});
