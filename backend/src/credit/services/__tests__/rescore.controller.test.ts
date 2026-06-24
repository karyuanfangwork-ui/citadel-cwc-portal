jest.mock('../scoring.service', () => ({
  scoringService: { executeScore: jest.fn() },
}));
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { creditApplication: { findUnique: jest.fn() } },
}));

import { rescoreApplication } from '../../controllers/comment.controller';
import { scoringService } from '../scoring.service';
import prisma from '../../../utils/prisma';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('rescoreApplication', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the scoring engine and returns the new score run id', async () => {
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue({ id: 'app-1' });
    (scoringService.executeScore as jest.Mock).mockResolvedValue({
      scoreRun: { id: 'run-9' },
      totalScore: 72,
      riskRating: 'A',
    });
    const req: any = { params: { id: 'app-1' }, user: { id: 'u-1' } };
    const res = mockRes();

    await rescoreApplication(req, res);

    expect(scoringService.executeScore).toHaveBeenCalledWith('app-1');
    expect(res.json).toHaveBeenCalledWith({
      data: { scoreRunId: 'run-9', riskRating: 'A', totalScore: 72 },
    });
  });

  it('returns 404 when application not found', async () => {
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(null);
    const req: any = { params: { id: 'missing' }, user: { id: 'u-1' } };
    const res = mockRes();

    await rescoreApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(scoringService.executeScore).not.toHaveBeenCalled();
  });
});