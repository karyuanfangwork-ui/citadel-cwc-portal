import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBorrowerProfileData {
  borrowerType: string;
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
}

export interface UpdateBorrowerProfileData {
  borrowerType?: string;
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
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
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
    // Validate: exactly one of accountId or contactId must be set
    if (!data.accountId && !data.contactId) {
      throw new Error('Either accountId or contactId must be provided');
    }
    if (data.accountId && data.contactId) {
      throw new Error('Only one of accountId or contactId may be provided, not both');
    }

    const createData: Prisma.BorrowerProfileCreateInput = {
      borrowerType: data.borrowerType as any,
      ...(data.accountId && { account: { connect: { id: data.accountId } } }),
      ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
      creditRiskRating: (data.creditRiskRating as any) ?? undefined,
      amlRiskTier: (data.amlRiskTier as any) ?? undefined,
      exposureLimit: data.exposureLimit != null ? new Prisma.Decimal(data.exposureLimit as string | number) : undefined,
      totalExposure: data.totalExposure != null ? new Prisma.Decimal(data.totalExposure as string | number) : undefined,
      isSanctionedEntity: data.isSanctionedEntity ?? false,
      sourceOfWealth: data.sourceOfWealth ?? undefined,
      purposeOfAccount: data.purposeOfAccount ?? undefined,
      occupation: data.occupation ?? undefined,
      employer: data.employer ?? undefined,
      annualIncome: data.annualIncome != null ? new Prisma.Decimal(data.annualIncome as string | number) : undefined,
      netWorth: data.netWorth != null ? new Prisma.Decimal(data.netWorth as string | number) : undefined,
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