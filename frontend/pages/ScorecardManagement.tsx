import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  scorecardApi, CreditScorecard, CreditScorecardVersion, ScorecardFactor,
  ScorecardProductType,
} from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { friendlyMessage } from '../src/utils/errorMessages';
import toast from 'react-hot-toast';

const DEFAULT_FACTORS: ScorecardFactor[] = [
  { key: 'financial_performance', label: 'Financial Performance', weight: 0 },
  { key: 'leverage', label: 'Leverage', weight: 0 },
  { key: 'liquidity', label: 'Liquidity', weight: 0 },
  { key: 'cashflow', label: 'Cash Flow', weight: 0 },
  { key: 'management', label: 'Management Quality', weight: 0 },
  { key: 'industry', label: 'Industry Risk', weight: 0 },
  { key: 'collateral', label: 'Collateral Coverage', weight: 0 },
  { key: 'relationship', label: 'Relationship History', weight: 0 },
  { key: 'market_conditions', label: 'Market Conditions', weight: 0 },
];

const DEFAULT_RETAIL_FACTORS: ScorecardFactor[] = DEFAULT_FACTORS.map((factor) => ({
  ...factor,
  label: factor.key === 'cashflow' ? 'Cash Flow (DSR)' : factor.label,
}));

const PRODUCT_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_FACILITY: 'Revolving Facility', TRADE_FINANCE: 'Trade Finance',
  PROJECT_FINANCE: 'Project Finance', SYNDICATED: 'Syndicated', BRIDGING: 'Bridging',
  OVERDRAFT: 'Overdraft', HIRE_PURCHASE: 'Hire Purchase',
};

