import { z } from 'zod';

const creditProductTypeEnum = z.enum([
  'TERM_LOAN',
  'REVOLVING_FACILITY',
  'TRADE_FINANCE',
  'OVERDRAFT',
  'PROJECT_FINANCE',
  'SYNDICATED',
  'BRIDGING',
  'HIRE_PURCHASE',
]);

const currencyCodeEnum = z.enum([
  'MYR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD',
]);

// CA Memo Phase 1 enums
const applicationTypeEnum = z.enum(['NEW', 'ADDITIONAL', 'RENEWAL', 'VARIATION']);
const accountClassificationEnum = z.enum([
  'PERFORMING', 'EARLY_CARE', 'WATCHLIST', 'NON_CCRIS_RR', 'CCRIS_RR', 'IMPAIRED',
]);
const accountStrategyEnum = z.enum(['GROW', 'MAINTAIN', 'EXIT']);
const evidenceSourceTypeEnum = z.enum([
  'MANUAL',
  'APPLICATION_FORM',
  'PAYROLL_RECORDS',
  'CREDIT_BUREAU',
  'CORE_BANKING_SYSTEM',
  'BANK_STATEMENT_ANALYSIS',
  'UPLOADED_FINANCIAL_STATEMENTS',
  'OCR_EXTRACTION',
  'TAX_DOCUMENTS',
  'INTERNAL_RISK_ENGINE',
  'CREDIT_SCORING_ENGINE',
]);
const evidenceConfidenceEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const evidenceMappingFieldSchema = z.object({
  fieldKey: z.string().min(1),
  fieldLabel: z.string().min(1),
  sourceType: evidenceSourceTypeEnum,
  documentId: z.string().uuid().nullable().optional(),
  documentLabel: z.string().max(500).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  autoPopulated: z.boolean().optional(),
  ocrExtracted: z.boolean().optional(),
  confidence: evidenceConfidenceEnum.optional(),
});

// Optional ISO date string (YYYY-MM-DD or full ISO). Accepts null/empty for clearing.
const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

// CA Memo Phase 1 — header + narrative fields (all optional)
const caMemoHeaderFields = {
  customerGroupName: z.string().max(255).optional().nullable(),
  cifNo: z.string().max(50).optional().nullable(),
  applicationType: applicationTypeEnum.optional().nullable(),
  originatingDepartment: z.string().max(150).optional().nullable(),
  teamLeadName: z.string().max(150).optional().nullable(),
  referredBy: z.string().max(255).optional().nullable(),
  accountClassification: accountClassificationEnum.optional().nullable(),
  connectedPartyFlag: z.boolean().optional(),
  connectedPartyStaffName: z.string().max(255).optional().nullable(),
  completeDocsDate: optionalDate,
  lastReviewDate: optionalDate,
  nextReviewDate: optionalDate,
  relationshipSince: optionalDate,
  lastSiteVisitDate: optionalDate,
  preambleText: z.string().max(20000).optional().nullable(),
  mattersToHighlight: z.string().max(20000).optional().nullable(),
  transactionDetailsText: z.string().max(20000).optional().nullable(),
  accountStrategy: accountStrategyEnum.optional().nullable(),
  crossSellingInitiatives: z.string().max(20000).optional().nullable(),
  // CA Memo Phase 3 — Section 7 Way Out narratives
  firstWayOut: z.string().max(20000).optional().nullable(),
  secondWayOut: z.string().max(20000).optional().nullable(),
  otherWayOut: z.string().max(20000).optional().nullable(),
};

export const CA_MEMO_HEADER_FIELD_NAMES = Object.keys(caMemoHeaderFields) as Array<keyof typeof caMemoHeaderFields>;

// ApplicationState values — used at runtime for transition logic, not in zod schemas
// (kept for reference; the service imports ApplicationState directly from @prisma/client)

// Positive decimal: accepts string|number, rejects <= 0 and non-numeric.
const positiveDecimal = z
  .union([z.string(), z.number()])
  .refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }, { message: 'Amount must be greater than 0' });

export const createCreditApplicationSchema = z.object({
  body: z.object({
    borrowerProfileId: z.string().uuid(),
    productType: creditProductTypeEnum,
    purpose: z.string().max(2000).optional().nullable(),
    requestedAmount: positiveDecimal,
    requestedTenor: z.number().int().min(1).max(360).optional().nullable(),
    currency: currencyCodeEnum.default('MYR'),
    assignedRmId: z.string().uuid().optional().nullable(),
    assignedAnalystId: z.string().uuid().optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    ...caMemoHeaderFields,
  }),
});

export const updateCreditApplicationSchema = z.object({
  body: z.object({
    productType: creditProductTypeEnum.optional(),
    purpose: z.string().max(2000).optional().nullable(),
    requestedAmount: positiveDecimal.optional(),
    requestedTenor: z.number().int().min(1).max(360).optional().nullable(),
    currency: currencyCodeEnum.optional(),
    assignedRmId: z.string().uuid().optional().nullable(),
    assignedAnalystId: z.string().uuid().optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    ...caMemoHeaderFields,
  }),
});

export const transitionApplicationSchema = z.object({
  body: z.object({
    action: z.string().min(1),
    reason: z.string().max(5000).optional().nullable(),
  }).superRefine((data, ctx) => {
    const reasonRequiredActions = ['reject', 'reject_kyc', 'decline_offer', 'withdraw'];
    if (reasonRequiredActions.includes(data.action)) {
      if (typeof data.reason !== 'string' || data.reason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Reason is required for this action',
          path: ['reason'],
        });
      }
    }
  }),
});

export const evidenceMappingSchema = z.object({
  body: z.object({
    sourceSummary: z.string().max(2000).optional().nullable(),
    mappings: z.array(evidenceMappingFieldSchema).min(1),
  }),
});

export type CreateCreditApplicationInput = z.infer<typeof createCreditApplicationSchema>['body'];
export type UpdateCreditApplicationInput = z.infer<typeof updateCreditApplicationSchema>['body'];
export type TransitionApplicationInput = z.infer<typeof transitionApplicationSchema>['body'];
export type EvidenceMappingInput = z.infer<typeof evidenceMappingSchema>['body'];