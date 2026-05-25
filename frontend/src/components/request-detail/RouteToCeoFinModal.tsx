import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const RouteToCeoFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [finalizedAmount, setFinalizedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isValid = finalizedAmount !== '' && Number(finalizedAmount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.setFinalizedAmountAndRouteCeo(requestId, Number(finalizedAmount), notes || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to route to CEO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-700">price_check</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Set Amount & Route to CEO</h2>
              <p className="text-xs text-gray-500">Finance Workflow · Purchase Requisition</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Finalized Amount (MYR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">MYR</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={finalizedAmount}
                    onChange={e => setFinalizedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Amounts above MYR 15,000 will require additional Group CEO approval after CFO.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Justification or context for the CEO…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={!isValid || submitting} className="px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {submitting ? 'Routing…' : 'Route to CEO'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RouteToCeoFinModal;