import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, CreditApproval, ApplicationTransition, ApplicationState, ApplicationSignoff, signoffApi, dashboardApi, commentApi,
} from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import { pollPdfJob } from '../src/services/pdfJob.service';
import { useDirtyFormGuard } from '../src/hooks/useDirtyFormGuard';
import { useCreditFeatureFlags } from '../src/hooks/useCreditFeatureFlags';
import { useApplicationLane } from '../src/hooks/useApplicationLane';
import ReadinessChecklistModal from '../src/components/credit/ReadinessChecklistModal';

// ── Application 360 Workspace Components ──
import ApplicationWorkspaceHeader from '../src/components/credit/detail/ApplicationWorkspaceHeader';
import ApplicationHorizontalTabs from '../src/components/credit/detail/ApplicationHorizontalTabs';
import ApplicationKpiRow from '../src/components/credit/detail/ApplicationKpiRow';
import ApplicationJourneyStepper from '../src/components/credit/detail/ApplicationJourneyStepper';
import ApplicationSectionIndex from '../src/components/credit/detail/ApplicationSectionIndex';
import ApplicationStatusWidget from '../src/components/credit/detail/ApplicationStatusWidget';
import ApplicationSlaWidget from '../src/components/credit/detail/ApplicationSlaWidget';
import ApplicationTeamWidget from '../src/components/credit/detail/ApplicationTeamWidget';
import ApplicationPendingTasks from '../src/components/credit/detail/ApplicationPendingTasks';
import ApplicationCustomerInsights from '../src/components/credit/detail/ApplicationCustomerInsights';
import ApplicationNotesWidget from '../src/components/credit/detail/ApplicationNotesWidget';
import SectionCompletionHeader, { CompletionStatus } from '../src/components/credit/detail/SectionCompletionHeader';

// ── Legacy panels (still used for mobile / fallback) ──
import ApplicationAlertsPanel, { AlertItem } from '../src/components/credit/detail/ApplicationAlertsPanel';

// ── 7-Section Tabs (used directly by renderTab or PersonalFastView) ──
import DocumentsTab from './credit/tabs/DocumentsTab';
import ApplicationOverviewTab from '../src/components/credit/detail/ApplicationOverviewTab';

// ── 360 Merged Tab Components ──
import TimelineAuditTab from './credit/tabs/TimelineAuditTab';
import CustomerProfileTab from './credit/tabs/CustomerProfileTab';
import ApplicationDetailsTab from './credit/tabs/ApplicationDetailsTab';
import ApprovalsTab360 from './credit/tabs/ApprovalsTab360';
import ConditionsOfferTab from './credit/tabs/ConditionsOfferTab';
import DisbursementTab from './credit/tabs/DisbursementTab';
import CollateralGuaranteesTab from './credit/tabs/CollateralGuaranteesTab';
import FinancialProfileTab from './credit/tabs/FinancialProfileTab';
import CreditBureauComplianceTab from './credit/tabs/CreditBureauComplianceTab';
import RiskAssessmentTab from './credit/tabs/RiskAssessmentTab';

import ScoreOutdatedBanner from '../src/components/credit/ScoreOutdatedBanner';
import BorrowerSummaryCard, { getBorrowerDisplayName } from '../src/components/credit/BorrowerSummaryCard';
import {
  STATE_COLORS,
  STATE_LABELS,
  SECURED_PRODUCTS,
  DetailTab,
  TabGroup,
  getPhaseCompletion,
  getIncompletePhaseCount,
  getNextIncompleteTab,
  getVisibleTabGroups,
  TAB_TO_PHASE_MAP,
  FATCA_CRS_FLAG,
  ProcessingLane as ProcessingLaneType,
  getBorrowerSegment,
  getJourneyStage,
  // ── Application 360 Tab System ──
  DetailTab360,
  TAB_GROUPS_360,
  ALL_TABS_360,
  TAB_TO_TAB360,
} from './credit/creditUtils';
import RejectionBanner from './credit/RejectionBanner';
import PersonalFastView from './credit/PersonalFastView';

// Maps phaseCompletion keys to the 360 tab IDs used in the section index
const PHASE_TO_SECTION_TAB_360: Record<string, DetailTab360> = {
  s1: 'application-details',
  s2: 'customer-profile',
  s3: 'financial-profile',
  s4: 'risk-assessment',
  s5: 'credit-bureau',
  s6: 'collateral-guarantees',
  s7: 'approvals',
  meta: 'documents',
};

// Section index uses 360 tab IDs
const SECTION_INDEX_TABS_360: DetailTab360[] = [
  'overview', 'customer-profile', 'application-details', 'financial-profile',
  'risk-assessment', 'credit-bureau', 'collateral-guarantees', 'documents', 'approvals', 'conditions-offer', 'disbursement', 'timeline-audit',
];

