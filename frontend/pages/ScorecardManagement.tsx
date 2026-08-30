import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  scorecardApi, CreditScorecard, CreditScorecardVersion, ScorecardFactor,
  CreditProductType,
} from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { friendlyMessage } from '../src/utils/errorMessages';
import toast from 'react-hot-toast';

const DEFAULT_FACTORS: ScorecardFactor[] = [
  { key: 'financial_performance', label: 'Financial Performance', weight: 15 },
  { key: 'leverage', label: 'Leverage', weight: 10 },
  { key: 'liquidity', label: 'Liquidity', weight: 10 },
  { key: 'cashflow', label: 'Cash Flow', weight: 20 },
  { key: 'management', label: 'Management Quality', weight: 10 },
  { key: 'industry', label: 'Industry Risk', weight: 10 },
  { key: 'collateral', label: 'Collateral Coverage', weight: 10 },
  { key: 'relationship', label: 'Relationship History', weight: 10 },
  { key: 'market_conditions', label: 'Market Conditions', weight: 5 },
];

const DEFAULT_RETAIL_FACTORS: ScorecardFactor[] = [
  { key: 'financial_performance', label: 'Financial Performance', weight: 5 },
  { key: 'leverage', label: 'Leverage', weight: 5 },
  { key: 'liquidity', label: 'Liquidity', weight: 5 },
  { key: 'cashflow', label: 'Cash Flow (DSR)', weight: 30 },
  { key: 'management', label: 'Management Quality', weight: 10 },
  { key: 'industry', label: 'Industry Risk', weight: 10 },
  { key: 'collateral', label: 'Collateral Coverage', weight: 10 },
  { key: 'relationship', label: 'Relationship History', weight: 15 },
  { key: 'market_conditions', label: 'Market Conditions', weight: 10 },
];

const PRODUCT_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', TRADE_FINANCE: 'Trade Finance',
  PROJECT_FINANCE: 'Project Finance', SYNDICATED: 'Syndicated', BRIDGE_LOAN: 'Bridge Loan',
  OVERDRAFT: 'Overdraft', LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee',
};

const ScorecardManagement: React.FC = () => {
  const { user } = useAuth();
  const canAdmin = hasPermission(user, 'credit:admin');
  const canWrite = hasPermission(user, 'credit:write');

  const [scorecards, setScorecards] = useState<CreditScorecard[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<CreditScorecardVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Create scorecard dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', productType: '' as CreditProductType | '' });
  const [creating, setCreating] = useState(false);

  // Create version dialog
  const [showVersionDialog, setShowVersionDialog] = useState<string | null>(null);
  const [versionFactors, setVersionFactors] = useState<ScorecardFactor[]>([...DEFAULT_FACTORS]);
  const [retailFactors, setRetailFactors] = useState<ScorecardFactor[]>([...DEFAULT_RETAIL_FACTORS]);
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
      await scorecardApi.createVersion(showVersionDialog, { factors: versionFactors, retailFactors });
      setShowVersionDialog(null);
      setVersionFactors([...DEFAULT_FACTORS]);
      setRetailFactors([...DEFAULT_RETAIL_FACTORS]);
      fetchVersions(showVersionDialog);
      fetchScorecards();
    } catch (e) { console.error(e); }
    finally { setCreatingVersion(false); }
  };

  const handleActivateVersion = async (versionId: string) => {
    if (!confirm('Activate this version? It will replace the current active version.')) return;
    try {
      setActivationError(null);
      setActivating(versionId);
      await scorecardApi.activateVersion(versionId);
      if (expandedId) fetchVersions(expandedId);
      fetchScorecards();
      toast.success('Scorecard version activated');
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

  const totalWeight = versionFactors.reduce((sum, f) => sum + f.weight, 0);
  const weightsValid = totalWeight === 100;

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
            <strong>Activation failed:</strong> {activationError}
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
                        <button onClick={() => { setVersionFactors([...DEFAULT_FACTORS]); setShowVersionDialog(sc.id); }}
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
                                    v.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
                                  }`}>
                                    {v.isActive ? 'Active' : 'Inactive'}
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
                                  {v.approvedBy ? `${v.approvedBy.firstName} ${v.approvedBy.lastName}` : '—'}
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                  {!v.isActive && canAdmin && v.approvedById && (
                                    <button onClick={() => handleActivateVersion(v.id)} disabled={activating === v.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                                      {activating === v.id ? 'Activating...' : 'Activate'}
                                    </button>
                                  )}
                                  {!v.isActive && canAdmin && !v.approvedById && (
                                    <span className="text-xs font-semibold text-amber-700" title="A maker must approve this version before a different checker can activate it">
                                      Approval required
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
                  <select value={createForm.productType} onChange={e => setCreateForm(f => ({ ...f, productType: e.target.value as CreditProductType }))}
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
              <p className="text-sm text-text-secondary mb-4">Define the 9 factor weights. They must sum to exactly 100.</p>

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

              <div className={`p-3 rounded-lg text-sm font-bold ${retailFactors.reduce((s, f) => s + f.weight, 0) === 100 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                Retail Total: {retailFactors.reduce((s, f) => s + f.weight, 0)}% {retailFactors.reduce((s, f) => s + f.weight, 0) === 100 ? '' : `(need ${100 - retailFactors.reduce((s, f) => s + f.weight, 0) > 0 ? '+' : ''}${100 - retailFactors.reduce((s, f) => s + f.weight, 0)}%)`}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowVersionDialog(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={handleCreateVersion} disabled={!weightsValid || retailFactors.reduce((s, f) => s + f.weight, 0) !== 100 || creatingVersion}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {creatingVersion ? 'Creating...' : 'Create Version'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ScorecardManagement;