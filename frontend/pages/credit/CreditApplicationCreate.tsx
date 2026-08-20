import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../src/context/AuthContext';
import creditService, {
  branchApi,
  Branch,
  BorrowerProfile,
  CreditApplication,
  CreditProductType,
  CurrencyCode,

  financialApi,
  retailIncomeApi,
} from '../../src/services/credit.service';
import { friendlyMessage } from '../../src/utils/errorMessages';

import WizardActions from '../../src/components/credit/new-application/WizardActions';
import RightSummaryPanel from '../../src/components/credit/new-application/RightSummaryPanel';
import WizardStepper from '../../src/components/credit/new-application/WizardStepper';

import {
  BUSINESS_DOCUMENTS,
  RETAIL_DOCUMENTS,
  STEPS,
  STORAGE_KEY,
} from '../../src/components/credit/new-application/step-config';
import { getSmartDefaults, VISIBLE_PRODUCT_TYPES } from './creditUtils';

type WizardStep = (typeof STEPS)[number]['key'];

type ApplicantMode = 'existing' | 'new';
type FinancialMode = 'retail' | 'business';

type DocumentState = {
  key: string;
  label: string;
  required: boolean;
  fileName: string | null;
  file?: File | null;
  uploadedDocumentId?: string | null;
  completed: boolean;
};


