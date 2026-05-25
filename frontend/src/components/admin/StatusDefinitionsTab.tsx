import React, { useState, useEffect } from 'react';
import { requestStatusService, RequestStatusDefinition, CreateStatusDefinitionInput } from '../../services/requestStatusService';

const CATEGORIES = ['GENERAL', 'HR', 'ONBOARDING', 'IT', 'FINANCE'];

const emptyForm = (): CreateStatusDefinitionInput => ({
  code: '',
  label: '',
  description: '',
  category: 'GENERAL',
  displayOrder: 0,
  isActive: true,
});

export const StatusDefinitionsTab: React.FC = () => {
  const [definitions, setDefinitions] = useState<RequestStatusDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RequestStatusDefinition | null>(null);
  const [form, setForm] = useState<CreateStatusDefinitionInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, [filterCategory]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await requestStatusService.getAll(filterCategory || undefined);
      setDefinitions(data);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = (def: RequestStatusDefinition) => {
    setEditing(def);
    setForm({ code: def.code, label: def.label, description: def.description ?? '', category: def.category ?? 'GENERAL', displayOrder: def.displayOrder, isActive: def.isActive });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.label) { setError('Code and label are required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const updated = await requestStatusService.update(editing.id, form);
        setDefinitions(prev => prev.map(d => d.id === editing.id ? updated : d));
      } else {
        const created = await requestStatusService.create(form);
        setDefinitions(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (def: RequestStatusDefinition) => {
    if (!confirm(`Delete status definition "${def.code}"? This will fail if banner configs reference it.`)) return;
    try {
      await requestStatusService.delete(def.id);
      setDefinitions(prev => prev.filter(d => d.id !== def.id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Delete failed');
    }
  };

  return (
    <div>
      <div className="mb-8 p-6 bg-purple-50 rounded-2xl border border-purple-200">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Request Status Definitions</h3>
        <p className="text-sm text-gray-600">
          Manage human-readable labels and metadata for each request status code. These codes must match the Prisma <code className="bg-white px-1 rounded">RequestStatus</code> enum.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700"
        >
          + Add Status
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Label</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {definitions.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No definitions found.</td></tr>
              )}
              {definitions.map(def => (
                <tr key={def.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700">{def.code}</td>
                  <td className="px-4 py-3 text-gray-900">{def.label}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{def.category ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{def.displayOrder}</td>
                  <td className="px-4 py-3">
                    {def.isActive
                      ? <span className="text-xs px-2 py-0.5 bg-green-50 rounded-full text-green-700">Yes</span>
                      : <span className="text-xs px-2 py-0.5 bg-red-50 rounded-full text-red-600">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(def)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Edit</button>
                      <button onClick={() => handleDelete(def)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit Status Definition' : 'Add Status Definition'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Code (exact enum value)</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="e.g. PENDING_CEO_APPROVAL"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    disabled={!!editing}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Label</label>
                  <input
                    value={form.label}
                    onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. Pending CEO Approval"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={e => setForm(p => ({ ...p, displayOrder: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                Active
              </label>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
