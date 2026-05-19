import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { CreditEncryptionService } from './encryption.service';
import { PiiReadLogService } from './piiReadLog.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateShareholderData {
  borrowerProfileId: string;
  contactId?: string | null;
  name: string;
  nricPassport?: string | null;
  shareholdingPct?: number | string | null;
  shareClass?: string | null;
  numberOfShares?: number | null;
}

export interface UpdateShareholderData {
  contactId?: string | null;
  name?: string;
  nricPassport?: string | null;
  shareholdingPct?: number | string | null;
  shareClass?: string | null;
  numberOfShares?: number | null;
}

export interface ListShareholdersOptions {
  borrowerProfileId: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function decryptNric(record: any) {
  return {
    ...record,
    nricPassport: record.nricPassportEncrypted
      ? CreditEncryptionService.decrypt(record.nricPassportEncrypted)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ShareholderService {
  /**
   * List shareholders for a borrower profile with pagination.
   */
  async listShareholders(options: ListShareholdersOptions) {
    const { borrowerProfileId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ShareholderWhereInput = {
      borrowerProfileId,
    };

    const [shareholders, total] = await Promise.all([
      prisma.shareholder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { shareholdingPct: 'desc' },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.shareholder.count({ where }),
    ]);

    return {
      shareholders: shareholders.map(decryptNric),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single shareholder by ID.
   */
  async getShareholder(id: string, requestingUserId?: string) {
    const shareholder = await prisma.shareholder.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!shareholder) return null;

    if (shareholder.nricPassportEncrypted && requestingUserId) {
      await PiiReadLogService.logPiiAccess(
        requestingUserId,
        'Shareholder',
        id,
        'nricPassport',
      ).catch(() => {/* non-blocking */});
    }

    return decryptNric(shareholder);
  }

  /**
   * Create a new shareholder.
   */
  async createShareholder(data: CreateShareholderData) {
    const createData: Prisma.ShareholderCreateInput = {
      name: data.name,
      nricPassportEncrypted: data.nricPassport?.trim()
        ? CreditEncryptionService.encrypt(data.nricPassport.trim())
        : null,
      shareholdingPct: data.shareholdingPct != null ? new Prisma.Decimal(data.shareholdingPct as string | number) : undefined,
      shareClass: data.shareClass ?? undefined,
      numberOfShares: data.numberOfShares ?? undefined,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
    };

    const shareholder = await prisma.shareholder.create({
      data: createData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return decryptNric(shareholder);
  }

  /**
   * Update an existing shareholder.
   */
  async updateShareholder(id: string, data: UpdateShareholderData) {
    const existing = await prisma.shareholder.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.ShareholderUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nricPassport !== undefined) {
      updateData.nricPassportEncrypted = data.nricPassport?.trim()
        ? CreditEncryptionService.encrypt(data.nricPassport.trim())
        : null;
    }
    if (data.shareholdingPct !== undefined) updateData.shareholdingPct = data.shareholdingPct != null ? new Prisma.Decimal(data.shareholdingPct as string | number) : null;
    if (data.shareClass !== undefined) updateData.shareClass = data.shareClass;
    if (data.numberOfShares !== undefined) updateData.numberOfShares = data.numberOfShares;
    if (data.contactId !== undefined) {
      updateData.contact = data.contactId ? { connect: { id: data.contactId } } : { disconnect: true };
    }

    const shareholder = await prisma.shareholder.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return decryptNric(shareholder);
  }

  /**
   * Delete a shareholder.
   */
  async deleteShareholder(id: string) {
    const existing = await prisma.shareholder.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.shareholder.delete({ where: { id } });
  }
}

export const shareholderService = new ShareholderService();
