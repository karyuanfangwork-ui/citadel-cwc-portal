import prisma from '../../utils/prisma';

/** Link live borrower statements to the first application that reaches committee. */
export async function linkStatementsToApplication(
  applicationId: string,
): Promise<{ linked: number; alreadyLinked: number }> {
  const application = await prisma.creditApplication.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { id: true, borrowerProfileId: true },
  });

  if (!application?.borrowerProfileId) return { linked: 0, alreadyLinked: 0 };

  const statements = await prisma.financialStatement.findMany({
    where: { borrowerProfileId: application.borrowerProfileId, deletedAt: null },
    select: { id: true, applicationId: true },
  });
  const unlinkedIds = statements.filter((statement) => statement.applicationId === null).map((statement) => statement.id);
  const alreadyLinked = statements.length - unlinkedIds.length;

  if (unlinkedIds.length === 0) return { linked: 0, alreadyLinked };

  const { count } = await prisma.financialStatement.updateMany({
    where: { id: { in: unlinkedIds }, applicationId: null },
    data: { applicationId },
  });
  return { linked: count, alreadyLinked };
}
