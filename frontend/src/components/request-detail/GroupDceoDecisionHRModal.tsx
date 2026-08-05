import React, { useState } from 'react';
import * as approvalService from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface GroupDceoDecisionHRModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const GroupDceoDecisionHRModal: React.FC<GroupDceoDecisionHRModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    try {
      setSubmitting(true);
      setError(null);
      await approvalService.groupDceoDecisionHR(requestId, decision, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process Group Deputy CEO decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">gavel</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Group Deputy CEO Decision</h2>
              <p className="text-xs text-gray-500">HR Workflow · New Hiring Request</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Decision <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVED')}
                    className={`p-3 border rounded-xl text-center transition-colors ${
                      decision === 'APPROVED'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl block mx-auto mb-1">check_circle</span>
                    <span className="text-sm font-bold">Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={`p-3 border rounded-xl text-center transition-colors ${
                      decision === 'REJECTED'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl block mx-auto mb-1">cancel</span>
                    <span className="text-sm font-bold">Reject</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  placeholder="Add any comments about your decision…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!decision || submitting}
                className={`px-4 py-3 text-sm font-bold text-white rounded-lg disabled:opacity-50 ${
                  decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitting ? 'Processing…' : decision === 'REJECTED' ? 'Reject Request' : 'Approve Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default GroupDceoDecisionHRModal;