import React, { useState, useEffect, useCallback } from 'react';
import crmService, { AssignmentRule } from '../src/services/crm.service';

export default function CrmAssignmentRulesAdmin() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AssignmentRule | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    territoryId: '',
    sourceMatch: '',
    roundRobin: false,
    isActive: true,
    priority: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmService.listAssignmentRules();
      setRules(data);
    } catch (e) {
      console.error('Failed to load assignment rules', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ name: '', territoryId: '', sourceMatch: '', roundRobin: false, isActive: true, priority: 0 });
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        territoryId: form.territoryId || null,
        sourceMatch: form.sourceMatch || null,
      };
      if (editing) {
        await crmService.updateAssignmentRule(editing.id, payload);
      } else {
        await crmService.createAssignmentRule(payload);
      }
      resetForm();
      load();
    } catch (e) {
      console.error('Failed to save rule', e);
      alert('Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment rule?')) return;
    try {
      await crmService.deleteAssignmentRule(id);
      load();
    } catch (e) {
      console.error('Failed to delete rule', e);
    }
  };

  const startEdit = (rule: AssignmentRule) => {
    setEditing(rule);
    setCreating(true);
    setForm({
      name: rule.name,
      territoryId: rule.territoryId ?? '',
      sourceMatch: rule.sourceMatch ?? '',
      roundRobin: rule.roundRobin,
      isActive: rule.isActive,
      priority: rule.priority,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assignment Rules</h1>
        {!creating && (
          <button
            onClick={() => { setCreating(true); resetForm(); setCreating(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            + Add Rule
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{editing ? 'Edit Rule' : 'New Rule'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Website leads"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory ID (optional)</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.territoryId}
                onChange={e => setForm(f => ({ ...f, territoryId: e.target.value }))}
                placeholder="UUID or leave blank"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Match</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.sourceMatch}
                onChange={e => setForm(f => ({ ...f, sourceMatch: e.target.value }))}
                placeholder="e.g. source=WEBSITE"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.roundRobin}
                  onChange={e => setForm(f => ({ ...f, roundRobin: e.target.checked }))}
                />
                Round Robin
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              {editing ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : rules.length === 0 ? (
        <p className="text-gray-500">No assignment rules configured. Create one above.</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source Match</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Territory</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Round Robin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rule.priority}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{rule.sourceMatch ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {rule.territory?.name ?? rule.territoryId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rule.roundRobin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                      {rule.roundRobin ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button onClick={() => startEdit(rule)} className="text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}