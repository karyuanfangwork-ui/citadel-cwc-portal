import React, { useState, useEffect } from 'react';
import { adminService, WorkflowTransition, WorkflowTransitionInput } from '../../services/admin.service';
import apiClient from '../../services/api';

const ROLES = ['ADMIN', 'AGENT', 'NORMAL_STAFF', 'IT_AGENT', 'MANAGER', 'IT_SUPPORT', 'HR_AGENT', 'FINANCE_AGENT', 'CEO', 'CTO', 'CFO', 'CMO', 'GROUP_DCEO'];
const LABEL_OPTIONS = ['APPROVE', 'REJECT', 'SUBMIT', 'ADVANCE', 'RETURN', 'ESCALATE', 'CLOSE'];

const emptyForm = (): WorkflowTransitionInput => ({
  fromStatus: '',
  toStatus: '',
  transitionLabel: undefined,
  requiresComment: false,
  autoAssignRole: undefined,
  autoAssignUserId: undefined,
  isActive: true,
});

export const WorkflowTransitionTab: React.FC = () => {
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkflowTransition | null>(null);
  const [form, setForm] = useState<WorkflowTransitionInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedFrom, setExpandedFrom] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        adminService.listWorkflowTransitions(),
        adminService.listWorkflowStatuses(),
      ]);
      setTransitions(t);
      setStatuses(s);
      // Fetch active agents/admins for autoAssignUserId dropdown
      try {
        const uRes = await apiClient.get('/users', { params: { role: 'AGENT,ADMIN', limit: 200 } });
        setUsers(uRes.data?.data?.users || uRes.data?.data || []);
      } catch { /* non-critical — dropdown will be empty */ }
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

  const openEdit = (t: WorkflowTransition) => {
    setEditing(t);
    setForm({
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      transitionLabel: t.transitionLabel ?? undefined,
      requiresComment: t.requiresComment,
      autoAssignRole: t.autoAssignRole ?? undefined,
      autoAssignUserId: t.autoAssignUserId ?? undefined,
      isActive: t.isActive,
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.fromStatus || !form.toStatus) { setError('From Status and To Status are required'); return; }
    if (form.fromStatus === form.toStatus) { setError('From and To status must be different'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const updated = await adminService.updateWorkflowTransition(editing.id, form);
        setTransitions(prev => prev.map(t => t.id === editing.id ? updated : t));
      } else {
        const created = await adminService.createWorkflowTransition(form);
        setTransitions(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save transition');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminService.deleteWorkflowTransition(id);
      setTransitions(prev => prev.filter(t => t.id !== id));
      setDeleteId(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete transition');
    }
  };

  // Group by fromStatus
  const grouped = transitions.reduce<Record<string, WorkflowTransition[]>>((acc, t) => {
    if (!acc[t.fromStatus]) acc[t.fromStatus] = [];
    acc[t.fromStatus].push(t);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-[#101418]">Workflow Transitions</h2>
          <p className="text-sm text-[#44546f] mt-1">{transitions.length} transition{transitions.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-bold hover:bg-[#0747a6] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Transition
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-[#101418]">{editing ? 'Edit Transition' : 'Add Transition'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44546f] mb-1">From Status *</label>
                  <select
                    value={form.fromStatus}
                    onChange={e => setForm(f => ({ ...f, fromStatus: e.target.value }))}
                    disabled={!!editing}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0052cc] disabled:bg-gray-50"
                  >
                    <option value="">Select...</option>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44546f] mb-1">To Status *</label>
                  <select
                    value={form.toStatus}
                    onChange={e => setForm(f => ({ ...f, toStatus: e.target.value }))}
                    disabled={!!editing}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0052cc] disabled:bg-gray-50"
                  >
                    <option value="">Select...</option>
                    {statuses.filter(s => s !== form.fromStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44546f] mb-1">Transition Label</label>
                <select
                  value={form.transitionLabel ?? ''}
                  onChange={e => setForm(f => ({ ...f, transitionLabel: e.target.value || undefined }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0052cc]"
                >
                  <option value="">— none —</option>
                  {LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44546f] mb-1">Auto-Assign Role</label>
                  <select
                    value={form.autoAssignRole ?? ''}
                    onChange={e => setForm(f => ({ ...f, autoAssignRole: e.target.value || undefined, autoAssignUserId: e.target.value ? undefined : f.autoAssignUserId }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0052cc]"
                  >
                    <option value="">— none —</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <p className="text-[10px] text-[#8993a4] mt-1">Assigns to the first active user with this role.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44546f] mb-1">Auto-Assign User</label>
                  <select
                    value={form.autoAssignUserId ?? ''}
                    onChange={e => setForm(f => ({ ...f, autoAssignUserId: e.target.value || undefined, autoAssignRole: e.target.value ? undefined : f.autoAssignRole }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0052cc]"
                  >
                    <option value="">— none —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
                  </select>
                  <p className="text-[10px] text-[#8993a4] mt-1">Specific user takes priority over role.</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-bold text-[#101418] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresComment}
                    onChange={e => setForm(f => ({ ...f, requiresComment: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  Requires Comment
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-[#101418] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-bold text-[#44546f] hover:text-[#101418] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-bold hover:bg-[#0747a6] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-[#101418] mb-2">Delete Transition?</h3>
            <p className="text-sm text-[#44546f] mb-6">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-bold text-[#44546f]">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Transitions List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin"><span className="material-symbols-outlined">hourglass_top</span></div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12 text-sm text-[#44546f]">No transitions configured</div>
          )}
          {(Object.entries(grouped) as [string, WorkflowTransition[]][])
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([fromStatus, items]) => (
              <div key={fromStatus} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedFrom(expandedFrom === fromStatus ? null : fromStatus)}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg text-[#0052cc]">call_split</span>
                    <div className="text-left">
                      <span className="font-bold text-[#101418]">{fromStatus}</span>
                      <span className="text-xs text-[#44546f] ml-3">{items.length} transition{items.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-lg text-[#44546f]">
                    {expandedFrom === fromStatus ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedFrom === fromStatus && (
                  <div className="divide-y divide-gray-100">
                    {items.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#44546f] font-mono">→</span>
                          <div>
                            <span className="font-bold text-sm text-[#101418]">{t.toStatus}</span>
                            <div className="flex items-center gap-3 mt-1">
                              {t.transitionLabel && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{t.transitionLabel}</span>
                              )}
                              {t.autoAssignRole && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">→ {t.autoAssignRole}</span>
                              )}
                              {t.autoAssignUserId && (
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">👤 specific user</span>
                              )}
                              {t.requiresComment && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">💬</span>
                              )}
                              {!t.isActive && (
                                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">Inactive</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-2 text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
