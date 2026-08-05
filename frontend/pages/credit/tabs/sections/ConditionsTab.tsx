import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  conditionApi,
  ConditionPrecedent,
  CpCompletionStatus,
  ConditionCategory,
} from '../../../../src/services/credit.service';
import { useAuth } from '../../../../src/context/AuthContext';
import { hasPermission } from '../../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../../src/utils/errorMessages';
import { formatDate } from '../../creditUtils';
import EmptyState from '../../../../src/components/EmptyState';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import StateBadge from '../../../../src/components/ui/StateBadge';

interface ConditionsTabProps {
  // No props needed — fetches its own data based on URL param
}

const ConditionsTab: React.FC<ConditionsTabProps> = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'credit:write');

  const [conditions, setConditions] = useState<ConditionPrecedent[]>([]);
  const [cpCompletion, setCpCompletion] = useState<CpCompletionStatus | null>(null);
  const [completingCondition, setCompletingCondition] = useState<string | null>(null);
  const [waiveDialogId, setWaiveDialogId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waivingCondition, setWaivingCondition] = useState(false);
  const [showAddConditionDialog, setShowAddConditionDialog] = useState(false);
  const [conditionForm, setConditionForm] = useState({ title: '', description: '', category: 'PRE_DISBURSEMENT' as ConditionCategory, dueDate: '' });
  const [savingCondition, setSavingCondition] = useState(false);

  const fetchConditions = useCallback(async () => {
    if (!id) return;
    try {
      const [conds, cp] = await Promise.all([
        conditionApi.list(id),
        conditionApi.checkCpCompletion(id),
      ]);
      setConditions(conds);
      setCpCompletion(cp);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load conditions')); }
  }, [id]);

  useEffect(() => { fetchConditions(); }, [fetchConditions]);

  const handleCompleteCondition = async (conditionId: string) => {
    try {
      setCompletingCondition(conditionId);
      await conditionApi.completeCondition(conditionId);
      toast.success('Condition completed');
      fetchConditions();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to complete condition')); }
    finally { setCompletingCondition(null); }
  };

  const handleWaiveCondition = async () => {
    if (!waiveDialogId || !waiveReason) return;
    try {
      setWaivingCondition(true);
      await conditionApi.waiveCondition(waiveDialogId, { reason: waiveReason });
      toast.success('Condition waived');
      setWaiveDialogId(null);
      setWaiveReason('');
      fetchConditions();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to waive condition')); }
    finally { setWaivingCondition(false); }
  };

  const handleCreateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingCondition(true);
      await conditionApi.create(id, {
        title: conditionForm.title,
        description: conditionForm.description || undefined,
        category: conditionForm.category,
        dueDate: conditionForm.dueDate ? new Date(conditionForm.dueDate).toISOString() : undefined,
      });
      toast.success('Condition added');
      setShowAddConditionDialog(false);
      setConditionForm({ title: '', description: '', category: 'PRE_DISBURSEMENT', dueDate: '' });
      fetchConditions();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to add condition')); }
    finally { setSavingCondition(false); }
  };

  const addConditionAction = canWrite ? (
    <button onClick={() => setShowAddConditionDialog(true)}
      className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      <span className="material-symbols-outlined text-base">add</span> Add Condition
    </button>
  ) : undefined;

  return (
    <>
      <CaMemoSection title="Conditions" phase="Phase 4" actions={addConditionAction}>
        {/* CP Completion Gate */}
        {cpCompletion && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 ${cpCompletion.isComplete ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${cpCompletion.isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <span className="material-symbols-outlined text-2xl">{cpCompletion.isComplete ? 'check_circle' : 'pending'}</span>
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${cpCompletion.isComplete ? 'text-green-700' : 'text-amber-700'}`}>
                {cpCompletion.isComplete ? 'All Conditions Precedent Satisfied' : 'Conditions Precedent Pending'}
              </p>
              <div className="flex gap-3 mt-1 text-xs">
                <span className={cpCompletion.completedCount > 0 ? 'text-green-700 font-bold' : 'text-text-secondary'}>
                  Completed: {cpCompletion.completedCount}
                </span>
                <span className={cpCompletion.waivedCount > 0 ? 'text-amber-700 font-bold' : 'text-text-secondary'}>
                  Waived: {cpCompletion.waivedCount}
                </span>
                <span className={cpCompletion.pendingCount > 0 ? 'text-red-700 font-bold' : 'text-text-secondary'}>
                  Pending: {cpCompletion.pendingCount}
                </span>
                <span className="text-text-secondary">Total: {cpCompletion.totalConditions}</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${cpCompletion.isComplete ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${cpCompletion.totalConditions > 0 ? ((cpCompletion.completedCount + cpCompletion.waivedCount) / cpCompletion.totalConditions * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {conditions.length === 0 ? (
          <EmptyState icon="checklist" title="No Conditions" description="Conditions precedent and subsequent will appear here." />
        ) : (
          <div className="space-y-6">
            {/* §2.5 — Group by source: decision-linked vs manually added */}
            {(() => {
              const fromDecision = conditions.filter(c => c.decisionId);
              const manual = conditions.filter(c => !c.decisionId);
              const renderCondition = (cond: typeof conditions[0]) => {
                const isOverdue = cond.status === 'PENDING' && cond.dueDate && new Date(cond.dueDate) < new Date();
                return (
                  <div key={cond.id} className={`bg-bg-surface border rounded-xl p-4 ${isOverdue ? 'border-red-300' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        cond.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        cond.status === 'WAIVED' ? 'bg-purple-100 text-purple-700' :
                        isOverdue ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        <span className="material-symbols-outlined text-base">
                          {cond.status === 'COMPLETED' ? 'check_circle' :
                           cond.status === 'WAIVED' ? 'verified' :
                           isOverdue ? 'warning' :
                           'radio_button_unchecked'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-text-primary text-sm">{cond.title}</p>
                          <StateBadge state={cond.status} size="sm" />
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bg-subtle text-text-secondary">
                            {cond.category.replace(/_/g, ' ')}
                          </span>
                          {cond.conditionType && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                              {cond.conditionType}
                            </span>
                          )}
                        </div>
                        {cond.description && <p className="text-xs text-text-secondary mt-0.5">{cond.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                          {cond.dueDate && (
                            <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                              Due: {formatDate(cond.dueDate)}{isOverdue ? ' (Overdue!)' : ''}
                            </span>
                          )}
                          {cond.completedAt && <span>Completed: {formatDate(cond.completedAt)}</span>}
                          {cond.waivedAt && <span>Waived: {formatDate(cond.waivedAt)}</span>}
                        </div>
                      </div>
                      {canWrite && cond.status === 'PENDING' && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleCompleteCondition(cond.id)} disabled={completingCondition === cond.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <span className="material-symbols-outlined text-sm">check</span>
                            {completingCondition === cond.id ? '...' : 'Complete'}
                          </button>
                          <button onClick={() => { setWaiveDialogId(cond.id); setWaiveReason(''); }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
                            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <span className="material-symbols-outlined text-sm">block</span> Waive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {fromDecision.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-amber-600 text-base">gavel</span>
                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide">From Approval Decision</h4>
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{fromDecision.length}</span>
                      </div>
                      <div className="space-y-2">{fromDecision.map(renderCondition)}</div>
                    </div>
                  )}
                  {manual.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-gray-500 text-base">edit_note</span>
                        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Added Manually</h4>
                        <span className="text-[10px] text-text-secondary bg-bg-subtle border border-border px-1.5 py-0.5 rounded-full">{manual.length}</span>
                      </div>
                      <div className="space-y-2">{manual.map(renderCondition)}</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </CaMemoSection>

      {/* Waive Condition Dialog */}
      {waiveDialogId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setWaiveDialogId(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Waive Condition</h2>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Waiver Reason *</label>
              <textarea rows={3} value={waiveReason} onChange={e => setWaiveReason(e.target.value)}
                placeholder="Provide reason for waiving this condition..."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setWaiveDialogId(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={handleWaiveCondition} disabled={!waiveReason || waivingCondition}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                {waivingCondition ? 'Waiving...' : 'Waive Condition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Condition Dialog */}
      {showAddConditionDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowAddConditionDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Condition</h2>
            <form onSubmit={handleCreateCondition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title *</label>
                <input required value={conditionForm.title} onChange={e => setConditionForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea rows={2} value={conditionForm.description} onChange={e => setConditionForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Category *</label>
                  <select required value={conditionForm.category} onChange={e => setConditionForm(f => ({ ...f, category: e.target.value as ConditionCategory }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {['PRE_DISBURSEMENT', 'POST_DISBURSEMENT', 'FINANCIAL_COVENANT', 'REPORTING', 'OTHER'].map(c => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Due Date</label>
                  <input type="date" value={conditionForm.dueDate} onChange={e => setConditionForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddConditionDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingCondition}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingCondition ? 'Saving...' : 'Add Condition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ConditionsTab;