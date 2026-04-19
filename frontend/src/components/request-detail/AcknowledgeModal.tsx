// frontend/src/components/request-detail/AcknowledgeModal.tsx
import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface Ceo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AcknowledgeModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [ceos, setCeos] = useState<Ceo[]>([]);
  const [filtered, setFiltered] = useState<Ceo[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    const fetchCeos = async () => {
      try {
        const users = await itWorkflowService.getUsersByRole('CEO');
        setCeos(users);
        setFiltered(users);
      } catch {
        setError('Failed to load CEO users');
      } finally {
        setLoading(false);
      }
    };
    fetchCeos();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      ceos.filter(
        c =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
    );
  }, [search, ceos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.acknowledgeRequest(requestId, selectedId, notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">verified_user</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Acknowledge Request</h2>
            <p className="text-xs text-gray-500">IT Workflow · Route to CEO for Approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search CEO
              </label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] [&::-webkit-search-cancel-button]:hidden"
              />
              <p className="text-xs text-gray-400 mt-1">Showing CEO users</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Select CEO <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading CEO users…</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No CEO users found</p>
                  ) : (
                    filtered.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                          selectedId === c.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="ceo"
                          value={c.id}
                          checked={selectedId === c.id}
                          onChange={() => setSelectedId(c.id)}
                          className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                        />
                        <div className="size-8 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
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
                placeholder="Any context the CEO should know…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              {submitting ? 'Acknowledging…' : 'Acknowledge & Route to CEO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcknowledgeModal;
