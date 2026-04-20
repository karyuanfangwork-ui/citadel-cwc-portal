import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface ResubmitModalProps {
  requestId: string;
  // Pre-fill values from the existing ITHardwareRequest
  initialValues?: {
    hardwareName?: string;
    hardwareModel?: string;
    estimatedPrice?: number | string;
    preferredVendor?: string;
    productUrl?: string;
    businessJustification?: string;
  };
  onSuccess: () => void;
  onClose: () => void;
}

const ResubmitModal: React.FC<ResubmitModalProps> = ({
  requestId,
  initialValues,
  onSuccess,
  onClose,
}) => {
  const [hardwareName, setHardwareName] = useState(initialValues?.hardwareName || '');
  const [hardwareModel, setHardwareModel] = useState(initialValues?.hardwareModel || '');
  const [estimatedPrice, setEstimatedPrice] = useState(initialValues?.estimatedPrice || '');
  const [preferredVendor, setPreferredVendor] = useState(initialValues?.preferredVendor || '');
  const [productUrl, setProductUrl] = useState(initialValues?.productUrl || '');
  const [businessJustification, setBusinessJustification] = useState(initialValues?.businessJustification || '');
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardwareName || !businessJustification) return;

    try {
      setSubmitting(true);
      setError(null);

      await itWorkflowService.resubmitRequest(requestId, {
        hardwareName,
        hardwareModel: hardwareModel || undefined,
        estimatedPrice: estimatedPrice ? parseFloat(String(estimatedPrice)) : undefined,
        preferredVendor: preferredVendor || undefined,
        productUrl: productUrl || undefined,
        businessJustification,
        resubmitNotes: resubmitNotes || undefined,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resubmit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="size-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-orange-600">edit_note</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Resubmit Request</h2>
            <p className="text-xs text-gray-500">IT Hardware · Revise and resubmit</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Hardware Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={hardwareName}
                onChange={e => setHardwareName(e.target.value)}
                placeholder="e.g. Laptop, Monitor, Keyboard"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Preferred Model <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={hardwareModel}
                onChange={e => setHardwareModel(e.target.value)}
                placeholder="e.g. MacBook Pro 16-inch, Dell UltraSharp 27"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Estimated Price <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={estimatedPrice}
                onChange={e => setEstimatedPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Preferred Vendor <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={preferredVendor}
                onChange={e => setPreferredVendor(e.target.value)}
                placeholder="e.g. Dell, Apple, Lenovo"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Product URL <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="url"
                value={productUrl}
                onChange={e => setProductUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Business Justification <span className="text-orange-500">*</span>
              </label>
              <textarea
                value={businessJustification}
                onChange={e => setBusinessJustification(e.target.value)}
                rows={3}
                placeholder="Explain why you need this hardware and how it will improve your work..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Resubmit Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={resubmitNotes}
                onChange={e => setResubmitNotes(e.target.value)}
                rows={2}
                placeholder="Explain how you've addressed the rejection reason..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 resize-none"
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
              disabled={!hardwareName || !businessJustification || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
            >
              {submitting ? 'Resubmitting…' : 'Resubmit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ResubmitModal;
