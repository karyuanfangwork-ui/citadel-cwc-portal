import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import creditService, { CreateBorrowerProfilePayload, DuplicateMatch } from '../src/services/credit.service';
import { useDuplicateCheck } from '../src/hooks/useDuplicateCheck';
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
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.formData) {
          setFormData({ ...initialFormData(), ...draft.formData });
          setHadSavedDraft(true);
        }
        if (typeof draft.currentStep === 'number') setCurrentStep(draft.currentStep);
      }
    } catch { /* ignore corrupt draft */ }
    // Mark draft load as complete even if no draft was found,
    // so the save effect below can start persisting.
    setDraftLoaded(true);
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
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: storable, currentStep }));
  }, [formData, currentStep, draftLoaded]);

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
  }, [resetDupCheck]);

  const runDuplicateCheckCb = useCallback(() => {
    const identifier = isIndividual ? formData.nric : formData.ssm;
    if (!identifier?.trim()) return;
    void runDuplicateCheck(isIndividual ? { nric: identifier } : { ssm: identifier });
  }, [isIndividual, formData.nric, formData.ssm, runDuplicateCheck]);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  const handleSaveDraft = useCallback(() => {
    const storable = { ...formData, documents: [] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: storable, currentStep }));
    toast.success('Draft saved');
  }, [formData, currentStep]);

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

  // ── Post-create orchestration (best-effort, non-blocking) ──

  const runPostCreateSteps = useCallback(async (borrowerId: string) => {
    const tasks: Promise<void>[] = [];

    // Income
    if (formData.monthlyGrossIncome) {
      const gross = Number(formData.monthlyGrossIncome) + Number(formData.fixedAllowances || 0);
      tasks.push(
        creditService.putIncome(borrowerId, {
          employmentType: formData.employmentType || undefined,
          employerName: formData.employerName || undefined,
          monthlyGrossIncome: gross,
          existingLoanCommitment: Number(formData.existingCommitments) || 0,
        }).then(() => undefined)
      );
    }

    // KYC
    if (formData.kycVerified) {
      tasks.push(creditService.runKyc(borrowerId).then(() => undefined));
    }

    // AML
    if (formData.amlResult !== 'not_started') {
      tasks.push(
        creditService.runAml(borrowerId, {
          result: formData.amlResult.toUpperCase(),
          notes: formData.amlNotes || undefined,
        }).then(() => undefined)
      );
    }

    // Documents
    for (const doc of formData.documents) {
      tasks.push(creditService.uploadBorrowerDocument(borrowerId, doc.file, doc.documentClass).then(() => undefined));
    }

    const results = await Promise.allSettled(tasks);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      toast.success('Borrower created. Some post-create steps failed — complete them on the profile page.');
    }
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
      await runPostCreateSteps(profile.id);

      localStorage.removeItem(DRAFT_KEY);
      toast.success('Borrower created successfully');
      navigate(`/credit/borrowers/${profile.id}`);
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
          <DuplicateCheckStep
            onUseExisting={(borrowerId) => navigate(`/credit/borrowers/${borrowerId}`)}
            onProceed={() => { setCompletedSteps(prev => new Set(prev).add(0)); setCurrentStep(1); }}
          />
        );
      case 1:
        return (
          <BorrowerTypeStep
            value={formData.borrowerType}
            onChange={handleBorrowerTypeChange}
          />
        );
      case 2:
        return (
          <BasicInfoStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
            duplicateStatus={dupCheck}
            duplicateBorrowerId={dupBorrowerId}
            onDuplicateCheck={runDuplicateCheckCb}
          />
        );
      case 3:
        return (
          <ContactInfoStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 4:
        return (
          <EmploymentFinancialsStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 5:
        return (
          <ComplianceChecksStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 6:
        return (
          <DocumentUploadStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 7:
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