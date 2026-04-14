// frontend/src/components/request-detail/PendingInvoiceModal.tsx
import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface CfoUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PendingInvoiceModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PendingInvoiceModal: React.FC<PendingInvoiceModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [cfos, setCfos] = useState<CfoUser[]>([]);
  const [filtered, setFiltered] = useState<CfoUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    const fetchCfos = async () => {
      try {
        const users = await itWorkflowService.getUsersByRole('CFO');
        setCfos(users);
        setFiltered(users);
      } catch {
        setError('Failed to load CFO users');
      } finally {
        setLoading(false);
      }
    };
    fetchCfos();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      cfos.filter(
        c =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
    );
  }, [search, cfos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.routeToCfoApproval(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to route to CFO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-purple-50">
          <div className="size-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-600">receipt_long</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Pending Invoice</h2>
            <p className="text-xs text-gray-500">IT Workflow · Select CFO for Approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search CFO
              </label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 [&::-webkit-search-cancel-button]:hidden"
              />
              <p className="text-xs text-gray-400 mt-1">Showing CFO users</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select CFO <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading CFO users…</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No CFO users found</p>
                  ) : (
                    filtered.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === c.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cfo"
                          value={c.id}
                          checked={selectedId === c.id}
                          onChange={() => setSelectedId(c.id)}
                          className="accent-purple-600 w-4 h-4 flex-shrink-0"
                        />
                        <div className="size-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context the CFO should know…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
            >
              {submitting ? 'Routing…' : 'Route to CFO for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PendingInvoiceModal;
