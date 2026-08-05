import React, { useEffect, useState, useMemo } from 'react';
import creditService, { CreditApplication, retailIncomeApi } from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import CollapsibleSection from '../../../src/components/credit/CollapsibleSection';
import FinancialProfileSummaryStrip from '../../../src/components/credit/FinancialProfileSummaryStrip';
import CalculationBreakdownPanel, { RatioBreakdown } from '../../../src/components/credit/CalculationBreakdownPanel';
import EvidenceMappingPanel from '../../../src/components/credit/EvidenceMappingPanel';
import JointBorrowerSection from '../../../src/components/credit/JointBorrowerSection';
import ValidationOverridePanel from '../../../src/components/credit/ValidationOverridePanel';
import FinancialsTab from './FinancialsTab';
import SmeFinancialsTab from './sections/SmeFinancialsTab';
import PaymentCapabilityTab from './sections/PaymentCapabilityTab';
import RetailIncomeTab from './sections/RetailIncomeTab';

/**
 * FinancialProfileTab — Phase 1 UX / Layout Restructure
 *
 * Restructures the financial profile into a production-grade underwriting interface:
 *   1. Summary strip (5 cards: borrower type, DSR/DSCR, affordability, docs, verification)
 *   2. Borrower-type-branching accordion sections:
 *      - INDIVIDUAL → retail income, obligations, payment capability
 *      - SOLE_PROPRIETOR → retail income + SME financials (dual assessment) + payment capability
 *      - CORPORATE → financial statements + SME ratios + payment capability
 *   3. Calculation breakdown panel (expandable, shows formula + inputs + threshold)
 *   4. Validation and warning panel
 *   5. Audit trail entry point (links to timeline-audit tab)
 *
 * Phase 1 deliverable from financial-profile-implementation-plan.md.
 * Sub-tabs (FinancialsTab, SmeFinancialsTab, RetailIncomeTab, PaymentCapabilityTab)
 * are preserved and composed within the new accordion structure.
 */

interface FinancialProfileTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
}

// ── Borrower type helpers ──────────────────────────────────────────────────────

const isRetail = (bt?: string) => bt === 'INDIVIDUAL';
const isSoleProprietor = (bt?: string) => bt === 'SOLE_PROPRIETOR';
const isCorporate = (bt?: string) => bt === 'CORPORATE';

// ── Validation warnings ────────────────────────────────────────────────────────

interface ValidationWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ReadinessResult {
  ready: boolean;
  errors: ValidationWarning[];
  warnings: ValidationWarning[];
  satisfied: { field: string; message: string; severity: 'info' }[];
}

// ── Main component ─────────────────────────────────────────────────────────────

