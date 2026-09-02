import React from 'react';
import {
  APPLICATION_WORKSPACE_AREAS,
  ApplicationWorkspaceArea,
  getVisibleWorkspaceLocalTabs,
  getVisibleWorkspaceAreas,
  WorkspaceAreaDefinition,
} from './applicationWorkspaceAreas';

interface ApplicationWorkspaceNavigationProps {
  activeArea: ApplicationWorkspaceArea;
  activeTab: string;
  onAreaChange: (area: WorkspaceAreaDefinition) => void;
  onTabChange: (tab: string) => void;
  borrowerType?: string | null;
  lane?: string | null;
  featureFlags?: Record<string, boolean | undefined>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  borderLeft: '3px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--font-sans, inherit)',
  fontSize: 13,
  lineHeight: 1.3,
};

const ApplicationWorkspaceNavigation: React.FC<ApplicationWorkspaceNavigationProps> = ({
  activeArea,
  activeTab,
  onAreaChange,
  onTabChange,
  borrowerType,
  lane,
  featureFlags,
  mobileOpen = false,
  onMobileClose,
}) => {
  const visibleAreas = getVisibleWorkspaceAreas(lane);
  const primaryAreas = visibleAreas.filter(area => area.type === 'primary');
  const utilityAreas = visibleAreas.filter(area => area.type === 'utility');
  const selectedArea = APPLICATION_WORKSPACE_AREAS.find(area => area.id === activeArea) ?? primaryAreas[0];

  return (
    <nav
      aria-label="Application workspace"
      className={`${mobileOpen ? 'flex fixed inset-x-0 top-14 bottom-0 z-50 w-full' : 'hidden'} lg:flex lg:static lg:w-[248px] flex-col shrink-0`}
      style={{
        borderRight: '1px solid var(--cr-outline-variant, #e2e8f0)',
        backgroundColor: 'var(--cr-surface-container-lowest, #f8fafc)',
        overflowY: 'auto',
      }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden" style={{ borderColor: 'var(--cr-outline-variant, #e2e8f0)' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cr-outline, #64748b)' }}>Workspace</span>
        <button type="button" aria-label="Close workspace menu" onClick={onMobileClose} className="rounded p-1 text-slate-600 hover:bg-slate-100">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
        </button>
      </div>
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
        Workspace
      </div>

      {primaryAreas.map(area => {
        const isActive = area.id === activeArea;
        return (
          <React.Fragment key={area.id}>
            <button
              type="button"
              onClick={() => onAreaChange(area)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                ...navButtonStyle,
                borderLeftColor: isActive ? 'var(--cr-action, #0051d5)' : 'transparent',
                background: isActive ? 'var(--cr-action-container, rgba(0,81,213,0.08))' : 'transparent',
                fontWeight: isActive ? 650 : 450,
                color: isActive ? 'var(--cr-on-surface, #0f172a)' : 'var(--cr-on-surface-variant, #475569)',
              }}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: 18, color: isActive ? 'var(--cr-action, #0051d5)' : 'var(--cr-outline, #94a3b8)' }}
              >
                {area.id === 'overview' ? 'dashboard' : area.id === 'application-parties' ? 'groups' : area.id === 'financials' ? 'account_balance' : area.id === 'risk-compliance' ? 'fact_check' : area.id === 'assessment-recommendation' ? 'assignment' : 'gavel'}
              </span>
              <span>{area.label}</span>
            </button>

            {isActive && getVisibleWorkspaceLocalTabs(area.id, borrowerType, lane, featureFlags).length > 0 && (
              <div
                role="tablist"
                aria-label={`${area.label} tabs`}
                style={{ padding: '2px 8px 8px 36px' }}
              >
                {getVisibleWorkspaceLocalTabs(area.id, borrowerType, lane, featureFlags).map(tab => {
                  // The URL value is authoritative here: several legacy destinations intentionally
                  // render through the same 360 component (for example Application/Facilities).
                  const localActive = activeTab === tab.urlTab || activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={localActive}
                      onClick={() => onTabChange(tab.urlTab)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '7px 8px',
                        border: 'none',
                        borderRadius: 4,
                        background: localActive ? 'var(--cr-surface-container-high, #e2e8f0)' : 'transparent',
                        color: localActive ? 'var(--cr-on-surface, #0f172a)' : 'var(--cr-on-surface-variant, #64748b)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: localActive ? 650 : 450,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}

      <div style={{ margin: '12px 16px 8px', borderTop: '1px solid var(--cr-outline-variant, #e2e8f0)' }} />
      <div
        style={{
          padding: '0 16px 8px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cr-outline, #64748b)',
        }}
      >
        Utilities
      </div>

      {utilityAreas.map(area => {
        const isActive = area.id === activeArea;
        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onAreaChange(area)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              ...navButtonStyle,
              borderLeftColor: isActive ? 'var(--cr-action, #0051d5)' : 'transparent',
              background: isActive ? 'var(--cr-action-container, rgba(0,81,213,0.08))' : 'transparent',
              fontWeight: isActive ? 650 : 450,
              color: isActive ? 'var(--cr-on-surface, #0f172a)' : 'var(--cr-on-surface-variant, #475569)',
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18, color: 'var(--cr-outline, #94a3b8)' }}>
              {area.id === 'documents' ? 'folder_open' : 'history'}
            </span>
            <span>{area.label}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />
      <span className="sr-only">Selected area: {selectedArea.label}</span>
    </nav>
  );
};

export default ApplicationWorkspaceNavigation;
