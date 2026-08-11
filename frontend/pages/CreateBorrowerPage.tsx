import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import creditService, { BorrowerOnboardingStage, CreateBorrowerProfilePayload, DuplicateMatch } from '../src/services/credit.service';
import { useDuplicateCheck } from '../src/hooks/useDuplicateCheck';
import type { DuplicateIdentityResult } from '../src/types/credit-ui.types';
import { STEPS } from '../src/components/credit/create-borrower/ProgressTracker';
import TopBar from '../src/components/credit/create-borrower/TopBar';
import DuplicateCheckStep from '../src/components/credit/create-borrower/DuplicateCheckStep';
import BorrowerTypeStep from '../src/components/credit/create-borrower/BorrowerTypeStep';
import BasicInfoStep, { FormData, initialFormData } from '../src/components/credit/create-borrower/BasicInfoStep';
import ContactInfoStep from '../src/components/credit/create-borrower/ContactInfoStep';
import EmploymentFinancialsStep from '../src/components/credit/create-borrower/EmploymentFinancialsStep';
import ComplianceChecksStep from '../src/components/credit/create-borrower/ComplianceChecksStep';
import DocumentUploadStep from '../src/components/credit/create-borrower/DocumentUploadStep';
import ReviewStep from '../src/components/credit/create-borrower/ReviewStep';
import CreateBorrowerActionPanel from '../src/components/credit/create-borrower/CreateBorrowerActionPanel';
import DuplicateConflictModal from '../src/components/credit/create-borrower/DuplicateConflictModal';
import ProgressTracker from '../src/components/credit/create-borrower/ProgressTracker';

type BorrowerType = 'INDIVIDUAL' | 'CORPORATE' | 'SOLE_PROPRIETOR';

const SEGMENT_LABELS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'Retail',
  SOLE_PROPRIETOR: 'SME',
  CORPORATE: 'Corporate',
};

