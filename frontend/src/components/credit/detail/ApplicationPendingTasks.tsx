/**
 * ApplicationPendingTasks — Right panel widget showing pending checklist items.
 *
 * Derives a list of PendingTask objects from CreditApplication fields,
 * sorts them (blocked → overdue → pending), and renders a collapsible
 * section with status icons, clickable labels, and a count badge.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState, useMemo } from 'react';
import { CreditApplication, ApplicationState } from '../../../services/credit.service';

// ── Types ─────────────────────────────────────────────────────

interface PendingTask {
  id: string;
  label: string;
  status: 'pending' | 'overdue' | 'blocked';
  targetTab: string;
}

interface ApplicationPendingTasksProps {
  app: CreditApplication;
  onNavigate: (targetTab: string) => void;
}

// ── State ordering for ">= X" comparisons ─────────────────────

const STATE_RANK: Record<ApplicationState, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  KYC_REVIEW: 2,
  COMPLIANCE_HOLD: 3,
  KYC_APPROVED: 4,
  KYC_REJECTED: 5,
  UNDERWRITING: 6,
  CREDIT_ASSESSMENT: 7,
  COMMITTEE_REVIEW: 8,
  APPROVED: 9,
  REJECTED: 10,
  CONDITION_FULFILMENT: 11,
  OFFER: 12,
  ACCEPTED: 13,
  DISBURSED: 14,
  ACTIVE: 15,
  CLOSED: 16,
  WITHDRAWN: 17,
  REFERRED_BACK: 18,
};

function stateGTE(state: ApplicationState, threshold: ApplicationState): boolean {
  return (STATE_RANK[state] ?? 0) >= (STATE_RANK[threshold] ?? 0);
}

// ── Sort priority ─────────────────────────────────────────────

const STATUS_ORDER: Record<PendingTask['status'], number> = {
  blocked: 0,
  overdue: 1,
  pending: 2,
};

// ── Status icon config ────────────────────────────────────────

const STATUS_ICON: Record<PendingTask['status'], { name: string; color: string }> = {
  pending: { name: 'schedule', color: '#2563eb' },
  overdue: { name: 'warning', color: '#dc2626' },
  blocked: { name: 'block', color: '#6b7280' },
};

// ── Component ─────────────────────────────────────────────────

const ApplicationPendingTasks: React.FC<ApplicationPendingTasksProps> = ({
  app,
  onNavigate,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const tasks: PendingTask[] = useMemo(() => {
    const result: PendingTask[] = [];
    const st = app.state ?? app.status ?? 'DRAFT';

    // 1. Borrower profile
    if (!app.borrowerProfile?.borrowerType) {
      result.push({
        id: 'borrower-profile',
        label: 'Complete borrower profile',
        status: 'pending',
        targetTab: 'borrower-profile',
      });
    }

    // 2. Loan request
    if (!app.requestedAmount) {
      result.push({
        id: 'loan-request',
        label: 'Complete loan request',
        status: 'pending',
        targetTab: 'loan-request',
      });
    }

    // 3. Credit assessment
    if (!app.riskRating && !(app as any).scoreRunCount) {
      result.push({
        id: 'risk-score',
        label: 'Run credit assessment',
        status: 'pending',
        targetTab: 'risk-score',
      });
    }

    // 4. Financials — overdue if state >= UNDERWRITING
    const hasFinancials =
      (app.borrowerProfile?.financialStatements &&
        app.borrowerProfile.financialStatements.length > 0) ||
      !!(app as any).retailIncome;
    if (!hasFinancials) {
      const isOverdue = stateGTE(st as ApplicationState, 'UNDERWRITING');
      result.push({
        id: 'financials',
        label: 'Upload financials',
        status: isOverdue ? 'overdue' : 'pending',
        targetTab: 'financials',
      });
    }

    // 5. Collateral (secured loans only)
    const isSecured = (app as any).isSecured ?? false;
    const hasCollateral =
      Array.isArray((app as any).collateral) && (app as any).collateral.length > 0;
    if (isSecured && !hasCollateral) {
      result.push({
        id: 'collateral',
        label: 'Add collateral details',
        status: 'blocked',
        targetTab: 'collateral',
      });
    }

    // 6. Approval decision
    if (stateGTE(st as ApplicationState, 'APPROVED') && !app.decisionedAt) {
      result.push({
        id: 'approvals',
        label: 'Record approval decision',
        status: 'overdue',
        targetTab: 'approvals',
      });
    }

    // 7. Conditions & offer
    const hasConditions = (app.facilities ?? []).some(f => f.conditions);
    if (stateGTE(st as ApplicationState, 'OFFER') && !hasConditions) {
      result.push({
        id: 'conditions',
        label: 'Set conditions & offer',
        status: 'pending',
        targetTab: 'conditions',
      });
    }

    // 8. Sprint 2/3 — Compliance hold
    if (st === 'COMPLIANCE_HOLD') {
      result.push({
        id: 'compliance-hold',
        label: 'Clear compliance hold — AML/PEP/sanctions review required',
        status: 'blocked',
        targetTab: 'credit-checks-risk',
      });
    }

    // 9. Sprint 2/3 — Condition fulfilment pending
    if (st === 'CONDITION_FULFILMENT') {
      result.push({
        id: 'cp-fulfilment',
        label: 'Fulfil or waive precedent conditions before making offer',
        status: 'blocked',
        targetTab: 'conditions',
      });
    }

    // 10. Sprint 2/3 — Missing documents (for committee submission stage)
    if (stateGTE(st as ApplicationState, 'CREDIT_ASSESSMENT') && !stateGTE(st as ApplicationState, 'COMMITTEE_REVIEW')) {
      const docs = (app as any).documents ?? [];
      const hasUnverified = docs.some((d: any) =>
        d.verificationStatus && d.verificationStatus !== 'VERIFIED' && d.verificationStatus !== 'REJECTED'
      );
      if (hasUnverified) {
        result.push({
          id: 'documents-verify',
          label: 'Verify pending documents before committee submission',
          status: 'overdue',
          targetTab: 'documents',
        });
      }
    }

    // 11. Sprint 2/3 — Committee approval pending
    if (st === 'COMMITTEE_REVIEW' && !app.decisionedAt) {
      result.push({
        id: 'committee-approval',
        label: 'Awaiting committee approval decision',
        status: 'pending',
        targetTab: 'approvals',
      });
    }

    // Sort: blocked → overdue → pending
    result.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

    // Show at most 7
    return result.slice(0, 7);
  }, [app]);

  const count = tasks.length;

  return (
    <section
      style={{
        padding: 16,
        borderBottom: '1px solid var(--cr-outline-variant)',
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={() => setCollapsed(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--cr-font-display)',
              fontSize: 11,
              textTransform: 'uppercase',
              color: 'var(--cr-outline)',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
            }}
          >
            PENDING TASKS
          </span>
          {count > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: 'var(--cr-primary)',
                color: 'var(--cr-on-primary)',
                fontSize: 10,
                fontFamily: 'var(--cr-font-display)',
                fontWeight: 'bold',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              {count}
            </span>
          )}
        </div>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={{ marginTop: 12 }}>
          {count === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#16a34a' }}
              >
                check_circle
              </span>
              <span
                style={{
                  fontFamily: 'var(--cr-font-body)',
                  fontSize: 12,
                  color: 'var(--cr-on-surface-variant)',
                }}
              >
                All tasks completed
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(task => {
                const icon = STATUS_ICON[task.status];
                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate(task.targetTab)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: icon.color }}
                    >
                      {icon.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--cr-font-body)',
                        fontSize: 12,
                        color: 'var(--cr-on-surface-variant)',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.color = 'var(--cr-primary)';
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.color = 'var(--cr-on-surface-variant)';
                      }}
                    >
                      {task.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ApplicationPendingTasks;