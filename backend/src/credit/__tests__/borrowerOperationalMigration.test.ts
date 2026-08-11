import { describe, expect, it } from '@jest/globals';
import {
  chooseUnambiguousOwner,
  formatBorrowerNumber,
  mapBorrowerLifecycle,
  mapBorrowerSegment,
} from '../utils/borrowerOperational';

describe('borrower operational backfill contract', () => {
  it.each([
    ['INDIVIDUAL', 'INDIVIDUAL'],
    ['JOINT', 'INDIVIDUAL'],
    ['SOLE_PROPRIETOR', 'SME'],
    ['CORPORATE', 'CORPORATE'],
  ])('maps legal type %s to segment %s', (legalType, segment) => {
    expect(mapBorrowerSegment(legalType)).toBe(segment);
  });

  it('keeps lifecycle independent from deletedAt semantics', () => {
    expect(mapBorrowerLifecycle(true)).toBe('ACTIVE');
    expect(mapBorrowerLifecycle(false)).toBe('INACTIVE');
  });

  it('formats stable borrower numbers and rejects invalid sequence values', () => {
    expect(formatBorrowerNumber(1)).toBe('BRW-000001');
    expect(formatBorrowerNumber(42)).toBe('BRW-000042');
    expect(() => formatBorrowerNumber(0)).toThrow();
  });

  it('only assigns an owner when the latest application owner is unambiguous', () => {
    expect(chooseUnambiguousOwner(['user-1', 'user-1'])).toBe('user-1');
    expect(chooseUnambiguousOwner(['user-1', 'user-2'])).toBeNull();
    expect(chooseUnambiguousOwner([null, undefined])).toBeNull();
  });
});
