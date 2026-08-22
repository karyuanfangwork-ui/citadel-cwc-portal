import prisma from '../../utils/prisma';
import { getScoreStatus } from '../services/comment.service';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findUnique: jest.fn(),
    },
  },
}));

const findUnique = (prisma.creditApplication.findUnique as jest.Mock);

describe('getScoreStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not mark a score stale when the material input and score run timestamps are equal', async () => {
    const timestamp = new Date('2026-08-21T08:32:00.000Z');
    findUnique.mockResolvedValue({
      retailIncome: { updatedAt: timestamp },
      borrowerProfile: { financialStatements: [] },
      scoreRuns: [{ createdAt: timestamp }],
    });

    await expect(getScoreStatus('application-1')).resolves.toEqual({
      lastScoreRunAt: timestamp.toISOString(),
      lastFinancialsUpdatedAt: timestamp.toISOString(),
      staleInputSource: 'Retail income / DSR',
      isOutdated: false,
    });
  });

  it('ignores generic application changes and uses the latest tracked material input', async () => {
    const financialTimestamp = new Date('2026-08-21T08:30:00.000Z');
    const scoreTimestamp = new Date('2026-08-21T08:31:00.000Z');
    findUnique.mockResolvedValue({
      retailIncome: null,
      borrowerProfile: { financialStatements: [{ updatedAt: financialTimestamp }] },
      scoreRuns: [{ createdAt: scoreTimestamp }],
    });

    await expect(getScoreStatus('application-1')).resolves.toMatchObject({
      lastFinancialsUpdatedAt: financialTimestamp.toISOString(),
      staleInputSource: 'Financial statements',
      isOutdated: false,
    });
  });

  it('marks the score stale when a tracked material input is newer than the score run', async () => {
    const financialTimestamp = new Date('2026-08-21T08:32:00.000Z');
    const scoreTimestamp = new Date('2026-08-21T08:31:00.000Z');
    findUnique.mockResolvedValue({
      retailIncome: { updatedAt: financialTimestamp },
      borrowerProfile: { financialStatements: [] },
      scoreRuns: [{ createdAt: scoreTimestamp }],
    });

    await expect(getScoreStatus('application-1')).resolves.toMatchObject({
      staleInputSource: 'Retail income / DSR',
      isOutdated: true,
    });
  });
});
