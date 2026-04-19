import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface ProcurementModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ProcurementModal: React.FC<ProcurementModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [vendor, setVendor] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markProcurement(requestId, {
        vendor: vendor || undefined,
        orderNumber: orderNumber || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start procurement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600">shopping_cart</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Start Procurement</h2>
            <p className="text-xs text-gray-500">IT Workflow · Log vendor & order details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Vendor Name <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                placeholder="e.g. Dell, Logitech, CDW…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Purchase Order / Order Number <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="e.g. PO-2026-04-0042"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Estimated Delivery <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={e => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
              {submitting ? 'Starting…' : 'Start Procurement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProcurementModal;
