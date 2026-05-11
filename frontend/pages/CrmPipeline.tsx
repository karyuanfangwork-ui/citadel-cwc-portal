import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crmService, { CrmPipeline, CrmPipelineStage, CrmOpportunity } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

const CrmPipelineView = () => {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [activePipeline, setActivePipeline] = useState<string>('');
  const [stages, setStages] = useState<CrmPipelineStage[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggedOpp, setDraggedOpp] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [oppForm, setOppForm] = useState<Partial<CrmOpportunity & { accountName?: string }>>({});
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const pips = await crmService.listPipelines();
      setPipelines(pips);
      if (pips.length > 0) {
        const defaultPip = pips.find(p => p.isDefault) || pips[0];
        setActivePipeline(defaultPip.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!activePipeline) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await crmService.getPipeline(activePipeline);
        setStages(data.stages); setTotalValue(data.totalValue);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [activePipeline]);

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    setDraggedOpp(oppId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', oppId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const oppId = e.dataTransfer.getData('text/plain');
    if (!oppId) return;

    // Find which stage the opp is currently in
    let currentStageId = '';
    for (const stage of stages) {
      if (stage.opportunities?.some(o => o.id === oppId)) {
        currentStageId = stage.id;
        break;
      }
    }
    if (currentStageId === stageId) { setDraggedOpp(null); return; }

    const targetStage = stages.find(s => s.id === stageId);
    let lostReason: string | undefined;
    if (targetStage?.isLostStage) {
      lostReason = prompt('Reason for losing this deal:') || undefined;
    }

    try {
      await crmService.moveStage(oppId, stageId, lostReason);
      // Re-fetch pipeline data
      const data = await crmService.getPipeline(activePipeline);
      setStages(data.stages); setTotalValue(data.totalValue);
    } catch (e) { console.error(e); }
    setDraggedOpp(null);
  };

  const selectedPipeline = pipelines.find(p => p.id === activePipeline);

  const handleCreateOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipeline) return;
    const firstStage = selectedPipeline.stages?.[0];
    try {
      setSaving(true);
      await crmService.createOpportunity({
        ...oppForm,
        pipelineId: selectedPipeline.id,
        stageId: oppForm.stageId ?? firstStage?.id,
        value: oppForm.value ?? 0,
        probability: oppForm.probability ?? firstStage?.probability ?? 0,
        currency: 'MYR',
      });
      setShowCreate(false);
      setOppForm({});
      // reload pipeline data
      const pls = await crmService.listPipelines();
      setPipelines(pls);
      const data = await crmService.getPipeline(activePipeline);
      setStages(data.stages); setTotalValue(data.totalValue);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openCreateOpp = async () => {
    try {
      const accs = await crmService.listAccounts({ limit: 100 });
      setAccounts(accs.accounts.map(a => ({ id: a.id, name: a.name })));
    } catch (e) { console.error(e); }
    if (selectedPipeline?.stages?.[0]) {
      setOppForm({ stageId: selectedPipeline.stages[0].id, probability: selectedPipeline.stages[0].probability });
    }
    setShowCreate(true);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <CrmNav />
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 border-b border-border bg-surface shrink-0">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
              <span>/</span><span className="font-semibold text-text-primary">Pipeline</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-text-primary">Sales Pipeline</h1>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalValue)} total</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pipelines.length > 1 && (
              <select value={activePipeline} onChange={e => setActivePipeline(e.target.value)}
                className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button onClick={openCreateOpp}
              className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">add</span> New Deal
            </button>
            <button onClick={() => navigate('/crm/opportunities')} className="flex items-center gap-2 border border-border bg-surface text-text-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-bg-subtle transition-colors" style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">list</span> List View
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto px-4 sm:px-8 py-5" style={{ background: 'var(--color-surface-muted)' }}>
        {loading ? (
          <div className="flex gap-4 h-full">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-72 shrink-0 bg-surface border border-border rounded-xl p-4">
                <div style={{ height: 16, width: '60%', background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 16 }} />
                {[0,1,2].map(j => (
                  <div key={j} className="bg-surface-muted rounded-lg p-4 mb-3" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <div style={{ height: 12, width: '80%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 10, width: '50%', background: 'var(--color-border)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {stages.map(stage => {
              const opps = stage.opportunities || [];
              const stageValue = opps.reduce((s, o) => s + Number(o.value), 0);
              const isOver = dragOverStage === stage.id;
              return (
                <div
                  key={stage.id}
                  className={`w-72 shrink-0 bg-surface border rounded-xl flex flex-col transition-all ${isOver ? 'border-brand-400 ring-2 ring-brand-200' : 'border-border'}`}
                  onDragOver={e => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, stage.id)}
                >
                  {/* Stage Header */}
                  <div className="p-4 border-b border-border shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: stage.color }} />
                        <span className="text-sm font-extrabold text-text-primary">{stage.name}</span>
                      </div>
                      <span className="text-xs font-bold bg-surface-muted text-text-secondary px-2 py-0.5 rounded-full">{opps.length}</span>
                    </div>
                    <div className="text-xs font-semibold text-text-tertiary">{formatCurrency(stageValue)} · {stage.probability}% prob</div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: 100 }}>
                    {opps.length === 0 && (
                      <div className="text-center py-8 text-text-tertiary text-xs">
                        {isOver ? <span className="font-bold text-brand-600">Drop here</span> : 'No deals'}
                      </div>
                    )}
                    {opps.map(opp => (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={e => handleDragStart(e, opp.id)}
                        onDragEnd={() => setDraggedOpp(null)}
                        onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                        className={`bg-white border border-gray-100 rounded-lg p-3.5 cursor-grab hover:shadow-md hover:border-brand-200 transition-all ${draggedOpp === opp.id ? 'opacity-40 scale-95' : ''}`}
                        style={{ userSelect: 'none' }}
                      >
                        <div className="text-sm font-bold text-text-primary mb-1 line-clamp-2">{opp.name}</div>
                        <div className="text-lg font-black text-indigo-600 mb-2">{formatCurrency(Number(opp.value))}</div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-text-tertiary text-sm">business</span>
                            <span className="text-xs text-text-secondary truncate max-w-[120px]">{opp.account?.name}</span>
                          </div>
                          {opp.expectedCloseDate && (
                            <span className="text-xs text-text-tertiary">{formatDate(opp.expectedCloseDate)}</span>
                          )}
                        </div>
                        {opp.owner && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-indigo-600">{opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}</span>
                            </div>
                            <span className="text-xs text-text-tertiary">{opp.owner.firstName} {opp.owner.lastName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && selectedPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowCreate(false); setOppForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-black text-text-primary">New Deal</h2>
              <button onClick={() => { setShowCreate(false); setOppForm({}); }}
                className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateOpp} className="p-6 pt-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Deal Name *</label>
                <input required value={oppForm.name ?? ''} onChange={e => setOppForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Account *</label>
                <select required value={oppForm.accountId ?? ''} onChange={e => setOppForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Stage</label>
                <select value={oppForm.stageId ?? ''} onChange={e => {
                  const stage = selectedPipeline.stages?.find(s => s.id === e.target.value);
                  setOppForm(f => ({ ...f, stageId: e.target.value, probability: stage?.probability ?? f.probability }));
                }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }}>
                  {(selectedPipeline.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Value (MYR)</label>
                  <input type="number" min="0" value={oppForm.value ?? ''} onChange={e => setOppForm(f => ({ ...f, value: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Close Date</label>
                  <input type="date" value={oppForm.expectedCloseDate ?? ''} onChange={e => setOppForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setOppForm({}); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmPipelineView;
