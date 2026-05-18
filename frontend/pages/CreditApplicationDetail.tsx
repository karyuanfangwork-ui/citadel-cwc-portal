import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, CreditApplicationParty, CreditApproval,
  CreditAuditEvent, ApplicationTransition, ApplicationState, CreditProductType,
  FacilityType, CurrencyCode, ApprovalDecision,
  scoringApi, CreditScoreRun, RiskRating,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null, currency = 'MYR') =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency as any, maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED: { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

const STEPPER_STAGES: { key: string; label: string; states: ApplicationState[] }[] = [
  { key: 'draft', label: 'Draft', states: ['DRAFT'] },
  { key: 'kyc', label: 'KYC Review', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED'] },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { key: 'decision', label: 'Decision', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'] },
  { key: 'offer', label: 'Offer', states: ['OFFER', 'ACCEPTED'] },
  { key: 'active', label: 'Active', states: ['DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN'] },
];

const PRODUCT_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', TRADE_FINANCE: 'Trade Finance',
  PROJECT_FINANCE: 'Project Finance', SYNDICATED: 'Syndicated', BRIDGE_LOAN: 'Bridge Loan',
  OVERDRAFT: 'Overdraft', LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee',
};

const FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' }, { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
  { value: 'OVERDRAFT', label: 'Overdraft' }, { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' }, { value: 'TRADE_FINANCE', label: 'Trade Finance' },
  { value: 'BRIDGE_LOAN', label: 'Bridge Loan' }, { value: 'PROJECT_FINANCE', label: 'Project Finance' },
];

const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

