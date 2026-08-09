import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { maskNric } from '../utils/maskNric';
import { PiiReadLogService } from './piiReadLog.service';
import { normalizeIdentity } from '../utils/identityNormalization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBorrowerProfileData {
  borrowerType: string;
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  // Identity fields
  registrationNumber?: string | null;
  industry?: string | null;
  nricPassport?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  nationality?: string | null;
  // Borrower creation wizard — type-specific fields
  dateOfBirth?: string | Date | null;
  dateOfIncorporation?: string | Date | null;
  businessNature?: string | null;
  businessType?: string | null;
  authorizedRepresentative?: string | null;
  preferredName?: string | null;
  maritalStatus?: string | null;
  educationLevel?: string | null;
  taxNumber?: string | null;
  officePhone?: string | null;
  preferredContactMethod?: string | null;
  mailingAddress?: string | null;
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
  // P2-2: Annual turnover for SME lane threshold
  annualTurnover?: number | string | null;
  // P2-3: SME-specific fields
  yearsTrading?: number | null;
  smeFinancialStatementType?: string | null;
  sicCode?: string | null;
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
  // Identity fields
  registrationNumber?: string | null;
  industry?: string | null;
  nricPassport?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  nationality?: string | null;
  // Borrower creation wizard — type-specific fields
  dateOfBirth?: string | Date | null;
  dateOfIncorporation?: string | Date | null;
  businessNature?: string | null;
  businessType?: string | null;
  authorizedRepresentative?: string | null;
  preferredName?: string | null;
  maritalStatus?: string | null;
  educationLevel?: string | null;
  taxNumber?: string | null;
  officePhone?: string | null;
  preferredContactMethod?: string | null;
  mailingAddress?: string | null;
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
  // P2-2: Annual turnover for SME lane threshold
  annualTurnover?: number | string | null;
  // P2-3: SME-specific fields
  yearsTrading?: number | null;
  smeFinancialStatementType?: string | null;
  sicCode?: string | null;
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
   * GET /borrowers/stats — Aggregate counts for KPI cards
   */
  async getBorrowerStats() {
    const baseWhere = { deletedAt: null } as const;

    const [total, active, pendingKyc, watchlist] = await Promise.all([
      prisma.borrowerProfile.count({ where: baseWhere }),
      prisma.borrowerProfile.count({ where: { ...baseWhere, isActive: true } }),
      prisma.borrowerProfile.count({ where: { ...baseWhere, amlRiskTier: 'HIGH' } }),
      prisma.borrowerProfile.count({ where: { ...baseWhere, isSanctionedEntity: true } }),
    ]);

    return { total, active, pendingKyc, watchlist };
  }

  /**
   * Search borrowers by NRIC, passport, phone, email, name, or registration number.
   * Returns a list of matches with KYC status for the duplicate-check step.
   */
  async searchBorrowers(query: string, limit = 10) {
    const q = query.trim();
    if (q.length < 2) return [];

    const where = {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { nricPassport: { contains: q, mode: 'insensitive' as const } },
        { phone: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
        { registrationNumber: { contains: q, mode: 'insensitive' as const } },
        { account: { registrationNumber: { contains: q, mode: 'insensitive' as const } } },
        { account: { name: { contains: q, mode: 'insensitive' as const } } },
        { contact: { nricPassport: { contains: q, mode: 'insensitive' as const } } },
        { contact: { firstName: { contains: q, mode: 'insensitive' as const } } },
        { contact: { lastName: { contains: q, mode: 'insensitive' as const } } },
      ],
    };

    const profiles = await prisma.borrowerProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        borrowerType: true,
        nricPassport: true,
        phone: true,
        email: true,
        registrationNumber: true,
        kycVerifiedAt: true,
        _count: { select: { applications: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return profiles.map((p) => ({
      id: p.id,
      name: p.name || 'Unknown',
      borrowerType: p.borrowerType,
      nricPassport: p.nricPassport,
      phone: p.phone,
      email: p.email,
      registrationNumber: p.registrationNumber,
      kycVerified: p.kycVerifiedAt != null,
      applicationCount: p._count.applications,
    }));
  }

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
    nricPassport?: string | null;
    registrationNumber?: string | null;
    excludeId?: string | null;
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

    // 3. LOS-017 — Check the profile's OWN identity fields. Checks 1 and 2
    // reach registration number and NRIC only through CRM links, so a borrower
    // created without CRM linkage was matched on name alone — which splits
    // exposure and KYC history across two records for the same person.
    const directNric = normalizeIdentity(params.nricPassport);
    const directRegNo = normalizeIdentity(params.registrationNumber);

    if (directNric || directRegNo) {
      const identityMatches = await prisma.borrowerProfile.findMany({
        where: {
          deletedAt: null,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
          OR: [
            ...(directNric ? [{ nricPassportNormalized: directNric }] : []),
            ...(directRegNo ? [{ registrationNumberNormalized: directRegNo }] : []),
          ],
        },
        select: {
          id: true, name: true, borrowerType: true,
          nricPassportNormalized: true, registrationNumberNormalized: true,
        },
        take: 10,
      });

      for (const m of identityMatches) {
        if (seenIds.has(m.id)) continue;
        seenIds.add(m.id);
        duplicates.push({
          borrowerId: m.id,
          name: m.name || 'Unknown',
          borrowerType: m.borrowerType,
          matchField: m.nricPassportNormalized && m.nricPassportNormalized === directNric
            ? 'NRIC/Passport (direct)'
            : 'Registration Number (direct)',
        });
      }
    }

    // 4. Check by name + borrower type (catches manual duplicates)
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
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { nricPassport: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
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
   * Contact NRIC is masked (last 4 chars only) — use revealContactNric for plaintext.
   */
  async getBorrowerProfile(id: string) {
    const profile = await prisma.borrowerProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        account: { select: { id: true, name: true, industry: true, companySize: true, annualRevenue: true, registrationNumber: true, taxNumber: true, accountType: true, parentAccountId: true, description: true, address: true, city: true, state: true, country: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true, dateOfBirth: true, nricPassport: true } },
        directors: { where: { resignationDate: null }, orderBy: { appointmentDate: 'desc' } },
        shareholders: { orderBy: { shareholdingPct: 'desc' } },
        beneficialOwners: { orderBy: { createdAt: 'desc' } },
        relatedPartyMembers: { include: { group: { select: { id: true, name: true, relationshipType: true } } } },
      },
    });
    if (profile?.contact?.nricPassport) {
      profile.contact.nricPassport = maskNric(profile.contact.nricPassport);
    }
    return profile;
  }

  /**
   * Reveal the plaintext NRIC for a borrower profile's contact (PII-logged).
   */
  async revealContactNric(borrowerProfileId: string, requestingUserId: string) {
    const profile = await prisma.borrowerProfile.findFirst({
      where: { id: borrowerProfileId, deletedAt: null },
      include: { contact: { select: { nricPassport: true } } },
    });
    if (!profile?.contact?.nricPassport) return null;
    await PiiReadLogService.logPiiAccess(requestingUserId, 'BorrowerProfile', borrowerProfileId, 'contact.nricPassport').catch(() => {});
    return profile.contact.nricPassport;
  }

  /**
   * Create a new borrower profile.
   * If overrideDuplicate is false (default), runs checkDuplicateEnhanced first
   * and throws 409 if duplicates are found.
   * If overrideDuplicate is true, skips the duplicate check (admin override).
   */
  async createBorrowerProfile(data: CreateBorrowerProfileData, options?: { overrideDuplicate?: boolean; overrideReason?: string; userId?: string; userPermissions?: string[] }) {
    if (!data.name?.trim()) {
      throw new Error('Borrower name is required');
    }

    // LOS-017 — Overriding duplicate detection is a governed act: it creates a
    // second record for what the system believes is the same person or company,
    // which splits exposure and KYC history. Require the permission, a real
    // reason, and an audit trail.
    const overrideDuplicate = options?.overrideDuplicate ?? false;
    if (overrideDuplicate) {
      if (!options?.userPermissions?.includes('credit:admin')) {
        throw Object.assign(
          new Error('Overriding duplicate borrower detection requires the credit:admin permission.'),
          { statusCode: 403 },
        );
      }
      const reason = options?.overrideReason?.trim() ?? '';
      if (reason.length < 20) {
        throw Object.assign(
          new Error('A duplicate override requires a reason of at least 20 characters explaining why these are distinct parties.'),
          { statusCode: 400 },
        );
      }
    }

    // Always run the duplicate check — when overriding, we capture what was
    // suppressed for the audit record.
    const duplicateCheck = await this.checkDuplicateEnhanced({
      accountId: data.accountId,
      contactId: data.contactId,
      name: data.name,
      borrowerType: data.borrowerType,
      nricPassport: data.nricPassport,
      registrationNumber: data.registrationNumber,
    });

    if (!overrideDuplicate && duplicateCheck.duplicates.length > 0) {
      throw new AppError('Duplicate borrower detected', 409, { duplicates: duplicateCheck.duplicates });
    }

    const createData: Prisma.BorrowerProfileCreateInput = {
      borrowerType: data.borrowerType as any,
      name: data.name ?? undefined,
      ...(data.accountId && { account: { connect: { id: data.accountId } } }),
      ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
      registrationNumber: data.registrationNumber ?? undefined,
      registrationNumberNormalized: normalizeIdentity(data.registrationNumber),
      industry: data.industry ?? undefined,
      nricPassport: data.nricPassport ?? undefined,
      nricPassportNormalized: normalizeIdentity(data.nricPassport),
      address: data.address ?? undefined,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
      gender: (data as any).gender ?? undefined,
      nationality: (data as any).nationality ?? undefined,
      // Borrower creation wizard — type-specific fields
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      dateOfIncorporation: data.dateOfIncorporation ? new Date(data.dateOfIncorporation) : undefined,
      businessNature: data.businessNature ?? undefined,
      businessType: data.businessType ?? undefined,
      authorizedRepresentative: data.authorizedRepresentative ?? undefined,
      preferredName: data.preferredName ?? undefined,
      maritalStatus: data.maritalStatus ?? undefined,
      educationLevel: data.educationLevel ?? undefined,
      taxNumber: data.taxNumber ?? undefined,
      officePhone: data.officePhone ?? undefined,
      preferredContactMethod: data.preferredContactMethod ?? undefined,
      mailingAddress: data.mailingAddress ?? undefined,
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
      // P2-2: Annual turnover
      annualTurnover: data.annualTurnover != null ? new Prisma.Decimal(data.annualTurnover as string | number) : undefined,
      // P2-3: SME-specific fields
      yearsTrading: data.yearsTrading ?? undefined,
      smeFinancialStatementType: (data.smeFinancialStatementType as any) ?? undefined,
      sicCode: data.sicCode ?? undefined,
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
            overrideReason: options.overrideReason,
            suppressedMatches: duplicateCheck.duplicates.map((d) => ({ id: d.borrowerId, field: d.matchField })),
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
    // creditRiskRating is NOT accepted here — rating changes must flow through
    // the scoring engine (scoringService.executeScore) or the audited override
    // flow (scoreOverrideService), not a generic profile update.
    if (data.amlRiskTier !== undefined) updateData.amlRiskTier = data.amlRiskTier as any;
    if (data.exposureLimit !== undefined) updateData.exposureLimit = data.exposureLimit != null ? new Prisma.Decimal(data.exposureLimit as string | number) : null;
    if (data.totalExposure !== undefined) updateData.totalExposure = data.totalExposure != null ? new Prisma.Decimal(data.totalExposure as string | number) : null;
    if (data.isSanctionedEntity !== undefined) updateData.isSanctionedEntity = data.isSanctionedEntity;
    if (data.registrationNumber !== undefined) updateData.registrationNumber = data.registrationNumber;
    if (data.registrationNumber !== undefined) updateData.registrationNumberNormalized = normalizeIdentity(data.registrationNumber) as any;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.nricPassport !== undefined) updateData.nricPassport = data.nricPassport;
    if (data.nricPassport !== undefined) updateData.nricPassportNormalized = normalizeIdentity(data.nricPassport) as any;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    // Borrower creation wizard — type-specific fields
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.dateOfIncorporation !== undefined) updateData.dateOfIncorporation = data.dateOfIncorporation ? new Date(data.dateOfIncorporation) : null;
    if (data.businessNature !== undefined) updateData.businessNature = data.businessNature;
    if (data.businessType !== undefined) updateData.businessType = data.businessType;
    if (data.authorizedRepresentative !== undefined) updateData.authorizedRepresentative = data.authorizedRepresentative;
    if (data.preferredName !== undefined) updateData.preferredName = data.preferredName;
    if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus;
    if (data.educationLevel !== undefined) updateData.educationLevel = data.educationLevel;
    if (data.taxNumber !== undefined) updateData.taxNumber = data.taxNumber;
    if (data.officePhone !== undefined) updateData.officePhone = data.officePhone;
    if (data.preferredContactMethod !== undefined) updateData.preferredContactMethod = data.preferredContactMethod;
    if (data.mailingAddress !== undefined) updateData.mailingAddress = data.mailingAddress;
    if (data.sourceOfWealth !== undefined) updateData.sourceOfWealth = data.sourceOfWealth;
    if (data.purposeOfAccount !== undefined) updateData.purposeOfAccount = data.purposeOfAccount;
    if (data.occupation !== undefined) updateData.occupation = data.occupation;
    if (data.employer !== undefined) updateData.employer = data.employer;
    if (data.annualIncome !== undefined) updateData.annualIncome = data.annualIncome != null ? new Prisma.Decimal(data.annualIncome as string | number) : null;
    if (data.netWorth !== undefined) updateData.netWorth = data.netWorth != null ? new Prisma.Decimal(data.netWorth as string | number) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    // P2-2: Annual turnover
    if (data.annualTurnover !== undefined) updateData.annualTurnover = data.annualTurnover != null ? new Prisma.Decimal(data.annualTurnover as string | number) : null;
    // P2-3: SME-specific fields
    if (data.yearsTrading !== undefined) updateData.yearsTrading = data.yearsTrading ?? null;
    if (data.smeFinancialStatementType !== undefined) updateData.smeFinancialStatementType = data.smeFinancialStatementType as any ?? null;
    if (data.sicCode !== undefined) updateData.sicCode = data.sicCode ?? null;

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