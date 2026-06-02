import React from 'react';
import { ApplicationSignoff, CreditApproval, CreditApplication, ApplicationState } from '../../services/credit.service';

// ── Types ────────────────────────────────────────────────────────────

interface S7ProcessBannerProps {
  app: CreditApplication;
  signoffs: ApplicationSignoff[];
  allSigned: boolean;
  approvals: CreditApproval[];
  onNavigate: (tab: 'signoff' | 'approvals') => void;
}

// ── Step status helpers ──────────────────────────────────────────────

const REQUIRED_SIGNOFF_ROLES = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as const;

function signoffComplete(signoffs: ApplicationSignoff[]): boolean {
  return REQUIRED_SIGNOFF_ROLES.every(role =>
    signoffs.some(s => s.role === role && s.signedAt),
  );
}

function committeeComplete(app: CreditApplication): boolean {
  const st = (app.state || app.status) as ApplicationState;
  // Past COMMITTEE_REVIEW means it was submitted to committee
  return !['DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED', 'UNDERWRITING', 'CREDIT_ASSESSMENT'].includes(st);
}

function approvalComplete(approvals: CreditApproval[]): boolean {
  // All decisions are APPROVE (no pending stages)
  return approvals.length > 0 && approvals.every(a => a.decision === 'APPROVE');
}

// ── Component ────────────────────────────────────────────────────────

const S7ProcessBanner: React.FC<S7ProcessBannerProps> = ({
  app,
  signoffs,
  allSigned,
  approvals,
  onNavigate,
}) => {
  const step1Done = allSigned || signoffComplete(signoffs);
  const step2Done = committeeComplete(app);
  const step3Done = approvalComplete(approvals);
  const state = (app.state || app.status) as ApplicationState;

  // Only show in relevant states
  const relevantStates: ApplicationState[] = [
    'UNDERWRITING' as ApplicationState,
    'CREDIT_ASSESSMENT' as ApplicationState,
    'COMMITTEE_REVIEW' as ApplicationState,
    'APPROVED' as ApplicationState,
  ];
  if (!relevantStates.includes(state)) return null;

  const steps = [
    {
      key: 'signoff',
      label: 'CA Memo Sign-off',
      detail: step1Done
        ? REQUIRED_SIGNOFF_ROLES.map(role => {
            const s = signoffs.find(sf => sf.role === role);
            return s ? `✓ ${roleLabel(role)}` : `✓ ${roleLabel(role)}`;
          }).join(' · ')
        : 'All 3 roles must sign before Committee Review',
      done: step1Done,
      tab: 'signoff' as const,
    },
    {
      key: 'committee',
      label: 'Committee Review',
      detail: step2Done ? 'Submitted for review' : 'Submit after sign-off is complete',
      done: step2Done,
      tab: 'signoff' as const, // clicking navigates to signoff to finish step 1 first
    },
    {
      key: 'approval',
      label: 'Approval Chain',
      detail: step3Done
        ? `${approvals.length} approval${approvals.length !== 1 ? 's' : ''} collected`
        : approvals.length > 0
        ? `${approvals.length} approval${approvals.length !== 1 ? 's' : ''} collected`
        : 'Authority decision on the credit',
      done: step3Done,
      tab: 'approvals' as const,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        S7 · Decision Process
      </p>
      <div className="flex items-start gap-2">
        {steps.map((step, idx) => (
          <React.Fragment key={step.key}>
            <button
              type="button"
              onClick={() => onNavigate(step.tab)}
              className="flex-1 text-left rounded-lg p-3 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
              style={{ background: step.done ? '#f0fdf4' : undefined }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    step.done
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.done ? (
                    <span className="material-symbols-outlined text-xs">check</span>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className={`text-sm font-bold ${step.done ? 'text-green-700' : 'text-gray-700'}`}>
                  Step {idx + 1}: {step.label}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${step.done ? 'text-green-600' : 'text-gray-500'}`}>
                {step.detail}
              </p>
            </button>
            {idx < steps.length - 1 && (
              <div className={`w-6 flex items-center justify-center pt-4 ${step.done ? 'text-green-400' : 'text-gray-300'}`}>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

function roleLabel(role: string): string {
  switch (role) {
    case 'PREPARED_BY': return 'Prepared By';
    case 'REVIEWED_BY': return 'Reviewed By';
    case 'CONCURRED_BY': return 'Concurred By';
    default: return role;
  }
}

export default S7ProcessBanner;