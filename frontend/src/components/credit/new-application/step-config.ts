export type WizardStep =
  | 'borrower'
  | 'loan-request'
  | 'facility'
  | 'assignment'
  | 'review';

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
  { key: 'borrower', title: 'Borrower', subtitle: 'Select an existing borrower from canonical Borrower Management.' },
  { key: 'loan-request', title: 'Loan Request', subtitle: 'Capture product, amount, tenor, currency, and optional purpose.' },
  { key: 'facility', title: 'Facility', subtitle: 'Structure the facility when the resolved processing lane requires it.' },
  { key: 'assignment', title: 'Assignment', subtitle: 'Review the automatically resolved lane, RM, and branch.' },
  { key: 'review', title: 'Review', subtitle: 'Create a DRAFT and continue submission requirements in Application 360.' },
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
