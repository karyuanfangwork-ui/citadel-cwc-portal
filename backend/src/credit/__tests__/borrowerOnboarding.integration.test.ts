jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerOnboardingRun: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

  it('persists post-create stages to the specified run when a borrower has multiple runs', async () => {
    const stages = [
      { name: 'PROFILE' as const, status: 'COMPLETED' as const },
      { name: 'KYC' as const, status: 'FAILED' as const, message: 'Screening service is unavailable.' },
    ];
    db.borrowerOnboardingRun.update.mockResolvedValue({
      idempotencyKey: 'run-1',
      borrowerId: 'borrower-1',
      status: 'REQUIRES_FOLLOW_UP',
      stages,
    });
    db.borrowerOnboardingRun.updateMany.mockResolvedValue({ count: 1 });
    db.borrowerOnboardingRun.findFirst.mockResolvedValue({
      idempotencyKey: 'run-2',
      borrowerId: 'borrower-1',
      status: 'COMPLETED',
      stages: [{ name: 'PROFILE', status: 'COMPLETED' }],
    });
    db.borrowerProfile.findUnique.mockResolvedValue({ id: 'borrower-1', borrowerNumber: 'BRW-000001' });

    await borrowerOnboardingService.recordStages('run-1', stages);

    expect(db.borrowerOnboardingRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'run-1' },
      data: expect.objectContaining({ status: 'REQUIRES_FOLLOW_UP', stages }),
    }));
    expect(db.borrowerOnboardingRun.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { borrowerId: 'borrower-1' },
    }));
  });
});
