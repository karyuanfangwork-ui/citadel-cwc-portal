// frontend/src/components/request-detail/RouteToCfoFinModal.tsx
import React, { useState } from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const RouteToCfoFinModal: React.FC<Props> = ({ requestId, onSuccess, onClose }) => {
  const [finalizedAmount, setFinalizedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isValid = finalizedAmount !== '' && Number(finalizedAmount) > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setInvoiceFiles(prev => {
        const combined = [...prev, ...newFiles];
        return combined.slice(0, 5); // max 5 files
      });
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setInvoiceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await financeWorkflowService.setFinalizedAmountAndRouteCfo(
        requestId,
        Number(finalizedAmount),
        notes || undefined,
        invoiceFiles.length > 0 ? invoiceFiles : undefined,
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to route to CFO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-amber-50">
            <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-700">price_check</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Set Amount & Route to CFO</h2>
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
                <p className="text-xs text-gray-400 mt-1">Amounts above MYR 15,000 will require additional Group Deputy CEO approval after CFO.</p>
              </div>

              {/* Invoice files */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Invoice Files <span className="font-normal normal-case text-gray-400">(max 5, 10 MB each)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#0052cc] border border-[#0052cc]/30 rounded-lg cursor-pointer hover:bg-[#0052cc]/5 transition-colors">
                  <span className="material-symbols-outlined text-base">upload</span>
                  {invoiceFiles.length > 0 ? 'Add more files' : 'Choose files'}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {invoiceFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {invoiceFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                        <span className="material-symbols-outlined text-gray-400 text-base">description</span>
                        <span className="flex-1 truncate text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">{invoiceFiles.length}/5 files selected</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Justification or context for the CFO…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">
                Cancel
              </button>
              <button type="submit" disabled={!isValid || submitting} className="px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
                {submitting ? 'Routing…' : 'Route to CFO'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RouteToCfoFinModal;