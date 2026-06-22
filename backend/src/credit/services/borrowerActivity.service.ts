import prisma from '../../utils/prisma';

export async function logBorrowerActivity(
  borrowerId: string,
  type: string,
  title: string,
  detail?: string,
  actorId?: string,
): Promise<void> {
  await prisma.borrowerActivity.create({
    data: {
      borrowerId,
      type,
      title,
      detail: detail ?? null,
      actorId: actorId ?? null,
    },
  });
}

export async function listBorrowerActivity(borrowerId: string, limit = 20) {
  return prisma.borrowerActivity.findMany({
    where: { borrowerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
