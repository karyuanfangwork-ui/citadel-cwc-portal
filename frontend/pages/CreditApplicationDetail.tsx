import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, CreditApproval, ApplicationTransition, ApplicationState, ApplicationSignoff, SubmissionReadinessResult, signoffApi, dashboardApi, commentApi,
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
import ApplicationJourneyStepper from '../src/components/credit/detail/ApplicationJourneyStepper';
import ApplicationWorkspaceNavigation from '../src/components/credit/detail/ApplicationWorkspaceNavigation';
import ApplicationPartiesWorkspace from '../src/components/credit/detail/ApplicationPartiesWorkspace';
import FinancialsWorkspace from '../src/components/credit/detail/FinancialsWorkspace';
import RiskComplianceWorkspace from '../src/components/credit/detail/RiskComplianceWorkspace';
import AssessmentRecommendationWorkspace from '../src/components/credit/detail/AssessmentRecommendationWorkspace';
import DecisionCompletionWorkspace from '../src/components/credit/detail/DecisionCompletionWorkspace';
import {
  APPLICATION_WORKSPACE_AREAS,
  resolveWorkspaceAreaFromTab,
  resolveWorkspaceLocationFromQuery,
  ApplicationWorkspaceArea,
} from '../src/components/credit/detail/applicationWorkspaceAreas';
import ApplicationStatusWidget from '../src/components/credit/detail/ApplicationStatusWidget';
import ApplicationSlaWidget from '../src/components/credit/detail/ApplicationSlaWidget';
import ApplicationTeamWidget from '../src/components/credit/detail/ApplicationTeamWidget';
import SectionCompletionHeader, { CompletionStatus, CompletionItem } from '../src/components/credit/detail/SectionCompletionHeader';

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
import CaMemoPreviewTab from './credit/tabs/CaMemoPreviewTab';

