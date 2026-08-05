export type ApplicantMode = 'existing' | 'new';
export type FinancialMode = 'retail' | 'business';

export type DocumentState = {
  key: string;
  label: string;
  required: boolean;
  fileName: string | null;
  completed: boolean;
};

export type NewApplicantDraft = {
  borrowerType: 'INDIVIDUAL' | 'SOLE_PROPRIETOR' | 'CORPORATE';
  name: string;
  nricPassport: string;
  registrationNumber: string;
  phone: string;
  email: string;
};

export type FinancialDraft = {
  monthlySalary: string;
  allowance: string;
  bonus: string;
  rentalIncome: string;
  otherIncome: string;
  monthlyCommitments: string;
  revenue: string;
  grossProfit: string;
  netProfit: string;
  existingBorrowings: string;
  currentAssets: string;
  currentLiabilities: string;
};

export type WizardDraft = {
  currentStep: string;
  searchQuery: string;
  searchResults: unknown[];
  selectedBorrower: unknown | null;
  applicantMode: ApplicantMode;
  newApplicant: NewApplicantDraft;
  productType: string | '';
  currency: string;
  requestedAmount: string;
  requestedTenor: string;
  purpose: string;
  branchId: string;
  assignedRmId: string;
  financials: FinancialDraft;
  documents: DocumentState[];
};

export function getBorrowerTypeLabel(type?: string | null): string {
  if (!type) return 'Borrower';
  return type.replace(/_/g, ' ');
}

export function getFinancialMode(borrowerType?: string | null): FinancialMode {
  return borrowerType === 'INDIVIDUAL' ? 'retail' : 'business';
}

export function getBorrowerDisplayName(profile: { account?: { name?: string | null } | null; contact?: { firstName?: string | null; lastName?: string | null } | null; name?: string | null } | null): string {
  if (!profile) return '—';
  return profile.account?.name || (profile.contact ? `${profile.contact.firstName ?? ''} ${profile.contact.lastName ?? ''}`.trim() : profile.name || 'Unnamed Borrower');
}