type DetailTab = 'summary' | 'facilities' | 'parties' | 'documents' | 'approvals' | 'audit';

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [parties, setParties] = useState<CreditApplicationParty[]>([]);
  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [audit, setAudit] = useState<CreditAuditEvent[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [facilityForm, setFacilityForm] = useState<Partial<CreditFacility>>({ currency: 'MYR' as any, facilityType: 'TERM_LOAN' });
  const [partyForm, setPartyForm] = useState<Partial<CreditApplicationParty>>({ partyType: 'GUARANTOR' });
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision | ''>('');
  const [approvalComment, setApprovalComment] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [savingFacility, setSavingFacility] = useState(false);
  const [savingParty, setSavingParty] = useState(false);

  // Score Run state
  const [scoreRuns, setScoreRuns] = useState<CreditScoreRun[]>([]);
  const [runningScore, setRunningScore] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState<string | null>(null);
  const [overrideRating, setOverrideRating] = useState<RiskRating>('NR');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideApproverId, setOverrideApproverId] = useState('');
  const [overriding, setOverriding] = useState(false);

  const RISK_RATINGS: RiskRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];
  const RISK_COLORS: Record<string, { bg: string; text: string }> = {
    AAA: { bg: '#22c55e20', text: '#16a34a' }, AA: { bg: '#22c55e20', text: '#16a34a' },
    A: { bg: '#22c55e20', text: '#16a34a' }, BBB: { bg: '#3b82f620', text: '#2563eb' },
    BB: { bg: '#f59e0b20', text: '#d97706' }, B: { bg: '#f59e0b20', text: '#d97706' },
    CCC: { bg: '#ef444420', text: '#dc2626' }, CC: { bg: '#ef444420', text: '#dc2626' },
    C: { bg: '#ef444420', text: '#dc2626' }, D: { bg: '#ef444420', text: '#dc2626' },
    NR: { bg: '#6b728020', text: '#6b7280' },
  };

  const canWrite = hasPermission(user, 'credit:write');
  const canApprove = hasPermission(user, 'credit:approve') || hasPermission(user, 'credit:review');

  const fetchApp = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await creditService.getApplication(id);
      setApp(data);
    } catch (e) {
      console.error(e);
      navigate('/credit/applications');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchTransitions = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.getApplicationTransitions(id);
      setTransitions(data);
    } catch (e) { console.error(e); }
  }, [id]);

  const fetchFacilities = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listFacilities(id);
      setFacilities(data);
    } catch (e) { console.error(e); }
  }, [id]);

  const fetchParties = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listParties(id);
      setParties(data);
    } catch (e) { console.error(e); }
  }, [id]);

  const fetchApprovals = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listApprovals(id);
      setApprovals(data);
    } catch (e) { console.error(e); }
  }, [id]);

  const fetchAudit = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.getApplicationAudit(id);
      setAudit(data);
    } catch (e) { console.error(e); }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);
  useEffect(() => { if (id) fetchTransitions(); }, [fetchTransitions]);
  useEffect(() => { if (activeTab === 'facilities') fetchFacilities(); }, [activeTab, fetchFacilities]);
  useEffect(() => { if (activeTab === 'parties') fetchParties(); }, [activeTab, fetchParties]);
  useEffect(() => { if (activeTab === 'approvals') fetchApprovals(); }, [activeTab, fetchApprovals]);
  useEffect(() => { if (activeTab === 'audit') fetchAudit(); }, [activeTab, fetchAudit]);

  const handleTransition = async (action: string) => {
    if (!id) return;
    try {
      setTransitioning(true);
      await creditService.transitionApplication(id, { action, reason: transitionReason || undefined });
      setTransitionReason('');
      setShowTransitionDialog(null);
      fetchApp();
      fetchTransitions();
    } catch (e) { console.error(e); }
    finally { setTransitioning(false); }
  };

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingFacility(true);
      await creditService.createFacility(id, facilityForm);
      setShowFacilityForm(false);
      setFacilityForm({ currency: 'MYR' as any, facilityType: 'TERM_LOAN' });
      fetchFacilities();
    } catch (e) { console.error(e); }
    finally { setSavingFacility(false); }
  };

  const handleDeleteFacility = async (facilityId: string) => {
    if (!confirm('Delete this facility?')) return;
    try {
      await creditService.deleteFacility(facilityId);
      fetchFacilities();
    } catch (e) { console.error(e); }
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingParty(true);
      await creditService.createParty(id, partyForm);
      setShowPartyForm(false);
      setPartyForm({ partyType: 'GUARANTOR' });
      fetchParties();
    } catch (e) { console.error(e); }
    finally { setSavingParty(false); }
  };

  const handleSubmitApproval = async () => {
    if (!id || !approvalDecision) return;
    try {
      setSubmittingApproval(true);
      await creditService.submitApproval(id, {
        decision: approvalDecision,
        comment: approvalComment || undefined,
      });
      setApprovalDecision('');
      setApprovalComment('');
      fetchApprovals();
      fetchApp();
    } catch (e) { console.error(e); }
    finally { setSubmittingApproval(false); }
  };

  // Score Runs
  const fetchScoreRuns = useCallback(async () => {
    if (!id) return;
    try {
      const data = await scoringApi.listScores(id);
      setScoreRuns(data);
    } catch (e) { console.error(e); }
  }, [id]);

  useEffect(() => { if (activeTab === 'summary') fetchScoreRuns(); }, [activeTab, fetchScoreRuns]);

  const handleRunScore = async () => {
    if (!id) return;
    try {
      setRunningScore(true);
      await scoringApi.executeScore(id);
      fetchScoreRuns();
      fetchApp();
    } catch (e) { console.error(e); }
    finally { setRunningScore(false); }
  };

  const handleOverrideScore = async () => {
    if (!showOverrideDialog) return;
    try {
      setOverriding(true);
      await scoringApi.overrideScore(showOverrideDialog, {
        rating: overrideRating,
        reason: overrideReason,
        approverId: overrideApproverId || user?.id || '',
      });
      setShowOverrideDialog(null);
      setOverrideRating('NR');
      setOverrideReason('');
      setOverrideApproverId('');
      fetchScoreRuns();
      fetchApp();
    } catch (e) { console.error(e); }
    finally { setOverriding(false); }
  };

  if (loading) return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 20, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    </>
  );

  if (!app) return null;

  const currentState = (app.state || app.status) as ApplicationState;
  const badge = STATE_COLORS[currentState] || STATE_COLORS.DRAFT;

  // Stepper logic
  const currentStageIdx = STEPPER_STAGES.findIndex(s => s.states.includes(currentState));
  const isPastStage = (idx: number) => idx < currentStageIdx;
  const isCurrentStage = (idx: number) => idx === currentStageIdx;

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <Link to="/credit/applications" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Applications</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">{app.borrowerProfile ? `${app.borrowerProfile.firstName} ${app.borrowerProfile.lastName}` : app.id.slice(0, 8)}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
              <span className="material-symbols-outlined text-2xl">description</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-text-primary">
                {app.borrowerProfile ? `${app.borrowerProfile.firstName} ${app.borrowerProfile.lastName}` : 'Application'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                  {currentState.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-text-secondary">{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {app.borrowerProfile && (
              <Link to={`/credit/borrowers/${app.borrowerProfileId}`}
                className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">person</span> View Borrower
              </Link>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            {STEPPER_STAGES.map((stage, idx) => (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1.5 ${
                    isCurrentStage(idx) ? 'bg-brand-700 text-white ring-4 ring-brand-100' :
                    isPastStage(idx) ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {isPastStage(idx) ? <span className="material-symbols-outlined text-base">check</span> : idx + 1}
                  </div>
                  <span className={`text-xs font-bold text-center ${isCurrentStage(idx) ? 'text-brand-700' : isPastStage(idx) ? 'text-green-600' : 'text-text-secondary'}`}>
                    {stage.label}
                  </span>
                </div>
                {idx < STEPPER_STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mt-[-16px] ${isPastStage(idx + 1) || isCurrentStage(idx + 1) ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minWidth: 20 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Key Info Chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'Amount', value: formatCurrency(app.requestedAmount, app.currency), icon: 'payments' },
            { label: 'Approved', value: formatCurrency(app.approvedAmount, app.currency), icon: 'check_circle' },
            { label: 'Tenor', value: `${app.tenureMonths} mo`, icon: 'schedule' },
            { label: 'Currency', value: app.currency, icon: 'currency_exchange' },
            { label: 'RM', value: app.rm ? `${app.rm.firstName} ${app.rm.lastName}` : '—', icon: 'person' },
            { label: 'Analyst', value: app.analyst ? `${app.analyst.firstName} ${app.analyst.lastName}` : '—', icon: 'analytics' },
            { label: 'Risk', value: app.riskRating || '—', icon: 'speed' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
              <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
              <span className="font-bold text-text-primary">{s.value}</span>
              <span className="text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Transition Action Buttons */}
        {transitions.length > 0 && canWrite && (
          <div className="bg-bg-surface border border-border rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Available Actions</h3>
            <div className="flex flex-wrap gap-2">
              {transitions.map(t => {
                const isReject = t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED' || t.toState === 'WITHDRAWN';
                const isApprove = t.toState === 'APPROVED' || t.toState === 'KYC_APPROVED' || t.toState === 'ACCEPTED';
                return (
                  <button key={t.action} onClick={() => setShowTransitionDialog(t.action)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      isReject ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' :
                      isApprove ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' :
                      'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                    }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <span className="material-symbols-outlined text-base">{isReject ? 'block' : isApprove ? 'check_circle' : 'arrow_forward'}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(['summary', 'facilities', 'parties', 'documents', 'approvals', 'audit'] as DetailTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Application Details</h3>
              {[
                { label: 'Product Type', value: PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName, icon: 'category' },
                { label: 'Requested Amount', value: formatCurrency(app.requestedAmount, app.currency), icon: 'payments' },
                { label: 'Approved Amount', value: formatCurrency(app.approvedAmount, app.currency), icon: 'check_circle' },
                { label: 'Interest Rate', value: app.interestRate ? `${app.interestRate}% p.a.` : '—', icon: 'percent' },
                { label: 'Tenure', value: `${app.tenureMonths} months`, icon: 'schedule' },
                { label: 'Currency', value: app.currency, icon: 'currency_exchange' },
                { label: 'Risk Rating', value: app.riskRating || '—', icon: 'speed' },
                { label: 'Purpose', value: app.purpose || '—', icon: 'topic' },
                { label: 'Submitted', value: formatDate(app.submittedAt ?? null), icon: 'send' },
                { label: 'Decided', value: formatDate(app.decidedAt ?? null), icon: 'gavel' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
                  <span className="text-sm text-text-primary">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">People</h3>
              {[
                { label: 'Relationship Manager', value: app.rm ? `${app.rm.firstName} ${app.rm.lastName}` : '—', icon: 'person', sub: app.rm?.email },
                { label: 'Credit Analyst', value: app.analyst ? `${app.analyst.firstName} ${app.analyst.lastName}` : '—', icon: 'analytics', sub: app.analyst?.email },
                { label: 'Borrower', value: app.borrowerProfile ? `${app.borrowerProfile.firstName} ${app.borrowerProfile.lastName}` : '—', icon: 'account_circle', sub: app.borrowerProfile?.email },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-text-secondary block">{f.label}</span>
                    <span className="text-sm text-text-primary font-medium">{f.value}</span>
                    {f.sub && <span className="text-xs text-text-secondary block truncate">{f.sub}</span>}
                  </div>
                </div>
              ))}
              {app.rejectionReason && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-xs font-bold text-red-700">Rejection Reason</span>
                  <p className="text-sm text-red-800 mt-0.5">{app.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score Run Section in Summary Tab */}
        {activeTab === 'summary' && (
          <div className="mt-6 bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Credit Scoring</h3>
              {canWrite && (
                <button onClick={handleRunScore} disabled={runningScore}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
                  style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">speed</span>
                  {runningScore ? 'Running...' : 'Run Score'}
                </button>
              )}
            </div>

            {scoreRuns.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">No score runs yet. Click "Run Score" to execute credit scoring.</p>
            ) : (
              <div>
                {/* Latest Score Run */}
                {(() => {
                  const latest = scoreRuns[0];
                  const rating = latest.overriddenRating || latest.riskRating;
                  const ratingColor = RISK_COLORS[rating] || RISK_COLORS.NR;
                  return (
                    <div className="bg-bg-subtle border border-border rounded-xl p-5 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black" style={{ background: ratingColor.bg, color: ratingColor.text }}>
                            {rating}
                          </div>
                          <div>
                            <p className="text-2xl font-black text-text-primary">{latest.totalScore}</p>
                            <p className="text-xs text-text-secondary">Total Score</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {latest.overriddenRating && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                              Overridden (was {latest.riskRating})
                            </span>
                          )}
                          <button onClick={() => setShowOverrideDialog(latest.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <span className="material-symbols-outlined text-sm">edit</span> Override
                          </button>
                        </div>
                      </div>

                      {/* Factor Breakdown */}
                      <div className="grid grid-cols-3 gap-2">
                        {latest.factorBreakdown?.map(fb => (
                          <div key={fb.factorKey} className="bg-bg-surface border border-border rounded-lg p-2.5">
                            <p className="text-xs text-text-secondary truncate">{fb.factorLabel}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-bold text-text-primary">{fb.weightedScore.toFixed(1)}</span>
                              <span className="text-[10px] text-text-secondary">w:{fb.weight}% s:{fb.score.toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Score History */}
                {scoreRuns.length > 1 && (
                  <div>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Score History</h4>
                    <div className="space-y-2">
                      {scoreRuns.slice(1).map(sr => {
                        const r = sr.overriddenRating || sr.riskRating;
                        const rc = RISK_COLORS[r] || RISK_COLORS.NR;
                        return (
                          <div key={sr.id} className="flex items-center gap-3 px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.text }}>{r}</span>
                            <span className="font-semibold text-text-primary">{sr.totalScore}</span>
                            <span className="text-xs text-text-secondary">{formatDateTime(sr.executedAt)}</span>
                            {sr.overriddenRating && <span className="text-xs text-amber-600 font-bold">Overridden</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Override Score Dialog */}
        {showOverrideDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowOverrideDialog(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">Override Risk Rating</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">New Rating *</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RISK_RATINGS.map(r => (
                      <button key={r} onClick={() => setOverrideRating(r)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          overrideRating === r ? 'ring-2 ring-brand-300 ' : ''
                        }`} style={{
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          background: (RISK_COLORS[r]?.bg || '#6b728020'),
                          color: (RISK_COLORS[r]?.text || '#6b7280'),
                          borderColor: (RISK_COLORS[r]?.text || '#6b7280') + '40',
                        }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Override Reason *</label>
                  <textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Provide reason for overriding the risk rating..."
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Approver ID</label>
                  <input type="text" value={overrideApproverId} onChange={e => setOverrideApproverId(e.target.value)}
                    placeholder="Approver user ID (defaults to current user)"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowOverrideDialog(null)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button onClick={handleOverrideScore} disabled={!overrideReason || overriding}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {overriding ? 'Overriding...' : 'Override'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Facilities Tab */}
        {activeTab === 'facilities' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Facilities</h3>
              {canWrite && (
                <button onClick={() => setShowFacilityForm(true)} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">add</span> Add Facility
                </button>
              )}
            </div>
            {facilities.length === 0 ? (
              <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">account_balance</span>
                <p className="font-semibold text-sm">No facilities yet</p>
              </div>
            ) : (
              <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-muted)' }}>
                      {['Type', 'Amount', 'Currency', 'Rate', 'Tenure', 'Purpose', 'Actions'].map(h => (
                        <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map(f => (
                      <tr key={f.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{f.facilityType.replace(/_/g, ' ')}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formatCurrency(f.approvedAmount, f.currency)}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{f.currency}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{f.interestRate ? `${f.interestRate}%` : '—'}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{f.tenureMonths} mo</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)', maxWidth: 200 }} className="truncate">{f.purpose || '—'}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-5)' }}>
                          {canWrite && (
                            <button onClick={() => handleDeleteFacility(f.id)} className="text-red-500 hover:text-red-700 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Parties Tab */}
        {activeTab === 'parties' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Parties</h3>
              {canWrite && (
                <button onClick={() => setShowPartyForm(true)} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">person_add</span> Add Party
                </button>
              )}
            </div>
            {parties.length === 0 ? (
              <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">group</span>
                <p className="font-semibold text-sm">No parties linked</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parties.map(p => (
                  <div key={p.id} className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-text-primary text-sm">{p.firstName} {p.lastName}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">{p.partyType}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {p.nricPassport && `NRIC: ${p.nricPassport} · `}{p.email && `${p.email} · `}{p.phone && `${p.phone}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Documents</h3>
            <p className="text-sm text-text-secondary">Documents are managed on the <Link to={`/credit/borrowers/${app.borrowerProfileId}`} className="text-brand-700 hover:underline" style={{ textDecoration: 'none' }}>Borrower Profile</Link> page.</p>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Approval Timeline */}
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Approval History</h3>
              {approvals.length === 0 ? (
                <p className="text-sm text-text-secondary">No approvals yet.</p>
              ) : (
                <div className="space-y-4">
                  {approvals.map(a => {
                    const decColors: Record<string, { bg: string; text: string }> = {
                      APPROVED: { bg: '#22c55e20', text: '#16a34a' },
                      REJECTED: { bg: '#ef444420', text: '#dc2626' },
                      RETURNED: { bg: '#f59e0b20', text: '#d97706' },
                      ESCALATED: { bg: '#8b5cf620', text: '#7c3aed' },
                    };
                    const c = decColors[a.decision] || { bg: '#6366f120', text: '#6366f1' };
                    return (
                      <div key={a.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: c.bg, color: c.text }}>
                            {a.decision === 'APPROVED' ? '✓' : a.decision === 'REJECTED' ? '✗' : a.decision === 'RETURNED' ? '↩' : '↑'}
                          </div>
                          {a !== approvals[approvals.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-text-primary">{a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : 'Unknown'}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>{a.decision}</span>
                            {a.isCommitteeVote && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Committee</span>}
                          </div>
                          {a.comment && <p className="text-xs text-text-secondary mt-0.5">{a.comment}</p>}
                          <p className="text-xs text-text-secondary mt-0.5">{formatDateTime(a.decidedAt ?? a.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Approval Action Panel */}
            {canApprove && (
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Submit Decision</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">Decision *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED'] as ApprovalDecision[]).map(d => {
                        const colors: Record<string, string> = {
                          APPROVED: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                          REJECTED: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                          RETURNED: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                          ESCALATED: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
                        };
                        return (
                          <button key={d} onClick={() => setApprovalDecision(d)}
                            className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                              approvalDecision === d ? 'ring-2 ring-brand-300 ' + colors[d] : colors[d]
                            }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            {d.charAt(0) + d.slice(1).toLowerCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Comment</label>
                    <textarea rows={3} value={approvalComment} onChange={e => setApprovalComment(e.target.value)}
                      placeholder="Add comments for this decision..."
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none" style={{ fontFamily: 'var(--font-sans)' }} />
                  </div>
                  <button onClick={handleSubmitApproval} disabled={!approvalDecision || submittingApproval}
                    className="w-full px-4 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {submittingApproval ? 'Submitting...' : 'Submit Decision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Audit Trail</h3>
            {audit.length === 0 ? (
              <p className="text-sm text-text-secondary">No audit events recorded.</p>
            ) : (
              <div className="space-y-4">
                {audit.map(a => {
                  const isStateChange = a.fromState && a.toState;
                  return (
                    <div key={a.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStateChange ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                          <span className="material-symbols-outlined text-base">{isStateChange ? 'swap_horiz' : 'edit_note'}</span>
                        </div>
                        {a !== audit[audit.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-text-primary">{a.action.replace(/_/g, ' ')}</span>
                          {isStateChange && (
                            <span className="text-xs">
                              <span className="font-medium" style={{ color: (STATE_COLORS[a.fromState!]?.text) || '#6366f1' }}>{a.fromState!.replace(/_/g, ' ')}</span>
                              <span className="text-text-secondary mx-1">→</span>
                              <span className="font-medium" style={{ color: (STATE_COLORS[a.toState!]?.text) || '#6366f1' }}>{a.toState!.replace(/_/g, ' ')}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.performer && <span className="text-xs text-text-secondary">by {a.performer.firstName} {a.performer.lastName}</span>}
                          <span className="text-xs text-text-secondary">{formatDateTime(a.createdAt)}</span>
                        </div>
                        {a.comment && <p className="text-xs text-text-secondary mt-1 bg-bg-subtle border border-border rounded-lg px-3 py-1.5">{a.comment}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Transition Dialog */}
        {showTransitionDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowTransitionDialog(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-2">Confirm Action</h2>
              <p className="text-sm text-text-secondary mb-4">
                Are you sure you want to perform "<span className="font-bold text-text-primary">{showTransitionDialog.replace(/_/g, ' ')}</span>"?
              </p>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Reason (optional)</label>
                <textarea rows={2} value={transitionReason} onChange={e => setTransitionReason(e.target.value)}
                  placeholder="Add a reason or note..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTransitionDialog(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={() => handleTransition(showTransitionDialog)} disabled={transitioning}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {transitioning ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Facility Form Modal */}
        {showFacilityForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFacilityForm(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">Add Facility</h2>
              <form onSubmit={handleCreateFacility} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Facility Type *</label>
                  <select required value={facilityForm.facilityType || ''} onChange={e => setFacilityForm(f => ({ ...f, facilityType: e.target.value as FacilityType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Approved Amount *</label>
                    <input required type="number" min="0" value={facilityForm.approvedAmount ?? ''} onChange={e => setFacilityForm(f => ({ ...f, approvedAmount: Number(e.target.value) }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
                    <select required value={facilityForm.currency || 'MYR'} onChange={e => setFacilityForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Interest Rate (%)</label>
                    <input type="number" step="0.01" value={facilityForm.interestRate ?? ''} onChange={e => setFacilityForm(f => ({ ...f, interestRate: Number(e.target.value) }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Tenure (months) *</label>
                    <input required type="number" min="1" value={facilityForm.tenureMonths ?? ''} onChange={e => setFacilityForm(f => ({ ...f, tenureMonths: Number(e.target.value) }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Purpose</label>
                  <textarea rows={2} value={facilityForm.purpose ?? ''} onChange={e => setFacilityForm(f => ({ ...f, purpose: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Conditions</label>
                  <textarea rows={2} value={facilityForm.conditions ?? ''} onChange={e => setFacilityForm(f => ({ ...f, conditions: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowFacilityForm(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={savingFacility}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {savingFacility ? 'Saving...' : 'Add Facility'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Party Form Modal */}
        {showPartyForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowPartyForm(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">Add Party</h2>
              <form onSubmit={handleCreateParty} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Party Type *</label>
                  <select required value={partyForm.partyType || ''} onChange={e => setPartyForm(f => ({ ...f, partyType: e.target.value as any }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {['BORROWER', 'GUARANTOR', 'COVENANTOR', 'DIRECTOR', 'SHAREHOLDER'].map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
                    <input required value={partyForm.firstName || ''} onChange={e => setPartyForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label>
                    <input required value={partyForm.lastName || ''} onChange={e => setPartyForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">NRIC/Passport</label>
                  <input value={partyForm.nricPassport || ''} onChange={e => setPartyForm(f => ({ ...f, nricPassport: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                    <input type="email" value={partyForm.email || ''} onChange={e => setPartyForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                    <input value={partyForm.phone || ''} onChange={e => setPartyForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Relationship</label>
                  <input value={partyForm.relationship || ''} onChange={e => setPartyForm(f => ({ ...f, relationship: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowPartyForm(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={savingParty}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {savingParty ? 'Saving...' : 'Add Party'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CreditApplicationDetail;