import SnapshotBanner from '../src/components/credit/SnapshotBanner';
import { useApplicationSnapshot } from '../src/hooks/useApplicationSnapshot';

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
  getApplicationLifecycleState,
  // ── Application 360 Tab System ──
  DetailTab360,
  TAB_TO_TAB360,
} from './credit/creditUtils';
import RejectionBanner from './credit/RejectionBanner';
import PersonalFastView from './credit/PersonalFastView';
import { buildApplicationReadinessViewModel } from '../src/components/credit/detail/applicationReadinessViewModel';

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog } = useDirtyFormGuard();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const { flags: featureFlags, integrations, isFeatureEnabled } = useCreditFeatureFlags();
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
  const facilityCreationFailed = searchParams.get('facility') === 'failed';

  const getDefaultTab360 = (state: string): DetailTab360 => {
    if (state === 'COMPLIANCE_HOLD') return 'credit-bureau';
    if (['COMMITTEE_REVIEW', 'REFERRED_BACK', 'ACCEPTED', 'REJECTED'].includes(state)) return 'approvals';
    return 'overview';
  };

  // Resolve activeTab: support both old DetailTab URLs and new DetailTab360 URLs
  // If URL has a legacy tab param, redirect to the 360 equivalent
  const rawTab = searchParams.get('tab') || '';
  const rawArea = searchParams.get('area');
  const tabLocation = resolveWorkspaceLocationFromQuery(rawTab, rawArea);
  const activeTab: DetailTab360 = rawTab
    ? tabLocation.tab
    : app
      ? getDefaultTab360(app.state || app.status || 'DRAFT')
      : 'overview';
  const activeArea = rawTab || rawArea
    ? tabLocation.area
    : resolveWorkspaceAreaFromTab(activeTab);
  const activeLocalTab = tabLocation.localTab;

  const setActiveTab = useCallback((tab: DetailTab360 | string) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      prev.set('area', resolveWorkspaceAreaFromTab(tab));
      return prev;
    });
  }, [setSearchParams]);

  const advancedMemo = isFeatureEnabled('credit:advanced_memo');
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(isNewApplication);

  const [visibleTabGroups, setVisibleTabGroups] = useState<TabGroup[]>([]);
  const visibleTabs = visibleTabGroups.flatMap(g => g.tabs.map(t => t.id));

  const handleTabChange = useCallback((tab: DetailTab360) => {
    if (isDirty && !confirmTabSwitch()) return;
    setActiveTab(tab);
  }, [isDirty, confirmTabSwitch, setActiveTab]);

  const handleAreaChange = useCallback((area: { id: ApplicationWorkspaceArea; defaultTab: DetailTab360 }) => {
    if (isDirty && !confirmTabSwitch()) return;
    const firstLocalTab = APPLICATION_WORKSPACE_AREAS.find(candidate => candidate.id === area.id)?.localTabs[0];
    setSearchParams(prev => {
      prev.set('area', area.id);
      prev.set('tab', firstLocalTab?.urlTab ?? area.defaultTab);
      return prev;
    });
  }, [isDirty, confirmTabSwitch, setSearchParams]);

  const handleWorkspaceTabChange = useCallback((tab: string) => {
    if (isDirty && !confirmTabSwitch()) return;
    setSearchParams(prev => {
      prev.set('area', activeArea);
      prev.set('tab', tab);
      return prev;
    });
  }, [activeArea, isDirty, confirmTabSwitch, setSearchParams]);

  const handleWorkspaceDestination = useCallback((area: ApplicationWorkspaceArea, tab: string) => {
    if (isDirty && !confirmTabSwitch()) return;
    setSearchParams(prev => {
      prev.set('area', area);
      prev.set('tab', tab);
      return prev;
    });
  }, [isDirty, confirmTabSwitch, setSearchParams]);

  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [readiness, setReadiness] = useState<SubmissionReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
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
  const readinessRequestRef = useRef(0);
  const transitionDialogCancelRef = useRef<HTMLButtonElement>(null);
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null);

  // CA-P1-004 — keep the snapshot decision at the single application-object swap point.
  const snapshotView = useApplicationSnapshot(
    app?.id ?? '',
    (app?.state ?? (app as any)?.status ?? null) as string | null,
    app as CreditApplication,
  );

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

  const fetchReadiness = useCallback(async () => {
    if (!id || !app) return;
    const state = (app.state || app.status) as ApplicationState;
    const terminalState = ['ACTIVE', 'CLOSED', 'WITHDRAWN'].includes(state);
    if (terminalState) {
      setReadiness(null);
      setReadinessError(null);
      setReadinessLoading(false);
      return;
    }

    setReadinessLoading(true);
    setReadinessError(null);
    const requestId = ++readinessRequestRef.current;
    try {
      const result = await creditService.checkReadiness(id);
      if (requestId !== readinessRequestRef.current) return;
      setReadiness(result);
    } catch (error) {
      if (requestId !== readinessRequestRef.current) return;
      console.error('Failed to load application readiness', error);
      setReadiness(null);
      setReadinessError('Readiness request failed');
    } finally {
      if (requestId === readinessRequestRef.current) setReadinessLoading(false);
    }
  }, [id, app?.id, app?.state, app?.status]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness, activeTab]);

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
      toast.success(action === 'submit' ? 'Application submitted — next stage: KYC Review' : 'Application transitioned successfully');
      setTransitionReason('');
      setReasonError(false);
      setShowTransitionDialog(null);
      transitionTriggerRef.current?.focus();
      fetchApp();
      fetchTransitions();
      setReadiness(null);
      setReadinessError(null);
      setEsignReady(null);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to transition application'));
      if ((action === 'submit' || action === 'resubmit') && id) {
        creditService.checkReadiness(id).then(result => {
          setReadiness(result);
          setReadinessError(null);
        }).catch(() => setReadinessError('Readiness request failed'));
      }
    }
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
    const visible360Tabs = visibleTabGroups.flatMap(g => g.tabs.map(t => t.id as DetailTab360));
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
    lane: app.lane ?? null,
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
  const lifecycleState = getApplicationLifecycleState(currentState);
  const readinessViewModel = buildApplicationReadinessViewModel({
    applicationState: currentState,
    readiness,
    readinessLoading,
    readinessError,
  });

  // SLA days remaining — use backend-provided target when available
  const slaDaysLeft = (() => {
    if (app?.slaDueAt) {
      return Math.ceil((new Date(app.slaDueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
    if (!app?.createdAt) return null;
    const created = new Date(app.createdAt);
    const fallbackHours = app.slaTargetHours ?? 14 * 24;
    const slaTarget = new Date(created.getTime() + fallbackHours * 60 * 60 * 1000);
    return Math.ceil((slaTarget.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  })();

  // Critical alerts (kept for mobile fallback)
  const criticalAlerts: AlertItem[] = (() => {
    const alerts: AlertItem[] = [];
    if (readinessViewModel.blockers.length > 0) {
      readinessViewModel.blockers.forEach((blocker, i) => {
        alerts.push({
          id: `readiness-${i}`,
          severity: 'error',
          icon: 'notification_important',
          title: blocker.title,
          description: blocker.description || '',
          action: blocker.targetArea && blocker.targetLocalTab
            ? { label: 'Fix now', tab: blocker.targetLocalTab, area: blocker.targetArea }
            : undefined,
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
    return alerts;
  })();

  // Next incomplete tab
  const nextIncompleteTab = getNextIncompleteTab(phaseCompletion, currentState);
  const nextIncompleteGroup = visibleTabGroups.find(g => g.tabs.some(t => t.id === nextIncompleteTab));
  const nextIncompleteTabLabel = nextIncompleteGroup?.tabs.find(t => t.id === nextIncompleteTab)?.label || '';
  const nextIncompleteGroupLabel = nextIncompleteGroup?.label || '';

  // ── Render tab by 360 ID ──────────────────────────────────
  // Each 360 tab now renders its merged component directly.
  // Sprint 4: SectionCompletionHeader wraps each tab to show completion status.
  const renderTabWithHeader = (tabId: DetailTab360, phaseKey: string, title: string, content: React.ReactNode): React.ReactNode => {
    const phaseStatus = phaseCompletion[phaseKey] as CompletionStatus | undefined;
    if (!phaseStatus || tabId === 'overview' || tabId === 'timeline-audit' || tabId === 'disbursement') {
      return content;
    }
    const blockers = (readiness?.errors ?? []).map(e => `${e.field}: ${e.message}`);

    // For s1 (Application Details), show a field-level checklist so the user knows exactly what's missing
    let items: CompletionItem[] | undefined;
    if (phaseKey === 's1' && phaseStatus === 'incomplete') {
      const hasVal = (v: unknown) => v != null && String(v).trim() !== '';
      items = [
        { label: 'Requested Amount', status: hasVal(app?.requestedAmount) ? 'done' : 'missing' },
        { label: 'Tenor', status: hasVal(app?.requestedTenor) ? 'done' : 'missing' },
        { label: 'Product Type', status: hasVal(app?.productType) ? 'done' : 'missing' },
        { label: 'Purpose', status: hasVal(app?.purpose) ? 'done' : 'missing' },
        { label: 'Facility added', status: facilities.length > 0 ? 'done' : 'missing' },
      ];
    }

    return (
      <>
        <SectionCompletionHeader
          title={title}
          status={phaseStatus}
          blockers={phaseStatus === 'blocked' || phaseStatus === 'incomplete' ? blockers.slice(0, 3) : []}
          items={items}
        />
        {content}
      </>
    );
  };

  const renderTab = (tabId: DetailTab360): React.ReactNode => {
    if (activeArea === 'application-parties' && app) {
      return renderTabWithHeader(tabId, 's1', 'Application & Parties', (
        <ApplicationPartiesWorkspace
          application={app}
          activeTab={activeLocalTab ?? 'application'}
          onUpdated={updated => setApp(updated)}
          onDirtyChange={setDirty}
          advancedMemo={advancedMemo}
        />
      ));
    }
    if (activeArea === 'financials' && app) {
      return renderTabWithHeader(tabId, 's3', 'Financials', (
        <FinancialsWorkspace
          application={app}
          activeTab={activeLocalTab ?? 'statements'}
          lane={lane}
          onUpdated={updated => setApp(updated)}
          onDirtyChange={setDirty}
        />
      ));
    }
    if (activeArea === 'risk-compliance' && app) {
      return renderTabWithHeader(tabId, 's4', 'Risk & Compliance', (
        <RiskComplianceWorkspace
          application={app}
          activeTab={activeLocalTab ?? 'bureau-kyc'}
          integrations={integrations}
          isFeatureEnabled={isFeatureEnabled}
          onUpdated={updated => setApp(updated)}
          onDirtyChange={setDirty}
          onRefresh={fetchApp}
        />
      ));
    }
    if (activeArea === 'assessment-recommendation' && app) {
      return renderTabWithHeader(tabId, 's7', 'Assessment & Recommendation', (
        <AssessmentRecommendationWorkspace
          application={app}
          activeTab={(activeLocalTab as 'assessment' | 'deviations-mitigants' | 'recommendation' | 'ca-memo') ?? 'assessment'}
          lane={lane}
          isFeatureEnabled={isFeatureEnabled}
          onUpdated={updated => setApp(updated)}
          onDirtyChange={setDirty}
          onRefresh={fetchApp}
        />
      ));
    }
    if (activeArea === 'decision-completion' && app) {
      return renderTabWithHeader(tabId, 's7', 'Decision & Completion', (
        <DecisionCompletionWorkspace
          application={app}
          facilities={facilities}
          activeTab={(activeLocalTab as 'approvals' | 'decision-history' | 'conditions-offer' | 'completion') ?? 'approvals'}
          onRefresh={fetchApp}
          onUpdated={updated => setApp(updated)}
        />
      ));
    }
    switch (tabId) {
      case 'overview': return (
        <ApplicationOverviewTab
          app={app!}
          facilities={facilities}
          readiness={readiness}
          readinessLoading={readinessLoading}
          readinessError={readinessError}
          onRetryReadiness={fetchReadiness}
          slaDaysLeft={slaDaysLeft}
          formatTimeAgo={formatTimeAgo}
          onNavigate={(tab) => { const t360 = (TAB_TO_TAB360[tab as DetailTab] ?? tab) as DetailTab360; handleTabChange(t360); }}
          transitions={transitions}
          currentState={currentState}
          phaseCompletion={phaseCompletion}
          commentPreviews={commentPreviews}
          onAddNote={() => handleTabChange('timeline-audit')}
          onOpenComments={() => handleTabChange('timeline-audit')}
          onNavigateToWorkspace={handleWorkspaceDestination}
          onSubmit={() => {
            const submitTransition = transitions.find(t => t.toState === 'SUBMITTED' || t.action.toLowerCase().includes('submit'));
            if (submitTransition) setShowTransitionDialog(submitTransition.action);
          }}
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
            const slaDays = Math.max(1, Math.round((app.slaTargetHours ?? 14 * 24) / 24));
            if (elapsedDays > slaDays) return Math.max(10, 100 - Math.round(((elapsedDays - slaDays) / slaDays) * 50));
            return Math.round(100 - (elapsedDays / slaDays) * 100);
          })()}
        />
      );
      case 'customer-profile': return renderTabWithHeader('customer-profile', 's2', 'Customer Profile', <CustomerProfileTab application={snapshotView.resolvedApplication ?? app!} fatcaCrsEnabled={isFeatureEnabled(FATCA_CRS_FLAG)} lane={lane} />);
      case 'application-details': return renderTabWithHeader('application-details', 's1', 'Application Details', <ApplicationDetailsTab application={app!} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} advancedMemo={advancedMemo} />);
      case 'financial-profile': return renderTabWithHeader('financial-profile', 's3', 'Financial Profile', <FinancialProfileTab application={snapshotView.resolvedApplication ?? app!} onUpdated={setApp} onDirtyChange={setDirty} />);
      case 'credit-bureau': return renderTabWithHeader('credit-bureau', 's5', 'Credit Bureau & Compliance', <CreditBureauComplianceTab application={app!} onUpdated={setApp} integrations={integrations} />);
      case 'risk-assessment': return renderTabWithHeader('risk-assessment', 's4', 'Risk Assessment', <RiskAssessmentTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} onRefresh={fetchApp} isFeatureEnabled={isFeatureEnabled} />);
      case 'collateral-guarantees': return renderTabWithHeader('collateral-guarantees', 's6', 'Collateral & Guarantees', <CollateralGuaranteesTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />);
      case 'documents': return renderTabWithHeader('documents', 'meta', 'Documents', <DocumentsTab app={app!} canApprove={canApprove} />);
      case 'approvals': return renderTabWithHeader('approvals', 's7', 'Approvals', <ApprovalsTab360 app={app!} onRefresh={fetchApp} onUpdated={setApp} />);
      case 'ca-memo': return renderTabWithHeader('ca-memo', 's7', 'CA Memo', <CaMemoPreviewTab applicationId={app!.id} applicationNo={app!.applicationNo} />);
      case 'conditions-offer': return <ConditionsOfferTab app={app!} facilities={facilities} onRefresh={fetchApp} onUpdated={(updated) => setApp(updated)} />;
      case 'disbursement': return <DisbursementTab application={app!} onUpdated={(updated) => setApp(updated)} />;
      case 'timeline-audit': return <TimelineAuditTab applicationId={app!.id} />;
      default: return null;
    }
  };

  return (
    <>
      <a href="#credit-detail-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-3 focus:py-1 focus:bg-blue-600 focus:text-white focus:rounded focus:text-sm focus:font-bold">
        Skip to content
      </a>

      {/* ── Application 360 Workspace — 3-column layout ── */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden credit-module">

        {/* ── Primary Application Workspace Navigation — hidden for Personal Fast lane ── */}
        {lane !== 'PERSONAL_FAST' && (
          <ApplicationWorkspaceNavigation
            activeArea={activeArea}
            activeTab={rawTab || activeTab}
            onAreaChange={handleAreaChange}
            onTabChange={handleWorkspaceTabChange}
            borrowerType={app.borrowerProfile?.borrowerType}
            lane={lane}
            featureFlags={featureFlags}
          />
        )}

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
              const isSubmitAction = currentState === 'DRAFT' || currentState === 'REFERRED_BACK' || action === 'submit_to_committee';
              if (isSubmitAction && readiness && !readiness.ready) {
                pendingTransitionRef.current = action;
                setReadinessModalOpen(true);
                return;
              }
              setShowTransitionDialog(action);
            }}
            onExportCaMemo={handleDownloadCaMemo}
            onExportSummaryPdf={handleDownloadSummaryPdf}
          />

          {snapshotView.mode !== 'live' && (
            <div className="px-4 pt-3">
              <SnapshotBanner
                mode={snapshotView.mode}
                effectiveMode={snapshotView.effectiveMode}
                snapshot={snapshotView.snapshot}
                error={snapshotView.error}
                viewingLive={snapshotView.viewingLive}
                onToggleLive={snapshotView.setViewingLive}
              />
            </div>
          )}

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

          {/* ── Journey Stepper (11 stages) ── */}
          <div style={{ padding: '12px 24px 0' }}>
            <ApplicationJourneyStepper
              currentStageIndex={journeyStageIndex}
              lifecycleState={lifecycleState}
            />
          </div>

          {/* The legacy grouped horizontal tabs remain available as a compatibility component,
              but are no longer rendered as a competing global navigation layer. */}

          {/* ── Tab Content ── */}
          <div className="p-6">
            {showOnboardingBanner && currentState === 'DRAFT' && (
              <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800 mb-1">Application Draft Created</p>
                  <p className="text-xs font-semibold text-blue-800">{app.applicationNo} · {getBorrowerDisplayName(app.borrowerProfile)} · Status: Draft</p>
                  <p className="text-xs text-blue-700">
                    Review the server-owned submission requirements below. When the blockers are resolved, use <strong>Submit for KYC Review</strong> in the header.
                  </p>
                  {facilityCreationFailed && <p className="mt-2 text-xs font-semibold text-rose-700">The initial facility could not be saved. Open Application Details and add it before submitting.</p>}
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

            {lane === 'PERSONAL_FAST' && currentState === 'DRAFT' && (readiness || readinessLoading) && (
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
            nextRequiredAction={null}
          />

          <ApplicationSlaWidget
            slaDaysLeft={slaDaysLeft}
            createdAt={app.createdAt ?? null}
            slaTargetHours={app.slaTargetHours ?? null}
          />

          <ApplicationTeamWidget
            app={app}
            onAssign={(field: string) => {
              // Navigate to borrower-profile tab for assignment changes
              handleTabChange('customer-profile');
            }}
          />

        </aside>
      </div>

      {/* ── Mobile bottom panels (shown below content on small screens) ── */}
      <div className="lg:hidden p-4 space-y-4" style={{ backgroundColor: 'var(--cr-surface-bright, #fff)' }}>
        <ApplicationStatusWidget
          currentState={currentState}
          nextRequiredAction={null}
        />
        <ApplicationSlaWidget
          slaDaysLeft={slaDaysLeft}
          createdAt={app.createdAt ?? null}
          slaTargetHours={app.slaTargetHours ?? null}
        />
        {criticalAlerts.length > 0 && (
          <ApplicationAlertsPanel
            alerts={criticalAlerts}
            onNavigate={(tab, area) => area ? handleWorkspaceDestination(area, tab) : handleTabChange(tab as DetailTab360)}
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
        readiness={readiness}
        onSubmitAnyway={() => {
          const action = pendingTransitionRef.current;
          setReadinessModalOpen(false);
          pendingTransitionRef.current = null;
          if (action) {
            setShowTransitionDialog(action);
          }
        }}
        onNavigateToSection={(tabId) => {
          if (lane === 'PERSONAL_FAST') {
            // Personal Fast uses scroll-to-section via hash, not tab switching
            const el = document.getElementById(`pf-section-${tabId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            handleTabChange(tabId as DetailTab360);
          }
        }}
      />
      {DirtyGuardDialog}
    </>
  );
};

export default CreditApplicationDetail;