const FinancialProfileTab: React.FC<FinancialProfileTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
}) => {
  const borrowerType = application.borrowerProfile?.borrowerType;
  const readOnly = application.state !== 'DRAFT';

  // Fetch retail income data for DSR display in summary strip
  const [dsr, setDsr] = useState<number | null>(null);
  const [netDsr, setNetDsr] = useState<number | null>(null);
  const [dscr, setDscr] = useState<number | null>(null);
  const [financialsVerified, setFinancialsVerified] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [verifiedDocCount, setVerifiedDocCount] = useState(0);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const editableApplicationPayload = useMemo(() => ({
    productType: application.productType,
    purpose: application.purpose,
    requestedAmount: application.requestedAmount,
    requestedTenor: application.requestedTenor,
    currency: application.currency,
    assignedRmId: application.rmId,
    assignedAnalystId: application.analystId,
    branchId: application.branchId,
    customerGroupName: application.customerGroupName,
    cifNo: application.cifNo,
    applicationType: application.applicationType,
    originatingDepartment: application.originatingDepartment,
    teamLeadName: application.teamLeadName,
    referredBy: application.referredBy,
    accountClassification: application.accountClassification,
    connectedPartyFlag: application.connectedPartyFlag,
    connectedPartyStaffName: application.connectedPartyStaffName,
    completeDocsDate: application.completeDocsDate,
    lastReviewDate: application.lastReviewDate,
    nextReviewDate: application.nextReviewDate,
    relationshipSince: application.relationshipSince,
    lastSiteVisitDate: application.lastSiteVisitDate,
    preambleText: application.preambleText,
    mattersToHighlight: application.mattersToHighlight,
    transactionDetailsText: application.transactionDetailsText,
    accountStrategy: application.accountStrategy,
    crossSellingInitiatives: application.crossSellingInitiatives,
    firstWayOut: application.firstWayOut,
    secondWayOut: application.secondWayOut,
    otherWayOut: application.otherWayOut,
  }), [application]);

  useEffect(() => {
    // Load retail income data for summary strip DSR
    if (isRetail(borrowerType) || isSoleProprietor(borrowerType)) {
      retailIncomeApi.get(application.id).then((data) => {
        if (data) {
          if (data.dsrPercent) setDsr(Number(data.dsrPercent));
          if ((data as any).netDsrPercent) setNetDsr(Number((data as any).netDsrPercent));
          if (data.financialsVerified) setFinancialsVerified(data.financialsVerified);
        }
      }).catch(() => {
        /* no data yet — fine */
      });
    }
  }, [application.id, borrowerType]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    setReadinessLoading(true);
    creditService.checkReadiness(application.id)
      .then((result) => {
        if (!cancelled) setReadiness(result);
      })
      .catch(() => {
        if (!cancelled) setReadiness(null);
      })
      .finally(() => {
        if (!cancelled) setReadinessLoading(false);
      });
    return () => { cancelled = true; };
  }, [application.id, readOnly]);

  // Derive document counts from application (if documents are available)
  useEffect(() => {
    const docs = (application as any).documents ?? [];
    setDocCount(docs.length);
    setVerifiedDocCount(docs.filter((d: any) => d.verificationStatus === 'VERIFIED').length);
  }, [application]);

  // Build validation warnings based on current data
  useEffect(() => {
    const warnings: ValidationWarning[] = [];

    // DSR warnings for retail
    if (dsr !== null) {
      if (dsr > 70) {
        warnings.push({
          field: 'dsr',
          message: `DSR at ${dsr.toFixed(1)}% exceeds the 70% regulatory threshold. Submission blocked unless a credit manager override is obtained.`,
          severity: 'error',
        });
      } else if (dsr > 60) {
        warnings.push({
          field: 'dsr',
          message: `DSR at ${dsr.toFixed(1)}% is above the standard 60% threshold. An exception reason is required for submission.`,
          severity: 'warning',
        });
      }
    }

    // DSCR warnings for business
    if (dscr !== null) {
      if (dscr < 1.10) {
        warnings.push({
          field: 'dscr',
          message: `DSCR at ${dscr.toFixed(2)}x is below the 1.10x minimum. Business cashflow may not support debt service.`,
          severity: 'error',
        });
      } else if (dscr < 1.25) {
        warnings.push({
          field: 'dscr',
          message: `DSCR at ${dscr.toFixed(2)}x is in the watch zone (1.10–1.24x). Monitor closely.`,
          severity: 'warning',
        });
      }
    }

    // Document warnings
    if (docCount === 0) {
      warnings.push({
        field: 'documents',
        message: 'No documents uploaded. Financial evidence is required before submission.',
        severity: 'error',
      });
    } else if (verifiedDocCount < docCount) {
      warnings.push({
        field: 'documents',
        message: `${docCount - verifiedDocCount} document(s) pending verification. All documents must be verified before committee submission.`,
        severity: 'warning',
      });
    }

    // Verification warning
    if (!financialsVerified && (isRetail(borrowerType) || isSoleProprietor(borrowerType))) {
      warnings.push({
        field: 'verification',
        message: 'Income figures have not been verified against supporting documents (payslip, bank statements, CCRIS).',
        severity: 'warning',
      });
    }

    setValidationWarnings(warnings);
  }, [dsr, dscr, docCount, verifiedDocCount, financialsVerified, borrowerType]);

  // Build calculation breakdown ratios
  const ratioBreakdowns = useMemo((): RatioBreakdown[] => {
    const ratios: RatioBreakdown[] = [];

    if (dsr !== null) {
      ratios.push({
        name: 'Debt Service Ratio (Gross)',
        code: 'DSR',
        formula: '(Total Monthly Commitments + Proposed Instalment) / Gross Monthly Income × 100',
        inputs: [
          { label: 'Gross Income', value: '—' },
          { label: 'Total Commitments', value: '—' },
          { label: 'Proposed Instalment', value: '—' },
        ],
        result: `${dsr.toFixed(1)}%`,
        threshold: 'Pass: ≤ 60% | Watch: 60–70% | Fail: > 70%',
        status: dsr <= 60 ? 'pass' : dsr <= 70 ? 'watch' : 'fail',
        sources: ['retail-income-api'],
      });
    }

    if (netDsr !== null) {
      ratios.push({
        name: 'Debt Service Ratio (Net Income)',
        code: 'Net DSR',
        formula: '(Total Commitments + Proposed Instalment) / (Gross - EPF - Tax - SOCSO) × 100',
        inputs: [
          { label: 'Net Income', value: '—' },
          { label: 'Total Commitments', value: '—' },
        ],
        result: `${netDsr.toFixed(1)}%`,
        threshold: 'Pass: ≤ 50% | Watch: 50–60% | Fail: > 60%',
        status: netDsr <= 50 ? 'pass' : netDsr <= 60 ? 'watch' : 'fail',
        sources: ['retail-income-api'],
      });
    }

    if (dscr !== null) {
      ratios.push({
        name: 'Debt Service Coverage Ratio',
        code: 'DSCR',
        formula: 'Net Operating Income / (Interest + Principal Repayment)',
        inputs: [
          { label: 'Net Income', value: '—' },
          { label: 'Interest + Principal', value: '—' },
        ],
        result: `${dscr.toFixed(2)}x`,
        threshold: 'Pass: ≥ 1.25x | Watch: 1.10–1.24x | Fail: < 1.10x',
        status: dscr >= 1.25 ? 'pass' : dscr >= 1.10 ? 'watch' : 'fail',
        sources: ['sme-financial-api'],
      });
    }

    return ratios;
  }, [dsr, netDsr, dscr]);

  // Count warnings by severity for badge
  const errorCount = validationWarnings.filter(w => w.severity === 'error').length;
  const warnCount = validationWarnings.filter(w => w.severity === 'warning').length;
  const readinessErrors = readiness?.errors?.length ?? 0;
  const readinessWarnings = readiness?.warnings?.length ?? 0;
  const readyToSubmit = readiness ? readiness.ready && readinessErrors === 0 : errorCount === 0;
  const validationBadge = errorCount > 0
    ? { text: `${errorCount} blocking`, tone: 'fail' as const }
    : warnCount > 0
      ? { text: `${warnCount} warning${warnCount > 1 ? 's' : ''}`, tone: 'warn' as const }
      : undefined;

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const next = await creditService.updateApplication(application.id, {
        ...editableApplicationPayload,
        version: application.version,
      } as any);
      onUpdated(next);
      toast.success('Financial profile snapshot saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitForReview = async () => {
    try {
      setSubmittingReview(true);
      const currentReadiness = readiness ?? await creditService.checkReadiness(application.id);
      setReadiness(currentReadiness);
      if (!currentReadiness.ready || (currentReadiness.errors?.length ?? 0) > 0) {
        const first = currentReadiness.errors?.[0] || currentReadiness.warnings?.[0];
        toast.error(first?.message || 'Application is not ready for review');
        return;
      }
      const next = await creditService.transitionApplication(application.id, { action: 'submit' });
      onUpdated(next);
      toast.success('Application submitted for review');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to submit for review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Summary Strip ── */}
      <FinancialProfileSummaryStrip
        application={application}
        dsr={dsr}
        dscr={dscr}
        docCount={docCount}
        verifiedDocCount={verifiedDocCount}
        financialsVerified={financialsVerified}
      />

      {/* ── 2. Validation Warnings Panel ── */}
      {validationWarnings.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-lg text-amber-500">rule</span>
            <h3 className="text-sm font-semibold text-gray-700">Validation & Warnings</h3>
            {validationBadge && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                validationBadge.tone === 'fail'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {validationBadge.text}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {validationWarnings.map((w, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2.5 rounded border text-xs ${
                  w.severity === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : w.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                <span className="material-symbols-outlined text-sm mt-0.5">
                  {w.severity === 'error' ? 'error' : w.severity === 'warning' ? 'warning' : 'info'}
                </span>
                <div>
                  <p className="font-medium">{w.field.toUpperCase()}: {w.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Accordion Sections — Borrower-type-branched ── */}
      <div className="space-y-8">

        {/* ── RETAIL: Income & Employment ── */}
        {(isRetail(borrowerType) || isSoleProprietor(borrowerType)) && (
          <CollapsibleSection
            id="fp-retail-income"
            label="Income / Employment"
            icon="payments"
            defaultOpen
            badge={dsr !== null ? {
              text: `DSR ${dsr.toFixed(1)}%`,
              tone: dsr <= 60 ? 'pass' : dsr <= 70 ? 'warn' : 'fail',
            } : undefined}
          >
            <RetailIncomeTab
              applicationId={application.id}
              readOnly={readOnly}
              onSaved={() => {
                // Refresh DSR after save
                retailIncomeApi.get(application.id).then((data) => {
                  if (data?.dsrPercent) setDsr(Number(data.dsrPercent));
                  if ((data as any)?.netDsrPercent) setNetDsr(Number((data as any).netDsrPercent));
                  if (data?.financialsVerified) setFinancialsVerified(data.financialsVerified);
                });
              }}
            />
          </CollapsibleSection>
        )}

        {/* ── CORPORATE / SME: Financial Statements ── */}
        {(isCorporate(borrowerType) || isSoleProprietor(borrowerType)) && (
          <CollapsibleSection
            id="fp-financial-statements"
            label="Financial Statements"
            icon="trending_up"
            defaultOpen={isCorporate(borrowerType)}
          >
            <FinancialsTab application={application} />
          </CollapsibleSection>
        )}

        {/* ── CORPORATE / SME: SME Financials & Ratios ── */}
        {(isCorporate(borrowerType) || isSoleProprietor(borrowerType)) && (
          <CollapsibleSection
            id="fp-sme-financials"
            label="SME Financials & Ratios"
            icon="store"
            defaultOpen={isSoleProprietor(borrowerType)}
          >
            <SmeFinancialsTab
              application={application}
              onUpdated={onUpdated}
              onDirtyChange={onDirtyChange}
              onDscrChange={setDscr}
              onRatiosChange={(ratios) => {
                // Extract DSCR from ratios for summary strip
                const dscrRatio = ratios.find(r => r.key === 'dscr');
                if (dscrRatio) setDscr(dscrRatio.value);
              }}
            />
          </CollapsibleSection>
        )}

        {/* ── ALL: Joint Borrower / Guarantor Links ── */}
        {(isCorporate(borrowerType) || isSoleProprietor(borrowerType) || (application.borrowerProfile?.relatedPartyMembers?.length ?? 0) > 0) && (
          <CollapsibleSection
            id="fp-joint-borrower"
            label="Joint Borrower / Guarantor"
            icon="groups"
          >
            <JointBorrowerSection application={application} />
          </CollapsibleSection>
        )}

        {/* ── ALL: Evidence / Source Mapping ── */}
        <CollapsibleSection
          id="fp-evidence-mapping"
          label="Evidence / Source Mapping"
          icon="link"
          badge={docCount > 0 ? {
            text: `${verifiedDocCount}/${docCount} verified`,
            tone: verifiedDocCount === docCount ? 'pass' : verifiedDocCount === 0 ? 'fail' : 'warn',
          } : undefined}
        >
          <EvidenceMappingPanel application={application} />
        </CollapsibleSection>

        {/* ── RETAIL: Existing Obligations & Assets (placeholder for Phase 2) ── */}
        {isRetail(borrowerType) && (
          <CollapsibleSection
            id="fp-obligations-assets"
            label="Existing Obligations / Assets"
            icon="account_balance_wallet"
          >
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
              <p>
                Detailed obligations and assets tracking will be expanded in Phase 2 (Retail Lending Financial Profile).
                Current commitment data is captured in the Income / Employment section above.
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* ── ALL: Payment Capability ── */}
        <CollapsibleSection
          id="fp-payment-capability"
          label="Payment Capability"
          icon="savings"
        >
          <PaymentCapabilityTab
            application={application}
            onUpdated={onUpdated}
            onDirtyChange={onDirtyChange}
          />
        </CollapsibleSection>

        {/* ── ALL: Calculation Breakdown ── */}
        <CollapsibleSection
          id="fp-calculation-breakdown"
          label="Calculation Breakdown"
          icon="calculate"
          badge={ratioBreakdowns.length > 0 ? {
            text: `${ratioBreakdowns.length} ratio${ratioBreakdowns.length > 1 ? 's' : ''}`,
            tone: 'info',
          } : undefined}
        >
          <CalculationBreakdownPanel ratios={ratioBreakdowns} />
        </CollapsibleSection>

        {/* ── ALL: Audit Trail / Override Panel ── */}
        <CollapsibleSection
          id="fp-audit-trail"
          label="Audit Trail / Overrides"
          icon="history"
        >
          <ValidationOverridePanel
            applicationId={application.id}
            borrowerType={borrowerType}
            warnings={validationWarnings}
            readOnly={readOnly}
          />
        </CollapsibleSection>
      </div>

      {/* ── 4. Action Footer ── */}
      {!readOnly && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {readinessLoading
              ? 'Checking submission readiness…'
              : (readiness && readinessErrors > 0)
                ? `${readinessErrors} blocking issue(s) from backend readiness check`
                : validationWarnings.filter(w => w.severity === 'error').length > 0
                  ? `${validationWarnings.filter(w => w.severity === 'error').length} blocking issue(s) must be resolved before submission`
                  : readinessWarnings > 0
                    ? `${readinessWarnings} warning(s) from backend readiness check`
                    : 'All validation checks passed — ready for review'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={savingDraft || submittingReview}
            >
              {savingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handleSubmitForReview}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submittingReview || savingDraft || (!readyToSubmit && (validationWarnings.filter(w => w.severity === 'error').length > 0 || readinessErrors > 0))}
            >
              <span className="material-symbols-outlined text-sm">send</span>
              {submittingReview ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialProfileTab;