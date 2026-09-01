/**
 * ApplicationTeamWidget — Right panel widget showing assigned team members.
 *
 * Displays: RM, Analyst, Approver — each in a row with label + UserAssignChip.
 * Collapsible section with header 'ASSIGNED TEAM'.
 * Disabled when app is in CLOSED/WITHDRAWN/ACTIVE/DISBURSED states.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';
import { CreditApplication } from '../../../services/credit.service';
import UserAssignChip from '../UserAssignChip';

interface ApplicationTeamWidgetProps {
  app: CreditApplication;
  onAssign: (field: string) => void;
}

const DISABLED_STATES: string[] = ['CLOSED', 'WITHDRAWN', 'ACTIVE', 'DISBURSED'];

const ApplicationTeamWidget: React.FC<ApplicationTeamWidgetProps> = ({ app, onAssign }) => {
  const [collapsed, setCollapsed] = useState(true);

  const isDisabled = DISABLED_STATES.includes(app.state ?? app.status ?? '');

  // Derive latest approval / approver
  const latestApproval = (app.approvals && app.approvals.length > 0)
    ? [...app.approvals].sort((a, b) => {
        const dateA = a.decidedAt ?? a.createdAt;
        const dateB = b.decidedAt ?? b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })[0]
    : null;

  const approverName = latestApproval?.approver
    ? `${latestApproval.approver.firstName} ${latestApproval.approver.lastName}`
    : null;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--cr-outline-variant)',
        padding: 16,
      }}
    >
      {/* ── Collapsible Header ── */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(prev => !prev)}
        style={{ userSelect: 'none' }}
      >
        <span
          className="font-bold uppercase"
          style={{
            fontFamily: 'var(--cr-font-display)',
            fontSize: 11,
            color: 'var(--cr-outline)',
            letterSpacing: '0.12em',
          }}
        >
          ASSIGNED TEAM
        </span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </div>

      {/* ── Rows ── */}
      {!collapsed && (
        <div className="flex flex-col gap-3 mt-3">
          {/* RM */}
          <div className="flex items-center gap-3">
            <span
              className="font-bold uppercase shrink-0"
              style={{
                fontFamily: 'var(--cr-font-display)',
                fontSize: 11,
                color: 'var(--cr-outline)',
                letterSpacing: '0.08em',
                minWidth: 72,
              }}
            >
              RM
            </span>
            <UserAssignChip
              label="RM"
              value={app.rm ?? null}
              applicationId={app.id}
              field="assignedRmId"
              roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={isDisabled}
              onUpdated={() => onAssign('assignedRmId')}
            />
          </div>

          {/* Analyst */}
          <div className="flex items-center gap-3">
            <span
              className="font-bold uppercase shrink-0"
              style={{
                fontFamily: 'var(--cr-font-display)',
                fontSize: 11,
                color: 'var(--cr-outline)',
                letterSpacing: '0.08em',
                minWidth: 72,
              }}
            >
              ANALYST
            </span>
            <UserAssignChip
              label="Analyst"
              value={app.analyst ?? null}
              applicationId={app.id}
              field="assignedAnalystId"
              roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={isDisabled}
              onUpdated={() => onAssign('assignedAnalystId')}
            />
          </div>

          {/* Approver — derived from latest approval, displayed as text chip */}
          <div className="flex items-center gap-3">
            <span
              className="font-bold uppercase shrink-0"
              style={{
                fontFamily: 'var(--cr-font-display)',
                fontSize: 11,
                color: 'var(--cr-outline)',
                letterSpacing: '0.08em',
                minWidth: 72,
              }}
            >
              APPROVER
            </span>
            {approverName ? (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--cr-surface-container-high)',
                  border: '1px solid var(--cr-outline-variant)',
                  fontSize: 'var(--cr-text-body-sm)',
                  fontFamily: 'var(--cr-font-body)',
                  color: 'var(--cr-on-surface)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--cr-primary)' }}>
                  verified
                </span>
                <span className="font-medium">{approverName}</span>
              </div>
            ) : (
              <span
                style={{
                  fontSize: 'var(--cr-text-body-sm)',
                  fontFamily: 'var(--cr-font-body)',
                  color: 'var(--cr-outline)',
                  fontStyle: 'italic',
                }}
              >
                Unassigned
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationTeamWidget;
