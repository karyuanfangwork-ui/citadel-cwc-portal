import prisma from '../../utils/prisma';

export interface CreateRmdIssueData {
  issueDescription: string;
  businessUnitResponse?: string | null;
  sortOrder?: number;
}

export async function listByApplication(applicationId: string) {
  return prisma.rmdIssue.findMany({
    where: { applicationId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function create(applicationId: string, data: CreateRmdIssueData) {
  return prisma.rmdIssue.create({
    data: {
      applicationId,
      issueDescription: data.issueDescription,
      businessUnitResponse: data.businessUnitResponse ?? null,
      sortOrder: data.sortOrder ?? 1,
    },
  });
}

export async function update(id: string, data: Partial<CreateRmdIssueData>) {
  return prisma.rmdIssue.update({
    where: { id },
    data: {
      issueDescription: data.issueDescription,
      businessUnitResponse: data.businessUnitResponse,
      sortOrder: data.sortOrder,
    },
  });
}

export async function remove(id: string) {
  return prisma.rmdIssue.delete({ where: { id } });
}
