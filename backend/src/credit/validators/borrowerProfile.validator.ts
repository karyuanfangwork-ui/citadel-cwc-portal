import { z } from 'zod';

const borrowerTypeEnum = z.enum(['INDIVIDUAL', 'CORPORATE', 'JOINT', 'SOLE_PROPRIETOR']);
const riskRatingEnum = z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR']);
const amlRiskTierEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED']);
// P2-3: SME financial statement classification
const smeFinancialStatementTypeEnum = z.enum(['AUDITED', 'MANAGEMENT', 'COMPILED']);

// Allow decimal-like strings or numbers, normalise to string for Prisma Decimal
const decimalField = z.union([z.string(), z.number()]).optional().nullable();

export type BorrowerIdentityValidationInput = {
  borrowerType?: string | null;
  name?: string | null;
  nricPassport?: string | null;
  dateOfBirth?: string | Date | null;
  nationality?: string | null;
  registrationNumber?: string | null;
  dateOfIncorporation?: string | Date | null;
  businessNature?: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * Validates the identity fields required by the selected legal borrower type.
 * The service uses this against the merged post-update state so sparse PATCH
 * payloads cannot remove fields that were required at creation time.
 */
export function getBorrowerIdentityValidationIssues(data: BorrowerIdentityValidationInput): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  const isIndividual = data.borrowerType === 'INDIVIDUAL';
  const isCorporateType = data.borrowerType === 'CORPORATE' || data.borrowerType === 'SOLE_PROPRIETOR';

  if (!data.name?.trim()) {
    issues.push({ field: 'name', message: 'Borrower name is required' });
  }

  if (!data.phone?.trim() && !data.email?.trim()) {
    issues.push({ field: 'phoneOrEmail', message: 'At least one primary contact method (phone or email) is required' });
  }

  if (isIndividual) {
    if (!data.nricPassport?.trim()) issues.push({ field: 'nricPassport', message: 'NRIC/Passport is required for Individual borrowers' });
    if (!data.dateOfBirth) issues.push({ field: 'dateOfBirth', message: 'Date of Birth is required for Individual borrowers' });
    if (!data.nationality?.trim()) issues.push({ field: 'nationality', message: 'Nationality is required for Individual borrowers' });
  }

  if (isCorporateType) {
    if (!data.registrationNumber?.trim()) issues.push({ field: 'registrationNumber', message: 'Registration Number is required for Sole Proprietor/Corporate borrowers' });
    if (!data.dateOfIncorporation) issues.push({ field: 'dateOfIncorporation', message: 'Date of Incorporation is required for Sole Proprietor/Corporate borrowers' });
    if (!data.businessNature?.trim()) issues.push({ field: 'businessNature', message: 'Business Nature is required for Sole Proprietor/Corporate borrowers' });
  }

  return issues;
}

export const createBorrowerProfileSchema = z.object({
  body: z.object({
    idempotencyKey: z.string().min(16).max(160).optional(),
    borrowerType: borrowerTypeEnum.default('CORPORATE'),
    name: z.string().max(255).optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    // Identity fields — self-contained, no CRM dependency
    registrationNumber: z.string().max(100).optional().nullable(),
    industry: z.string().max(100).optional().nullable(),
    nricPassport: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable(),
    // Demographic fields
    gender: z.string().max(20).optional().nullable(),
    nationality: z.string().max(100).optional().nullable(),
    // Borrower creation wizard — type-specific fields
    dateOfBirth: z.union([z.string(), z.date()]).optional().nullable(),
    dateOfIncorporation: z.union([z.string(), z.date()]).optional().nullable(),
    businessNature: z.string().max(500).optional().nullable(),
    businessType: z.string().max(50).optional().nullable(),
    authorizedRepresentative: z.string().max(255).optional().nullable(),
    preferredName: z.string().max(100).optional().nullable(),
    maritalStatus: z.string().max(30).optional().nullable(),
    educationLevel: z.string().max(50).optional().nullable(),
    taxNumber: z.string().max(50).optional().nullable(),
    officePhone: z.string().max(50).optional().nullable(),
    preferredContactMethod: z.enum(['MOBILE', 'EMAIL', 'OFFICE_PHONE', 'POST']).optional().nullable(),
    mailingAddress: z.string().max(500).optional().nullable(),
    creditRiskRating: riskRatingEnum.optional().nullable(),
    amlRiskTier: amlRiskTierEnum.optional().nullable(),
    exposureLimit: decimalField,
    totalExposure: decimalField,
    isSanctionedEntity: z.boolean().default(false),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    purposeOfAccount: z.string().max(255).optional().nullable(),
    occupation: z.string().max(100).optional().nullable(),
    employer: z.string().max(255).optional().nullable(),
    annualIncome: decimalField,
    netWorth: decimalField,
    // P2-2: SME lane threshold field
    annualTurnover: decimalField,
    // P2-3: SME-specific fields
    yearsTrading: z.number().int().min(0).optional().nullable(),
    smeFinancialStatementType: smeFinancialStatementTypeEnum.optional().nullable(),
    sicCode: z.string().max(10).optional().nullable(),
    // §2.9 Encrypted fields — set by encryptBorrowerFields middleware
    annualIncomeEncrypted: z.string().optional().nullable(),
    netWorthEncrypted: z.string().optional().nullable(),
    sourceOfWealthEncrypted: z.string().optional().nullable(),
    // §2.3 Duplicate override — admin can set true to bypass duplicate check
    overrideDuplicate: z.boolean().default(false).optional(),
    overrideReason: z.string().max(2000).optional(),
    duplicateExceptionId: z.string().uuid().optional(),
  }).superRefine((data, ctx) => {
    for (const issue of getBorrowerIdentityValidationIssues(data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['body', issue.field], message: issue.message });
    }
  }),
});

