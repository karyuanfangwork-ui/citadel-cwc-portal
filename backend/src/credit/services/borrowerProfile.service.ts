import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBorrowerProfileData {
  borrowerType: string;
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  creditRiskRating?: string | null;
  amlRiskTier?: string | null;
  exposureLimit?: number | string | null;
  totalExposure?: number | string | null;
  isSanctionedEntity?: boolean;
  sourceOfWealth?: string | null;
  purposeOfAccount?: string | null;
  occupation?: string | null;
  employer?: string | null;
  annualIncome?: number | string | null;
  netWorth?: number | string | null;
  // §2.9 Encrypted fields — set by encryptBorrowerFields middleware
  annualIncomeEncrypted?: string | null;
  netWorthEncrypted?: string | null;
  sourceOfWealthEncrypted?: string | null;
}

export interface UpdateBorrowerProfileData {
  borrowerType?: string;
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  creditRiskRating?: string | null;
  amlRiskTier?: string | null;
  exposureLimit?: number | string | null;
  totalExposure?: number | string | null;
  isSanctionedEntity?: boolean;
  sourceOfWealth?: string | null;
  purposeOfAccount?: string | null;
  occupation?: string | null;
  employer?: string | null;
  annualIncome?: number | string | null;
  netWorth?: number | string | null;
  isActive?: boolean;
  // §2.9 Encrypted fields — set by encryptBorrowerFields middleware
  annualIncomeEncrypted?: string | null;
  netWorthEncrypted?: string | null;
  sourceOfWealthEncrypted?: string | null;
}

export interface ListBorrowerProfilesOptions {
  page?: number;
  limit?: number;
  borrowerType?: string;
  creditRiskRating?: string;
  amlRiskTier?: string;
  isSanctionedEntity?: boolean;
  isActive?: boolean;
  search?: string;
}

export interface DuplicateMatch {
  borrowerId: string;
  name: string;
  borrowerType: string;
  matchField: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BorrowerProfileService {
  /**
   * Check if a borrower profile already exists for a given SSM or NRIC.
   * Returns the borrower ID if found, null otherwise.
   */
  async checkDuplicate(params: { ssm?: string; nric?: string }): Promise<{ exists: boolean; borrowerId?: string }> {
    if (params.ssm) {
      const account = await prisma.crmAccount.findFirst({
        where: { registrationNumber: params.ssm, borrowerProfile: { isNot: null } },
        select: { borrowerProfile: { select: { id: true } } },
      });
      if (account?.borrowerProfile) {
        return { exists: true, borrowerId: account.borrowerProfile.id };
      }
    }

    if (params.nric) {
      const contact = await prisma.crmContact.findFirst({
        where: { nricPassport: params.nric, borrowerProfile: { isNot: null } },
        select: { borrowerProfile: { select: { id: true } } },
      });
      if (contact?.borrowerProfile) {
        return { exists: true, borrowerId: contact.borrowerProfile.id };
      }
    }

    return { exists: false };
  }

  /**
   * Enhanced duplicate check — checks SSM (via CrmAccount), NRIC (via CrmContact),
   * and name+type (via BorrowerProfile) for potential duplicates.
   * Used server-side during creation to prevent duplicate borrowers.
   */
  async checkDuplicateEnhanced(params: {
    accountId?: string | null;
    contactId?: string | null;
    name?: string | null;
    borrowerType?: string;
  }): Promise<{ duplicates: DuplicateMatch[] }> {
    const duplicates: DuplicateMatch[] = [];
    const seenIds = new Set<string>();

    // 1. Check by SSM registration number via linked CrmAccount
    if (params.accountId) {
      const account = await prisma.crmAccount.findUnique({
        where: { id: params.accountId },
        select: { registrationNumber: true, name: true, borrowerProfile: { select: { id: true, name: true, borrowerType: true } } },
      });
      if (account?.registrationNumber) {
        // Find other accounts with the same registration number that have borrower profiles
        const matchingAccounts = await prisma.crmAccount.findMany({
          where: {
            registrationNumber: account.registrationNumber,
            id: { not: params.accountId },
            borrowerProfile: { isNot: null },
          },
          select: { name: true, borrowerProfile: { select: { id: true, name: true, borrowerType: true } } },
        });
        for (const ma of matchingAccounts) {
          if (ma.borrowerProfile && !seenIds.has(ma.borrowerProfile.id)) {
            seenIds.add(ma.borrowerProfile.id);
            duplicates.push({
              borrowerId: ma.borrowerProfile.id,
              name: ma.borrowerProfile.name || ma.name || 'Unknown',
              borrowerType: ma.borrowerProfile.borrowerType,
              matchField: 'SSM Registration Number',
            });
          }
        }
      }
    }

    // 2. Check by NRIC via linked CrmContact
    if (params.contactId) {
      const contact = await prisma.crmContact.findUnique({
        where: { id: params.contactId },
        select: { nricPassport: true, firstName: true, lastName: true, borrowerProfile: { select: { id: true, name: true, borrowerType: true } } },
      });
      if (contact?.nricPassport) {
        const matchingContacts = await prisma.crmContact.findMany({
          where: {
            nricPassport: contact.nricPassport,
            id: { not: params.contactId },
            borrowerProfile: { isNot: null },
          },
          select: { firstName: true, lastName: true, borrowerProfile: { select: { id: true, name: true, borrowerType: true } } },
        });
        for (const mc of matchingContacts) {
          if (mc.borrowerProfile && !seenIds.has(mc.borrowerProfile.id)) {
            seenIds.add(mc.borrowerProfile.id);
            duplicates.push({
              borrowerId: mc.borrowerProfile.id,
              name: mc.borrowerProfile.name || `${mc.firstName} ${mc.lastName}`.trim(),
              borrowerType: mc.borrowerProfile.borrowerType,
              matchField: 'NRIC/Passport',
            });
          }
        }
      }
      // Also check if this contact already has a borrower profile linked
      if (contact?.borrowerProfile && !seenIds.has(contact.borrowerProfile.id)) {
        seenIds.add(contact.borrowerProfile.id);
        duplicates.push({
          borrowerId: contact.borrowerProfile.id,
          name: contact.borrowerProfile.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
          borrowerType: contact.borrowerProfile.borrowerType,
          matchField: 'NRIC/Passport',
        });
      }
    }

    // 3. Check by name + borrower type (catches manual duplicates)
    if (params.name && params.borrowerType) {
      const byName = await prisma.borrowerProfile.findMany({
        where: {
          name: { equals: params.name, mode: 'insensitive' },
          borrowerType: params.borrowerType as any,
          deletedAt: null,
        },
        select: { id: true, name: true, borrowerType: true },
        take: 5,
      });
      for (const d of byName) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          duplicates.push({
            borrowerId: d.id,
            name: d.name || 'Unknown',
            borrowerType: d.borrowerType,
            matchField: 'Name',
          });
        }
      }
    }