const DRAFT_KEY = 'createBorrowerDraft';
const ONBOARDING_KEY = 'createBorrowerOnboardingKey';

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `borrower-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeWizardStep(step: number): number {
  if (step <= 0) return 0;
  if (step <= 2) return 1;
  if (step === 3) return 2;
  if (step === 4) return 3;
  if (step <= 6) return 4;
  return 5;
}

const CreateBorrowerPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Step state ──
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // ── Form data ──
  const [formData, setFormData] = useState<FormData>(initialFormData());

  // ── Duplicate check ──
  const { dupCheck, dupBorrowerId, runCheck: runDuplicateCheck, reset: resetDupCheck } = useDuplicateCheck();

  // ── Submission ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 409 conflict ──
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateMatch[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const isIndividual = formData.borrowerType === 'INDIVIDUAL';
  const isCorporateType = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';

  // ── Load draft on mount ──
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hadSavedDraft, setHadSavedDraft] = useState(false);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [onboardingKey] = useState(() => localStorage.getItem(ONBOARDING_KEY) || newIdempotencyKey());
  const [identityResult, setIdentityResult] = useState<DuplicateIdentityResult | null>(null);
  const [identityValue, setIdentityValue] = useState('');
  const [identityChecking, setIdentityChecking] = useState(false);
  const [exceptionRequesting, setExceptionRequesting] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      let hasServerDraft = false;
      try {
        const serverDraft = await creditService.getApplicationDraft();
        if (mounted && serverDraft) {
          hasServerDraft = true;
          setServerDraftId(serverDraft.id);
          const payload = serverDraft.payload as { formData?: Partial<FormData>; currentStep?: number; onboardingKey?: string };
          if (payload.formData) {
            setFormData({ ...initialFormData(), ...payload.formData });
            setHadSavedDraft(true);
          }
          if (typeof payload.currentStep === 'number') setCurrentStep(normalizeWizardStep(payload.currentStep));
          if (payload.onboardingKey) localStorage.setItem(ONBOARDING_KEY, payload.onboardingKey);
        }
      } catch { /* fall back to the existing local draft */ }
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved && mounted) {
          const draft = JSON.parse(saved);
          if (!hasServerDraft && draft.formData) setFormData({ ...initialFormData(), ...draft.formData });
          if (!hasServerDraft && typeof draft.currentStep === 'number') setCurrentStep(normalizeWizardStep(draft.currentStep));
          if (draft.formData) setHadSavedDraft(true);
          if (draft.onboardingKey) localStorage.setItem(ONBOARDING_KEY, draft.onboardingKey);
        }
      } catch { /* ignore corrupt draft */ }
      if (mounted) setDraftLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  // ── Show toast when a saved draft is restored ──
  useEffect(() => {
    if (draftLoaded && hadSavedDraft) {
      toast('Draft restored from previous session', { icon: '📝' });
    }
  }, [draftLoaded, hadSavedDraft]);

  // ── Save draft on change (skip until draft load is complete to avoid overwriting) ──
  useEffect(() => {
    if (!draftLoaded) return; // Don't save until draft load attempt is done
    // Don't persist File objects in localStorage
    const storable = { ...formData, documents: [] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: storable, currentStep, onboardingKey }));
    localStorage.setItem(ONBOARDING_KEY, onboardingKey);
    const timer = window.setTimeout(() => {
      void creditService.saveApplicationDraft({ formData: storable, currentStep, onboardingKey }).then((draft) => setServerDraftId(draft.id)).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [formData, currentStep, draftLoaded, onboardingKey]);

  // ── Handlers ──

  const handleFormDataChange = useCallback((updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleBorrowerTypeChange = useCallback((value: BorrowerType) => {
    setFormData(prev => ({
      ...prev,
      borrowerType: value,
      // Reset type-specific fields
      ssm: '',
      nric: '',
      dateOfBirth: '',
      dateOfIncorporation: '',
      businessNature: '',
      businessType: '',
      authorizedRepresentative: '',
      preferredName: '',
      maritalStatus: '',
      educationLevel: '',
      taxNumber: '',
      officePhone: '',
      preferredContactMethod: '',
      mailingAddress: '',
      accountId: null,
      contactId: null,
    }));
    resetDupCheck();
    setIdentityResult(null);
    setIdentityValue('');
    setIdentityError(null);
  }, [resetDupCheck]);

  const runDuplicateCheckCb = useCallback(() => {
    const identifier = isIndividual ? formData.nric : formData.ssm;
    if (!identifier?.trim()) return;
    void runDuplicateCheck(isIndividual ? { nric: identifier } : { ssm: identifier });
  }, [isIndividual, formData.nric, formData.ssm, runDuplicateCheck]);

  const runIdentityCheck = useCallback(async (identifier: string) => {
    if (!serverDraftId) {
      setIdentityError('Saving the secure server draft… please try the identity check again.');
      return;
    }
    if (!identifier.trim()) return;
    setIdentityChecking(true);
    setIdentityError(null);
    setIdentityValue(identifier.trim());
    try {
      const segment = formData.borrowerType === 'SOLE_PROPRIETOR' ? 'SME' : formData.borrowerType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';
      const identifierType = segment === 'CORPORATE' || segment === 'SME' ? 'BUSINESS_REGISTRATION' : 'NRIC';
      setIdentityResult(await creditService.checkBorrowerIdentity({ draftId: serverDraftId, segment, identifier, identifierType }));
    } catch (e: any) {
      setIdentityResult(null);
      setIdentityError(e?.response?.data?.message || 'Identity check failed.');
    } finally {
      setIdentityChecking(false);
    }
  }, [formData.borrowerType, serverDraftId]);

  const requestIdentityException = useCallback(async (input: { category: string; justification: string }) => {
    if (!serverDraftId || !identityResult?.match) return;
    setExceptionRequesting(true);
    try {
      const segment = formData.borrowerType === 'SOLE_PROPRIETOR' ? 'SME' : formData.borrowerType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';
      const exception = await creditService.requestDuplicateException({ draftId: serverDraftId, matchedBorrowerId: identityResult.match.borrowerId, segment, identityValue, ...input });
      setIdentityResult(prev => prev ? { ...prev, exceptionRequestId: exception.id, exceptionStatus: exception.status } : prev);
      toast.success('Duplicate exception request submitted for approval');
    } catch (e: any) {
      setIdentityError(e?.response?.data?.message || 'Could not request duplicate exception.');
    } finally {
      setExceptionRequesting(false);
    }
  }, [formData.borrowerType, identityResult, identityValue, serverDraftId]);

  const identityCanProceed = Boolean(identityResult && (!identityResult.exactMatch || identityResult.exceptionStatus === 'APPROVED'));

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  const handleSaveDraft = useCallback(() => {
    const storable = { ...formData, documents: [] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: storable, currentStep, onboardingKey }));
    void creditService.saveApplicationDraft({ formData: storable, currentStep, onboardingKey }).then((draft) => setServerDraftId(draft.id)).catch(() => undefined);
    toast.success('Draft saved');
  }, [formData, currentStep, onboardingKey]);

  const handleValidate = useCallback(() => {
    const isInd = formData.borrowerType === 'INDIVIDUAL';
    const isCorp = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';

    const issues: string[] = [];
    if (!formData.name.trim()) issues.push(`${isInd ? 'Full Name' : 'Company Name'} is required`);

    // Individual mandatory fields
    if (isInd) {
      if (!formData.nric.trim()) issues.push('NRIC/Passport is required');
      if (!formData.dateOfBirth) issues.push('Date of Birth is required');
      if (!formData.nationality.trim()) issues.push('Nationality is required');
    }

    // Corporate/SME mandatory fields
    if (isCorp) {
      if (!formData.ssm.trim()) issues.push('SSM Registration Number is required');
      if (!formData.dateOfIncorporation) issues.push('Date of Incorporation is required');
      if (!formData.businessNature.trim()) issues.push('Business Nature is required');
    }

    if (issues.length === 0) {
      toast.success('All required fields for current step are complete');
    } else {
      toast.error(`${issues.length} required field(s): ${issues.join(', ')}`);
    }
  }, [formData]);

  // ── Post-create orchestration with explicit recoverable outcomes ──

  const runPostCreateSteps = useCallback(async (borrowerId: string): Promise<BorrowerOnboardingStage[]> => {
    const stages: BorrowerOnboardingStage[] = [{ name: 'PROFILE', status: 'COMPLETED' }];
    const run = async (name: BorrowerOnboardingStage['name'], task: Promise<unknown>) => {
      try {
        await task;
        stages.push({ name, status: 'COMPLETED' });
      } catch (e: any) {
        stages.push({ name, status: 'FAILED', message: e?.response?.data?.message || 'Follow-up action failed.' });
      }
    };

    if (formData.monthlyGrossIncome) {
      const gross = Number(formData.monthlyGrossIncome) + Number(formData.fixedAllowances || 0);
      await run('INCOME', creditService.putIncome(borrowerId, {
        employmentType: formData.employmentType || undefined,
        employerName: formData.employerName || undefined,
        monthlyGrossIncome: gross,
        existingLoanCommitment: Number(formData.existingCommitments) || 0,
      }));
    } else stages.push({ name: 'INCOME', status: 'NOT_REQUIRED' });

    if (formData.kycVerified) await run('KYC', creditService.runKyc(borrowerId));
    else stages.push({ name: 'KYC', status: 'NOT_REQUIRED' });

    if (formData.amlResult !== 'not_started') {
      await run('AML', creditService.runAml(borrowerId, {
        result: formData.amlResult.toUpperCase(),
        notes: formData.amlNotes || undefined,
      }));
    } else stages.push({ name: 'AML', status: 'NOT_REQUIRED' });

    if (formData.documents.length > 0) {
      for (const doc of formData.documents) await run('DOCUMENTS', creditService.uploadBorrowerDocument(borrowerId, doc.file, doc.documentClass));
    } else stages.push({ name: 'DOCUMENTS', status: 'NOT_REQUIRED' });
    return stages;
  }, [formData]);

  const handleSubmit = useCallback(async (overrideDuplicate = false) => {
    setError(null);
    setSaving(true);
    try {
      // Build address string from components
      const addressParts = [formData.addressLine1, formData.addressLine2, formData.postcode, formData.city, formData.state]
        .filter(Boolean);
      const addressString = addressParts.length > 0 ? addressParts.join(', ') : undefined;

      const payload: CreateBorrowerProfilePayload = {
        idempotencyKey: onboardingKey,
        borrowerType: formData.borrowerType,
        name: formData.name || null,
        accountId: formData.accountId,
        contactId: formData.contactId,
        nricPassport: formData.nric || undefined,
        registrationNumber: formData.ssm || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: addressString,
        gender: formData.gender || undefined,
        nationality: formData.nationality || undefined,
        // Type-specific fields — sent to backend for persistence
        ...(formData.dateOfBirth ? { dateOfBirth: formData.dateOfBirth } : {}),
        ...(formData.dateOfIncorporation ? { dateOfIncorporation: formData.dateOfIncorporation } : {}),
        ...(formData.businessNature ? { businessNature: formData.businessNature } : {}),
        ...(formData.businessType ? { businessType: formData.businessType } : {}),
        ...(formData.authorizedRepresentative ? { authorizedRepresentative: formData.authorizedRepresentative } : {}),
        ...(formData.preferredName ? { preferredName: formData.preferredName } : {}),
        ...(formData.maritalStatus ? { maritalStatus: formData.maritalStatus } : {}),
        ...(formData.educationLevel ? { educationLevel: formData.educationLevel } : {}),
        ...(formData.taxNumber ? { taxNumber: formData.taxNumber } : {}),
        ...(formData.officePhone ? { officePhone: formData.officePhone } : {}),
        ...(formData.preferredContactMethod ? { preferredContactMethod: formData.preferredContactMethod as any } : {}),
        ...(formData.mailingAddress ? { mailingAddress: formData.mailingAddress } : {}),
        ...(formData.industrySector ? { sicCode: formData.industrySector } : {}),
        ...(formData.estimatedAnnualRevenue ? { annualTurnover: formData.estimatedAnnualRevenue } : {}),
        ...(overrideDuplicate && { overrideDuplicate: true }),
      };
      const profile = await creditService.createBorrowerProfile(payload);

      // Post-create orchestration (best-effort)
      const stages = await runPostCreateSteps(profile.id);
      const requiresFollowUp = stages.some(stage => stage.status === 'FAILED');

      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(ONBOARDING_KEY);
      toast.success(requiresFollowUp ? 'Borrower created; onboarding requires follow-up.' : 'Borrower created successfully');
      navigate(`/credit/borrowers/${profile.id}`, { state: { onboarding: { borrowerId: profile.id, status: requiresFollowUp ? 'REQUIRES_FOLLOW_UP' : 'COMPLETED', stages } } });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const conflicts: DuplicateMatch[] = e?.response?.data?.data?.duplicates ?? e?.response?.data?.data ?? [];
        setDuplicateConflict(Array.isArray(conflicts) ? conflicts : []);
        setShowConflictModal(true);
        return;
      }
      setError(e?.response?.data?.message || 'Failed to create borrower. Please try again.');
      toast.error(e?.response?.data?.message || 'Failed to create borrower');
    } finally {
      setSaving(false);
    }
  }, [formData, navigate, runPostCreateSteps]);

  // ── Can submit? ──
  const canSubmit = formData.name.trim() &&
    (isCorporateType ? formData.ssm.trim() : true) &&
    (isCorporateType ? !!formData.dateOfIncorporation : true) &&
    (isCorporateType ? formData.businessNature.trim() : true) &&
    (isIndividual ? formData.nric.trim() : true) &&
    (isIndividual ? !!formData.dateOfBirth : true) &&
    (isIndividual ? !!formData.nationality.trim() : true) &&
    dupCheck !== 'checking';

  // ── Mark step as completed when moving forward ──
  const handleNext = useCallback(() => {
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  // ── Render current step ──
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <DuplicateCheckStep
              onUseExisting={(borrowerId) => navigate(`/credit/borrowers/${borrowerId}`)}
              onProceed={() => { setCompletedSteps(prev => new Set(prev).add(0)); setCurrentStep(1); }}
              onIdentityCheck={runIdentityCheck}
              identityResult={identityResult}
              identityChecking={identityChecking}
              identityError={identityError}
              canProceed={identityCanProceed}
              onRequestException={requestIdentityException}
              exceptionRequesting={exceptionRequesting}
            />
            <BorrowerTypeStep value={formData.borrowerType} onChange={handleBorrowerTypeChange} />
          </>
        );
      case 1:
        return (
          <BasicInfoStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
            duplicateStatus={dupCheck}
            duplicateBorrowerId={dupBorrowerId}
            onDuplicateCheck={runDuplicateCheckCb}
          />
        );
      case 2:
        return (
          <ContactInfoStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 3:
        return (
          <EmploymentFinancialsStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 4:
        return (
          <>
            <ComplianceChecksStep formData={formData} onFormDataChange={handleFormDataChange} />
            <DocumentUploadStep formData={formData} onFormDataChange={handleFormDataChange} />
          </>
        );
      case 5:
        return (
          <ReviewStep
            formData={formData}
            duplicateStatus={dupCheck}
            onSubmit={() => handleSubmit()}
            onSaveDraft={handleSaveDraft}
            saving={saving}
            canSubmit={!!canSubmit}
          />
        );
      default:
        return null;
    }
  };

  return (
    /* ── 3-column layout matching Application 360 Workspace ── */
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden credit-module">

      {/* ── Left Sidebar: Progress Tracker (256px) ── */}
      <ProgressTracker
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* ── Center Column: Canvas ── */}
      <main className="flex-1 overflow-y-auto cr-scroll" style={{ backgroundColor: 'var(--cr-surface-bright, #fff)' }}>
        <div className="mx-auto max-w-[1680px]">
          {/* Sticky header bar */}
          <TopBar
            segmentLabel={SEGMENT_LABELS[formData.borrowerType]}
            onSaveDraft={handleSaveDraft}
            onValidate={handleValidate}
            saving={saving}
          />

          {/* Error banner */}
          {error && (
            <div
              style={{
                margin: '16px 24px 0',
                padding: '10px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--cr-radius, 0.25rem)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 'var(--cr-text-body-sm, 13px)',
                color: '#991b1b',
                fontWeight: 600,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
              {error}
              <button
                onClick={() => setError(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#991b1b',
                  padding: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          )}

          {/* Main canvas */}
          <div style={{ padding: '24px' }}>
            <div style={{ maxWidth: 896, margin: '0 auto' }}>
              {renderStep()}

              {/* ── Bottom navigation (hidden on the final Review step — it has its own submit buttons) ── */}
              {currentStep < STEPS.length - 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 32,
                  paddingTop: 24,
                  borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
                }}
              >
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    fontSize: 'var(--cr-text-label-md, 12px)',
                    fontWeight: 600,
                    backgroundColor: 'transparent',
                    color: currentStep === 0 ? 'var(--cr-outline, #76777d)' : 'var(--cr-on-surface-variant, #45464d)',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                    borderRadius: 'var(--cr-radius, 0.25rem)',
                    cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentStep === 0 ? 0.5 : 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                  Previous
                </button>

                {currentStep < STEPS.length - 1 ? (
                  <button
                    onClick={handleNext}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                      fontSize: 'var(--cr-text-label-md, 12px)',
                      fontWeight: 700,
                      backgroundColor: 'var(--cr-secondary, #0051d5)',
                      color: 'var(--cr-on-secondary, #ffffff)',
                      border: 'none',
                      borderRadius: 'var(--cr-radius, 0.25rem)',
                      cursor: 'pointer',
                    }}
                  >
                    Next
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmit()}
                    disabled={saving || !canSubmit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                      fontSize: 'var(--cr-text-label-md, 12px)',
                      fontWeight: 700,
                      backgroundColor: saving || !canSubmit ? 'var(--cr-surface-container-high, #e6e8ea)' : 'var(--cr-secondary, #0051d5)',
                      color: saving || !canSubmit ? 'var(--cr-outline, #76777d)' : 'var(--cr-on-secondary, #ffffff)',
                      border: 'none',
                      borderRadius: 'var(--cr-radius, 0.25rem)',
                      cursor: saving || !canSubmit ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving && (
                      <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                        progress_activity
                      </span>
                    )}
                    Submit
                  </button>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Right Sidebar: Action Panel (320px) ── */}
      <CreateBorrowerActionPanel
        formData={formData}
        currentStep={currentStep}
        duplicateStatus={dupCheck}
      />

      {/* ── Duplicate Conflict Modal ── */}
      {showConflictModal && (
        <DuplicateConflictModal
          conflicts={duplicateConflict}
          onCancel={() => setShowConflictModal(false)}
          onOverride={() => {
            setShowConflictModal(false);
            handleSubmit(true);
          }}
          saving={saving}
        />
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CreateBorrowerPage;