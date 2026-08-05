import { DocumentClass } from '@prisma/client';

export const DEFAULT_DOCUMENT_RULES: Record<string, { documentClass: DocumentClass; label: string }[]> = {
  INDIVIDUAL: [
    { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport' },
    { documentClass: 'PAYSLIP', label: 'Payslip (latest 3 months)' },
    { documentClass: 'BANK_STATEMENT', label: 'Bank Statement' },
  ],
  SOLE_PROPRIETOR: [
    { documentClass: 'NRIC_PASSPORT', label: 'NRIC / Passport' },
    { documentClass: 'SSM_CERT', label: 'SSM Certificate' },
    { documentClass: 'BANK_STATEMENT', label: 'Bank Statement' },
  ],
  JOINT: [
    { documentClass: 'JV_AGREEMENT', label: 'JV Agreement' },
    { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials' },
  ],
  CORPORATE: [
    { documentClass: 'SSM_CERT', label: 'SSM Certificate' },
    { documentClass: 'AUDITED_FINANCIALS', label: 'Audited Financials' },
    { documentClass: 'MOA_AOA', label: 'Memorandum & Articles (MOA/AOA)' },
  ],
};

export const DEFAULT_FIELD_RULES: { fieldPath: string; label: string }[] = [];
