import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CloseTicketFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.closeTicket(requestId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to close ticket');
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-700">check_circle</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Close Ticket</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">Payment has been confirmed. Closing this ticket will mark the Purchase Requisition as completed.</p>
            <p className="text-sm font-bold text-gray-800">Are you sure you want to close this ticket?</p>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Closing…' : 'Close Ticket'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CloseTicketFinModal;