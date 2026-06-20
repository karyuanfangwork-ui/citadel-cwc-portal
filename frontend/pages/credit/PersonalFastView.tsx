import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CreditApplication, CreditApproval, ApplicationSignoff, ApplicationState } from '../../src/services/credit.service';
import { LANE_LABELS, LANE_DESCRIPTIONS, ProcessingLane as ProcessingLaneType, FATCA_CRS_FLAG, getPhaseCompletion, getIncompletePhaseCount, PhaseStatus } from './creditUtils';
import StateBadge from '../../src/components/credit/StateBadge';
import EditBorrowerModal from '../../src/components/credit/EditBorrowerModal';
import { SectionErrorBoundary, SectionLoadingSkeleton, SectionEmptyState } from '../../src/components/credit/SectionStates';

// ── Tab components (same ones used by CreditApplicationDetail) ──
import LoanRequestTab from './tabs/LoanRequestTab';
import BorrowerProfileTab from './tabs/BorrowerProfileTab';
import FinancialsTab from './tabs/FinancialsTab';
import CreditChecksTab from './tabs/CreditChecksTab';
import SignoffTab from './tabs/SignoffTab';
import DocumentsTab from './tabs/DocumentsTab';
import ApplicationComments from '../../src/components/credit/ApplicationComments';
import S7ProcessBanner from '../../src/components/credit/S7ProcessBanner';

// ── P2-2: PersonalFastView ──────────────────────────────────────────────────
// Single scrollable page that renders all core sections vertically stacked.
// No sidebar tab navigation — this is the streamlined PERSONAL_FAST lane experience.

