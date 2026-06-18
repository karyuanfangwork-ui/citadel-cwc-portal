import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import creditService, { CreateBorrowerProfilePayload, DuplicateMatch } from '../src/services/credit.service';
import ProgressTracker, { STEPS } from '../src/components/credit/create-borrower/ProgressTracker';
import TopBar from '../src/components/credit/create-borrower/TopBar';
import CustomerTypeStep from '../src/components/credit/create-borrower/CustomerTypeStep';
import BasicInfoStep, { FormData, initialFormData } from '../src/components/credit/create-borrower/BasicInfoStep';
import PlaceholderStep from '../src/components/credit/create-borrower/PlaceholderStep';
import CreateBorrowerActionPanel from '../src/components/credit/create-borrower/CreateBorrowerActionPanel';
import DuplicateConflictModal from '../src/components/credit/create-borrower/DuplicateConflictModal';

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
  const [dupCheck, setDupCheck] = useState<'idle' | 'checking' | 'clear' | 'duplicate'>('idle');
  const [dupBorrowerId, setDupBorrowerId] = useState<string | null>(null);

  // ── Submission ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 409 conflict ──
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateMatch[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const isIndividual = formData.borrowerType === 'INDIVIDUAL';
  const isCorporateType = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';

  // ── Load draft on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.formData) setFormData(draft.formData);
        if (typeof draft.currentStep === 'number') setCurrentStep(draft.currentStep);
      }
    } catch { /* ignore corrupt draft */ }
  }, []);

  // ── Save draft on change ──
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }));
  }, [formData, currentStep]);

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
      accountId: null,
      contactId: null,
    }));
    setDupCheck('idle');
    setDupBorrowerId(null);
  }, []);

  const runDuplicateCheck = useCallback(async () => {
    const identifier = isIndividual ? formData.nric : formData.ssm;
    if (!identifier?.trim()) return;
    setDupCheck('checking');
    try {
      const result = await creditService.checkDuplicateBorrower(
        isIndividual ? { nric: identifier } : { ssm: identifier }
      );
      if (result.exists && result.borrowerId) {
        setDupCheck('duplicate');
        setDupBorrowerId(result.borrowerId);
      } else {
        setDupCheck('clear');
        setDupBorrowerId(null);
      }
    } catch {
      setDupCheck('idle');
    }
  }, [isIndividual, formData.nric, formData.ssm]);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  const handleSaveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }));
    toast.success('Draft saved');
  }, [formData, currentStep]);

  const handleValidate = useCallback(() => {
    const isInd = formData.borrowerType === 'INDIVIDUAL';
    const isCorp = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';

    const issues: string[] = [];
    if (!formData.name.trim()) issues.push(`${isInd ? 'Full Name' : 'Company Name'} is required`);
    if (isCorp && !formData.ssm.trim()) issues.push('SSM Registration Number is required');
    if (isInd && !formData.nric.trim()) issues.push('NRIC/Passport is required');
    if (isInd && !formData.dateOfBirth) issues.push('Date of Birth is required');

    if (issues.length === 0) {
      toast.success('All required fields for current step are complete');
    } else {
      toast.error(`${issues.length} required field(s): ${issues.join(', ')}`);
    }
  }, [formData]);

  const handleSubmit = useCallback(async (overrideDuplicate = false) => {
    setError(null);
    setSaving(true);
    try {
      const payload: CreateBorrowerProfilePayload = {
        borrowerType: formData.borrowerType,
        name: formData.name || null,
        accountId: formData.accountId,
        contactId: formData.contactId,
        ...(formData.industrySector ? { sicCode: formData.industrySector } : {}),
        ...(formData.estimatedAnnualRevenue ? { annualTurnover: formData.estimatedAnnualRevenue } : {}),
        ...(overrideDuplicate && { overrideDuplicate: true }),
      };
      const profile = await creditService.createBorrowerProfile(payload);
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
  }, [formData, navigate]);

  // ── Can submit? ──
  const canSubmit = formData.name.trim() &&
    (isCorporateType ? formData.ssm.trim() : true) &&
    (isIndividual ? formData.nric.trim() : true) &&
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
          <CustomerTypeStep
            value={formData.borrowerType}
            onChange={handleBorrowerTypeChange}
          />
        );
      case 1:
        return (
          <BasicInfoStep
            formData={formData}
            onFormDataChange={handleFormDataChange}
            duplicateStatus={dupCheck}
            duplicateBorrowerId={dupBorrowerId}
            onDuplicateCheck={runDuplicateCheck}
          />
        );
      default:
        // Steps 2-6: placeholder
        return <PlaceholderStep step={STEPS[currentStep]} />;
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
            onSubmit={() => handleSubmit()}
            saving={saving}
            canSubmit={!!canSubmit}
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

              {/* ── Bottom navigation ── */}
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