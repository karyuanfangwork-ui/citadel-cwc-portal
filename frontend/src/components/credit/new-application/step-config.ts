export type WizardStep =
  | 'applicant-search'
  | 'applicant-selection'
  | 'product-selection'
  | 'application-details'
  | 'financial-information'
  | 'documents'
  | 'review-submit';

export interface WizardStepConfig {
  key: WizardStep;
  title: string;
  subtitle: string;
}

export interface DocumentTemplate {
  key: string;
  label: string;
  required: boolean;
}

export const STORAGE_KEY = 'credit:new-application-wizard:v1';

export const STEPS: WizardStepConfig[] = [
  { key: 'applicant-search', title: 'Applicant Search', subtitle: 'Find an existing borrower before originating a new credit request.' },
  { key: 'applicant-selection', title: 'Applicant Selection', subtitle: 'Bind an existing borrower or create a new applicant safely.' },
  { key: 'product-selection', title: 'Product Selection', subtitle: 'Pick the product family and the core facility shape.' },
  { key: 'application-details', title: 'Application Details', subtitle: 'Capture requested amount, tenor, purpose, and ownership fields.' },
  { key: 'financial-information', title: 'Financial Information', subtitle: 'Add the financial inputs needed for early screening.' },
  { key: 'documents', title: 'Documents', subtitle: 'Track required documents and their upload/verification state.' },
  { key: 'review-submit', title: 'Review & Submit', subtitle: 'Validate blockers, review the payload, and create the application.' },
];

export const RETAIL_DOCUMENTS: DocumentTemplate[] = [
  { key: 'nric-front', label: 'NRIC Front', required: true },
  { key: 'nric-back', label: 'NRIC Back', required: true },
  { key: 'payslip', label: 'Payslip', required: true },
  { key: 'bank-statement', label: 'Bank Statement', required: true },
  { key: 'epf-statement', label: 'EPF Statement', required: false },
  { key: 'ea-form', label: 'EA Form', required: false },
];

export const BUSINESS_DOCUMENTS: DocumentTemplate[] = [
  { key: 'ssm-registration', label: 'SSM Registration', required: true },
  { key: 'financial-statements', label: 'Financial Statements', required: true },
  { key: 'bank-statements', label: 'Bank Statements', required: true },
  { key: 'director-id', label: 'Director Identification', required: true },
];
