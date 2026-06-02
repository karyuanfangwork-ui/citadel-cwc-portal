import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

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
   */
  async createBorrowerProfile(data: CreateBorrowerProfileData) {
    // Validate: cannot have both accountId and contactId
    if (data.accountId && data.contactId) {
      throw new Error('Only one of accountId or contactId may be provided, not both');
    }
    if (!data.accountId && !data.contactId && !data.name) {
      throw new Error('name is required when no CRM account or contact is linked');
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

    return prisma.borrowerProfile.create({
      data: createData,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });
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