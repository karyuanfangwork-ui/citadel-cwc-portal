import prisma from '../../utils/prisma';
import { BureauProvider } from '@prisma/client';

export interface CreateBureauCheckData {
  provider: BureauProvider;
  subjectName?: string | null;
  runDate?: string | null;
  runById?: string | null;
  hasHits?: boolean | null;
  findings?: string | null;
  attachedDocId?: string | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.creditBureauCheck.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function create(applicationId: string, data: CreateBureauCheckData) {
  return prisma.creditBureauCheck.create({
    data: {
      applicationId,
      provider: data.provider,
      subjectName: data.subjectName ?? null,
      runDate: data.runDate ? new Date(data.runDate) : null,
      runById: data.runById ?? null,
      hasHits: data.hasHits ?? null,
      findings: data.findings ?? null,
      attachedDocId: data.attachedDocId ?? null,
    },
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function update(id: string, data: Partial<CreateBureauCheckData>) {
  return prisma.creditBureauCheck.update({
    where: { id },
    data: {
      provider: data.provider,
      subjectName: data.subjectName,
      runDate: data.runDate ? new Date(data.runDate) : data.runDate === null ? null : undefined,
      runById: data.runById,
      hasHits: data.hasHits,
      findings: data.findings,
      attachedDocId: data.attachedDocId,
    },
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function remove(id: string) {
  return prisma.creditBureauCheck.delete({ where: { id } });
}
