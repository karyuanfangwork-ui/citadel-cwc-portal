jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerOnboardingRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    borrowerProfile: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';
import { borrowerOnboardingService } from '../services/borrowerOnboarding.service';

describe('borrower onboarding idempotency', () => {
  const db = prisma as any;

  beforeEach(() => jest.clearAllMocks());

  it('returns the existing borrower for a repeated idempotency key', async () => {
    db.borrowerOnboardingRun.findUnique.mockResolvedValue({
      borrowerId: 'borrower-1',
      status: 'COMPLETED',
      stages: [{ name: 'PROFILE', status: 'COMPLETED' }],
    });
    db.borrowerProfile.findUnique.mockResolvedValue({ id: 'borrower-1', borrowerNumber: 'BRW-000001' });

    const createProfile = jest.fn();
    const result = await borrowerOnboardingService.run('user-1', 'idempotency-key-123456', createProfile);

    expect(result).toMatchObject({ borrowerId: 'borrower-1', borrowerNumber: 'BRW-000001', status: 'COMPLETED' });
    expect(createProfile).not.toHaveBeenCalled();
    expect(db.borrowerOnboardingRun.create).not.toHaveBeenCalled();
  });

  it('creates one profile and records the completed profile stage', async () => {
    db.borrowerOnboardingRun.findUnique.mockResolvedValue(null);
    db.borrowerOnboardingRun.create.mockResolvedValue({});
    db.borrowerOnboardingRun.update.mockResolvedValue({});
    const createProfile = jest.fn().mockResolvedValue({ id: 'borrower-2', borrowerNumber: 'BRW-000002' });

    const result = await borrowerOnboardingService.run('user-1', 'idempotency-key-abcdef', createProfile);

    expect(createProfile).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ borrowerId: 'borrower-2', status: 'COMPLETED' });
    expect(db.borrowerOnboardingRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'idempotency-key-abcdef' },
      data: expect.objectContaining({ borrowerId: 'borrower-2', status: 'COMPLETED' }),
    }));
  });
});
