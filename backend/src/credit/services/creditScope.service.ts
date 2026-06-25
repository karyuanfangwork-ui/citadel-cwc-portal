import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

export type CreditAuthUser = NonNullable<AuthRequest['user']>;

const BROAD_CREDIT_ROLES = new Set(['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER']);

function hasAny(values: string[] | undefined, allowed: Set<string> | string[]): boolean {
  if (!Array.isArray(values)) return false;
  const allowedSet = Array.isArray(allowed) ? new Set(allowed) : allowed;
  return values.some((value) => allowedSet.has(value));
}

class CreditScopeService {
  hasBroadCreditAccess(user: CreditAuthUser): boolean {
    return hasAny(user.roles, BROAD_CREDIT_ROLES) || user.permissions?.includes('credit:admin');
  }

  buildApplicationScopeWhere(user: CreditAuthUser): Prisma.CreditApplicationWhereInput {
    if (this.hasBroadCreditAccess(user)) return {};

    return {
      OR: [
        { assignedRmId: user.id },
        { assignedAnalystId: user.id },
      ],
    };
  }

  buildBorrowerScopeWhere(user: CreditAuthUser): Prisma.BorrowerProfileWhereInput {
    if (this.hasBroadCreditAccess(user)) return {};

    return {
      applications: {
        some: this.buildApplicationScopeWhere(user),
      },
    };
  }

  buildDocumentScopeWhere(user: CreditAuthUser): Prisma.CreditDocumentWhereInput {
    if (this.hasBroadCreditAccess(user)) return {};

    const appScope = this.buildApplicationScopeWhere(user);
    return {
      OR: [
        { uploadedById: user.id },
        { application: appScope },
        { borrowerProfile: this.buildBorrowerScopeWhere(user) },
      ],
    };
  }

  async assertCanAccessApplication(user: CreditAuthUser, applicationId: string): Promise<void> {
    const application = await prisma.creditApplication.findFirst({
      where: {
        id: applicationId,
        deletedAt: null,
        ...this.buildApplicationScopeWhere(user),
      },
      select: { id: true },
    });

    if (!application) {
      throw new AppError('Credit application not found or access denied', 404);
    }
  }

  async assertCanAccessBorrower(user: CreditAuthUser, borrowerProfileId: string): Promise<void> {
    const borrower = await prisma.borrowerProfile.findFirst({
      where: {
        id: borrowerProfileId,
        deletedAt: null,
        ...this.buildBorrowerScopeWhere(user),
      },
      select: { id: true },
    });

    if (!borrower) {
      throw new AppError('Borrower profile not found or access denied', 404);
    }
  }

  async assertCanAccessDocument(user: CreditAuthUser, documentId: string): Promise<void> {
    const document = await prisma.creditDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        ...this.buildDocumentScopeWhere(user),
      },
      select: { id: true },
    });

    if (!document) {
      throw new AppError('Document not found or access denied', 404);
    }
  }
}

export const creditScopeService = new CreditScopeService();
