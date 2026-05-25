// frontend/src/components/request-detail/AssignAgentModal.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { requestService } from '../../services/request.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AssignAgentModalProps {
  requestId: string;
  currentAssigneeId?: string;
  currentUserId: string;
  currentUserName: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AssignAgentModal: React.FC<AssignAgentModalProps> = ({
  requestId,
  currentAssigneeId,
  currentUserId,
  currentUserName,
  onSuccess,
  onClose,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filtered, setFiltered] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(currentAssigneeId || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await apiClient.get('/users/agents');
        setAgents(res.data.data.agents);
        setFiltered(res.data.data.agents);
      } catch {
        setError('Failed to load agents');
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      agents.filter(
        a =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      )
    );
  }, [search, agents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await requestService.assignRequest(requestId, selectedId);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setSubmitting(false);
    }
  };

  const isSelf = selectedId === currentUserId;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Assign to Agent</h2>
            <p className="text-xs text-gray-500">Select agent or claim for yourself</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Assign to self quick option */}
            <label
              className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                isSelf ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="agent"
                value={currentUserId}
                checked={isSelf}
                onChange={() => setSelectedId(currentUserId)}
                className="accent-[#0052cc]"
              />
              <div className="size-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                Me
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Assign to myself</p>
                <p className="text-xs text-gray-500">{currentUserName}</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Or search for another agent
              </label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type agent name…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>

            {loading ? (
              <p className="text-xs text-gray-400 py-2">Loading agents…</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filtered
                  .filter(a => a.id !== currentUserId)
                  .map(a => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedId === a.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="agent"
                        value={a.id}
                        checked={selectedId === a.id}
                        onChange={() => setSelectedId(a.id)}
                        className="accent-[#0052cc]"
                      />
                      <div className="size-7 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.firstName} {a.lastName}</p>
                        <p className="text-xs text-gray-500">{a.email}</p>
                      </div>
                    </label>
                  ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">Cancel</button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              {submitting ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default AssignAgentModal;
