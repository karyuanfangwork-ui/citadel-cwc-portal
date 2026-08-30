import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../api', () => ({ default: mockApiClient }));

import { scorecardApi } from '../credit.service';

const baseVersion = {
  id: 'version-1',
  scorecardId: 'scorecard-1',
  version: 1,
  factorWeights: { cashflow: 100 },
  retailFactorWeights: null,
  isActive: false,
  effectiveFrom: '2026-08-30T00:00:00.000Z',
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

describe('scorecard version API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes a legacy unapproved version as DRAFT', async () => {
    mockApiClient.get.mockResolvedValue({ data: { data: { versions: [baseVersion] } } });

    const [version] = await scorecardApi.listVersions('scorecard-1');

    expect(version.lifecycleStatus).toBe('DRAFT');
    expect(version.approvedById).toBeNull();
    expect(version.createdById).toBeNull();
  });

  it('normalizes an approved inactive version as APPROVED', async () => {
    mockApiClient.get.mockResolvedValue({
      data: { data: { versions: [{ ...baseVersion, approvedById: 'approver-1', approvedAt: '2026-08-30T01:00:00.000Z' }] } },
    });

    const [version] = await scorecardApi.listVersions('scorecard-1');

    expect(version.lifecycleStatus).toBe('APPROVED');
    expect(version.approvedById).toBe('approver-1');
  });

  it('normalizes an active version as ACTIVE', async () => {
    mockApiClient.get.mockResolvedValue({ data: { data: { versions: [{ ...baseVersion, isActive: true, approvedById: 'approver-1' }] } } });

    const [version] = await scorecardApi.listVersions('scorecard-1');

    expect(version.lifecycleStatus).toBe('ACTIVE');
  });

  it('uses the governed approval and activation endpoints', async () => {
    mockApiClient.post
      .mockResolvedValueOnce({ data: { data: { version: baseVersion } } })
      .mockResolvedValueOnce({ data: { data: { version: baseVersion } } });

    await scorecardApi.approveVersion('version-1');
    await scorecardApi.activateVersion('version-1');

    expect(mockApiClient.post).toHaveBeenNthCalledWith(1, '/credit/scorecard-versions/version-1/approve');
    expect(mockApiClient.post).toHaveBeenNthCalledWith(2, '/credit/scorecard-versions/version-1/activate');
  });
});