interface PersonalFastViewProps {
  app: CreditApplication;
  lane: string;
  laneReason: string | null;
  onUpdated: (updated: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
  setApp: React.Dispatch<React.SetStateAction<CreditApplication | null>>;
  canApprove: boolean;
  isFeatureEnabled: (flag: string) => boolean;
  signoffs: ApplicationSignoff[];
  allSigned: boolean;
  approvals: CreditApproval[];
  onNavigate: (tab: string) => void;
}

interface SectionDef {
  id: string;
  number: number;
  title: string;
  /** Phase key(s) from getPhaseCompletion that determine this section's status */
  phases: string[];
  /** Whether this section is collapsible by default (secondary content) */
  collapsible?: boolean;
}

const PERSONAL_FAST_SECTIONS: SectionDef[] = [
  { id: 'loan-request',    number: 1, title: 'Loan Request',         phases: ['s1'] },
  { id: 'borrower-profile', number: 2, title: 'Borrower Profile',    phases: ['s2'] },
  { id: 'financials',      number: 3, title: 'Financials',          phases: ['s3'] },
  { id: 'credit-checks',   number: 4, title: 'Bureau & Compliance', phases: ['s4', 's5'] },
  { id: 'signoff',         number: 5, title: 'Sign-off',            phases: ['s7'] },
  { id: 'documents',       number: 6, title: 'Documents',            phases: ['meta'], collapsible: true },
  { id: 'comments',        number: 7, title: 'Comments',             phases: [],       collapsible: true },
];

/** Map phase statuses to a section-level status. */
function getSectionStatus(phases: string[], completion: Record<string, PhaseStatus>): PhaseStatus | 'none' {
  if (phases.length === 0) return 'none';
  for (const p of phases) {
    if (completion[p] === 'incomplete') return 'incomplete';
  }
  const allComplete = phases.every(p => completion[p] === 'complete');
  if (allComplete) return 'complete';
  const allOptional = phases.every(p => completion[p] === 'optional');
  if (allOptional) return 'optional';
  return 'complete';
}

/** Human-readable hint for what's needed to complete a section. */
function getSectionHint(sectionId: string, app: CreditApplication): string | null {
  const hasValue = (v: unknown) => v != null && String(v).trim() !== '';
  const bp = app.borrowerProfile;
  switch (sectionId) {
    case 'loan-request':
      if (!hasValue(app.requestedAmount)) return 'Enter requested amount';
      if (!hasValue(app.requestedTenor)) return 'Enter requested tenor';
      if (!hasValue(app.productType)) return 'Select product type';
      if (!hasValue(app.purpose)) return 'Enter purpose of loan';
      if (!app.facilities || app.facilities.length === 0) return 'Add at least one facility';
      return null;
    case 'borrower-profile':
      if (!hasValue(bp?.borrowerType)) return 'Set borrower type';
      return null;
    case 'financials': {
      const isRetail = bp?.borrowerType === 'INDIVIDUAL' || bp?.borrowerType === 'SOLE_PROPRIETOR';
      if (isRetail) {
        const ri = (app as any).retailIncome;
        if (!ri || ri.monthlyGrossIncome == null) return 'Enter monthly gross income';
        return null;
      }
      if (!bp?.financialStatements || bp.financialStatements.length === 0) return 'Add at least one financial statement';
      return null;
    }
    case 'credit-checks': {
      const cl = (app as any).bureauChecklist;
      if (!cl) return 'Complete bureau checklist (CCRIS, CTOS, AML screening)';
      if (!cl.ccrisUploaded) return 'Upload CCRIS report';
      if (!cl.ctosUploaded) return 'Upload CTOS report';
      if (!cl.amlScreeningDone) return 'Complete AML screening';
      if (!cl.noAdverseRecord && !cl.adverseExceptionReason) return 'Resolve adverse record or provide exception reason';
      const scoreRunCount = (app as any).scoreRunCount ?? app.scoreRunCount ?? 0;
      if (scoreRunCount === 0) return 'Run at least one credit score';
      return null;
    }
    case 'signoff':
      if (!app.preparedAt) return 'Prepare sign-off (PREPARED_BY)';
      return null;
    case 'documents':
      return null;
    case 'comments':
      return null;
    default:
      return null;
  }
}

/** Determine if a section has data worth showing (for empty-state detection). */
function isSectionEmpty(sectionId: string, app: CreditApplication): boolean {
  switch (sectionId) {
    case 'loan-request':
      return !app.requestedAmount && !app.productType && !app.purpose;
    case 'borrower-profile':
      return !app.borrowerProfile;
    case 'financials': {
      const bp = app.borrowerProfile;
      const isRetail = bp?.borrowerType === 'INDIVIDUAL' || bp?.borrowerType === 'SOLE_PROPRIETOR';
      if (isRetail) return !(app as any).retailIncome;
      return !bp?.financialStatements || bp.financialStatements.length === 0;
    }
    case 'credit-checks':
      return !(app as any).creditBureauChecks?.length && !(app as any).bureauChecklist;
    case 'signoff':
      return false; // SignoffTab always renders the form
    case 'documents':
      return false; // DocumentsTab handles its own empty state
    case 'comments':
      return false; // ApplicationComments handles its own empty state
    default:
      return false;
  }
}

const STATUS_STYLES: Record<PhaseStatus | 'none', { badge: string; dot: string; label: string }> = {
  complete:   { badge: 'bg-green-600 text-white', dot: 'bg-green-500', label: 'Complete' },
  incomplete: { badge: 'bg-amber-500 text-white', dot: 'bg-amber-500', label: 'Action needed' },
  optional:   { badge: 'bg-gray-400 text-white', dot: 'bg-gray-400', label: 'Optional' },
  none:       { badge: 'bg-gray-300 text-gray-700', dot: 'bg-gray-300', label: '' },
};

const PersonalFastView: React.FC<PersonalFastViewProps> = ({
  app,
  lane,
  laneReason,
  onUpdated,
  onDirtyChange,
  onRefresh,
  setApp,
  canApprove,
  isFeatureEnabled,
  signoffs,
  allSigned,
  approvals,
  onNavigate,
}) => {
  const currentState = (app.state || app.status) as ApplicationState;

  // ── Phase 2: Compute completion statuses ──
  const phaseCompletion = useMemo(() => getPhaseCompletion({
    requestedAmount: app.requestedAmount,
    requestedTenor: app.requestedTenor,
    productType: app.productType as string | null,
    purpose: app.purpose,
    borrowerType: app.borrowerProfile?.borrowerType ?? null,
    registrationNumber: app.borrowerProfile?.registrationNumber ?? null,
    riskRating: app.riskRating,
    scoreRunCount: app.scoreRunCount,
    latestScoreRunAt: app.latestScoreRunAt,
    latestScoreRunStatus: app.latestScoreRunStatus,
    firstWayOut: app.firstWayOut,
    preparedAt: app.preparedAt,
    decisionedAt: app.decisionedAt,
    facilities: app.facilities ?? [],
    parties: app.parties ?? [],
    financialStatements: app.borrowerProfile?.financialStatements ?? [],
    creditBureauChecks: (app as any).creditBureauChecks ?? [],
    creditDecisions: (app as any).creditDecisions ?? [],
    isSecured: ((app as any).collateralItems?.length ?? 0) > 0,
    retailIncome: (app as any).retailIncome ?? null,
    bureauChecklist: (app as any).bureauChecklist ?? null,
  }), [app]);
  const incompleteCount = useMemo(() => getIncompletePhaseCount(phaseCompletion), [phaseCompletion]);
  const totalRequired = useMemo(() => Object.values(phaseCompletion).filter(s => s !== 'optional').length, [phaseCompletion]);
  const completeCount = totalRequired - incompleteCount;
  const progressPct = totalRequired > 0 ? Math.round((completeCount / totalRequired) * 100) : 0;

  // Find next incomplete section for "what to do next" cue
  const nextSection = useMemo(() => {
    for (const section of PERSONAL_FAST_SECTIONS) {
      const status = getSectionStatus(section.phases, phaseCompletion);
      if (status === 'incomplete') return section;
    }
    return null;
  }, [phaseCompletion]);

  // ── Phase 4: Collapsible sections state ──
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    return new Set(PERSONAL_FAST_SECTIONS.filter(s => s.collapsible).map(s => s.id));
  });

  // ── Phase 3: Edit borrower modal state ──
  const [showEditBorrower, setShowEditBorrower] = useState(false);

  // ── Phase 6: Section retry keys ──
  // Increment to force SectionErrorBoundary to remount its children
  const [retryKeys, setRetryKeys] = useState<Record<string, number>>({});
  const handleSectionRetry = useCallback((sectionId: string) => {
    setRetryKeys(prev => ({ ...prev, [sectionId]: (prev[sectionId] ?? 0) + 1 }));
    onRefresh();
  }, [onRefresh]);

  // ── Phase 6: Scroll-spy for active section tracking ──
  const [activeSection, setActiveSection] = useState<string>(PERSONAL_FAST_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry closest to the top that's intersecting
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id.replace('pf-section-', '');
          setActiveSection(id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    // Observe all section elements
    PERSONAL_FAST_SECTIONS.forEach(s => {
      const el = document.getElementById(`pf-section-${s.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [collapsedSections]); // Re-observe when collapse state changes

  // ── Phase 6: Deep-link support — read URL hash on mount ──
  useEffect(() => {
    const hash = window.location.hash.replace('#pf-', '');
    if (hash) {
      // Auto-expand if it's a collapsed section
      setCollapsedSections(prev => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
      // Scroll to the section after expansion
      setTimeout(() => {
        const el = document.getElementById(`pf-section-${hash}`);
        if (el) {
          const scrollParent = el.closest('main');
          if (scrollParent) {
            const elRect = el.getBoundingClientRect();
            const parentRect = scrollParent.getBoundingClientRect();
            const offset = elRect.top - parentRect.top - 8;
            scrollParent.scrollTo({ top: scrollParent.scrollTop + offset, behavior: 'smooth' });
          } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 200);
    }
  }, []);

  // ── Phase 6: Update URL hash when active section changes ──
  const updateHash = useCallback((sectionId: string) => {
    if (window.location.hash !== `#pf-${sectionId}`) {
      window.history.replaceState(null, '', `#pf-${sectionId}`);
    }
  }, []);

  useEffect(() => {
    updateHash(activeSection);
  }, [activeSection, updateHash]);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    // Auto-expand if collapsed
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Use setTimeout to allow the section to expand before scrolling
    setTimeout(() => {
      const el = document.getElementById(`pf-section-${id}`);
      if (el) {
        // Find the scrollable parent (main element)
        const scrollParent = el.closest('main');
        if (scrollParent) {
          // Calculate position relative to the scroll container, accounting for header
          const elRect = el.getBoundingClientRect();
          const parentRect = scrollParent.getBoundingClientRect();
          const offset = elRect.top - parentRect.top - 8; // 8px padding
          scrollParent.scrollTo({ top: scrollParent.scrollTop + offset, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 80);
  };

  const renderSection = (section: SectionDef): React.ReactNode => {
    switch (section.id) {
      case 'loan-request':
        return <LoanRequestTab application={app} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />;
      case 'borrower-profile':
        return <BorrowerProfileTab application={app} fatcaCrsEnabled={isFeatureEnabled(FATCA_CRS_FLAG)} />;
      case 'financials':
        return <FinancialsTab application={app} />;
      case 'credit-checks':
        return <CreditChecksTab application={app} onUpdated={setApp} />;
      case 'signoff':
        return (
          <>
            <S7ProcessBanner
              app={app}
              signoffs={signoffs}
              allSigned={allSigned}
              approvals={approvals}
              onNavigate={onNavigate as (tab: 'signoff' | 'approvals') => void}
            />
            <SignoffTab application={app} onUpdated={setApp} />
          </>
        );
      case 'documents':
        return <DocumentsTab app={app} canApprove={canApprove} />;
      case 'comments':
        return <ApplicationComments applicationId={app.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Lane banner */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-green-700 text-xl">bolt</span>
        <div>
          <div className="text-sm font-bold text-green-800">
            {LANE_LABELS[lane as ProcessingLaneType] || 'Personal Fast'} — Streamlined Flow
          </div>
          {laneReason && (
            <div className="text-xs text-green-700 mt-0.5">{laneReason}</div>
          )}
          <div className="text-xs text-green-600 mt-0.5">
            {LANE_DESCRIPTIONS[lane as ProcessingLaneType]}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StateBadge state={currentState} size="md" />
        </div>
      </div>

      {/* ── Phase 2: Compact progress strip ── */}
      <div className="bg-white border border-border rounded-xl px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Progress ring */}
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke={progressPct === 100 ? '#16a34a' : '#f59e0b'}
                strokeWidth="4"
                strokeDasharray={`${(progressPct / 100) * 125.66} 125.66`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text-primary">
              {progressPct}%
            </span>
          </div>
          {/* Stats */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text-primary">
              {completeCount} of {totalRequired} sections complete
            </div>
            {nextSection ? (
              <div className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                Next: <span className="font-semibold">{nextSection.title}</span>
                {getSectionHint(nextSection.id, app) && (
                  <span className="text-amber-600"> — {getSectionHint(nextSection.id, app)}</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-green-700 mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                All required sections complete — ready for submission
              </div>
            )}
          </div>
          {/* Phase 6: Section dots — clickable for scroll-spy navigation */}
          <div className="flex items-center gap-1.5 shrink-0">
            {PERSONAL_FAST_SECTIONS.map((section) => {
              const status = getSectionStatus(section.phases, phaseCompletion);
              const style = STATUS_STYLES[status];
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  title={`${section.title}: ${style.label || 'N/A'}`}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-2.5 h-2.5 rounded-full ${style.dot} transition-all hover:scale-125 ${
                    isActive ? 'ring-2 ring-offset-1 ring-brand-400 scale-125' : ''
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* All sections stacked vertically */}
      {PERSONAL_FAST_SECTIONS.map((section) => {
        const status = getSectionStatus(section.phases, phaseCompletion);
        const style = STATUS_STYLES[status];
        const hint = getSectionHint(section.id, app);
        const isCollapsed = collapsedSections.has(section.id);
        const isCollapsible = section.collapsible;
        const isEmpty = isSectionEmpty(section.id, app);
        const retryKey = retryKeys[section.id] ?? 0;

        return (
          <section
            key={section.id}
            id={`pf-section-${section.id}`}
            ref={(el) => { sectionRefs.current[section.id] = el; }}
            className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
              activeSection === section.id ? 'border-brand-300 ring-1 ring-brand-100' : 'border-border'
            }`}
          >
            <div
              className={`border-b border-border px-6 py-3 flex items-center gap-3 ${
                isCollapsible ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'
              }`}
              onClick={isCollapsible ? () => toggleSection(section.id) : undefined}
            >
              {/* Numbered badge with status color */}
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${style.badge} text-xs font-bold shrink-0`}
              >
                {section.number}
              </span>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex-1">
                {section.title}
              </h3>

              {/* Phase 3: Edit button for borrower profile */}
              {section.id === 'borrower-profile' && app.borrowerProfile && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowEditBorrower(true); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-cwc-md transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit Identity
                </button>
              )}

              {/* Status indicator */}
              {status === 'incomplete' && hint && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {hint}
                </span>
              )}
              {status === 'complete' && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                </span>
              )}

              {/* Collapse/expand chevron */}
              {isCollapsible && (
                <span className={`material-symbols-outlined text-gray-400 text-lg transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                  expand_more
                </span>
              )}
            </div>

            {/* Section content — Phase 6: wrapped in error boundary */}
            {!isCollapsed && (
              <div className="p-6">
                <SectionErrorBoundary
                  key={retryKey}
                  sectionTitle={section.title}
                  onRetry={() => handleSectionRetry(section.id)}
                >
                  {isEmpty ? (
                    <SectionEmptyState
                      icon="draft"
                      title={`No ${section.title.toLowerCase()} data yet`}
                      description={
                        section.id === 'loan-request'
                          ? 'Fill in the loan request details to get started.'
                          : section.id === 'financials'
                          ? 'Add financial statements or retail income data to proceed.'
                          : section.id === 'credit-checks'
                          ? 'Run bureau checks and complete the compliance checklist.'
                          : 'Data for this section has not been added yet.'
                      }
                    />
                  ) : (
                    renderSection(section)
                  )}
                </SectionErrorBoundary>
              </div>
            )}
          </section>
        );
      })}

      {/* ── Phase 3: Edit Borrower Modal ── */}
      {app.borrowerProfile && (
        <EditBorrowerModal
          profile={app.borrowerProfile}
          isOpen={showEditBorrower}
          onClose={() => setShowEditBorrower(false)}
          onSaved={(updated) => {
            setApp({ ...app, borrowerProfile: updated });
            setShowEditBorrower(false);
          }}
        />
      )}
    </div>
  );
};

export default PersonalFastView;