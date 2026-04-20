// frontend/src/components/request-detail/CfoDecisionModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Attachment {
  id: string;
  fileName: string;
  storageUrl: string;
  mimeType: string;
  createdAt: string;
}

interface CfoDecisionModalProps {
  requestId: string;
  attachments?: Attachment[];
  onSuccess: () => void;
  onClose: () => void;
}

const API_ORIGIN = ((import.meta as any).env.VITE_API_BASE_URL as string || 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '');

const CfoDecisionModal: React.FC<CfoDecisionModalProps> = ({
  requestId,
  attachments = [],
  onSuccess,
  onClose,
}) => {
  const invoiceAttachment = attachments.find(a =>
    a.storageUrl.includes('/uploads/invoices/') ||
    a.fileName.toLowerCase().includes('invoice')
  );
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.cfoDecision(requestId, 'APPROVED', comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.cfoDecision(requestId, 'REJECTED', comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">account_balance</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">CFO Approval</h2>
            <p className="text-xs text-gray-500">IT Workflow · CFO Decision Required</p>
          </div>
        </div>
        <form className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {invoiceAttachment && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Invoice
                </label>
                {invoiceAttachment.mimeType === 'application/pdf' ? (
                  <iframe
                    src={`${API_ORIGIN}${invoiceAttachment.storageUrl}`}
                    className="w-full h-48 rounded-lg border border-gray-200"
                    title="Invoice"
                  />
                ) : (
                  <img
                    src={`${API_ORIGIN}${invoiceAttachment.storageUrl}`}
                    alt="Invoice"
                    className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                )}
                <a
                  href={`${API_ORIGIN}${invoiceAttachment.storageUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  {invoiceAttachment.fileName}
                </a>
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
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
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
              disabled={submitting}
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

export default CfoDecisionModal;
