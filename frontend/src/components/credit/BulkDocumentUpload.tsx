import React, { useState, useCallback, useRef } from 'react';
import creditService from '../../services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

interface BulkDocumentUploadProps {
  borrowerProfileId: string | null | undefined;
  applicationId: string;
  onUploaded?: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  classification: string;
  description: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

const DOC_CLASSES = [
  { value: 'NRIC_PASSPORT', label: 'NRIC / Passport' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'SSM_CERT', label: 'SSM Certificate' },
  { value: 'AUDITED_FINANCIALS', label: 'Audited Financials' },
  { value: 'MOA_AOA', label: 'MOA/AOA' },
  { value: 'MANAGEMENT_ACCOUNTS', label: 'Management Accounts' },
  { value: 'TAX_RETURN', label: 'Tax Return' },
  { value: 'BUSINESS_PLAN', label: 'Business Plan' },
  { value: 'VALUATION_REPORT', label: 'Valuation Report' },
  { value: 'INSURANCE_CERT', label: 'Insurance Certificate' },
  { value: 'OTHER', label: 'Other' },
];

/** Naive auto-classification based on filename patterns */
function guessClassification(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/nric|passport|mykad|ic/.test(lower)) return 'NRIC_PASSPORT';
  if (/payslip|salary|pay_slip/.test(lower)) return 'PAYSLIP';
  if (/bank.*stmt|statement|bank_statement/.test(lower)) return 'BANK_STATEMENT';
  if (/ssm|form.*9|form.*24/.test(lower)) return 'SSM_CERT';
  if (/audit|financial.*stmt|financials/.test(lower)) return 'AUDITED_FINANCIALS';
  if (/moa|aoa|memorandum|article/.test(lower)) return 'MOA_AOA';
  if (/management.*acct|management/.test(lower)) return 'MANAGEMENT_ACCOUNTS';
  if (/tax|lhdn/.test(lower)) return 'TAX_RETURN';
  if (/business.*plan|bizplan/.test(lower)) return 'BUSINESS_PLAN';
  if (/valuation|appraisal/.test(lower)) return 'VALUATION_REPORT';
  if (/insurance|cover.*note/.test(lower)) return 'INSURANCE_CERT';
  return 'OTHER';
}

const BulkDocumentUpload: React.FC<BulkDocumentUploadProps> = ({ borrowerProfileId, applicationId, onUploaded }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      classification: guessClassification(file.name),
      description: '',
      status: 'pending' as const,
      progress: 0,
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const uploadOne = useCallback(async (item: UploadItem) => {
    if (!borrowerProfileId) {
      updateItem(item.id, { status: 'error', error: 'No borrower profile linked' });
      return;
    }
    if (!applicationId) {
      updateItem(item.id, { status: 'error', error: 'No application linked' });
      return;
    }
    try {
      updateItem(item.id, { status: 'uploading', progress: 10 });
      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('classification', item.classification);
      if (item.description.trim()) fd.append('description', item.description);

      // Simulate progress for UX (real progress would need XHR/fetch with ReadableStream)
      updateItem(item.id, { progress: 30 });

      await creditService.uploadApplicationDocument(borrowerProfileId, applicationId, fd);
      updateItem(item.id, { status: 'done', progress: 100 });
    } catch (e) {
      updateItem(item.id, { status: 'error', error: friendlyMessage(e, 'Upload failed') });
    }
  }, [applicationId, borrowerProfileId, updateItem]);

  const uploadAll = useCallback(async () => {
    const pending = items.filter(i => i.status === 'pending' || i.status === 'error');
    for (const item of pending) {
      await uploadOne(item);
    }
    onUploaded?.();
  }, [items, uploadOne, onUploaded]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const statusIcon = (status: UploadItem['status']) => {
    switch (status) {
      case 'done': return <span className="material-symbols-outlined text-green-600 text-base">check_circle</span>;
      case 'uploading': return <span className="material-symbols-outlined text-blue-600 text-base animate-spin">progress_activity</span>;
      case 'error': return <span className="material-symbols-outlined text-red-500 text-base">error</span>;
      default: return <span className="material-symbols-outlined text-text-secondary text-base">description</span>;
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-border hover:border-brand-300 hover:bg-gray-50'
        }`}
      >
        <span className="material-symbols-outlined text-3xl text-text-secondary mb-2">cloud_upload</span>
        <p className="text-sm font-semibold text-text-primary">Drop files here or click to browse</p>
        <p className="text-xs text-text-secondary mt-1">PDF, images, and office documents accepted</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-border rounded-lg p-3 flex items-center gap-3">
              {statusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={item.classification}
                    onChange={e => updateItem(item.id, { classification: e.target.value })}
                    disabled={item.status === 'uploading' || item.status === 'done'}
                    className="text-xs border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-brand-200"
                  >
                    {DOC_CLASSES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(item.id, { description: e.target.value })}
                    placeholder="Note (optional)"
                    disabled={item.status === 'uploading' || item.status === 'done'}
                    className="text-xs border border-border rounded px-2 py-0.5 flex-1 min-w-0 outline-none focus:ring-1 focus:ring-brand-200"
                  />
                </div>
                {item.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div className="bg-brand-600 h-1 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.status === 'error' && item.error && (
                  <p className="text-xs text-red-600 mt-1">{item.error}</p>
                )}
              </div>
              {item.status !== 'uploading' && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-text-secondary hover:text-red-500"
                  title="Remove"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            {items.filter(i => i.status === 'done').length}/{items.length} uploaded
          </p>
          <button
            onClick={uploadAll}
            disabled={items.every(i => i.status === 'done') || items.some(i => i.status === 'uploading')}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            Upload All ({items.filter(i => i.status === 'pending' || i.status === 'error').length})
          </button>
        </div>
      )}
    </div>
  );
};

export default BulkDocumentUpload;