export const updateBorrowerProfileSchema = z.object({
  body: z.object({
    borrowerType: borrowerTypeEnum.optional(),
    name: z.string().max(255).optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    contactId: z.string().uuid().optional().nullable(),
    // Identity fields
    registrationNumber: z.string().max(100).optional().nullable(),
    industry: z.string().max(100).optional().nullable(),
    nricPassport: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable(),
    // Demographic fields
    gender: z.string().max(20).optional().nullable(),
    nationality: z.string().max(100).optional().nullable(),
    // Borrower creation wizard — type-specific fields
    dateOfBirth: z.union([z.string(), z.date()]).optional().nullable(),
    dateOfIncorporation: z.union([z.string(), z.date()]).optional().nullable(),
    businessNature: z.string().max(500).optional().nullable(),
    businessType: z.string().max(50).optional().nullable(),
    authorizedRepresentative: z.string().max(255).optional().nullable(),
    preferredName: z.string().max(100).optional().nullable(),
    maritalStatus: z.string().max(30).optional().nullable(),
    educationLevel: z.string().max(50).optional().nullable(),
    taxNumber: z.string().max(50).optional().nullable(),
    officePhone: z.string().max(50).optional().nullable(),
    preferredContactMethod: z.enum(['MOBILE', 'EMAIL', 'OFFICE_PHONE', 'POST']).optional().nullable(),
    mailingAddress: z.string().max(500).optional().nullable(),
    creditRiskRating: riskRatingEnum.optional().nullable(),
    amlRiskTier: amlRiskTierEnum.optional().nullable(),
    exposureLimit: decimalField,
    totalExposure: decimalField,
    isSanctionedEntity: z.boolean().optional(),
    sourceOfWealth: z.string().max(255).optional().nullable(),
    purposeOfAccount: z.string().max(255).optional().nullable(),
    occupation: z.string().max(100).optional().nullable(),
    employer: z.string().max(255).optional().nullable(),
    annualIncome: decimalField,
    netWorth: decimalField,
    // P2-2: SME lane threshold field
    annualTurnover: decimalField,
    // P2-3: SME-specific fields
    yearsTrading: z.number().int().min(0).optional().nullable(),
    smeFinancialStatementType: smeFinancialStatementTypeEnum.optional().nullable(),
    sicCode: z.string().max(10).optional().nullable(),
    isActive: z.boolean().optional(),
    // §2.9 Encrypted fields — set by encryptBorrowerFields middleware
    annualIncomeEncrypted: z.string().optional().nullable(),
    netWorthEncrypted: z.string().optional().nullable(),
    sourceOfWealthEncrypted: z.string().optional().nullable(),
  }),
});

export type CreateBorrowerProfileInput = z.infer<typeof createBorrowerProfileSchema>['body'];
export type UpdateBorrowerProfileInput = z.infer<typeof updateBorrowerProfileSchema>['body'];
