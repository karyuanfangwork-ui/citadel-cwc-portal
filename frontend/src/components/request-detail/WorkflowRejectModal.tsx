// frontend/src/components/request-detail/WorkflowRejectModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';

const REJECTION_REASONS = [
  'Budget not available',
  'Duplicate request',
  'Not within policy',
  'Other',
];

interface WorkflowRejectModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const WorkflowRejectModal: React.FC<WorkflowRejectModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    const fullComment = notes.trim() ? `${reason}: ${notes.trim()}` : reason;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.managerDecision(requestId, 'REJECTED', fullComment);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600">cancel</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Reject Request</h2>
            <p className="text-xs text-gray-500">IT Workflow · Manager Approval</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REJECTION_REASONS.map(r => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      reason === r ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-red-600"
                    />
                    <span className="text-sm font-semibold text-gray-700">{r}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Additional Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Provide more context for the requester…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 resize-none"
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
              disabled={!reason || submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Rejecting…' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkflowRejectModal;
