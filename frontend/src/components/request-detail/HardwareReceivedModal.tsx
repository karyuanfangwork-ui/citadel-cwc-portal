import React, { useState } from 'react';
import itWorkflowService from '../../services/it-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface HardwareReceivedModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const HardwareReceivedModal: React.FC<HardwareReceivedModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [registerAsAsset, setRegisterAsAsset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await itWorkflowService.markHardwareReceived(requestId, {
        receivedDate,
        notes: notes || undefined,
        assetTag: assetTag || undefined,
        serialNumber: serialNumber || undefined,
        registerAsAsset,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark hardware as received');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="size-9 rounded-lg bg-teal-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-600">local_shipping</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Mark Hardware Received</h2>
            <p className="text-xs text-gray-500">IT Workflow · Confirm hardware arrival</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Received Date <span className="font-normal normal-case text-gray-400">(required)</span>
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={e => setReceivedDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Asset Tag <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={assetTag}
                  onChange={e => setAssetTag(e.target.value)}
                  placeholder="e.g. IT-00234"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Serial Number <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-XZ1234"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 p-3 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="registerAsAsset"
                checked={registerAsAsset}
                onChange={e => setRegisterAsAsset(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="registerAsAsset" className="text-sm text-blue-800 font-medium cursor-pointer">
                Register in IT Asset Registry
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Delivery Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any notes about delivery condition, missing items, etc."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
              {submitting ? 'Saving…' : 'Mark Received'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default HardwareReceivedModal;
