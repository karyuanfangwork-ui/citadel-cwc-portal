/**
 * ApplicationSectionIndex — Left sidebar section index (240px) for the Application 360 Workspace.
 *
 * Displays 10 section items with status badges. Active tab is highlighted with
 * a left border accent and background tint.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';
import { DetailTab360 } from '../../../../pages/credit/creditUtils';

type SectionStatus = 'complete' | 'in-progress' | 'pending' | 'exception';

interface ApplicationSectionIndexProps {
  activeTab: DetailTab360;
  onTabChange: (tab: DetailTab360) => void;
  sectionStatuses: Record<string, SectionStatus>;
}

/** Ordered list of sidebar sections — one per detail tab */
const SECTIONS: { label: string; tabId: DetailTab360; icon: string }[] = [
  { label: 'Overview', tabId: 'overview', icon: 'dashboard' },
  { label: 'Customer Profile', tabId: 'customer-profile', icon: 'person' },
  { label: 'Application Details', tabId: 'application-details', icon: 'description' },
  { label: 'Financial Profile', tabId: 'financial-profile', icon: 'trending_up' },
  { label: 'Risk Assessment', tabId: 'risk-assessment', icon: 'shield' },
  { label: 'Credit Bureau & Compliance', tabId: 'credit-bureau', icon: 'fact_check' },
  { label: 'Collateral & Guarantees', tabId: 'collateral-guarantees', icon: 'verified_user' },
  { label: 'Documents', tabId: 'documents', icon: 'folder_open' },
  { label: 'Approvals', tabId: 'approvals', icon: 'check_circle' },
  { label: 'Conditions & Offer', tabId: 'conditions-offer', icon: 'assignment_turned_in' },
  { label: 'Timeline & Audit', tabId: 'timeline-audit', icon: 'history' },
];

const STATUS_ICON: Record<SectionStatus, string> = {
  complete: 'check_circle',
  'in-progress': 'radio_button_checked',
  pending: 'radio_button_unchecked',
  exception: 'error',
};

const STATUS_COLOR: Record<SectionStatus, string> = {
  complete: 'var(--cr-success, #16a34a)',
  'in-progress': 'var(--cr-action, #0051d5)',
  pending: 'var(--cr-outline, #94a3b8)',
  exception: 'var(--cr-error, #dc2626)',
};

const ApplicationSectionIndex: React.FC<ApplicationSectionIndexProps> = ({
  activeTab,
  onTabChange,
  sectionStatuses,
}) => {
  return (
    <nav
      aria-label="Application sections"
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 240,
        borderRight: '1px solid var(--cr-outline-variant, #e2e8f0)',
        backgroundColor: 'var(--cr-surface-container-lowest, #f8fafc)',
        overflowY: 'auto',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '16px 16px 8px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cr-outline, #64748b)',
        }}
      >
        Sections
      </div>

      {/* Section items */}
      {SECTIONS.map((section) => {
        const isActive = activeTab === section.tabId;
        const status: SectionStatus = sectionStatuses[section.tabId] || 'pending';

        return (
          <button
            key={section.tabId}
            id={`section-${section.tabId}`}
            onClick={() => onTabChange(section.tabId)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              border: 'none',
              borderBottom: '1px solid transparent',
              borderLeft: isActive ? '3px solid var(--cr-action, #0051d5)' : '3px solid transparent',
              background: isActive
                ? 'var(--cr-action-container, rgba(0,81,213,0.08))'
                : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              fontFamily: 'var(--font-sans, inherit)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--cr-surface-container, #f1f5f9)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {/* Section icon */}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 18,
                color: isActive ? 'var(--cr-action, #0051d5)' : 'var(--cr-outline, #94a3b8)',
              }}
            >
              {section.icon}
            </span>

            {/* Label */}
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--cr-on-surface, #0f172a)' : 'var(--cr-on-surface-variant, #475569)',
                lineHeight: 1.3,
              }}
            >
              {section.label}
            </span>

            {/* Status badge */}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                color: STATUS_COLOR[status],
              }}
              title={`${section.label}: ${status}`}
            >
              {STATUS_ICON[status]}
            </span>
          </button>
        );
      })}

      {/* Bottom spacer */}
      <div style={{ flex: 1 }} />
    </nav>
  );
};

export default ApplicationSectionIndex;