    return { duplicates };
  }

  /**
   * List borrower profiles with pagination and filters.
   */
  async listBorrowerProfiles(options: ListBorrowerProfilesOptions) {
    const {
      page = 1,
      limit = 20,
      borrowerType,
      creditRiskRating,
      amlRiskTier,
      isSanctionedEntity,
      isActive,
      search,
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.BorrowerProfileWhereInput = {
      deletedAt: null,
    };

    if (borrowerType) {
      where.borrowerType = borrowerType as any;
    }
    if (creditRiskRating) {
      where.creditRiskRating = creditRiskRating as any;
    }
    if (amlRiskTier) {
      where.amlRiskTier = amlRiskTier as any;
    }
    if (isSanctionedEntity !== undefined) {
      where.isSanctionedEntity = isSanctionedEntity;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sourceOfWealth: { contains: search, mode: 'insensitive' } },
        { purposeOfAccount: { contains: search, mode: 'insensitive' } },
        { occupation: { contains: search, mode: 'insensitive' } },
        { employer: { contains: search, mode: 'insensitive' } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.borrowerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.borrowerProfile.count({ where }),
    ]);

    return {
      profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single borrower profile by ID.
   */
  async getBorrowerProfile(id: string) {
    return prisma.borrowerProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, dateOfBirth: true, nricPassport: true } },
        directors: { where: { resignationDate: null }, orderBy: { appointmentDate: 'desc' } },
        shareholders: { orderBy: { shareholdingPct: 'desc' } },
        beneficialOwners: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Create a new borrower profile.
   * If overrideDuplicate is false (default), runs checkDuplicateEnhanced first
   * and throws 409 if duplicates are found.
   * If overrideDuplicate is true, skips the duplicate check (admin override).
   */
  async createBorrowerProfile(data: CreateBorrowerProfileData, options?: { overrideDuplicate?: boolean; userId?: string }) {
    // Validate: cannot have both accountId and contactId
    if (data.accountId && data.contactId) {
      throw new Error('Only one of accountId or contactId may be provided, not both');
    }
    if (!data.accountId && !data.contactId && !data.name) {
      throw new Error('name is required when no CRM account or contact is linked');
    }

    // Server-side duplicate check (unless admin override)
    const overrideDuplicate = options?.overrideDuplicate ?? false;
    if (!overrideDuplicate) {
      const duplicateCheck = await this.checkDuplicateEnhanced({
        accountId: data.accountId,
        contactId: data.contactId,
        name: data.name,
        borrowerType: data.borrowerType,
      });
      if (duplicateCheck.duplicates.length > 0) {
        throw new AppError('Duplicate borrower detected', 409, { duplicates: duplicateCheck.duplicates });
      }
    }

    const createData: Prisma.BorrowerProfileCreateInput = {
      borrowerType: data.borrowerType as any,
      name: data.name ?? undefined,
      ...(data.accountId && { account: { connect: { id: data.accountId } } }),
      ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
      creditRiskRating: (data.creditRiskRating as any) ?? undefined,
      amlRiskTier: (data.amlRiskTier as any) ?? undefined,
      exposureLimit: data.exposureLimit != null ? new Prisma.Decimal(data.exposureLimit as string | number) : undefined,
      totalExposure: data.totalExposure != null ? new Prisma.Decimal(data.totalExposure as string | number) : undefined,
      isSanctionedEntity: data.isSanctionedEntity ?? false,
      sourceOfWealth: data.sourceOfWealthEncrypted ? null : (data.sourceOfWealth ?? undefined),
      purposeOfAccount: data.purposeOfAccount ?? undefined,
      occupation: data.occupation ?? undefined,
      employer: data.employer ?? undefined,
      annualIncome: data.annualIncomeEncrypted ? null : (data.annualIncome != null ? new Prisma.Decimal(data.annualIncome as string | number) : undefined),
      netWorth: data.netWorthEncrypted ? null : (data.netWorth != null ? new Prisma.Decimal(data.netWorth as string | number) : undefined),
      sourceOfWealthEncrypted: data.sourceOfWealthEncrypted ?? undefined,
      annualIncomeEncrypted: data.annualIncomeEncrypted ?? undefined,
      netWorthEncrypted: data.netWorthEncrypted ?? undefined,
    };

    const profile = await prisma.borrowerProfile.create({
      data: createData,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit log for admin override of duplicate detection
    if (overrideDuplicate && options?.userId) {
      await prisma.auditLog.create({
        data: {
          userId: options.userId,
          action: 'BORROWER_DUPLICATE_OVERRIDE',
          resourceType: 'BorrowerProfile',
          resourceId: profile.id,
          newValues: {
            overrideDuplicate: true,
            borrowerType: data.borrowerType,
            name: data.name,
            accountId: data.accountId,
            contactId: data.contactId,
          } as any,
        },
      }).catch(() => {
        // Audit failures must never break the main operation
      });
    }

    return profile;
  }

  /**
   * Update an existing borrower profile.
   */
  async updateBorrowerProfile(id: string, data: UpdateBorrowerProfileData) {
    const existing = await prisma.borrowerProfile.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    const updateData: Prisma.BorrowerProfileUpdateInput = {};

    if (data.borrowerType !== undefined) updateData.borrowerType = data.borrowerType as any;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.accountId !== undefined) {
      updateData.account = data.accountId ? { connect: { id: data.accountId } } : { disconnect: true };
    }
    if (data.contactId !== undefined) {
      updateData.contact = data.contactId ? { connect: { id: data.contactId } } : { disconnect: true };
    }
    if (data.creditRiskRating !== undefined) updateData.creditRiskRating = data.creditRiskRating as any;
    if (data.amlRiskTier !== undefined) updateData.amlRiskTier = data.amlRiskTier as any;
    if (data.exposureLimit !== undefined) updateData.exposureLimit = data.exposureLimit != null ? new Prisma.Decimal(data.exposureLimit as string | number) : null;
    if (data.totalExposure !== undefined) updateData.totalExposure = data.totalExposure != null ? new Prisma.Decimal(data.totalExposure as string | number) : null;
    if (data.isSanctionedEntity !== undefined) updateData.isSanctionedEntity = data.isSanctionedEntity;
    if (data.sourceOfWealth !== undefined) updateData.sourceOfWealth = data.sourceOfWealth;
    if (data.purposeOfAccount !== undefined) updateData.purposeOfAccount = data.purposeOfAccount;
    if (data.occupation !== undefined) updateData.occupation = data.occupation;
    if (data.employer !== undefined) updateData.employer = data.employer;
    if (data.annualIncome !== undefined) updateData.annualIncome = data.annualIncome != null ? new Prisma.Decimal(data.annualIncome as string | number) : null;
    if (data.netWorth !== undefined) updateData.netWorth = data.netWorth != null ? new Prisma.Decimal(data.netWorth as string | number) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // §2.9 Encrypted fields — if the encryption middleware has encrypted values,
    // store those in the Encrypted columns and zero out the plaintext.
    if (data.annualIncomeEncrypted !== undefined) {
      updateData.annualIncomeEncrypted = data.annualIncomeEncrypted;
      updateData.annualIncome = null;
    }
    if (data.netWorthEncrypted !== undefined) {
      updateData.netWorthEncrypted = data.netWorthEncrypted;
      updateData.netWorth = null;
    }
    if (data.sourceOfWealthEncrypted !== undefined) {
      updateData.sourceOfWealthEncrypted = data.sourceOfWealthEncrypted;
      updateData.sourceOfWealth = null;
    }

    return prisma.borrowerProfile.update({
      where: { id },
      data: updateData,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Soft-delete a borrower profile.
   */
  async deleteBorrowerProfile(id: string) {
    const existing = await prisma.borrowerProfile.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    return prisma.borrowerProfile.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

export const borrowerProfileService = new BorrowerProfileService();