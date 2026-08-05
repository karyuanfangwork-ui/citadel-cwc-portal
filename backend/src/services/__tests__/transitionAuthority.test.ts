/**
 * Tests that isValidTransition and getValidNextStatuses treat the DB as the
 * authoritative source — never falling back to the seed map for individual
 * pairs when the table is seeded.
 */

// Must be declared before jest.mock — the factory references it lazily at runtime.
const mockWorkflowTransitionCount = jest.fn();
const mockWorkflowTransitionFindMany = jest.fn();

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    workflowTransition: {
      count: mockWorkflowTransitionCount,
      findMany: mockWorkflowTransitionFindMany,
    },
  },
}));

import { isValidTransition, getValidNextStatuses } from '../../utils/workflowTransitions';

describe('isValidTransition table authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when an active transition exists in the DB', async () => {
    mockWorkflowTransitionCount.mockResolvedValueOnce(1);

    const result = await isValidTransition('SUBMITTED', 'IN_REVIEW');
    expect(result).toBe(true);
  });

  it('rejects a transition that is present in the seed map but deactivated in the table', async () => {
    // Table is seeded (rows exist) but this specific pair is inactive.
    mockWorkflowTransitionCount
      .mockResolvedValueOnce(0)   // matching active pair = 0
      .mockResolvedValueOnce(42); // table is non-empty overall

    const result = await isValidTransition('SUBMITTED', 'PROCUREMENT_IN_PROGRESS');
    expect(result).toBe(false);
  });

  it('falls back to the seed map only when the table is completely empty', async () => {
    mockWorkflowTransitionCount
      .mockResolvedValueOnce(0)  // matching active pair
      .mockResolvedValueOnce(0); // table empty — unseeded environment

    const result = await isValidTransition('SUBMITTED', 'PROCUREMENT_IN_PROGRESS');
    expect(result).toBe(true);
  });

  it('returns false for a genuinely invalid transition when table is empty', async () => {
    mockWorkflowTransitionCount
      .mockResolvedValueOnce(0)  // matching active pair
      .mockResolvedValueOnce(0); // table empty

    const result = await isValidTransition('RESOLVED', 'IN_PROGRESS');
    expect(result).toBe(false);
  });
});

describe('getValidNextStatuses table authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns DB rows when active transitions exist', async () => {
    mockWorkflowTransitionFindMany.mockResolvedValue([
      { toStatus: 'IN_REVIEW' },
      { toStatus: 'IN_PROGRESS' },
    ]);

    const result = await getValidNextStatuses('SUBMITTED');
    expect(result).toEqual(['IN_REVIEW', 'IN_PROGRESS']);
  });

  it('returns empty array when table is seeded but has no transitions for this status', async () => {
    mockWorkflowTransitionFindMany.mockResolvedValue([]);
    mockWorkflowTransitionCount.mockResolvedValueOnce(10);

    const result = await getValidNextStatuses('RESOLVED');
    expect(result).toEqual([]);
  });

  it('falls back to seed map when table is completely empty', async () => {
    mockWorkflowTransitionFindMany.mockResolvedValue([]);
    mockWorkflowTransitionCount.mockResolvedValueOnce(0);

    const result = await getValidNextStatuses('SUBMITTED');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('IN_REVIEW');
  });
});