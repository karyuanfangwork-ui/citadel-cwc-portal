// frontend/src/components/request-detail/PaymentDoneModal.tsx
import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface PaymentDoneModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PaymentDoneModal: React.FC<PaymentDoneModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [paymentReference, setPaymentReference] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isDisabled = !paymentReference.trim() || !amount || parseFloat(amount) <= 0 || !paymentDate || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markPaymentDone(requestId, {
        paymentReference: paymentReference.trim(),
        amount: parseFloat(amount),
        paymentDate,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-blue-50 rounded-t-2xl">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">payments</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Payment Done</h2>
            <p className="text-xs text-gray-500">IT Workflow · Confirm Payment Details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Payment Reference *
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder="e.g. PAY-2026-001"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Amount *
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional payment notes…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
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
              disabled={isDisabled}
              className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              {submitting ? 'Confirming…' : 'Confirm Payment Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentDoneModal;
