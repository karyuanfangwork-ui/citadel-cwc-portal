import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { CreditEncryptionService } from './encryption.service';
import { PiiReadLogService } from './piiReadLog.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateUboData {
  borrowerProfileId: string;
  name: string;
  nricPassport?: string | null;
  ownershipPct: number | string;
  isPep?: boolean;
  sourceOfWealth?: string | null;
  countryOfResidence?: string | null;
}

export interface UpdateUboData {
  name?: string;
  nricPassport?: string | null;
  ownershipPct?: number | string;
  isPep?: boolean;
  sourceOfWealth?: string | null;
  countryOfResidence?: string | null;
}

export interface ListUbosOptions {
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

function maskNric(record: any) {
  const plain = record.nricPassportEncrypted
    ? CreditEncryptionService.decrypt(record.nricPassportEncrypted)
    : null;
  return {
    ...record,
    nricPassport: plain ? CreditEncryptionService.maskNric(plain) : null,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class UboService {
  /**
   * List UBOs for a borrower profile with pagination.
   */
  async listUbos(options: ListUbosOptions) {
    const { borrowerProfileId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UltimateBeneficialOwnerWhereInput = {
      borrowerProfileId,
    };

    const [beneficialOwners, total] = await Promise.all([
      prisma.ultimateBeneficialOwner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ultimateBeneficialOwner.count({ where }),
    ]);

    return {
      beneficialOwners: beneficialOwners.map(maskNric),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single UBO by ID.
   */
  async getUbo(id: string, requestingUserId?: string) {
    const ubo = await prisma.ultimateBeneficialOwner.findUnique({
      where: { id },
    });

    if (!ubo) return null;

    if (ubo.nricPassportEncrypted && requestingUserId) {
      await PiiReadLogService.logPiiAccess(
        requestingUserId,
        'UltimateBeneficialOwner',
        id,
        'nricPassport',
      ).catch(() => {/* non-blocking */});
    }

    return decryptNric(ubo);
  }

  /**
   * Create a new UBO.
   */
  async createUbo(data: CreateUboData) {
    const nricTrimmed = data.nricPassport?.trim() || null;
    const createData: Prisma.UltimateBeneficialOwnerCreateInput = {
      name: data.name,
      nricPassportEncrypted: nricTrimmed ? CreditEncryptionService.encrypt(nricTrimmed) : null,
      nricPassportHmac: nricTrimmed ? CreditEncryptionService.hmacNric(nricTrimmed) : null,
      ownershipPct: new Prisma.Decimal(data.ownershipPct as string | number),
      isPep: data.isPep ?? false,
      sourceOfWealth: data.sourceOfWealth ?? undefined,
      countryOfResidence: data.countryOfResidence ?? undefined,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
    };

    const ubo = await prisma.ultimateBeneficialOwner.create({
      data: createData,
    });

    return decryptNric(ubo);
  }

  /**
   * Update an existing UBO.
   */
  async updateUbo(id: string, data: UpdateUboData) {
    const existing = await prisma.ultimateBeneficialOwner.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.UltimateBeneficialOwnerUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nricPassport !== undefined) {
      const nricTrimmed = data.nricPassport?.trim() || null;
      updateData.nricPassportEncrypted = nricTrimmed ? CreditEncryptionService.encrypt(nricTrimmed) : null;
      updateData.nricPassportHmac = nricTrimmed ? CreditEncryptionService.hmacNric(nricTrimmed) : null;
    }
    if (data.ownershipPct !== undefined) updateData.ownershipPct = new Prisma.Decimal(data.ownershipPct as string | number);
    if (data.isPep !== undefined) updateData.isPep = data.isPep;
    if (data.sourceOfWealth !== undefined) updateData.sourceOfWealth = data.sourceOfWealth;
    if (data.countryOfResidence !== undefined) updateData.countryOfResidence = data.countryOfResidence;

    const ubo = await prisma.ultimateBeneficialOwner.update({
      where: { id },
      data: updateData,
    });

    return decryptNric(ubo);
  }

  /**
   * Reveal the decrypted NRIC for a UBO (PII-logged).
   */
  async revealNric(id: string, requestingUserId: string) {
    const ubo = await prisma.ultimateBeneficialOwner.findUnique({ where: { id }, select: { nricPassportEncrypted: true } });
    if (!ubo || !ubo.nricPassportEncrypted) return null;
    await PiiReadLogService.logPiiAccess(requestingUserId, 'UltimateBeneficialOwner', id, 'nricPassport').catch(() => {});
    return CreditEncryptionService.decrypt(ubo.nricPassportEncrypted);
  }

  /**
   * Delete a UBO.
   */
  async deleteUbo(id: string) {
    const existing = await prisma.ultimateBeneficialOwner.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.ultimateBeneficialOwner.delete({ where: { id } });
  }
}

export const uboService = new UboService();
