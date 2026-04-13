// frontend/src/components/request-detail/SubmitForApprovalModal.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import itWorkflowService from '../../services/it-workflow.service';

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface SubmitForApprovalModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const SubmitForApprovalModal: React.FC<SubmitForApprovalModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filtered, setFiltered] = useState<Manager[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [suggestedManagerId, setSuggestedManagerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 100 } });
        const all: Manager[] = res.data.data.users.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          roles: u.roles?.map((r: any) => (typeof r === 'string' ? r : (r.role?.name ?? r.name))) ?? [],
        }));
        const adminsAndManagers = all.filter(u =>
          u.roles.some(r => ['ADMIN', 'admin', 'CEO', 'ceo', 'MANAGER', 'manager'].includes(r))
        );
        setManagers(adminsAndManagers);
        setFiltered(adminsAndManagers);

        // Auto-suggest requester's direct manager
        try {
          const { suggestedManager } = await itWorkflowService.getSuggestedManager(requestId);
          if (suggestedManager) {
            setSuggestedManagerId(suggestedManager.id);
            // Pre-select only if this manager is in the list
            const inList = adminsAndManagers.some(m => m.id === suggestedManager.id);
            if (inList) {
              setSelectedId(suggestedManager.id);
            }
          }
        } catch {
          // Non-fatal: just skip auto-suggest
        }
      } catch {
        setError('Failed to load managers');
      } finally {
        setLoading(false);
      }
    };
    fetchManagers();
  }, [requestId]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      managers.filter(
        m =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    );
  }, [search, managers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.submitForApproval(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">approval</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Submit for Manager Approval</h2>
            <p className="text-xs text-gray-500">IT Workflow · Select approving manager</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search Manager
              </label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] [&::-webkit-search-cancel-button]:hidden"
              />
              <p className="text-xs text-gray-400 mt-1">Showing Admin / Manager users</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select Manager <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading managers…</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No managers found</p>
                  ) : (
                    filtered.map(m => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === m.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="manager"
                          value={m.id}
                          checked={selectedId === m.id}
                          onChange={() => setSelectedId(m.id)}
                          className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                        />
                        <div className="size-8 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                            {suggestedManagerId === m.id && (
                              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                Suggested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes to Manager <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context the manager should know…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitForApprovalModal;
