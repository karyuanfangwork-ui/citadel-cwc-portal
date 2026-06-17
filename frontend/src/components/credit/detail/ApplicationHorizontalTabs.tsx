/**
 * ApplicationHorizontalTabs — Horizontal scrollable tab bar for the Application 360 Workspace.
 *
 * Replaces the left sidebar tab navigation. Groups tabs by S-group with section
 * labels as subtle dividers. Shows document count badge on Documents tab.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useRef, useEffect } from 'react';
import { TabGroup, DetailTab360 } from '../../../../pages/credit/creditUtils';

interface ApplicationHorizontalTabsProps {
  visibleTabGroups: TabGroup[];
  activeTab: DetailTab360;
  onTabChange: (tab: DetailTab360) => void;
  phaseCompletion: Record<string, string>;
  documentCount?: number;
}

const ApplicationHorizontalTabs: React.FC<ApplicationHorizontalTabsProps> = ({
  visibleTabGroups,
  activeTab,
  onTabChange,
  phaseCompletion,
  documentCount,
}) => {
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const tab = activeTabRef.current;
      const scrollLeft = tab.offsetLeft - container.offsetLeft - container.clientWidth / 2 + tab.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeTab]);

  return (
    <div
      className="border-b overflow-x-auto no-scrollbar"
      style={{ borderColor: 'var(--cr-outline-variant)', backgroundColor: 'var(--cr-surface-container-lowest)' }}
      ref={scrollContainerRef}
    >
      <div className="flex items-stretch px-6 gap-0 min-w-max">
        {visibleTabGroups.map((group, groupIdx) => {
          const groupStatus = phaseCompletion[group.id];
          const sectionMatch = /^s(\d+)$/.exec(group.id);
          const sectionLabel = sectionMatch ? `S${sectionMatch[1]}` : group.advancedOnly ? 'ADV' : null;

          return (
            <React.Fragment key={group.id}>
              {/* Section divider between groups */}
              {groupIdx > 0 && (
                <div
                  className="self-stretch mx-1 my-2"
                  style={{ width: 1, backgroundColor: 'var(--cr-outline-variant)' }}
                />
              )}

              {/* Group label */}
              {sectionLabel && (
                <div
                  className="flex items-center px-1.5 text-[9px] font-bold uppercase tracking-widest select-none"
                  style={{ color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-display)', letterSpacing: 'var(--cr-tracking-label)' }}
                >
                  {sectionLabel}
                </div>
              )}

              {/* Tab buttons */}
              {group.tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const tabStatus = phaseCompletion[group.id];
                const isComplete = tabStatus === 'complete';

                return (
                  <button
                    key={tab.id}
                    ref={isActive ? activeTabRef : undefined}
                    onClick={() => onTabChange(tab.id as unknown as DetailTab360)}
                    role="tab"
                    aria-selected={isActive}
                    id={`tab-${tab.id}`}
                    className="relative px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
                    style={{
                      fontFamily: isActive ? 'var(--cr-font-display)' : 'var(--cr-font-body)',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--cr-secondary)' : 'var(--cr-on-surface-variant)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: isActive ? '2px solid var(--cr-secondary)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.color = 'var(--cr-on-surface)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.color = 'var(--cr-on-surface-variant)';
                    }}
                  >
                    {/* Completion dot */}
                    {isComplete && !isActive && (
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#16a34a' }}>check_circle</span>
                    )}
                    {tab.label}
                    {/* Document count badge */}
                    {tab.id === 'documents' && documentCount != null && documentCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center font-bold rounded-full"
                        style={{
                          minWidth: 16,
                          height: 16,
                          fontSize: 10,
                          padding: '0 4px',
                          backgroundColor: 'var(--cr-error-container)',
                          color: 'var(--cr-on-error-container)',
                          fontFamily: 'var(--cr-font-display)',
                        }}
                      >
                        {documentCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationHorizontalTabs;