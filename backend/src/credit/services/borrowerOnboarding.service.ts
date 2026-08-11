import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export type OnboardingStageName = 'PROFILE' | 'INCOME' | 'KYC' | 'AML' | 'DOCUMENTS';
export type OnboardingStageStatus = 'COMPLETED' | 'FAILED' | 'NOT_REQUIRED';
export interface BorrowerOnboardingStage {
  name: OnboardingStageName;
  status: OnboardingStageStatus;
  message?: string;
}
export interface BorrowerOnboardingResult {
  borrowerId: string;
  borrowerNumber: string;
  status: 'COMPLETED' | 'REQUIRES_FOLLOW_UP';
  stages: BorrowerOnboardingStage[];
}

type StoredRun = {
  borrowerId: string | null;
  status: string;
  stages: unknown;
};

class BorrowerOnboardingService {
  async run(
    userId: string,
    idempotencyKey: string,
    createProfile: () => Promise<{ id: string; borrowerNumber: string }>,
  ): Promise<BorrowerOnboardingResult> {
    const existing = await prisma.borrowerOnboardingRun.findUnique({ where: { idempotencyKey } }) as StoredRun | null;
    if (existing?.borrowerId && Array.isArray(existing.stages)) {
      const stages = existing.stages as BorrowerOnboardingStage[];
      const profile = await prisma.borrowerProfile.findUnique({
        where: { id: existing.borrowerId },
        select: { id: true, borrowerNumber: true },
      });
      if (profile) {
        return {
          borrowerId: profile.id,
          borrowerNumber: profile.borrowerNumber ?? '',
          status: existing.status === 'COMPLETED' ? 'COMPLETED' : 'REQUIRES_FOLLOW_UP',
          stages,
        };
      }
    }

    try {
      await prisma.borrowerOnboardingRun.create({
        data: {
          idempotencyKey,
          userId,
          stages: [{ name: 'PROFILE', status: 'COMPLETED' }] as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      const duplicate = await prisma.borrowerOnboardingRun.findUnique({ where: { idempotencyKey } }) as StoredRun | null;
      if (duplicate?.borrowerId) {
        const profile = await prisma.borrowerProfile.findUnique({ where: { id: duplicate.borrowerId }, select: { id: true, borrowerNumber: true } });
        if (profile) {
          return {
            borrowerId: profile.id,
            borrowerNumber: profile.borrowerNumber ?? '',
            status: 'REQUIRES_FOLLOW_UP',
            stages: Array.isArray(duplicate.stages) ? duplicate.stages as BorrowerOnboardingStage[] : [{ name: 'PROFILE', status: 'FAILED', message: 'Onboarding is already being resumed.' }],
          };
        }
      }
      throw error;
    }

    try {
      const profile = await createProfile();
      const stages: BorrowerOnboardingStage[] = [{ name: 'PROFILE', status: 'COMPLETED' }];
      await prisma.borrowerOnboardingRun.update({
        where: { idempotencyKey },
        data: { borrowerId: profile.id, status: 'COMPLETED', stages: stages as unknown as Prisma.InputJsonValue },
      });
      return { borrowerId: profile.id, borrowerNumber: profile.borrowerNumber, status: 'COMPLETED', stages };
    } catch (error) {
      await prisma.borrowerOnboardingRun.deleteMany({ where: { idempotencyKey, borrowerId: null } });
      throw error;
    }
  }
}

export const borrowerOnboardingService = new BorrowerOnboardingService();
