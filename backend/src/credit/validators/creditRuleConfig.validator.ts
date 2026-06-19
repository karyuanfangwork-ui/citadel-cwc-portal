import { z } from 'zod';

const productTypeEnum = z.enum([
  'TERM_LOAN',
  'REVOLVING_FACILITY',
  'TRADE_FINANCE',
  'OVERDRAFT',
  'PROJECT_FINANCE',
  'SYNDICATED',
  'BRIDGING',
  'HIRE_PURCHASE',
]);

const laneEnum = z.enum(['PERSONAL_FAST', 'SME', 'CORPORATE']);
const borrowerTypeEnum = z.enum(['INDIVIDUAL', 'SOLE_PROPRIETOR', 'JOINT', 'CORPORATE']);
const kindEnum = z.enum(['REQUIRED_DOCUMENT', 'REQUIRED_FIELD']);
const documentClassEnum = z.enum([
  'NRIC_PASSPORT',
  'MEMORANDUM_ARTICLES',
  'AUDITED_FINANCIALS',
  'MANAGEMENT_ACCOUNTS',
  'BANK_STATEMENT',
  'TAX_RETURN',
  'BUSINESS_PLAN',
  'CREDIT_BUREAU_REPORT',
  'VALUATION_REPORT',
  'INSURANCE_CERT',
  'BOARD_RESOLUTION',
  'AUTHORIZED_SIGNATORY',
  'GUARANTEE_LETTER',
  'PLEDGE_AGREEMENT',
  'SECURITY_DOCUMENT',
  'PAYSLIP',
  'SSM_CERT',
  'MOA_AOA',
  'JV_AGREEMENT',
  'LETTER_OF_OFFER',
  'DISBURSEMENT_INSTRUCTION',
  'OTHER',
]);

export const createRuleConfigSchema = z.object({
  body: z.object({
    kind: kindEnum,
    productType: productTypeEnum.nullable().optional(),
    lane: laneEnum.nullable().optional(),
    borrowerType: borrowerTypeEnum.nullable().optional(),
    documentClass: documentClassEnum.nullable().optional(),
    documentLabel: z.string().max(255).nullable().optional(),
    fieldPath: z.string().max(255).nullable().optional(),
    fieldLabel: z.string().max(255).nullable().optional(),
    isMandatory: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }).superRefine((val, ctx) => {
    if (val.kind === 'REQUIRED_DOCUMENT' && !val.documentClass) {
      ctx.addIssue({ code: 'custom', message: 'documentClass is required for REQUIRED_DOCUMENT', path: ['documentClass'] });
    }
    if (val.kind === 'REQUIRED_FIELD' && !val.fieldPath) {
      ctx.addIssue({ code: 'custom', message: 'fieldPath is required for REQUIRED_FIELD', path: ['fieldPath'] });
    }
  }),
});

export const updateRuleConfigSchema = z.object({
  body: z.object({
    productType: productTypeEnum.nullable().optional(),
    lane: laneEnum.nullable().optional(),
    borrowerType: borrowerTypeEnum.nullable().optional(),
    documentClass: documentClassEnum.nullable().optional(),
    documentLabel: z.string().max(255).nullable().optional(),
    fieldPath: z.string().max(255).nullable().optional(),
    fieldLabel: z.string().max(255).nullable().optional(),
    isMandatory: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});
