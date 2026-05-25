// frontend/src/components/request-detail/CeoDecisionModal.tsx
import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import approvalService from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface ExecUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CeoDecisionModalProps {
  requestId: string;
  serviceDeskCode: string;
  serviceDeskName: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CeoDecisionModal: React.FC<CeoDecisionModalProps> = ({
  requestId,
  serviceDeskCode,
  serviceDeskName,
  onSuccess,
  onClose,
}) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  // CTO selector state (only for IT workflow approve)
  const [ctos, setCtos] = useState<ExecUser[]>([]);
  const [filteredCtos, setFilteredCtos] = useState<ExecUser[]>([]);
  const [ctoSearch, setCtoSearch] = useState('');
  const [selectedCtoId, setSelectedCtoId] = useState('');
  const [loadingCtos, setLoadingCtos] = useState(false);

  const isIT = serviceDeskCode === 'IT';
  const isHR = serviceDeskCode === 'HR';

  // Fetch CTO users when modal opens for IT workflow
  useEffect(() => {
    if (!isIT) return;
    const fetchCtos = async () => {
      try {
        setLoadingCtos(true);
        const users = await itWorkflowService.getUsersByRole('CTO');
        setCtos(users);
        setFilteredCtos(users);
      } catch {
        setError('Failed to load CTO users');
      } finally {
        setLoadingCtos(false);
      }
    };
    fetchCtos();
  }, [isIT]);

  // Filter CTO users by search
  useEffect(() => {
    if (!isIT) return;
    const q = ctoSearch.toLowerCase();
    setFilteredCtos(
      ctos.filter(
        c =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
    );
  }, [ctoSearch, ctos, isIT]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (isIT) {
        await itWorkflowService.ceoDecision(requestId, 'APPROVED', comments || undefined, selectedCtoId || undefined);
      } else if (isHR) {
        await approvalService.ceoDecision(requestId, 'APPROVED', comments || undefined);
      } else {
        throw new Error(`CEO approval not implemented for service desk: ${serviceDeskCode}`);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (isIT) {
        await itWorkflowService.ceoDecision(requestId, 'REJECTED', comments || undefined);
      } else if (isHR) {
        await approvalService.ceoDecision(requestId, 'REJECTED', comments || undefined);
      } else {
        throw new Error(`CEO rejection not implemented for service desk: ${serviceDeskCode}`);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  // For IT workflow approve: CTO must be selected
  const canApprove = isIT ? !!selectedCtoId : true;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50 sticky top-0 z-10">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">verified_user</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CEO Approval</h2>
            <p className="text-xs text-gray-500">{serviceDeskName} · CEO Decision Required</p>
          </div>
        </div>
        <form>
          <div className="p-5 space-y-4">
            {/* CTO selector — only shown for IT workflow */}
            {isIT && (
              <div className="space-y-3 pb-4 border-b border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Select CTO <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Upon approval, this request will be routed to the selected CTO for review.</p>
                  <input
                    type="search"
                    value={ctoSearch}
                    onChange={e => setCtoSearch(e.target.value)}
                    placeholder="Type name or email…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 [&::-webkit-search-cancel-button]:hidden"
                  />
                  <p className="text-xs text-gray-400 mt-1">Showing CTO users</p>
                </div>
                <div>
                  {loadingCtos ? (
                    <p className="text-xs text-gray-400 py-2">Loading CTO users…</p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                      {filteredCtos.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">No CTO users found</p>
                      ) : (
                        filteredCtos.map(c => (
                          <label
                            key={c.id}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                              selectedCtoId === c.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="cto"
                              value={c.id}
                              checked={selectedCtoId === c.id}
                              onChange={() => setSelectedCtoId(c.id)}
                              className="accent-amber-600 w-4 h-4 flex-shrink-0"
                            />
                            <div className="size-8 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
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
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                placeholder="Add any notes for the requester"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              {submitting ? 'Rejecting…' : 'Reject'}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting || !canApprove}
              className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              {submitting ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default CeoDecisionModal;