const ScorecardManagement: React.FC = () => {
  const { user } = useAuth();
  const canAdmin = hasPermission(user, 'credit:admin');

  const [scorecards, setScorecards] = useState<CreditScorecard[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<CreditScorecardVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationVersionId, setActivationVersionId] = useState<string | null>(null);
  const [policyApprovalReference, setPolicyApprovalReference] = useState('');
  const [marketConditionsAcknowledged, setMarketConditionsAcknowledged] = useState(false);

  // Create scorecard dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', productType: '' as ScorecardProductType | '' });
  const [creating, setCreating] = useState(false);

  // Create version dialog
  const [showVersionDialog, setShowVersionDialog] = useState<string | null>(null);
  const [versionFactors, setVersionFactors] = useState<ScorecardFactor[]>([...DEFAULT_FACTORS]);
  const [retailFactors, setRetailFactors] = useState<ScorecardFactor[]>([...DEFAULT_RETAIL_FACTORS]);
  const [changeReason, setChangeReason] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  const fetchScorecards = useCallback(async () => {
    try {
      setLoading(true);
      const data = await scorecardApi.list();
      setScorecards(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchScorecards(); }, [fetchScorecards]);

  const fetchVersions = useCallback(async (scorecardId: string) => {
    try {
      const data = await scorecardApi.listVersions(scorecardId);
      setVersions(data);
    } catch (e) { console.error(e); }
  }, []);

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setVersions([]);
    } else {
      setExpandedId(id);
      fetchVersions(id);
    }
  };

  const handleCreateScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await scorecardApi.create({
        name: createForm.name,
        description: createForm.description || undefined,
        productType: createForm.productType || undefined,
      });
      setShowCreate(false);
      setCreateForm({ name: '', description: '', productType: '' });
      fetchScorecards();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const handleCreateVersion = async () => {
    if (!showVersionDialog) return;
    try {
      setCreatingVersion(true);
      await scorecardApi.createVersion(showVersionDialog, {
        factors: versionFactors,
        retailFactors,
        changeReason,
      });
      setShowVersionDialog(null);
      setVersionFactors([...DEFAULT_FACTORS]);
      setRetailFactors([...DEFAULT_RETAIL_FACTORS]);
      setChangeReason('');
      fetchVersions(showVersionDialog);
      fetchScorecards();
    } catch (e) { console.error(e); }
    finally { setCreatingVersion(false); }
  };

  const handleApproveVersion = async (versionId: string) => {
    if (!confirm('Approve this scorecard version as an independent checker? A separate operator must activate it.')) return;
    try {
      setActivationError(null);
      setApproving(versionId);
      await scorecardApi.approveVersion(versionId);
      if (expandedId) fetchVersions(expandedId);
      fetchScorecards();
      toast.success('Scorecard version approved; a separate operator can now activate it');
    } catch (e) {
      console.error(e);
      const message = friendlyMessage(e, 'Failed to approve scorecard version');
      setActivationError(message);
      toast.error(message);
    } finally { setApproving(null); }
  };

  const handleActivateVersion = (versionId: string) => {
    setActivationError(null);
    setActivationVersionId(versionId);
    setPolicyApprovalReference('');
    setMarketConditionsAcknowledged(false);
  };

  const submitActivation = async () => {
    if (!activationVersionId) return;
    if (policyApprovalReference.trim().length < 5) {
      const message = 'Enter the policy-owner approval reference (at least 5 characters).';
      setActivationError(message);
      toast.error(message);
      return;
    }
    if (!marketConditionsAcknowledged) {
      const message = 'Confirm the policy owner’s market_conditions treatment before activation.';
      setActivationError(message);
      toast.error(message);
      return;
    }
    try {
      setActivationError(null);
      setActivating(activationVersionId);
      await scorecardApi.activateVersion(activationVersionId, {
        policyApprovalReference: policyApprovalReference.trim(),
        marketConditionsAcknowledged: true,
      });
      setActivationVersionId(null);
      setPolicyApprovalReference('');
      setMarketConditionsAcknowledged(false);
      if (expandedId) fetchVersions(expandedId);
      fetchScorecards();
      toast.success('Scorecard version activated with recorded policy approval');
    } catch (e) {
      console.error(e);
      const message = friendlyMessage(e, 'Failed to activate scorecard version');
      setActivationError(message);
      toast.error(message);
    } finally { setActivating(null); }
  };


  const handleWeightChange = (idx: number, weight: number) => {
    setVersionFactors(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], weight };
      return updated;
    });
  };

  const totalWeight = versionFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const retailTotalWeight = retailFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const weightsValid = Math.abs(totalWeight - 100) <= 0.01;
  const retailWeightsValid = Math.abs(retailTotalWeight - 100) <= 0.01;

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '2rem' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">Scorecards</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-text-primary">Scorecard Management</h1>
          {canAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-brand-700 text-white hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">add</span> New Scorecard
            </button>
          )}
        </div>

        {activationError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>Governance action failed:</strong> {activationError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : scorecards.length === 0 ? (
          <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">dashboard_customize</span>
            <p className="font-semibold">No scorecards yet</p>
            {canAdmin && <p className="text-sm mt-1">Create your first credit scorecard to begin</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {scorecards.map(sc => (
              <div key={sc.id} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                {/* Scorecard Header */}
                <button onClick={() => handleExpand(sc.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <span className="material-symbols-outlined">dashboard_customize</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-text-primary">{sc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sc.productType && <span className="text-xs text-text-secondary">{PRODUCT_LABELS[sc.productType]}</span>}
                        <span className="text-xs bg-bg-subtle px-2 py-0.5 rounded-full text-text-secondary">
                          {sc._count?.versions ?? 0} version{(sc._count?.versions ?? 0) !== 1 ? 's' : ''}
                        </span>
                        {sc.activeVersionId && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-text-secondary transition-transform ${expandedId === sc.id ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Expanded: Version History */}
                {expandedId === sc.id && (
                  <div className="border-t border-border px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Version History</h3>
                      {canAdmin && (
                        <button onClick={() => {
                          setVersionFactors(DEFAULT_FACTORS.map((factor) => ({ ...factor })));
                          setRetailFactors(DEFAULT_RETAIL_FACTORS.map((factor) => ({ ...factor })));
                          setChangeReason('');
                          setShowVersionDialog(sc.id);
                        }}
                          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                          <span className="material-symbols-outlined text-sm">add</span> New Version
                        </button>
                      )}
                    </div>
                    {versions.length === 0 ? (
                      <p className="text-sm text-text-secondary py-4 text-center">No versions yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--color-surface-muted)' }}>
                              {['Version', 'Status', 'Factors', 'Created By', 'Created At', 'Actions'].map(h => (
                                <th key={h} style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {versions.map(v => (
                              <tr key={v.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                                  v{v.versionNumber}
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    v.lifecycleStatus === 'ACTIVE'
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : v.lifecycleStatus === 'APPROVED'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                                  }`}>
                                    {v.lifecycleStatus}
                                  </span>
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                                  <div className="flex flex-wrap gap-1">
                                    {v.factors.slice(0, 3).map(f => (
                                      <span key={f.key} className="text-[10px] bg-bg-subtle px-1.5 py-0.5 rounded">
                                        {f.label} ({f.weight}%)
                                      </span>
                                    ))}
                                    {v.factors.length > 3 && (
                                      <span className="text-[10px] text-text-secondary">+{v.factors.length - 3} more</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                  <div>{v.createdBy ? `${v.createdBy.firstName} ${v.createdBy.lastName}` : 'System / legacy'}</div>
                                  {v.approvedBy && v.approvedAt && (
                                    <div className="text-[11px] text-blue-700 mt-0.5">
                                      Approved by {v.approvedBy.firstName} {v.approvedBy.lastName} on {new Date(v.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                  )}
                                  {v.changeReason && <div className="text-[11px] mt-1">Reason: {v.changeReason}</div>}
                                  {v.policyApprovalReference && (
                                    <div className="text-[11px] text-green-700 mt-0.5">Policy approval: {v.policyApprovalReference}</div>
                                  )}
                                  {v.activatedAt && (
                                    <div className="text-[11px] text-green-700 mt-0.5">Activated {new Date(v.activatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                  )}
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                  {v.lifecycleStatus === 'DRAFT' && canAdmin && v.createdById && user?.id !== v.createdById && (
                                    <button onClick={() => handleApproveVersion(v.id)} disabled={approving === v.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">fact_check</span>
                                      {approving === v.id ? 'Approving...' : 'Approve'}
                                    </button>
                                  )}
                                  {v.lifecycleStatus === 'DRAFT' && canAdmin && v.createdById && user?.id === v.createdById && (
                                    <span className="text-xs font-semibold text-amber-700">Awaiting independent checker</span>
                                  )}
                                  {v.lifecycleStatus === 'DRAFT' && canAdmin && !v.createdById && (
                                    <span className="text-xs font-semibold text-amber-700" title="System-generated versions have no verified maker attribution">
                                      Legacy version — create a reviewed draft
                                    </span>
                                  )}
                                  {v.lifecycleStatus === 'APPROVED' && canAdmin && user?.id !== v.approvedById && user?.id !== v.createdById && (
                                    <button onClick={() => handleActivateVersion(v.id)} disabled={activating === v.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                                      {activating === v.id ? 'Activating...' : 'Activate'}
                                    </button>
                                  )}
                                  {v.lifecycleStatus === 'APPROVED' && canAdmin && (user?.id === v.approvedById || user?.id === v.createdById) && (
                                    <span className="text-xs font-semibold text-amber-700" title="A third, distinct operator must activate this approved version">
                                      Awaiting independent operator
                                    </span>
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
              </div>
            ))}
          </div>
        )}

        {/* Create Scorecard Dialog */}
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">Create Scorecard</h2>
              <form onSubmit={handleCreateScorecard} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Name *</label>
                  <input required value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                  <textarea rows={2} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Product Type</label>
                  <select value={createForm.productType} onChange={e => setCreateForm(f => ({ ...f, productType: e.target.value as ScorecardProductType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="">All Products</option>
                    {Object.entries(PRODUCT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={creating}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Version Dialog */}
        {showVersionDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowVersionDialog(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-2">Create Scorecard Version</h2>
              <p className="text-sm text-text-secondary mb-4">Enter policy-approved corporate and retail factor maps; each must sum to 100. New drafts start at zero rather than using unapproved weight defaults.</p>
              <div role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No market_conditions data provider is configured. Its treatment must be covered by the policy approval before activation.
              </div>
              <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor="scorecard-change-reason">Change reason *</label>
              <textarea id="scorecard-change-reason" required minLength={5} maxLength={1000} value={changeReason}
                onChange={e => setChangeReason(e.target.value)} rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-y mb-4" style={{ background: '#fff' }} />

              <div className="space-y-3 mb-4">
                {versionFactors.map((f, idx) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-sm text-text-primary w-40 shrink-0 truncate">{f.label}</span>
                    <input type="range" min={0} max={100} value={f.weight}
                      onChange={e => handleWeightChange(idx, Number(e.target.value))}
                      className="flex-1" style={{ accentColor: '#0052cc' }} />
                    <input type="number" min={0} max={100} value={f.weight}
                      onChange={e => handleWeightChange(idx, Number(e.target.value))}
                      className="w-16 border border-border rounded px-2 py-1 text-sm text-center" style={{ background: '#fff' }} />
                    <span className="text-xs text-text-secondary w-4">%</span>
                  </div>
                ))}
              </div>

              <div className={`p-3 rounded-lg text-sm font-bold ${weightsValid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                Total: {totalWeight}% {weightsValid ? '' : `(need ${100 - totalWeight > 0 ? '+' : ''}${100 - totalWeight}%)`}
              </div>

              {/* Retail / Individual Borrower Weight Set */}
              <h3 className="text-sm font-bold text-text-primary mt-6 mb-2">Retail Borrower Weights <span className="text-xs font-normal text-text-secondary">(INDIVIDUAL / SOLE_PROPRIETOR)</span></h3>
              <p className="text-xs text-text-secondary mb-3">Used for individual/retail borrowers. Cash Flow weight maps to DSR score.</p>
              <div className="space-y-3 mb-4">
                {retailFactors.map((f, idx) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-sm text-text-primary w-40 shrink-0 truncate">{f.label}</span>
                    <input type="range" min={0} max={100} value={f.weight}
                      onChange={e => {
                        setRetailFactors(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], weight: Number(e.target.value) };
                          return updated;
                        });
                      }}
                      className="flex-1" style={{ accentColor: '#7c3aed' }} />
                    <input type="number" min={0} max={100} value={f.weight}
                      onChange={e => {
                        setRetailFactors(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], weight: Number(e.target.value) };
                          return updated;
                        });
                      }}
                      className="w-16 border border-border rounded px-2 py-1 text-sm text-center" style={{ background: '#fff' }} />
                    <span className="text-xs text-text-secondary w-4">%</span>
                  </div>
                ))}
              </div>

              <div className={`p-3 rounded-lg text-sm font-bold ${retailWeightsValid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                Retail Total: {retailTotalWeight}% {retailWeightsValid ? '' : `(need ${100 - retailTotalWeight > 0 ? '+' : ''}${100 - retailTotalWeight}%)`}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowVersionDialog(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={handleCreateVersion} disabled={!weightsValid || !retailWeightsValid || changeReason.trim().length < 5 || creatingVersion}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {creatingVersion ? 'Creating...' : 'Create Version'}
                </button>
              </div>
            </div>
          </div>
        )}
        {activationVersionId && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center" onClick={() => setActivationVersionId(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <section role="dialog" aria-modal="true" aria-labelledby="scorecard-activation-title"
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6"
              onClick={event => event.stopPropagation()}>
              <h2 id="scorecard-activation-title" className="text-lg font-black text-text-primary mb-2">Policy approval required</h2>
              <p className="text-sm text-text-secondary mb-4">
                Activation will replace the current scorecard version. Enter the approved policy record and confirm it explicitly covers the unsupported market_conditions factor.
              </p>
              <label htmlFor="scorecard-policy-reference" className="block text-xs font-semibold text-text-secondary mb-1">Policy-owner approval reference *</label>
              <input id="scorecard-policy-reference" required minLength={5} maxLength={200}
                value={policyApprovalReference} onChange={event => setPolicyApprovalReference(event.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4" style={{ background: '#fff' }} />
              <label className="flex items-start gap-2 text-sm text-text-primary mb-5">
                <input type="checkbox" checked={marketConditionsAcknowledged}
                  onChange={event => setMarketConditionsAcknowledged(event.target.checked)} className="mt-1" />
                <span>The referenced policy approval explicitly accepts this version’s market_conditions weight and its lack of a configured external data provider.</span>
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setActivationVersionId(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="button" onClick={submitActivation}
                  disabled={activating === activationVersionId || policyApprovalReference.trim().length < 5 || !marketConditionsAcknowledged}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {activating === activationVersionId ? 'Activating...' : 'Record Approval & Activate'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default ScorecardManagement;