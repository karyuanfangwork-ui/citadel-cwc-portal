import prisma from '../../utils/prisma';
import { SignoffRole } from '@prisma/client';

export interface CreateSignoffData {
  role: SignoffRole;
  signedById: string;
  designationSnapshot: string;
  ipAddress?: string | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.applicationSignoff.findMany({
    where: { applicationId },
    orderBy: { signedAt: 'asc' },
    include: { signedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function create(applicationId: string, data: CreateSignoffData) {
  const app = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    select: { preparedAt: true, reviewedAt: true, concurredAt: true },
  });

  // Enforce sign-off sequence
  if (data.role === 'REVIEWED_BY' && !app.preparedAt) {
    throw Object.assign(new Error('Application must be prepared before review'), { status: 422 });
  }
  if (data.role === 'CONCURRED_BY' && !app.reviewedAt) {
    throw Object.assign(new Error('Application must be reviewed before concurrence'), { status: 422 });
  }

  const signoff = await prisma.applicationSignoff.create({
    data: {
      applicationId,
      role: data.role,
      signedById: data.signedById,
      designationSnapshot: data.designationSnapshot,
      ipAddress: data.ipAddress ?? null,
    },
    include: { signedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  // Stamp timestamp on application
  const timestampField =
    data.role === 'PREPARED_BY' ? 'preparedAt' :
    data.role === 'REVIEWED_BY' ? 'reviewedAt' : 'concurredAt';

  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: { [timestampField]: new Date() },
  });

  return signoff;
}

export async function revoke(applicationId: string, role: SignoffRole, requestingUserId: string) {
  const signoff = await prisma.applicationSignoff.findUnique({
    where: { applicationId_role: { applicationId, role } },
  });
  if (!signoff) throw Object.assign(new Error('Sign-off not found'), { status: 404 });
  if (signoff.signedById !== requestingUserId) {
    throw Object.assign(new Error('Only the signer can revoke their own sign-off'), { status: 403 });
  }

  // Block revocation if a later role has already signed
  const app = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    select: { reviewedAt: true, concurredAt: true },
  });
  if (role === 'PREPARED_BY' && app.reviewedAt) {
    throw Object.assign(new Error('Cannot revoke: application has already been reviewed'), { status: 422 });
  }
  if (role === 'REVIEWED_BY' && app.concurredAt) {
    throw Object.assign(new Error('Cannot revoke: application has already been concurred'), { status: 422 });
  }

  await prisma.applicationSignoff.delete({ where: { applicationId_role: { applicationId, role } } });

  // Clear the corresponding timestamp
  const clearField =
    role === 'PREPARED_BY' ? 'preparedAt' :
    role === 'REVIEWED_BY' ? 'reviewedAt' : 'concurredAt';

  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: { [clearField]: null },
  });
}