type SectionStatus = 'complete' | 'in-progress' | 'pending' | 'exception';

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog } = useDirtyFormGuard();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const { flags: featureFlags, isFeatureEnabled } = useCreditFeatureFlags();
  const { lane, reason: laneReason } = useApplicationLane(id);

  useEffect(() => {
    if (searchParams.get('mode') === 'wizard') {
      const clean = new URLSearchParams(searchParams);
      clean.delete('mode');
      setSearchParams(clean, { replace: true });
      toast('Redirected to Classic View — Wizard mode has been retired.', { icon: 'ℹ️' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isNewApplication = searchParams.get('new') === '1';

  const getDefaultTab360 = (state: string): DetailTab360 => {
    if (state === 'COMPLIANCE_HOLD') return 'credit-bureau';
    if (['COMMITTEE_REVIEW', 'REFERRED_BACK', 'ACCEPTED', 'REJECTED'].includes(state)) return 'approvals';
    return 'overview';
  };

  // Resolve activeTab: support both old DetailTab URLs and new DetailTab360 URLs
  // If URL has a legacy tab param, redirect to the 360 equivalent
  const rawTab = searchParams.get('tab') || '';
  const activeTab: DetailTab360 = (() => {
    if (!rawTab) return app ? getDefaultTab360(app.state || app.status || 'DRAFT') : 'overview';
    // Check if it's a 360 tab ID directly
    if (ALL_TABS_360.includes(rawTab as DetailTab360)) return rawTab as DetailTab360;
    // Map legacy tab ID to 360 equivalent
    if (rawTab in TAB_TO_TAB360) return TAB_TO_TAB360[rawTab as DetailTab];
    return 'overview';
  })();

  const setActiveTab = useCallback((tab: DetailTab360) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const advancedMemo = isFeatureEnabled('credit:advanced_memo');
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(isNewApplication);

  const [visibleTabGroups, setVisibleTabGroups] = useState<TabGroup[]>([]);
  const visibleTabs = visibleTabGroups.flatMap(g => g.tabs.map(t => t.id));

  const handleTabChange = useCallback((tab: DetailTab360) => {
    if (isDirty && !confirmTabSwitch()) return;
    setActiveTab(tab);
  }, [isDirty, confirmTabSwitch, setActiveTab]);

  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    errors: { field: string; message: string; severity: string }[];
    warnings: { field: string; message: string; severity: string }[];
    satisfied: { field: string; message: string; severity: string }[];
  } | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [esignReady, setEsignReady] = useState<{ ready: boolean; signedLoo: { id: string; fileName: string; verificationStatus: string } | null } | null>(null);
  const [esignLoading, setEsignLoading] = useState(false);
  const [signoffs, setSignoffs] = useState<ApplicationSignoff[]>([]);
  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const pendingTransitionRef = useRef<string | null>(null);
  const transitionDialogCancelRef = useRef<HTMLButtonElement>(null);
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [showMobileNav, setShowMobileNav] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canApprove = hasPermission(user, 'credit:approve');
  const canAdmin = hasPermission(user, 'credit:admin');

  const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isIdPlaceholder = id === 'new';

  const fetchApp = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      setLoading(true);
      const data = await creditService.getApplication(id);
      setApp(data);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to load application'));
      navigate('/credit/applications');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchTransitions = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      const data = await creditService.getApplicationTransitions(id);
      setTransitions(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load available actions')); }
  }, [id]);

  const fetchFacilities = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      const data = await creditService.listFacilities(id);
      setFacilities(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load facilities')); }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);
  useEffect(() => { if (id) fetchTransitions(); }, [fetchTransitions]);
  useEffect(() => { if (id) fetchFacilities(); }, [fetchFacilities]);

  useEffect(() => {
    if (isIdPlaceholder) setLoading(false);
  }, [isIdPlaceholder]);

  useEffect(() => {
    if (!app) return;
    const st = (app.state || app.status) as ApplicationState;
    setVisibleTabGroups(getVisibleTabGroups(advancedMemo, app.borrowerProfile?.borrowerType ?? null, st, featureFlags, lane as ProcessingLaneType | null));
  }, [app, advancedMemo, featureFlags, lane]);

  useEffect(() => {
    if (!id || !app) return;
    const st = (app.state || app.status) as ApplicationState;
    if (!['CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'UNDERWRITING'].includes(st)) return;
    signoffApi.list(id).then(setSignoffs).catch(() => {});
    creditService.listApprovals(id).then(setApprovals).catch(() => {});
  }, [id, app]);

  const REQUIRED_SIGNOFF_ROLES = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[];
  const allSigned = REQUIRED_SIGNOFF_ROLES.every(
    (role) => signoffs.some((s) => s.role === role && s.signedAt),
  );

  useEffect(() => {
    if (!id || !app) return;
    if ((app.state || app.status) !== 'DRAFT') return;
    setReadinessLoading(true);
    creditService.checkReadiness(id)
      .then(r => setReadiness(r))
      .catch(() => { /* non-critical */ })
      .finally(() => setReadinessLoading(false));
  }, [id, app]);

  useEffect(() => {
    if (!id || !app) return;
    if ((app.state || app.status) !== 'OFFER') return;
    setEsignLoading(true);
    creditService.checkEsignReadiness(id)
      .then(r => setEsignReady(r))
      .catch(() => { /* non-critical */ })
      .finally(() => setEsignLoading(false));
  }, [id, app]);

  useEffect(() => {
    if (showTransitionDialog && transitionDialogCancelRef.current) {
      transitionDialogCancelRef.current.focus();
    }
  }, [showTransitionDialog]);

  const phaseCompletionRef = useRef<Record<string, string>>({});
  const getCompletionStatus = useCallback((tabId: DetailTab): 'complete' | 'partial' | 'empty' => {
    const phaseKey = TAB_TO_PHASE_MAP[tabId];
    if (!phaseKey) return 'empty';
    const status = phaseCompletionRef.current[phaseKey];
    if (status === 'complete') return 'complete';
    if (status === 'incomplete') return 'partial';
    return 'empty';
  }, []);

  const [commentPreviews, setCommentPreviews] = useState<Array<{ id: string; author: string; content: string; timeAgo: string }>>([]);

  const formatTimeAgo = useCallback((date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  useEffect(() => {
    if (!app) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await commentApi.list(app.id, 1);
        if (cancelled) return;
        setCommentPreviews(
          (result.comments || []).slice(0, 3).map((c: any) => ({
            id: c.id,
            author: c.authorName || c.authorId || 'Unknown',
            content: c.content?.slice(0, 120) || '',
            timeAgo: c.createdAt ? formatTimeAgo(new Date(c.createdAt)) : '',
          }))
        );
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [app?.id, formatTimeAgo]);

  const handleTransition = async (action: string) => {
    if (!id) return;
    const t = transitions.find(tr => tr.action === showTransitionDialog);
    if (t?.requiresComment && !transitionReason.trim()) {
      setReasonError(true);
      return;
    }
    try {
      setTransitioning(true);
      await creditService.transitionApplication(id, { action, reason: transitionReason || undefined });
      toast.success('Application transitioned successfully');
      setTransitionReason('');
      setReasonError(false);
      setShowTransitionDialog(null);
      transitionTriggerRef.current?.focus();
      fetchApp();
      fetchTransitions();
      setReadiness(null);
      setEsignReady(null);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to transition application')); }
    finally { setTransitioning(false); }
  };

  const handleDownloadCaMemo = async () => {
    if (!app) return;
    try {
      const { jobId } = await creditService.downloadCaMemo(app.id);
      const url = await pollPdfJob(jobId);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CA-Memo-${app.applicationNo || app.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CA Memo downloaded');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to export CA Memo'));
    }
  };

  // Sprint 4 — Application Summary PDF export (via approval pack endpoint)
  const handleDownloadSummaryPdf = async () => {
    if (!app) return;
    try {
      const { enqueueAndWaitForPdf } = await import('../src/services/pdfJob.service');
      const url = await enqueueAndWaitForPdf(
        (async () => {
          const res = await import('../src/services/api').then(m => m.default.get(
            `/credit/applications/${app.id}/approval-pack?format=pdf`,
          ));
          return { jobId: res.data.data.jobId as string };
        })(),
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Application-Summary-${app.applicationNo || app.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Application Summary PDF downloaded');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to export application summary'));
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: DetailTab360) => {
    const visible360Tabs = TAB_GROUPS_360.flatMap(g => g.tabs.map(t => t.id as DetailTab360));
    const idx = visible360Tabs.indexOf(tab);
    if (idx === -1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = visible360Tabs[(idx + 1) % visible360Tabs.length];
      handleTabChange(next);
      document.getElementById(`tab-${next}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = visible360Tabs[(idx - 1 + visible360Tabs.length) % visible360Tabs.length];
      handleTabChange(prev);
      document.getElementById(`tab-${prev}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleTabChange(visible360Tabs[0]);
      document.getElementById(`tab-${visible360Tabs[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      handleTabChange(visible360Tabs[visible360Tabs.length - 1]);
      document.getElementById(`tab-${visible360Tabs[visible360Tabs.length - 1]}`)?.focus();
    }
  };

  // ── Handle note submission from NotesWidget ──
  const handleAddNote = useCallback(async (text: string) => {
    if (!app) return;
    try {
      await commentApi.create(app.id, { content: text });
      // Refresh comment previews
      const result = await commentApi.list(app.id, 1);
      setCommentPreviews(
        (result.comments || []).slice(0, 3).map((c: any) => ({
          id: c.id,
          author: c.authorName || c.authorId || 'Unknown',
          content: c.content?.slice(0, 120) || '',
          timeAgo: c.createdAt ? formatTimeAgo(new Date(c.createdAt)) : '',
        }))
      );
    } catch { /* best-effort */ }
  }, [app?.id, formatTimeAgo]);

  // ── Early returns ──
  if (isIdPlaceholder) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }} className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">New Credit Application</h2>
        <p className="text-gray-600 mb-6">You&#39;ll be redirected to the application list to create a new application.</p>
        <button
          type="button"
          onClick={() => navigate('/credit/applications')}
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Go to Applications
        </button>
      </div>
    );
  }

  if (loading) return (
    <div aria-busy="true" style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ height: 20, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  if (!app) return null;

  const currentState = (app.state || app.status) as ApplicationState;
  const badge = STATE_COLORS[currentState] || STATE_COLORS.DRAFT;

  const phaseCompletion = getPhaseCompletion({
    requestedAmount: app.requestedAmount,
    requestedTenor: app.requestedTenor,
    productType: app.productType as string | null,
    purpose: app.purpose,
    borrowerType: app.borrowerProfile?.borrowerType ?? null,
    registrationNumber: null,
    riskRating: app.riskRating,
    scoreRunCount: app.scoreRunCount,
    latestScoreRunAt: app.latestScoreRunAt,
    latestScoreRunStatus: app.latestScoreRunStatus,
    firstWayOut: app.firstWayOut,
    preparedAt: app.preparedAt,
    decisionedAt: app.decisionedAt,
    facilities: facilities,
    parties: app.parties,
    financialStatements: app.borrowerProfile?.financialStatements ?? [],
    creditBureauChecks: (app as any).creditBureauChecks ?? [],
    retailIncome: (app as any).retailIncome ?? null,
    bureauChecklist: (app as any).bureauChecklist ?? null,
    isSecured: ((app as any).collateralItems?.length ?? 0) > 0 || SECURED_PRODUCTS.includes(app.productType as string),
  });
  phaseCompletionRef.current = phaseCompletion;
  const incompleteCount = getIncompletePhaseCount(phaseCompletion);

  const requiredPhases = Object.values(phaseCompletion).filter(s => s !== 'optional');
  const completedPhases = requiredPhases.filter(s => s === 'complete').length;
  const progressPct = requiredPhases.length > 0 ? Math.round((completedPhases / requiredPhases.length) * 100) : 0;
  const progressColor = progressPct > 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626';

  // ── Application 360 derived data ──
  const segment = getBorrowerSegment(app.borrowerProfile?.borrowerType);
  const journeyStageIndex = getJourneyStage(currentState);

  // SLA days remaining
  const slaDaysLeft = (() => {
    if (!app?.createdAt) return null;
    const created = new Date(app.createdAt);
    const slaTarget = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    return Math.ceil((slaTarget.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  })();

  // Critical alerts (kept for mobile fallback)
  const criticalAlerts: AlertItem[] = (() => {
    const alerts: AlertItem[] = [];
    if (readiness?.errors) {
      readiness.errors.forEach((e, i) => {
        alerts.push({
          id: `readiness-${i}`,
          severity: 'error',
          icon: 'notification_important',
          title: e.message.slice(0, 60),
          description: e.field || '',
          action: { label: 'Fix now', tab: 'loan-request' },
        });
      });
    }
    if (slaDaysLeft !== null && slaDaysLeft <= 2) {
      alerts.push({
        id: 'sla-overdue',
        severity: slaDaysLeft <= 0 ? 'error' : 'warning',
        icon: 'event_busy',
        title: slaDaysLeft <= 0 ? 'SLA Overdue' : 'SLA Expiring Soon',
        description: slaDaysLeft <= 0 ? 'Application is past SLA target' : `Only ${slaDaysLeft} day${slaDaysLeft !== 1 ? 's' : ''} remaining`,
        action: { label: 'View details', tab: 'approvals' },
      });
    }
    if (incompleteCount > 0 && currentState === 'DRAFT') {
      alerts.push({
        id: 'incomplete-sections',
        severity: 'warning',
        icon: 'assignment_late',
        title: `${incompleteCount} section${incompleteCount !== 1 ? 's' : ''} incomplete`,
        description: 'Complete all sections before submitting',
      });
    }
    return alerts;
  })();

  // Next incomplete tab
  const nextIncompleteTab = getNextIncompleteTab(phaseCompletion, currentState);
  const nextIncompleteGroup = visibleTabGroups.find(g => g.tabs.some(t => t.id === nextIncompleteTab));
  const nextIncompleteTabLabel = nextIncompleteGroup?.tabs.find(t => t.id === nextIncompleteTab)?.label || '';
  const nextIncompleteGroupLabel = nextIncompleteGroup?.label || '';

  // ── Section statuses for ApplicationSectionIndex (360 tab IDs) ──
  const sectionStatuses: Record<string, SectionStatus> = {};
  for (const tabId of SECTION_INDEX_TABS_360) {
    if (tabId === 'overview') {
      sectionStatuses[tabId] = progressPct === 100 ? 'complete' : progressPct > 0 ? 'in-progress' : 'pending';
    } else if (tabId === 'conditions-offer') {
      sectionStatuses[tabId] = currentState === 'APPROVED' || currentState === 'OFFER' || currentState === 'ACCEPTED' ? 'in-progress' : 'pending';
    } else if (tabId === 'timeline-audit') {
      sectionStatuses[tabId] = 'pending'; // audit is always informational
    } else {
      // Map 360 tabId back to phase key
      const phaseKey = Object.entries(PHASE_TO_SECTION_TAB_360).find(([, v]) => v === tabId)?.[0];
      if (phaseKey) {
        const s = phaseCompletion[phaseKey];
        if (s === 'complete') sectionStatuses[tabId] = 'complete';
        else if (s === 'incomplete') sectionStatuses[tabId] = 'in-progress';
        else sectionStatuses[tabId] = s === 'optional' ? 'complete' : 'pending';
      } else {
        sectionStatuses[tabId] = 'pending';
      }
    }
  }

  // Next required action text for StatusWidget
  const nextRequiredAction = (() => {
    if (nextIncompleteTab && nextIncompleteTabLabel) return `Complete: ${nextIncompleteTabLabel}`;
    if (currentState === 'DRAFT') return 'Complete all sections to submit';
    return null;
  })();

  // ── Render tab by 360 ID ──────────────────────────────────
  // Each 360 tab now renders its merged component directly.
  // Sprint 4: SectionCompletionHeader wraps each tab to show completion status.
  const renderTabWithHeader = (tabId: DetailTab360, phaseKey: string, title: string, content: React.ReactNode): React.ReactNode => {
    const phaseStatus = phaseCompletion[phaseKey] as CompletionStatus | undefined;
    if (!phaseStatus || tabId === 'overview' || tabId === 'timeline-audit' || tabId === 'disbursement') {
      return content;
    }
    const blockers = (readiness?.errors ?? []).map(e => `${e.field}: ${e.message}`);
    return (
      <>
        <SectionCompletionHeader
          title={title}
          status={phaseStatus}
          blockers={phaseStatus === 'blocked' || phaseStatus === 'incomplete' ? blockers.slice(0, 3) : []}
        />
        {content}
      </>
    );
  };

  const renderTab = (tabId: DetailTab360): React.ReactNode => {
    switch (tabId) {
      case 'overview': return (
        <ApplicationOverviewTab
          app={app!}
          facilities={facilities}
          readiness={readiness}
          slaDaysLeft={slaDaysLeft}
          formatTimeAgo={formatTimeAgo}
          onNavigate={(tab) => { const t360 = (TAB_TO_TAB360[tab as DetailTab] ?? tab) as DetailTab360; handleTabChange(t360); }}
          transitions={transitions}
          currentState={currentState}
          phaseCompletion={phaseCompletion}
          commentPreviews={commentPreviews}
          onAddNote={() => handleTabChange('timeline-audit')}
          onOpenComments={() => handleTabChange('timeline-audit')}
          nextTab={nextIncompleteTab}
          nextGroupLabel={nextIncompleteGroupLabel}
          nextTabLabel={nextIncompleteTabLabel}
          assigneeName={app!.rm?.firstName ? `${app!.rm.firstName} ${app!.rm.lastName}` : app!.analyst?.firstName ? `${app!.analyst.firstName} ${app!.analyst.lastName}` : undefined}
          urgency={(() => {
            if (slaDaysLeft !== null && slaDaysLeft <= 2) return 'urgent' as const;
            if (slaDaysLeft !== null && slaDaysLeft <= 5) return 'warning' as const;
            return 'normal' as const;
          })()}
          progressPct={progressPct}
          documentReadinessPct={(() => {
            if (readiness) {
              const total = readiness.errors.length + readiness.warnings.length + (readiness.satisfied?.length ?? 0);
              if (total === 0) return 100;
              return Math.round(((readiness.satisfied?.length ?? 0) / total) * 100);
            }
            const docCount = (app as any).documents?.length ?? 0;
            return docCount > 0 ? Math.min(100, 50 + docCount * 10) : 30;
          })()}
          workflowVelocityPct={(() => {
            if (!app.createdAt) return 50;
            const created = new Date(app.createdAt);
            const elapsedDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
            const slaDays = 14;
            if (elapsedDays > slaDays) return Math.max(10, 100 - Math.round(((elapsedDays - slaDays) / slaDays) * 50));
            return Math.round(100 - (elapsedDays / slaDays) * 100);
          })()}
        />
      );
      case 'customer-profile': return renderTabWithHeader('customer-profile', 's2', 'Customer Profile', <CustomerProfileTab application={app!} fatcaCrsEnabled={isFeatureEnabled(FATCA_CRS_FLAG)} lane={lane} />);
      case 'application-details': return renderTabWithHeader('application-details', 's1', 'Application Details', <ApplicationDetailsTab application={app!} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} advancedMemo={advancedMemo} />);
      case 'financial-profile': return renderTabWithHeader('financial-profile', 's3', 'Financial Profile', <FinancialProfileTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />);
      case 'credit-bureau': return renderTabWithHeader('credit-bureau', 's5', 'Credit Bureau & Compliance', <CreditBureauComplianceTab application={app!} onUpdated={setApp} />);
      case 'risk-assessment': return renderTabWithHeader('risk-assessment', 's4', 'Risk Assessment', <RiskAssessmentTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} onRefresh={fetchApp} isFeatureEnabled={isFeatureEnabled} />);
      case 'collateral-guarantees': return renderTabWithHeader('collateral-guarantees', 's6', 'Collateral & Guarantees', <CollateralGuaranteesTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />);
      case 'documents': return renderTabWithHeader('documents', 'meta', 'Documents', <DocumentsTab app={app!} canApprove={canApprove} />);
      case 'approvals': return renderTabWithHeader('approvals', 's7', 'Approvals', <ApprovalsTab360 app={app!} onRefresh={fetchApp} onUpdated={setApp} />);
      case 'conditions-offer': return <ConditionsOfferTab app={app!} facilities={facilities} onRefresh={fetchApp} onUpdated={(updated) => setApp(updated)} />;
      case 'disbursement': return <DisbursementTab application={app!} onUpdated={(updated) => setApp(updated)} />;
      case 'timeline-audit': return <TimelineAuditTab applicationId={app!.id} />;
      default: return null;
    }
  };

  // ── Notes for ApplicationNotesWidget ──
  const notesForWidget = commentPreviews.map(c => ({
    id: c.id,
    author: c.author,
    text: c.content,
    createdAt: new Date().toISOString(), // approximate — real timestamp comes from API
  }));

  return (
    <>
      <a href="#credit-detail-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-3 focus:py-1 focus:bg-blue-600 focus:text-white focus:rounded focus:text-sm focus:font-bold">
        Skip to content
      </a>

      {/* ── Application 360 Workspace — 3-column layout ── */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden credit-module">

        {/* ── Left Sidebar: Section Index (240px) ── */}
        <ApplicationSectionIndex
          activeTab={activeTab}
          onTabChange={handleTabChange}
          sectionStatuses={sectionStatuses}
        />

        {/* ── Center Column: Workspace ── */}
        <main className="flex-1 overflow-y-auto cr-scroll" style={{ backgroundColor: 'var(--cr-surface-bright, #fff)' }}>
          <div className="mx-auto max-w-[1680px]">
          {/* Sticky Header (56px) */}
          <ApplicationWorkspaceHeader
            app={app}
            currentState={currentState}
            transitions={transitions}
            canWrite={canWrite}
            canAdmin={canAdmin}
            allSigned={allSigned}
            signoffs={signoffs}
            esignReady={esignReady}
            segment={segment}
            onShowTransitionDialog={(action) => {
              const t = transitions.find(tr => tr.action === action);
              const isSubmitAction = currentState === 'DRAFT' || currentState === 'REFERRED_BACK' || action === 'submit_to_committee';
              if (isSubmitAction && incompleteCount > 0) {
                pendingTransitionRef.current = action;
                setReadinessModalOpen(true);
                return;
              }
              setShowTransitionDialog(action);
            }}
            onExportCaMemo={handleDownloadCaMemo}
            onExportSummaryPdf={handleDownloadSummaryPdf}
          />

          {/* P2-4: Score outdated banner */}
          <ScoreOutdatedBanner applicationId={app.id} />

          {/* §2.7 — Rejection Banner */}
          <RejectionBanner
            applicationId={app.id}
            state={currentState}
            rejectionReasonCode={(app as any).rejectionReasonCode}
            rejectionReason={app.rejectionReason}
            applicationNo={app.applicationNo ?? undefined}
          />

          {/* ── KPI Row (8 cards) ── */}
          <div style={{ padding: '16px 24px 0' }}>
            <ApplicationKpiRow app={app} segment={segment} />
          </div>

          {/* ── Journey Stepper (11 stages) ── */}
          <div style={{ padding: '12px 24px 0' }}>
            <ApplicationJourneyStepper
              currentStageIndex={journeyStageIndex}
              onStageClick={(stage) => handleTabChange(stage.targetTab)}
            />
          </div>

          {/* ── Horizontal Tabs ── */}
          {lane !== 'PERSONAL_FAST' && (
            <ApplicationHorizontalTabs
              visibleTabGroups={TAB_GROUPS_360}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              phaseCompletion={phaseCompletion}
              documentCount={(app as any).documents?.length}
            />
          )}

          {/* ── Tab Content ── */}
          <div className="p-6">
            {showOnboardingBanner && currentState === 'DRAFT' && (
              <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800 mb-1">Application created — complete all 7 sections to submit</p>
                  <p className="text-xs text-blue-700">
                    Start with <strong>S1 Loan Request</strong> (already pre-filled), then work through S2–S7.
                    When all sections are green, use <strong>Submit for KYC Review</strong> in the header.
                  </p>
                </div>
                <button
                  onClick={() => setShowOnboardingBanner(false)}
                  aria-label="Dismiss"
                  className="text-blue-400 hover:text-blue-600 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            )}

            {currentState === 'ACTIVE' && (
              <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800 mb-1">This loan is currently active</p>
                  <p className="text-xs text-blue-700">
                    The borrower has received funds and the facility is in use. Close this application only when the loan has been <strong>fully repaid, written off, or formally terminated</strong>.
                  </p>
                </div>
              </div>
            )}
            {currentState === 'CLOSED' && (
              <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <span className="material-symbols-outlined text-gray-500 text-xl mt-0.5">lock</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">This loan has been closed</p>
                  <p className="text-xs text-gray-600">
                    The loan lifecycle is complete. No further actions can be taken on this application.
                    {app.closedAt && <> Closed on <strong>{new Date(app.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.</>}
                  </p>
                </div>
              </div>
            )}

            {currentState === 'DRAFT' && (readiness || readinessLoading) && (
              <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--cr-outline)' }}>checklist</span>
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--cr-outline)' }}>Submission Readiness</h3>
                  {readinessLoading && <span className="text-xs ml-auto" style={{ color: 'var(--cr-outline)' }}>Checking…</span>}
                  {!readinessLoading && readiness && (
                    <span className={`text-xs font-bold ml-auto px-2 py-0.5 rounded-full ${readiness.ready ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
                      {readiness.ready ? 'Ready to submit' : `${readiness.errors.length} issue${readiness.errors.length !== 1 ? 's' : ''} blocking`}
                    </span>
                  )}
                </div>
                {readiness && (
                  <ul className="space-y-1.5">
                    {readiness.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">cancel</span>
                        {e.message}
                      </li>
                    ))}
                    {readiness.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">warning</span>
                        {w.message}
                      </li>
                    ))}
                    {readiness.satisfied?.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">verified</span>
                        {s.message}
                      </li>
                    ))}
                    {readiness.ready && readiness.warnings.length === 0 && (readiness.satisfied?.length ?? 0) === 0 && (
                      <li className="flex items-center gap-2 text-xs text-green-700">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        All checks passed — application is ready to submit.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {/* P2-2: Personal Fast — single scrollable view */}
            {lane === 'PERSONAL_FAST' ? (
              <PersonalFastView
                app={app}
                lane={lane}
                laneReason={laneReason}
                onUpdated={(updated) => setApp(updated)}
                onDirtyChange={setDirty}
                onRefresh={fetchApp}
                setApp={setApp}
                canApprove={canApprove}
                isFeatureEnabled={isFeatureEnabled}
                signoffs={signoffs}
                allSigned={allSigned}
                approvals={approvals}
                onNavigate={(tab) => handleTabChange(tab as DetailTab360)}
              />
            ) : (
            <div id="credit-detail-content">
              {renderTab(activeTab)}
            </div>
            )}
          </div>
          </div>{/* /max-w container */}
        </main>

        {/* ── Right Sidebar: 6 Application 360 Widgets ── */}
        <aside
          className="hidden xl:flex flex-col w-80 shrink-0 overflow-y-auto cr-scroll"
          style={{
            backgroundColor: 'var(--cr-surface-container-lowest)',
            borderLeft: '1px solid var(--cr-outline-variant)',
          }}
        >
          <ApplicationStatusWidget
            currentState={currentState}
            nextRequiredAction={nextRequiredAction}
          />

          <ApplicationSlaWidget
            slaDaysLeft={slaDaysLeft}
            createdAt={app.createdAt ?? null}
          />

          <ApplicationTeamWidget
            app={app}
            onAssign={(field: string) => {
              // Navigate to borrower-profile tab for assignment changes
              handleTabChange('customer-profile');
            }}
          />

          <ApplicationPendingTasks
            app={app}
            onNavigate={(targetTab) => handleTabChange(targetTab as DetailTab360)}
          />

          <ApplicationCustomerInsights
            app={app}
            segment={segment}
          />

          <ApplicationNotesWidget
            notes={notesForWidget}
            onAddNote={handleAddNote}
            onViewAll={() => handleTabChange('timeline-audit')}
          />
        </aside>
      </div>

      {/* ── Mobile bottom panels (shown below content on small screens) ── */}
      <div className="lg:hidden p-4 space-y-4" style={{ backgroundColor: 'var(--cr-surface-bright, #fff)' }}>
        <ApplicationStatusWidget
          currentState={currentState}
          nextRequiredAction={nextRequiredAction}
        />
        <ApplicationSlaWidget
          slaDaysLeft={slaDaysLeft}
          createdAt={app.createdAt ?? null}
        />
        {criticalAlerts.length > 0 && (
          <ApplicationAlertsPanel
            alerts={criticalAlerts}
            onNavigate={(tab) => handleTabChange(tab as DetailTab360)}
          />
        )}
      </div>

      {/* ── Transition Dialog ── */}
      {showTransitionDialog && (() => {
        const t = transitions.find(tr => tr.action === showTransitionDialog);
        const isReject = t?.toState === 'REJECTED' || t?.toState === 'KYC_REJECTED' || t?.toState === 'WITHDRAWN';
        const label = t?.label || showTransitionDialog.replace(/_/g, ' ');
        return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => { setShowTransitionDialog(null); transitionTriggerRef.current?.focus(); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transition-dialog-title"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') { setShowTransitionDialog(null); setTransitionReason(''); setReasonError(false); transitionTriggerRef.current?.focus(); } }}>
            <h2 id="transition-dialog-title" className="text-lg font-black text-text-primary mb-2">
              {showTransitionDialog === 'close' ? 'Close This Loan?' : 'Confirm Action'}
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              {showTransitionDialog === 'close' ? (
                <>You are about to permanently close this loan application. This <strong>cannot be undone</strong>.</>
              ) : (
                <>
                  Are you sure you want to <span className="font-bold text-text-primary">{label}</span>?
                  {t && <span className="block mt-1 text-xs text-text-secondary">This will change the application status to <span className="font-semibold">{STATE_LABELS[t.toState] || t.toState}</span>.</span>}
                </>
              )}
            </p>

            {showTransitionDialog === 'submit_to_committee' && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">CA Memo Sign-off Status</p>
                <div className="space-y-1.5">
                  {(['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[]).map(role => {
                    const roleLabel = role === 'PREPARED_BY' ? 'Prepared By' : role === 'REVIEWED_BY' ? 'Reviewed By' : 'Concurred By';
                    const s = signoffs.find(sf => sf.role === role);
                    const signed = !!s?.signedAt;
                    return (
                      <div key={role} className="flex items-center gap-2 text-xs">
                        <span className={`material-symbols-outlined text-sm ${signed ? 'text-green-600' : 'text-gray-300'}`}>
                          {signed ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={signed ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                          {roleLabel}
                        </span>
                        {signed && s && (
                          <span className="text-gray-400">
                            — {s.signedBy ? `${s.signedBy.firstName} ${s.signedBy.lastName}` : 'Signed'}
                          </span>
                        )}
                        {!signed && (
                          <span className="text-gray-400 italic">(pending)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!allSigned && (
                  <p className="mt-2 text-xs text-red-600 font-medium">
                    All sign-offs must be complete before submitting to Committee Review.
                  </p>
                )}
              </div>
            )}

            {showTransitionDialog === 'close' && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">This action is irreversible</p>
                <p className="text-xs text-amber-700 mb-2">Closing this loan will:</p>
                <ul className="space-y-1 text-xs text-amber-800">
                  <li className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                    Mark the loan lifecycle as complete
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                    Remove this facility from active exposure tracking
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                    Stop all monitoring (collateral, insurance, covenants)
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                    Set the application to read-only — no further actions possible
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                    Record the closure date (today)
                  </li>
                </ul>
                <p className="mt-2 text-xs text-amber-700">
                  Only close when the loan has been <strong>fully repaid, written off, or formally terminated</strong>.
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Reason {t?.requiresComment ? <span className="text-red-500">*</span> : <span className="text-text-tertiary">(optional)</span>}
              </label>
              <textarea rows={2} value={transitionReason} onChange={e => { setTransitionReason(e.target.value); setReasonError(false); }}
                placeholder={t?.requiresComment
                  ? (showTransitionDialog === 'close' ? 'e.g. Fully repaid, Written off, Early settlement...' : 'A reason is required for this action...')
                  : 'Add a reason or note...'}
                className={`w-full border rounded-lg px-3 py-2 text-sm resize-none ${t?.requiresComment && !transitionReason.trim() ? 'border-red-300' : 'border-border'}`} style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              {t?.requiresComment && reasonError && !transitionReason.trim() && (
                <p className="text-xs text-red-600 mt-1 font-medium">Reason is required for this action</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button ref={transitionDialogCancelRef} onClick={() => { setShowTransitionDialog(null); setTransitionReason(''); setReasonError(false); transitionTriggerRef.current?.focus(); }}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={() => handleTransition(showTransitionDialog)} disabled={transitioning || (t?.requiresComment && !transitionReason.trim()) || (showTransitionDialog === 'submit_to_committee' && !allSigned)}
                className={`px-4 py-2 text-sm font-bold rounded-lg text-white transition-colors disabled:opacity-50 ${
                  showTransitionDialog === 'close' ? 'bg-amber-600 hover:bg-amber-700' :
                  isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'
                }`}
                title={showTransitionDialog === 'submit_to_committee' && !allSigned ? 'Complete all CA Memo sign-offs first' : undefined}
                style={{ border: 'none', cursor: showTransitionDialog === 'submit_to_committee' && !allSigned ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {transitioning ? 'Processing...' : showTransitionDialog === 'close' ? 'Close Loan →' : label}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Readiness Checklist Modal */}
      <ReadinessChecklistModal
        open={readinessModalOpen}
        onClose={() => { setReadinessModalOpen(false); pendingTransitionRef.current = null; }}
        phaseCompletion={phaseCompletion}
        onSubmitAnyway={() => {
          const action = pendingTransitionRef.current;
          setReadinessModalOpen(false);
          pendingTransitionRef.current = null;
          if (action) {
            setShowTransitionDialog(action);
          }
        }}
        onNavigateToSection={(tabId) => {
          handleTabChange(tabId as DetailTab360);
        }}
      />
      {DirtyGuardDialog}
    </>
  );
};

export default CreditApplicationDetail;