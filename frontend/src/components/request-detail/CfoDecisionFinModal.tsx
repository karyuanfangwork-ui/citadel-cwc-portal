// frontend/src/components/request-detail/CfoDecisionFinModal.tsx
// Dedicated CFO Decision modal for Finance Purchase Requisition workflow.
// Shows the attached invoice preview (if any) before the CFO approves/rejects.
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Attachment {
  id: string;
  fileName: string;
  storageUrl: string;
  mimeType: string;
  createdAt: string;
}

interface CfoDecisionFinModalProps {
  requestId: string;
  attachments?: Attachment[];
  onSuccess: () => void;
  onClose: () => void;
}

const API_BASE = ((import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1') as string;

const CfoDecisionFinModal: React.FC<CfoDecisionFinModalProps> = ({
  requestId,
  attachments = [],
  onSuccess,
  onClose,
}) => {
  const invoiceAttachments = attachments;
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) {
      setError('Please select Confirm or Reject');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.cfoDecision(requestId, decision, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-green-50">
          <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-600">gavel</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CFO Decision</h2>
            <p className="text-xs text-gray-500">Finance Purchase Requisition · Review Invoice & Confirm</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Invoice preview */}
            {invoiceAttachments.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {invoiceAttachments.length === 1 ? 'Attachment' : `Attachments (${invoiceAttachments.length})`}
                </label>
                <div className="space-y-2">
                  {invoiceAttachments.map(att => (
                    <div key={att.id} className="rounded-lg border border-gray-200 overflow-hidden">
                      {att.mimeType === 'application/pdf' ? (
                        <iframe
                          src={`${API_BASE}/requests/${requestId}/attachments/${att.id}?inline=true`}
                          className="w-full h-48"
                          title={att.fileName}
                        />
                      ) : (
                        <img
                          src={`${API_BASE}/requests/${requestId}/attachments/${att.id}?inline=true`}
                          alt={att.fileName}
                          className="w-full max-h-48 object-contain bg-gray-50"
                        />
                      )}
                      <a
                        href={`${API_BASE}/requests/${requestId}/attachments/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:underline bg-gray-50 border-t border-gray-100"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        {att.fileName}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Decision <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDecision('APPROVED')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg border-2 transition-colors ${
                    decision === 'APPROVED'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                  }`}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('REJECTED')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg border-2 transition-colors ${
                    decision === 'REJECTED'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                placeholder="Add any comments for the requester"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!decision || submitting}
              className={`px-4 py-3 text-sm font-bold text-white rounded-lg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                decision === 'REJECTED'
                  ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600'
                  : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-600'
              }`}
            >
              {submitting ? 'Submitting…' : decision === 'REJECTED' ? 'Reject' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default CfoDecisionFinModal;