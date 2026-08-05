jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: {
      findFirst: jest.fn().mockResolvedValue({ id: 'bp-1', deletedAt: null }),
      update: jest.fn().mockResolvedValue({ id: 'bp-1', industry: 'TECH' }),
    },
  },
}));

import { borrowerProfileService } from '../borrowerProfile.service';
import prisma from '../../../utils/prisma';

describe('borrower profile update ignores creditRiskRating', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not persist creditRiskRating supplied via generic update', async () => {
    await borrowerProfileService.updateBorrowerProfile('bp-1', {
      creditRiskRating: 'AAA',
      industry: 'TECH',
    } as any);

    const updateCall = (prisma.borrowerProfile.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('creditRiskRating');
    expect(updateCall.data).toHaveProperty('industry', 'TECH');
  });

  it('persists other fields normally', async () => {
    await borrowerProfileService.updateBorrowerProfile('bp-1', {
      industry: 'FINANCE',
      email: 'test@example.com',
    } as any);

    const updateCall = (prisma.borrowerProfile.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('industry', 'FINANCE');
    expect(updateCall.data).toHaveProperty('email', 'test@example.com');
  });
});