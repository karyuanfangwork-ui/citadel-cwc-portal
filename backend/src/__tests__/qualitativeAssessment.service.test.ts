import {
  SLIDER_TO_SCORE,
  toFactorScores,
  upsertQualitativeAssessment,
  getQualitativeAssessment,
} from '../credit/services/qualitativeAssessment.service';

jest.mock('../utils/prisma', () => ({
  qualitativeAssessment: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
}));

import prisma from '../utils/prisma';

describe('SLIDER_TO_SCORE', () => {
  it('maps slider 1 to 10', () => expect(SLIDER_TO_SCORE[1]).toBe(10));
  it('maps slider 3 to 50', () => expect(SLIDER_TO_SCORE[3]).toBe(50));
  it('maps slider 5 to 90', () => expect(SLIDER_TO_SCORE[5]).toBe(90));
  it('maps slider 2 to 32', () => expect(SLIDER_TO_SCORE[2]).toBe(32));
  it('maps slider 4 to 68', () => expect(SLIDER_TO_SCORE[4]).toBe(68));
});

describe('toFactorScores', () => {
  it('converts each slider to the correct score', () => {
    const scores = toFactorScores({
      managementScore: 5,
      relationshipScore: 1,
      industryScore: 3,
      collateralScore: 4,
    });
    expect(scores.management).toBe(90);
    expect(scores.relationship).toBe(10);
    expect(scores.industry).toBe(50);
    expect(scores.collateral).toBe(68);
  });

  it('defaults to 50 for an invalid slider value', () => {
    const scores = toFactorScores({
      managementScore: 99 as any,
      relationshipScore: 3,
      industryScore: 3,
      collateralScore: 3,
    });
    expect(scores.management).toBe(50);
  });
});

describe('upsertQualitativeAssessment', () => {
  it('calls prisma upsert with correct data and returns result', async () => {
    const mockResult = {
      id: 'qa-1',
      applicationId: 'app-1',
      managementScore: 4,
      relationshipScore: 3,
      industryScore: 2,
      collateralScore: 5,
      assessedById: 'user-1',
    };
    (prisma.qualitativeAssessment.upsert as jest.Mock).mockResolvedValue(mockResult);

    const result = await upsertQualitativeAssessment('app-1', 'user-1', {
      managementScore: 4,
      relationshipScore: 3,
      industryScore: 2,
      collateralScore: 5,
    });

    expect(prisma.qualitativeAssessment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: 'app-1' },
        create: expect.objectContaining({ managementScore: 4, assessedById: 'user-1' }),
        update: expect.objectContaining({ managementScore: 4, assessedById: 'user-1' }),
      }),
    );
    expect(result.managementScore).toBe(4);
  });
});

describe('getQualitativeAssessment', () => {
  it('returns null when no assessment exists', async () => {
    (prisma.qualitativeAssessment.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await getQualitativeAssessment('app-1');
    expect(result).toBeNull();
  });

  it('returns the assessment when it exists', async () => {
    const mockAssessment = { id: 'qa-1', applicationId: 'app-1', managementScore: 3 };
    (prisma.qualitativeAssessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);
    const result = await getQualitativeAssessment('app-1');
    expect(result).toEqual(mockAssessment);
  });
});