type FinancialDraft = {
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

type WizardDraft = {
  currentStep: WizardStep;
  searchQuery: string;
  searchResults: BorrowerProfile[];
  selectedBorrower: BorrowerProfile | null;
  applicantMode: ApplicantMode;

  productType: CreditProductType | '';
  currency: CurrencyCode;
  requestedAmount: string;
  requestedTenor: string;
  purpose: string;
  branchId: string;
  assignedRmId: string;
  financials: FinancialDraft;
  documents: DocumentState[];
};


const PRODUCT_OPTIONS = VISIBLE_PRODUCT_TYPES.map((product) => ({
  value: product.value as CreditProductType,
  label: product.label,
  description: product.value === 'TERM_LOAN'
    ? 'Standard amortising term financing'
    : product.value === 'OVERDRAFT'
      ? 'Working capital line with flexible drawings'
      : product.value === 'TRADE_FINANCE'
        ? 'Trade and import/export support'
        : product.value === 'PROJECT_FINANCE'
          ? 'Project-linked structured financing'
          : product.value === 'SYNDICATED'
            ? 'Multi-lender ticket'
            : product.value === 'BRIDGING'
              ? 'Short-term bridge funding'
              : product.value === 'HIRE_PURCHASE'
                ? 'Asset purchase financing'
                : 'Credit facility',
  amountBand: product.value === 'TERM_LOAN' ? 'RM 50k – RM 5m' : product.value === 'OVERDRAFT' ? 'RM 20k – RM 2m' : 'Configurable',
  tenureBand: product.value === 'OVERDRAFT' ? '12 – 36 months' : 'Up to 360 months',
}));



const initialFinancials: FinancialDraft = {
  monthlySalary: '',
  allowance: '',
  bonus: '',
  rentalIncome: '',
  otherIncome: '',
  monthlyCommitments: '',
  revenue: '',
  grossProfit: '',
  netProfit: '',
  existingBorrowings: '',
  currentAssets: '',
  currentLiabilities: '',
};

const initialDraft = (): WizardDraft => ({
  currentStep: 'applicant-search',
  searchQuery: '',
  searchResults: [],
  selectedBorrower: null,
  applicantMode: 'existing',

  productType: '',
  currency: 'MYR',
  requestedAmount: '',
  requestedTenor: '',
  purpose: '',
  branchId: '',
  assignedRmId: '',
  financials: initialFinancials,
  documents: [...RETAIL_DOCUMENTS, ...BUSINESS_DOCUMENTS].map((doc) => ({ ...doc, fileName: null, completed: false })),
});

function getStepIndex(step: WizardStep): number {
  return STEPS.findIndex((item) => item.key === step);
}

function getBorrowerDisplayName(profile: BorrowerProfile | null): string {
  if (!profile) return '—';
  return profile.account?.name || (profile.contact ? `${profile.contact.firstName} ${profile.contact.lastName}`.trim() : profile.name || 'Unnamed Borrower');
}

function getBorrowerTypeLabel(type?: string | null): string {
  if (!type) return 'Borrower';
  return type.replace(/_/g, ' ');
}

function getFinancialMode(profile: BorrowerProfile | null): FinancialMode {
  if (!profile) return 'retail';
  return profile.borrowerType === 'INDIVIDUAL' ? 'retail' : 'business';
}

function sum(values: Array<string | number>): number {
  let total = 0;
  for (const value of values) {
    total += Number(value) || 0;
  }
  return total;
}

function hasAnyFinancialInput(financials: FinancialDraft): boolean {
  return Object.values(financials).some((value) => String(value).trim() !== '');
}

function toMoney(value: string): number {
  return Number(value) || 0;
}

function buildBusinessLineItems(financials: FinancialDraft) {
  const revenue = toMoney(financials.revenue);
  const grossProfit = toMoney(financials.grossProfit);
  const netProfit = toMoney(financials.netProfit);
  const existingBorrowings = toMoney(financials.existingBorrowings);
  const currentAssets = toMoney(financials.currentAssets);
  const currentLiabilities = toMoney(financials.currentLiabilities);

  return {
    pl: [
      { lineKey: 'revenue', lineLabel: 'Revenue', amount: revenue, displayOrder: 1 },
      { lineKey: 'cogs', lineLabel: 'Cost of Goods Sold', amount: Math.max(0, revenue - grossProfit), displayOrder: 2 },
      { lineKey: 'gross_profit', lineLabel: 'Gross Profit', amount: grossProfit, displayOrder: 3 },
      { lineKey: 'operating_expenses', lineLabel: 'Operating Expenses', amount: Math.max(0, grossProfit - netProfit), displayOrder: 4 },
      { lineKey: 'interest', lineLabel: 'Interest Expense', amount: 0, displayOrder: 5 },
      { lineKey: 'depreciation', lineLabel: 'Depreciation & Amortization', amount: 0, displayOrder: 6 },
      { lineKey: 'net_income', lineLabel: 'Net Income', amount: netProfit, displayOrder: 7 },
    ],
    bs: [
      { lineKey: 'cash_and_equivalents', lineLabel: 'Cash & Equivalents', amount: 0, displayOrder: 1 },
      { lineKey: 'accounts_receivable', lineLabel: 'Accounts Receivable', amount: 0, displayOrder: 2 },
      { lineKey: 'inventory', lineLabel: 'Inventory', amount: 0, displayOrder: 3 },
      { lineKey: 'other_current_assets', lineLabel: 'Other Current Assets', amount: currentAssets, displayOrder: 4 },
      { lineKey: 'fixed_assets', lineLabel: 'Fixed Assets', amount: 0, displayOrder: 5 },
      { lineKey: 'intangible_assets', lineLabel: 'Intangible Assets', amount: 0, displayOrder: 6 },
      { lineKey: 'other_non_current_assets', lineLabel: 'Other Non-Current Assets', amount: 0, displayOrder: 7 },
      { lineKey: 'accounts_payable', lineLabel: 'Accounts Payable', amount: 0, displayOrder: 8 },
      { lineKey: 'short_term_debt', lineLabel: 'Short-Term Debt', amount: Math.min(existingBorrowings, currentLiabilities), displayOrder: 9 },
      { lineKey: 'other_current_liabilities', lineLabel: 'Other Current Liabilities', amount: Math.max(0, currentLiabilities - existingBorrowings), displayOrder: 10 },
      { lineKey: 'long_term_debt', lineLabel: 'Long-Term Debt', amount: 0, displayOrder: 11 },
      { lineKey: 'other_non_current_liabilities', lineLabel: 'Other Non-Current Liabilities', amount: 0, displayOrder: 12 },
    ],
  };
}

function documentKeyToClass(key: string): string {
  const map: Record<string, string> = {
    'nric-front': 'NRIC_PASSPORT',
    'nric-back': 'NRIC_PASSPORT',
    payslip: 'PAYSLIP',
    'bank-statement': 'BANK_STATEMENT',
    'bank-statements': 'BANK_STATEMENT',
    'epf-statement': 'OTHER',
    'ea-form': 'TAX_RETURN',
    'ssm-registration': 'SSM_CERT',
    'financial-statements': 'AUDITED_FINANCIALS',
    'director-id': 'NRIC_PASSPORT',
  };
  return map[key] ?? 'OTHER';
}

async function uploadWizardDocuments(applicationId: string, borrowerId: string, documents: DocumentState[]) {
  const selectedDocs = documents.filter((doc) => doc.file);
  if (selectedDocs.length === 0) return;

  await creditService.seedDocumentRequirements(applicationId).catch(() => undefined);
  let checklist = await creditService.listDocumentRequirements(applicationId).catch(() => null);

  for (const doc of selectedDocs) {
    if (!doc.file) continue;
    const classification = documentKeyToClass(doc.key);
    const fd = new FormData();
    fd.append('file', doc.file);
    fd.append('classification', classification);
    fd.append('description', `Uploaded during application create wizard: ${doc.label}`);

    const uploaded = await creditService.uploadApplicationDocument(borrowerId, applicationId, fd);
    const match = checklist?.requirements.find(
      (req) => req.isMandatory && !req.isCollected && req.documentClass === (uploaded.classification ?? classification),
    );
    if (match) {
      await creditService.linkRequirementDoc(match.id, uploaded.id);
      checklist = await creditService.listDocumentRequirements(applicationId).catch(() => checklist);
    }
  }
}

async function syncFinancialSnapshot(applicationId: string, borrower: BorrowerProfile, financials: FinancialDraft, currency: CurrencyCode) {
  if (!hasAnyFinancialInput(financials)) return;

  if (borrower.borrowerType === 'INDIVIDUAL') {
    const monthlyGrossIncome = sum([
      financials.monthlySalary,
      financials.allowance,
      financials.bonus,
      financials.rentalIncome,
      financials.otherIncome,
    ]);
    const monthlyCommitments = sum([financials.monthlyCommitments]);

    await retailIncomeApi.upsert(applicationId, {
      employmentType: 'SALARIED',
      employerName: borrower.name || undefined,
      monthlyGrossIncome,
      hirePurchaseCommitment: 0,
      creditCardCommitment: 0,
      existingLoanCommitment: 0,
      otherCommitments: monthlyCommitments,
    });
    return;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const statements = buildBusinessLineItems(financials);

  for (const statementType of ['PL', 'BS'] as const) {
    const statement = await financialApi.createStatement(borrower.id, {
      statementType,
      period: 'ANNUAL',
      fiscalYearEnd: todayIso,
      currency,
    });

    const items = statementType === 'PL' ? statements.pl : statements.bs;
    await financialApi.upsertLineItems(statement.id, items);
    await financialApi.computeRatios(statement.id);
  }
}

export default function CreditApplicationCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [borrowerContextStatus, setBorrowerContextStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [borrowerContextRetry, setBorrowerContextRetry] = useState(0);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borrowerContextRequestGeneration = useRef(0);
  const [draft, setDraft] = useState<WizardDraft>(() => initialDraft());


  const currentStepIndex = getStepIndex(draft.currentStep);
  const selectedBorrower = draft.selectedBorrower;
  const borrowerContextId = searchParams.get('borrowerId');
  const isContextBorrower = !!borrowerContextId && selectedBorrower?.id === borrowerContextId;
  const financialMode = getFinancialMode(selectedBorrower);
  const documentCatalog = financialMode === 'retail' ? RETAIL_DOCUMENTS : BUSINESS_DOCUMENTS;

  const selectedProduct = draft.productType ? PRODUCT_OPTIONS.find((item) => item.value === draft.productType) ?? null : null;
  const applicantTypeLabel = selectedBorrower ? getBorrowerTypeLabel(selectedBorrower.borrowerType) : 'Borrower';

  const derivedRetail = useMemo(() => {
    const gross = sum([draft.financials.monthlySalary, draft.financials.allowance, draft.financials.bonus, draft.financials.rentalIncome, draft.financials.otherIncome]);
    const commitments = sum([draft.financials.monthlyCommitments]);
    const net = gross - commitments;
    const dsr = gross > 0 ? (commitments / gross) * 100 : 0;
    return { gross, commitments, net, dsr };
  }, [draft.financials]);

  const derivedBusiness = useMemo(() => {
    const revenue = Number(draft.financials.revenue) || 0;
    const grossProfit = Number(draft.financials.grossProfit) || 0;
    const netProfit = Number(draft.financials.netProfit) || 0;
    const borrowings = Number(draft.financials.existingBorrowings) || 0;
    const currentAssets = Number(draft.financials.currentAssets) || 0;
    const currentLiabilities = Number(draft.financials.currentLiabilities) || 0;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const coverage = borrowings > 0 ? netProfit / borrowings : 0;
    return { revenue, grossProfit, netProfit, borrowings, currentAssets, currentLiabilities, currentRatio, margin, coverage };
  }, [draft.financials]);

  const documentCompletion = useMemo(() => {
    const total = draft.documents.filter((item) => item.required).length;
    const completed = draft.documents.filter((item) => item.required && item.completed).length;
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [draft.documents]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!draft.selectedBorrower) issues.push('Select or create a borrower applicant.');
    if (!draft.productType) issues.push('Choose a product.');
    if (!draft.requestedAmount || Number(draft.requestedAmount) <= 0) issues.push('Requested amount must be greater than zero.');
    if (!draft.requestedTenor || Number(draft.requestedTenor) <= 0) issues.push('Requested tenor must be greater than zero.');
    if (!draft.purpose.trim()) issues.push('Purpose is required.');
    if (documentCompletion < 100) issues.push('Required documents are still outstanding.');
    return issues;
  }, [draft, documentCompletion]);

  const canAdvance = useMemo(() => {
    switch (draft.currentStep) {
      case 'applicant-search':
        return true;
      case 'applicant-selection':
        return !!draft.selectedBorrower;
      case 'product-selection':
        return !!draft.productType;
      case 'application-details':
        return !!draft.requestedAmount && Number(draft.requestedAmount) > 0 && !!draft.requestedTenor && Number(draft.requestedTenor) > 0 && !!draft.purpose.trim();
      case 'financial-information':
        return true;
      case 'documents':
        return documentCompletion > 0;
      case 'review-submit':
        return validationIssues.length === 0;
      default:
        return false;
    }
  }, [draft.currentStep, draft.productType, draft.requestedAmount, draft.requestedTenor, draft.purpose, draft.selectedBorrower, documentCompletion, validationIssues.length]);

  useEffect(() => {
    if (!loaded || !restored) return;

    const payload = {
      ...draft,
      documents: draft.documents.map(({ key, label, required, uploadedDocumentId }) => ({
        key,
        label,
        required,
        fileName: null,
        uploadedDocumentId: uploadedDocumentId ?? null,
        completed: Boolean(uploadedDocumentId),
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(() => {
      creditService.saveApplicationDraft(payload).catch(() => {
        // localStorage remains the fallback cache
      });
    }, 800);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, [draft, loaded, restored]);

  useEffect(() => {
    let cancelled = false;

    const hydrateDraft = (source: Partial<WizardDraft>) => {
      setDraft((current) => ({
        ...current,
        ...source,
        financials: { ...initialFinancials, ...(source.financials ?? {}) },

        documents: Array.isArray(source.documents) && source.documents.length > 0
          ? (source.documents as DocumentState[])
          : current.documents,
        selectedBorrower: (source.selectedBorrower as BorrowerProfile | null) ?? null,
        searchResults: Array.isArray(source.searchResults) ? (source.searchResults as BorrowerProfile[]) : [],
      }));
    };

    const loadDraft = async () => {
      let serverDraft: Partial<WizardDraft> | null = null;
      let localDraft: Partial<WizardDraft> | null = null;

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          localDraft = JSON.parse(saved) as Partial<WizardDraft>;
        }
      } catch {
        // ignore corrupt local draft
      }

      try {
        const draftResponse = await creditService.getApplicationDraft();
        const payload = draftResponse?.payload;
        if (payload && typeof payload === 'object') {
          serverDraft = payload as Partial<WizardDraft>;
        }
      } catch {
        // server draft is optional; localStorage remains fallback
      }

      if (cancelled) return;

      const source = serverDraft ?? localDraft;
      if (source) {
        hydrateDraft(source);
        setRestored(true);
      }
      setLoaded(true);
    };

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !restored) return;
    toast('Draft restored from previous session', { icon: '📝' });
  }, [loaded, restored]);

  useEffect(() => {
    if (!borrowerContextId || !loaded) return;

    let cancelled = false;
    const requestGeneration = ++borrowerContextRequestGeneration.current;
    setBorrowerContextStatus('loading');

    const hydrateBorrowerContext = async () => {
      try {
        const borrower = await creditService.getBorrowerProfile(borrowerContextId);
        if (cancelled || requestGeneration !== borrowerContextRequestGeneration.current) return;

        setDraft((current) => ({
          ...current,
          applicantMode: 'existing',
          selectedBorrower: borrower,
        }));
        setBorrowerContextStatus('idle');
      } catch {
        if (cancelled || requestGeneration !== borrowerContextRequestGeneration.current) return;
        setBorrowerContextStatus('error');
      }
    };

    void hydrateBorrowerContext();

    return () => {
      cancelled = true;
    };
  }, [borrowerContextId, borrowerContextRetry, loaded]);

  useEffect(() => {
    setBranchLoading(true);
    branchApi.list()
      .then((items) => setBranches(items))
      .catch(() => {})
      .finally(() => setBranchLoading(false));
  }, []);

  useEffect(() => {
    if (selectedBorrower && draft.applicantMode === 'existing') {
      setDraft((prev) => {
        const currentDocs = prev.documents;
        const nextDocs = (selectedBorrower.borrowerType === 'INDIVIDUAL' ? RETAIL_DOCUMENTS : BUSINESS_DOCUMENTS).map((doc) => {
          const existing = currentDocs.find((item) => item.key === doc.key);
          return {
            ...(existing ?? {}),
            ...doc,
            fileName: existing?.fileName ?? null,
            completed: existing?.completed ?? false,
          };
        });
        return { ...prev, documents: nextDocs };
      });
    }
  }, [selectedBorrower?.id, draft.applicantMode]);

  const persistDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = {
        ...draft,
        documents: draft.documents.map(({ key, label, required, uploadedDocumentId }) => ({
          key,
          label,
          required,
          fileName: null,
          uploadedDocumentId: uploadedDocumentId ?? null,
          completed: Boolean(uploadedDocumentId),
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      await creditService.saveApplicationDraft(payload);
      toast.success('Draft saved');
    } catch (err) {
      toast.error(friendlyMessage(err, 'Draft saved locally, but server sync failed'));
    } finally {
      setSavingDraft(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    void creditService.deleteApplicationDraft().catch(() => {
      // ignore server cleanup failures; local draft was cleared
    });
    setDraft(initialDraft());
    setErrors([]);
    toast('Draft discarded', { icon: '🗑️' });
  };

  const setStep = (step: WizardStep) => {
    setDraft((prev) => ({ ...prev, currentStep: step }));
  };

  const moveNext = () => {
    const next = STEPS[currentStepIndex + 1]?.key;
    if (next) setStep(next);
  };

  const movePrevious = () => {
    const previous = STEPS[currentStepIndex - 1]?.key;
    if (previous) setStep(previous);
  };

  const searchApplicants = async (query: string) => {
    setDraft((prev) => ({ ...prev, searchQuery: query }));
    if (query.trim().length < 2) {
      setDraft((prev) => ({ ...prev, searchResults: [] }));
      return;
    }
    setSearching(true);
    try {
      const result = await creditService.listBorrowerProfiles({ search: query.trim(), limit: 10 });
      setDraft((prev) => ({ ...prev, searchResults: result.profiles }));
    } catch (err) {
      toast.error(friendlyMessage(err, 'Failed to search applicants'));
    } finally {
      setSearching(false);
    }
  };

  const selectExistingBorrower = (profile: BorrowerProfile) => {
    borrowerContextRequestGeneration.current += 1;
    setBorrowerContextStatus('idle');
    setDraft((prev) => ({
      ...prev,
      applicantMode: 'existing',
      selectedBorrower: profile,
      currentStep: 'applicant-selection',
    }));
  };


  const createApplication = async () => {
    const borrower = draft.selectedBorrower;
    if (!borrower) {
      setErrors(['Select an existing borrower first.']);
      return;
    }

    const issues = validationIssues;
    if (issues.length > 0) {
      setErrors(issues);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      const defaultRm = getSmartDefaults({ currentUser: user, productType: draft.productType || undefined });
      const payload: Partial<CreditApplication> & Record<string, unknown> = {
        borrowerProfileId: borrower.id,
        productType: draft.productType as CreditProductType,
        requestedAmount: Number(draft.requestedAmount),
        requestedTenor: Number(draft.requestedTenor),
        currency: draft.currency,
        purpose: draft.purpose.trim(),
        branchId: draft.branchId || null,
        assignedRmId: draft.assignedRmId || defaultRm.assignedRmId || null,
      };
      const created = await creditService.createApplication(payload);
      try {
        await uploadWizardDocuments(created.id, borrower.id, draft.documents);
      } catch (uploadErr) {
        console.error('Failed to upload wizard documents after application creation', uploadErr);
        toast.error(friendlyMessage(uploadErr, 'Application created, but document upload could not be completed'));
      }
      try {
        await syncFinancialSnapshot(created.id, borrower, draft.financials, draft.currency);
      } catch (syncErr) {
        console.error('Failed to sync financial snapshot after application creation', syncErr);
        toast.error(friendlyMessage(syncErr, 'Application created, but financial information could not be saved automatically'));
      }
      localStorage.removeItem(STORAGE_KEY);
      void creditService.deleteApplicationDraft().catch(() => {
        // stale server draft cleanup should not block redirect
      });
      toast.success('Application created');
      navigate(`/credit/applications/${created.id}?new=1`);
    } catch (err) {
      toast.error(friendlyMessage(err, 'Failed to create application'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateDocument = (key: string, updates: Partial<DocumentState>) => {
    setDraft((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) => (doc.key === key ? { ...doc, ...updates } : doc)),
    }));
  };

  const renderBorrowerContextStatus = () => {
    if (!borrowerContextId || borrowerContextStatus === 'idle') return null;

    if (borrowerContextStatus === 'loading') {
      return (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-low)' }}>
          Loading borrower opened from Borrower 360…
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p>Unable to load the borrower opened from Borrower 360. Your application draft is still available.</p>
        <button
          type="button"
          onClick={() => setBorrowerContextRetry((attempt) => attempt + 1)}
          className="mt-3 rounded border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-800"
        >
          Retry borrower lookup
        </button>
      </div>
    );
  };

  const renderStep = () => {
    switch (draft.currentStep) {
      case 'applicant-search':
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Search applicant</label>
              <input
                value={draft.searchQuery}
                onChange={(e) => searchApplicants(e.target.value)}
                placeholder="NRIC, phone, email, registration number, or name"
                className="w-full rounded border px-4 py-3 text-sm outline-none focus:ring-1"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>
                Search the borrower registry first to avoid duplicate origination.
              </p>
            </div>

            <div className="rounded-lg border" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--cr-outline-variant)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Search results</h3>
                <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>{searching ? 'Searching…' : `${draft.searchResults.length} result(s)`}</span>
              </div>
              {draft.searchResults.length === 0 ? (
                <div className="px-4 py-6 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                  {draft.searchQuery.trim().length < 2 ? 'Type at least two characters to search.' : 'No matching applicant found.'}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--cr-outline-variant)' }}>
                  {draft.searchResults.map((profile) => {
                    const appCount = profile._count?.applications ?? profile.applications?.length ?? 0;
                    return (
                      <div key={profile.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{getBorrowerDisplayName(profile)}</p>
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--cr-secondary-fixed)', color: 'var(--cr-on-secondary-fixed)' }}>{getBorrowerTypeLabel(profile.borrowerType)}</span>
                            {profile.kycVerifiedAt && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">KYC verified</span>}
                          </div>
                          <p className="mt-1 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>
                            {profile.nricPassport || profile.registrationNumber || 'No identifier on file'} · {appCount} application(s)
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/credit/borrowers/${profile.id}`}
                            className="rounded border px-3 py-2 text-sm font-semibold"
                            style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface)', textDecoration: 'none' }}
                          >
                            View Applicant 360
                          </Link>
                          <button
                            type="button"
                            onClick={() => selectExistingBorrower(profile)}
                            className="rounded px-3 py-2 text-sm font-semibold"
                            style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', border: 'none', cursor: 'pointer' }}
                          >
                            Use Existing Applicant
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      case 'applicant-selection':
        return (
          <div className="space-y-5">
            {selectedBorrower ? (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Selected applicant</p>
                      {isContextBorrower && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--cr-secondary-fixed)', color: 'var(--cr-on-secondary-fixed)' }}>Borrower 360 context</span>}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{getBorrowerDisplayName(selectedBorrower)}</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>{applicantTypeLabel} · {selectedBorrower.nricPassport || selectedBorrower.registrationNumber || 'No identifier on file'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isContextBorrower && !window.confirm('Change the borrower for this application? The application will no longer use the borrower opened from Borrower 360.')) return;
                      setDraft((prev) => ({ ...prev, selectedBorrower: null, applicantMode: 'existing' }));
                    }}
                    className="rounded border px-3 py-2 text-sm font-semibold"
                    style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface)', cursor: 'pointer', background: 'white' }}
                  >
                    {isContextBorrower ? 'Change borrower' : 'Clear selection'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--cr-on-surface)' }}>No applicant selected</h3>
                    <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                      Select an existing borrower from the search results. New borrower identities must be created through the canonical Borrower Management flow so type-specific identity and duplicate rules are applied consistently.
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--cr-surface-container-low)', color: 'var(--cr-on-surface-variant)' }}>Existing borrower only</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    to="/credit/borrowers/new?returnTo=application"
                    className="rounded px-4 py-2 text-sm font-semibold"
                    style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', textDecoration: 'none' }}
                  >
                    Create borrower first
                  </Link>
                  <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>After creation, return here and select the borrower.</span>
                </div>
              </div>
            )}
          </div>
        );
      case 'product-selection':
        return (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {PRODUCT_OPTIONS.map((product) => {
                const active = draft.productType === product.value;
                return (
                  <button
                    key={product.value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, productType: product.value as CreditProductType }))}
                    className="rounded-lg border p-4 text-left transition"
                    style={{
                      borderColor: active ? 'var(--cr-secondary)' : 'var(--cr-outline-variant)',
                      background: active ? 'var(--cr-secondary-fixed)' : 'var(--cr-surface-container-lowest)',
                      cursor: 'pointer',
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: active ? 'var(--cr-secondary)' : 'var(--cr-on-surface-variant)' }}>{product.label}</p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--cr-on-surface)' }}>{product.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full px-2 py-1" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--cr-on-surface-variant)' }}>{product.amountBand}</span>
                      <span className="rounded-full px-2 py-1" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--cr-on-surface-variant)' }}>{product.tenureBand}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedProduct && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Selected product</p>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{selectedProduct.label}</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>{selectedProduct.description}</p>
              </div>
            )}
          </div>
        );
      case 'application-details':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">Requested Amount</label>
              <input
                type="number"
                min="0"
                value={draft.requestedAmount}
                onChange={(e) => setDraft((prev) => ({ ...prev, requestedAmount: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Requested Tenor (months)</label>
              <input
                type="number"
                min="1"
                value={draft.requestedTenor}
                onChange={(e) => setDraft((prev) => ({ ...prev, requestedTenor: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Currency</label>
              <select
                value={draft.currency}
                onChange={(e) => setDraft((prev) => ({ ...prev, currency: e.target.value as CurrencyCode }))}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              >
                {['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'].map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Branch</label>
              <select
                value={draft.branchId}
                onChange={(e) => setDraft((prev) => ({ ...prev, branchId: e.target.value }))}
                disabled={branchLoading}
                className="w-full rounded border px-3 py-2 text-sm disabled:opacity-60"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              >
                <option value="">Default branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Relationship Manager ID</label>
              <input
                value={draft.assignedRmId}
                onChange={(e) => setDraft((prev) => ({ ...prev, assignedRmId: e.target.value }))}
                placeholder="Optional override"
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Purpose of Financing</label>
              <textarea
                rows={4}
                value={draft.purpose}
                onChange={(e) => setDraft((prev) => ({ ...prev, purpose: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm resize-vertical"
                style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}
              />
            </div>
          </div>
        );
      case 'financial-information':
        return financialMode === 'retail' ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">Monthly Salary</label>
                <input value={draft.financials.monthlySalary} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, monthlySalary: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Allowance</label>
                <input value={draft.financials.allowance} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, allowance: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Bonus</label>
                <input value={draft.financials.bonus} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, bonus: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Rental Income</label>
                <input value={draft.financials.rentalIncome} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, rentalIncome: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Other Income</label>
                <input value={draft.financials.otherIncome} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, otherIncome: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Monthly Commitments</label>
                <input value={draft.financials.monthlyCommitments} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, monthlyCommitments: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Calculated retail screening metrics</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Metric label="Gross Income" value={derivedRetail.gross} />
                <Metric label="Commitments" value={derivedRetail.commitments} />
                <Metric label="Net Income" value={derivedRetail.net} />
                <Metric label="DSR" value={`${derivedRetail.dsr.toFixed(1)}%`} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">Revenue</label>
                <input value={draft.financials.revenue} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, revenue: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Gross Profit</label>
                <input value={draft.financials.grossProfit} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, grossProfit: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Net Profit</label>
                <input value={draft.financials.netProfit} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, netProfit: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Existing Borrowings</label>
                <input value={draft.financials.existingBorrowings} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, existingBorrowings: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Current Assets</label>
                <input value={draft.financials.currentAssets} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, currentAssets: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Current Liabilities</label>
                <input value={draft.financials.currentLiabilities} onChange={(e) => setDraft((prev) => ({ ...prev, financials: { ...prev.financials, currentLiabilities: e.target.value } }))} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }} />
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Calculated business screening metrics</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Metric label="Revenue" value={derivedBusiness.revenue} />
                <Metric label="Current Ratio" value={derivedBusiness.currentRatio.toFixed(2)} />
                <Metric label="Net Margin" value={`${derivedBusiness.margin.toFixed(1)}%`} />
                <Metric label="Coverage" value={derivedBusiness.coverage.toFixed(2)} />
              </div>
            </div>
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Required documents</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>{selectedBorrower ? getBorrowerTypeLabel(selectedBorrower.borrowerType) : 'Borrower'} checklist</p>
                </div>
                <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: 'var(--cr-secondary-fixed)', color: 'var(--cr-on-secondary-fixed)' }}>{documentCompletion}% complete</span>
              </div>
              <div className="mt-4 space-y-3">
                {draft.documents.filter((doc) => documentCatalog.some((item) => item.key === doc.key)).map((doc) => (
                  <div key={doc.key} className="rounded border p-3" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{doc.label}</p>
                          {doc.required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Required</span>}
                        </div>
                        <p className="mt-1 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>{doc.fileName ? `Uploaded: ${doc.fileName}` : 'No file uploaded yet'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface)' }}>
                          Upload
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              updateDocument(doc.key, { file: file ?? null, fileName: file?.name ?? null, completed: !!file });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'review-submit':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Applicant" lines={[getBorrowerDisplayName(selectedBorrower), applicantTypeLabel, selectedBorrower?.nricPassport || selectedBorrower?.registrationNumber || 'No identifier']}/> 
              <InfoCard title="Product" lines={[selectedProduct?.label ?? '—', selectedProduct?.description ?? '']} />
              <InfoCard title="Facility" lines={[`Amount: ${draft.currency} ${Number(draft.requestedAmount || 0).toLocaleString()}`, `Tenor: ${draft.requestedTenor || '—'} months`, draft.purpose || 'No purpose provided']} />
              <InfoCard title="Documents" lines={[`${documentCompletion}% complete`, `${draft.documents.filter((doc) => doc.required && doc.completed).length}/${draft.documents.filter((doc) => doc.required).length} required documents complete`]} />
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>Validation blockers</h3>
              {validationIssues.length === 0 ? (
                <p className="mt-2 text-sm text-emerald-700">No blockers detected. Ready to create the application.</p>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                  {validationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="credit-module px-4 py-5 sm:px-6 lg:px-8" style={{ minHeight: '100%', background: 'var(--cr-surface)' }}>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-[16px]">description</span>
            Credit Applications
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em]" style={{ fontFamily: 'var(--cr-font-display)', color: 'var(--cr-on-surface)' }}>New Credit Application Wizard</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>Desktop-first application origination with applicant search, product capture, and review gating.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={persistDraft} disabled={savingDraft} className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white', color: 'var(--cr-on-surface)' }}>
                {savingDraft ? 'Saving…' : 'Save Draft'}
              </button>
              <button type="button" onClick={clearDraft} className="rounded border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white', color: 'var(--cr-on-surface)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <WizardStepper steps={STEPS} currentStep={draft.currentStep} currentStepIndex={currentStepIndex} onStepSelect={setStep} />

          <main className="min-w-0">
            <div className="rounded-lg border p-5" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Step {currentStepIndex + 1} of {STEPS.length}</p>
                  <h2 className="mt-1 text-xl font-semibold" style={{ color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}>{STEPS[currentStepIndex].title}</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>{STEPS[currentStepIndex].subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--cr-secondary-fixed)', color: 'var(--cr-on-secondary-fixed)' }}>{selectedBorrower ? getBorrowerTypeLabel(selectedBorrower.borrowerType) : 'No applicant'}</span>
                  <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--cr-surface-container-low)', color: 'var(--cr-on-surface-variant)' }}>{selectedProduct?.label ?? 'No product'}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {renderBorrowerContextStatus()}
                <div>{renderStep()}</div>
              </div>

              {errors.length > 0 && (
                <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-semibold">Please resolve the following blockers:</p>
                  <ul className="mt-2 list-disc pl-5">
                    {errors.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}

              <WizardActions
                currentStepIndex={currentStepIndex}
                totalSteps={STEPS.length}
                canAdvance={canAdvance}
                canSubmit={validationIssues.length === 0}
                savingDraft={savingDraft}
                submitting={submitting}
                isReviewStep={draft.currentStep === 'review-submit'}
                onPrevious={movePrevious}
                onSaveDraft={persistDraft}
                onNext={moveNext}
                onCreate={createApplication}
              />
            </div>
          </main>

          <RightSummaryPanel
            applicantName={selectedBorrower ? getBorrowerDisplayName(selectedBorrower) : 'Select a borrower'}
            applicantTypeLabel={selectedBorrower ? getBorrowerTypeLabel(selectedBorrower.borrowerType) : '—'}
            productLabel={selectedProduct?.label ?? 'Choose a product'}
            amountLabel={draft.requestedAmount ? `${draft.currency} ${Number(draft.requestedAmount).toLocaleString()}` : '—'}
            tenorLabel={draft.requestedTenor ? `${draft.requestedTenor} months` : '—'}
            branchLabel={branches.find((b) => b.id === draft.branchId)?.name ?? 'Default'}
            documentCompletion={documentCompletion}
            applicantSelected={!!selectedBorrower}
            productSelected={!!draft.productType}
            purposeCaptured={!!draft.purpose.trim()}
            requiredDocsComplete={documentCompletion === 100}
            riskNote={financialMode === 'retail'
              ? `Retail DSR ${derivedRetail.dsr.toFixed(1)}% · net income ${derivedRetail.net.toLocaleString()}`
              : `Current ratio ${derivedBusiness.currentRatio.toFixed(2)} · coverage ${derivedBusiness.coverage.toFixed(2)}`}
          />
        </div>
      </div>


    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white' }}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>{title}</p>
      <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--cr-on-surface)' }}>
        {lines.filter(Boolean).map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}
