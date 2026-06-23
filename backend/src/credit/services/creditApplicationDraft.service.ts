import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';

export type CreditApplicationDraftPayload = Prisma.InputJsonValue;

class CreditApplicationDraftService {
  async getCurrentDraft(userId: string) {
    return prisma.creditApplicationDraft.findUnique({ where: { userId } });
  }

  async saveCurrentDraft(userId: string, payload: CreditApplicationDraftPayload) {
    return prisma.creditApplicationDraft.upsert({
      where: { userId },
      create: { userId, payload },
      update: { payload },
    });
  }

  async deleteCurrentDraft(userId: string) {
    await prisma.creditApplicationDraft.deleteMany({ where: { userId } });
  }
}

export const creditApplicationDraftService = new CreditApplicationDraftService();
