import prisma from '../../utils/prisma';
import { CreditEncryptionService } from './encryption.service';

// ---------------------------------------------------------------------------
// §3.4 — FATCA/CRS Declaration Service
// ---------------------------------------------------------------------------

export interface CrsResidency {
  country: string;
  tin?: string | null;
}

export interface UpsertFatcaCrsData {
  declarationDate: string;
  isUsPerson: boolean;
  usTin?: string | null;
  entityClassification: 'INDIVIDUAL' | 'ACTIVE_NFE' | 'PASSIVE_NFE' | 'FINANCIAL_INSTITUTION';
  crsResidencies: CrsResidency[];
  expiryDate?: string | null;
}

function decorate(record: any) {
  return {
    ...record,
    usTin: record.usTinEncrypted ? CreditEncryptionService.decrypt(record.usTinEncrypted) : null,
    usTinEncrypted: undefined,
  };
}

class FatcaCrsService {
  async getByBorrower(borrowerProfileId: string) {
    const record = await prisma.fatcaCrsDeclaration.findFirst({
      where: { borrowerProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        selfCertifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return record ? decorate(record) : null;
  }

  async upsert(borrowerProfileId: string, selfCertifiedById: string, dto: UpsertFatcaCrsData) {
    const existing = await prisma.fatcaCrsDeclaration.findFirst({
      where: { borrowerProfileId },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      declarationDate: new Date(dto.declarationDate),
      isUsPerson: dto.isUsPerson,
      usTinEncrypted: dto.usTin ? CreditEncryptionService.encryptGcm(dto.usTin) : null,
      entityClassification: dto.entityClassification,
      crsResidencies: dto.crsResidencies as any,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
    };

    let record;
    if (existing) {
      record = await prisma.fatcaCrsDeclaration.update({
        where: { id: existing.id },
        data: {
          ...data,
          // Re-declaring resets verification — requires a fresh second-person check
          verifiedById: null,
          verifiedAt: null,
        },
        include: {
          selfCertifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          verifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    } else {
      record = await prisma.fatcaCrsDeclaration.create({
        data: {
          ...data,
          borrowerProfileId,
          selfCertifiedById,
        },
        include: {
          selfCertifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          verifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    }

    return decorate(record);
  }

  async verify(declarationId: string, verifiedById: string) {
    const existing = await prisma.fatcaCrsDeclaration.findUnique({ where: { id: declarationId } });
    if (!existing) return null;

    if (existing.selfCertifiedById === verifiedById) {
      throw new Error('Verification must be performed by a different officer than the self-certifier');
    }

    const record = await prisma.fatcaCrsDeclaration.update({
      where: { id: declarationId },
      data: { verifiedById, verifiedAt: new Date() },
      include: {
        selfCertifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return decorate(record);
  }

  async checkExpiry(borrowerProfileId: string): Promise<{ exists: boolean; expired: boolean; expiryDate: Date | null }> {
    const record = await prisma.fatcaCrsDeclaration.findFirst({
      where: { borrowerProfileId },
      orderBy: { createdAt: 'desc' },
      select: { expiryDate: true },
    });

    if (!record) {
      return { exists: false, expired: false, expiryDate: null };
    }

    const expired = !!record.expiryDate && record.expiryDate.getTime() < Date.now();
    return { exists: true, expired, expiryDate: record.expiryDate };
  }
}

export const fatcaCrsService = new FatcaCrsService();
