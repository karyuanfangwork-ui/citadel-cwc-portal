import React from 'react';
import { Link } from 'react-router-dom';
import crmService, { ScoringRule } from '../src/services/crm.service';

const OPERATORS: ScoringRule['operator'][] = ['equals', 'contains', 'gt', 'lt', 'starts_with', 'not_empty'];
const FIELDS = ['source', 'status', 'company', 'title', 'estimatedValue', 'contactEmail', 'contactPhone', 'description'];

export default function CrmLeadScoringAdmin() {
  const [rules, setRules] = React.useState<ScoringRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ field: 'source', operator: 'equals' as ScoringRule['operator'], value: '', points: 10, isActive: true });
  const [saving, setSaving] = React.useState(false);
  const [recomputing, setRecomputing] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    crmService.listScoringRules()
      .then(setRules)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const rule = await crmService.createScoringRule(form);
      setRules(prev => [...prev, rule]);
      setForm({ field: 'source', operator: 'equals', value: '', points: 10, isActive: true });
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      const rule = await crmService.updateScoringRule(id, form);
      setRules(prev => prev.map(r => r.id === id ? rule : r));
      setEditingId(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await crmService.deleteScoringRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const result = await crmService.recomputeScores();
      alert(`Recomputed scores for ${result.count} leads.`);
      load();
    } finally { setRecomputing(false); }
  };

  const startEdit = (rule: ScoringRule) => {
    setEditingId(rule.id);
    setForm({ field: rule.field, operator: rule.operator, value: rule.value, points: rule.points, isActive: rule.isActive });
  };

  if (loading) return <div className="p-6"><div className="animate-pulse space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded" />)}</div></div>;

  const totalPoints = rules.filter(r => r.isActive).reduce((s, r) => s + r.points, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-text-secondary mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-[#006a61] transition-colors">CRM</Link>
            <span className="text-text-secondary/40">›</span>
            <span className="font-bold text-[#006a61]">Scoring</span>
          </div>
          <h2 className="text-xl font-black text-text-primary">Lead Scoring Rules</h2>
          <p className="text-sm text-text-secondary mt-1">{rules.length} rules · {totalPoints} max points from active rules</p>
        </div>
        <button onClick={handleRecompute} disabled={recomputing}
          className="px-4 py-2 bg-gold text-text-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {recomputing ? 'Recomputing...' : '↻ Recompute All Scores'}
        </button>
      </div>

      {/* Add / Edit form */}
      <div className="bg-bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">
          {editingId ? 'Edit Rule' : 'Add Rule'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm">
            {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value as ScoringRule['operator'] }))}
            className="px-3 py-2 border border-border rounded-lg text-sm">
            {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="text" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            placeholder="Value" disabled={form.operator === 'not_empty'}
            className="px-3 py-2 border border-border rounded-lg text-sm" />
          <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
            className="px-3 py-2 border border-border rounded-lg text-sm" />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Active
            </label>
            {editingId ? (
              <>
                <button onClick={() => handleUpdate(editingId)} disabled={saving}
                  className="px-3 py-1.5 bg-accent text-white rounded text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Update'}
                </button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
              </>
            ) : (
              <button onClick={handleAdd} disabled={saving}
                className="px-3 py-1.5 bg-accent text-white rounded text-sm font-semibold disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Rule'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rules table */}
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">Field</th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">Operator</th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">Value</th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">Points</th>
              <th className="px-4 py-3 text-center font-semibold text-text-secondary">Active</th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-secondary">No rules yet. Add one above.</td></tr>
            )}
            {rules.map(rule => (
              <tr key={rule.id} className={`border-b border-border ${!rule.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs">{rule.field}</td>
                <td className="px-4 py-3">{rule.operator}</td>
                <td className="px-4 py-3">{rule.operator === 'not_empty' ? '—' : rule.value}</td>
                <td className="px-4 py-3 text-right font-semibold">{rule.points}</td>
                <td className="px-4 py-3 text-center">
                  {rule.isActive ? <span className="text-green-600">●</span> : <span className="text-gray-400">○</span>}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(rule)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}