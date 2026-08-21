import React from 'react';
import type { PhaseStatus } from '../../../pages/credit/creditUtils';

export interface ReadinessChecklistModalProps {
  open: boolean;
  onClose: () => void;
  phaseCompletion: Record<string, PhaseStatus>;
  readiness?: {
    ready: boolean;
    errors: Array<{ field: string; message: string; severity: string; tab?: string; target?: string }>;
    warnings: Array<{ field: string; message: string; severity: string; tab?: string; target?: string }>;
    satisfied: Array<{ field: string; message: string; severity: string; tab?: string; target?: string }>;
  } | null;
  onSubmitAnyway: () => void;
  onNavigateToSection: (tabId: string) => void;
  /** Processing lane — when PERSONAL_FAST, s4 navigates to credit-checks (combined section) */
  lane?: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  s1: 'S1 · Loan Request',
  s2: 'S2 · Borrower Profile',
  s3: 'S3 · Financials',
  s4: 'S4 · Risk Score',
  s5: 'S5 · Bureau & Compliance',
  s6: 'S6 · Collateral & Guarantees',
  s7: 'S7 · Decision',
  meta: 'Operations',
};

const PHASE_TO_TAB_MAP: Record<string, string> = {
  s1: 'loan-request',
  s2: 'borrower-profile',
  s3: 'financials',
  s4: 'risk-score',
  s5: 'credit-checks',
  s6: 'collateral',
  s7: 'approvals',
  meta: 'documents',
};

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  complete: { icon: 'check_circle', color: 'text-green-600', label: 'Complete' },
  incomplete: { icon: 'warning', color: 'text-amber-500', label: 'Incomplete' },
  optional: { icon: 'radio_button_unchecked', color: 'text-gray-400', label: 'Optional' },
  warning: { icon: 'warning', color: 'text-amber-500', label: 'Warning' },
};

const ReadinessChecklistModal: React.FC<ReadinessChecklistModalProps> = ({
  open,
  onClose,
  phaseCompletion,
  onSubmitAnyway,
  onNavigateToSection,
  lane,
  readiness,
}) => {
  if (!open) return null;

  // Personal Fast lane combines s4 + s5 into a single "credit-checks" section
  const phaseToTab = lane === 'PERSONAL_FAST'
    ? { ...PHASE_TO_TAB_MAP, s4: 'credit-checks', s5: 'credit-checks' }
    : PHASE_TO_TAB_MAP;

  const readinessIssues = readiness ? [...readiness.errors, ...readiness.warnings, ...readiness.satisfied] : [];
  const entries = readiness
    ? readinessIssues.map((issue) => [issue.field, issue.severity === 'error' ? 'incomplete' : issue.severity === 'warning' ? 'warning' : 'complete'] as [string, string])
    : Object.entries(phaseCompletion);
  const readinessByField = new Map(readinessIssues.map((issue) => [issue.field, issue]));
  const incompleteRequired = readiness
    ? readiness.errors
    : entries.filter(([, status]) => status === 'incomplete');
  // Submission must remain fail-closed when the server result is unavailable.
  // phaseCompletion is retained for visual context only.
  const allReady = readiness?.ready === true && readiness.errors.length === 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-checklist-title"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${allReady ? 'text-green-600' : 'text-amber-500'}`}>
              {allReady ? 'verified' : 'error_outline'}
            </span>
            <div>
              <h2 id="readiness-checklist-title" className="text-lg font-extrabold text-text-primary">
                {allReady ? 'Ready to Submit' : 'Submit for Review — Readiness Check'}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {allReady
                  ? 'All required sections are complete.'
                  : readiness
                    ? `${incompleteRequired.length} server requirement${incompleteRequired.length !== 1 ? 's' : ''} blocking submission`
                    : 'Checking server submission readiness…'}
              </p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="p-6 space-y-2 max-h-[50vh] overflow-y-auto">
          {entries.map(([key, status]) => {
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.optional;
            const issue = readinessByField.get(key);
            const label = issue?.message || PHASE_LABELS[key] || key;
            const tabId = issue?.tab || phaseToTab[key] || key;
            const isIncomplete = status === 'incomplete' && key !== 'meta';
            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  isIncomplete ? 'bg-amber-50 border border-amber-200' : status === 'complete' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${config.color}`}>
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold ${isIncomplete ? 'text-amber-800' : 'text-text-primary'}`}>
                    {label}
                  </span>
                  <span className={`text-[10px] font-bold ml-2 uppercase ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                {isIncomplete && (
                  <button
                    onClick={() => {
                      onNavigateToSection(tabId);
                      onClose();
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 whitespace-nowrap"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  >
                    Go to section <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-gray-100 transition-colors"
            style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Cancel
          </button>
          <button
            onClick={allReady ? onSubmitAnyway : undefined}
            disabled={!allReady}
            title={!allReady ? 'Resolve the server-reported submission requirements before submitting' : undefined}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
              allReady
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            style={{ border: 'none', cursor: allReady ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}
          >
            {allReady ? 'Submit for Review' : 'Resolve submission requirements'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadinessChecklistModal;