/**
 * P2-4: Bulk Document Upload — drag-and-drop zone for multi-file upload.
 *
 * Features:
 * - Multi-file drag-and-drop with individual progress bars
 * - Auto-classification suggestions based on filename patterns
 * - Per-file document type selector
 * - Graceful error handling per file
 * - Success/failed summary after batch completion
 */

import React, { useState, useCallback, useRef } from 'react';
import creditService, { DocumentType } from '../../services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

// ── Document classification patterns ──────────────────────────────────────

const DOC_CLASSES: { value: string; label: string; pattern?: RegExp }[] = [
  { value: 'NRIC_PASSPORT', label: 'NRIC / Passport', pattern: /nric|passport|ic[\s_-]?number|mykad/i },
  { value: 'PAYSLIP', label: 'Payslip', pattern: /payslip|salary|pay[\s_-]?slip/i },
  { value: 'BANK_STATEMENT', label: 'Bank Statement', pattern: /bank[\s_-]?stmt|statement/i },
  { value: 'SSM_CERT', label: 'SSM Certificate', pattern: /ssm|cert[\s_-]?of[\s_-]?incorporation/i },
  { value: 'AUDITED_FINANCIALS', label: 'Audited Financials', pattern: /audited|financial[\s_-]?statement|fs[\s_-]?\d/i },
  { value: 'MANAGEMENT_ACCOUNTS', label: 'Management Accounts', pattern: /management[\s_-]?account/i },
  { value: 'TAX_RETURN', label: 'Tax Return', pattern: /tax[\s_-]?return|borang[\s_-]?be|ea[\s_-]?form/i },
  { value: 'BUSINESS_PLAN', label: 'Business Plan', pattern: /business[\s_-]?plan|bp[\s_-]?\d/i },
  { value: 'VALUATION_REPORT', label: 'Valuation Report', pattern: /valuation|appraisal/i },
  { value: 'INSURANCE_CERT', label: 'Insurance Certificate', pattern: /insurance|policy[\s_-]?cert/i },
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution', pattern: /board[\s_-]?resolution|br[\s_-]?\d/i },
  { value: 'GUARANTEE_LETTER', label: 'Guarantee Letter', pattern: /guarantee|gl[\s_-]?\d/i },
  { value: 'OTHER', label: 'Other' },
];

/** Guess document type from filename */
function guessDocClass(filename: string): string {
  for (const dc of DOC_CLASSES) {
    if (dc.pattern && dc.pattern.test(filename)) return dc.value;
  }
  return 'OTHER';
}

// ── Types ──────────────────────────────────────────────────────────────────

interface FileEntry {
  id: string;
  file: File;
  classification: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface BulkDocumentUploadProps {
  borrowerProfileId: string;
  onUploaded?: () => void;
  onClose?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

const BulkDocumentUpload: React.FC<BulkDocumentUploadProps> = ({
  borrowerProfileId,
  onUploaded,
  onClose,
}) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newEntries: FileEntry[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      classification: guessDocClass(file.name),
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newEntries]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  }, [addFiles]);

  const updateEntry = useCallback((id: string, updates: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleUploadAll = async () => {
    const pending = files.filter(f => f.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of pending) {
      updateEntry(entry.id, { status: 'uploading', progress: 0 });

      try {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('classification', entry.classification);

        // Simulate progress
        updateEntry(entry.id, { progress: 30 });

        await creditService.uploadDocument(borrowerProfileId, formData);

        updateEntry(entry.id, { status: 'success', progress: 100 });
        successCount++;
      } catch (e) {
        updateEntry(entry.id, { status: 'error', error: friendlyMessage(e, 'Upload failed') });
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} document${successCount > 1 ? 's' : ''} uploaded successfully`);
      onUploaded?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} document${errorCount > 1 ? 's' : ''} failed to upload`);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <span className="material-icons text-blue-600">upload_file</span>
        Bulk Document Upload
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.tiff,.bmp"
        />
        <span className="material-icons text-4xl text-gray-400 mb-2 block">cloud_upload</span>
        <p className="text-sm text-gray-600">
          Drag & drop files here, or <span className="text-blue-600 font-medium underline">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, images, Word, Excel — up to 10 files at a time
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(entry => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                entry.status === 'success' ? 'border-green-300 bg-green-50' :
                entry.status === 'error' ? 'border-red-300 bg-red-50' :
                entry.status === 'uploading' ? 'border-blue-300 bg-blue-50' :
                'border-gray-200 bg-white'
              }`}
            >
              {/* File icon */}
              <span className="material-icons text-xl text-gray-500">
                {entry.file.name.endsWith('.pdf') ? 'picture_as_pdf' :
                 entry.file.name.match(/\.(jpg|jpeg|png|tiff|bmp)$/i) ? 'image' :
                 entry.file.name.match(/\.(xls|xlsx|csv)$/i) ? 'table_chart' : 'description'}
              </span>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{entry.file.name}</div>
                <div className="text-xs text-gray-500">
                  {(entry.file.size / 1024).toFixed(0)} KB
                </div>

                {/* Progress bar for uploading */}
                {entry.status === 'uploading' && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {entry.status === 'error' && entry.error && (
                  <div className="text-xs text-red-600 mt-0.5">{entry.error}</div>
                )}
              </div>

              {/* Classification selector */}
              {entry.status === 'pending' && (
                <select
                  value={entry.classification}
                  onChange={e => updateEntry(entry.id, { classification: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                >
                  {DOC_CLASSES.map(dc => (
                    <option key={dc.value} value={dc.value}>{dc.label}</option>
                  ))}
                </select>
              )}

              {/* Status indicator */}
              {entry.status === 'success' && (
                <span className="material-icons text-green-600">check_circle</span>
              )}

              {/* Remove button */}
              {(entry.status === 'pending' || entry.status === 'error') && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <span className="material-icons text-lg">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {files.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            {pendingCount > 0 && `${pendingCount} pending`}
            {successCount > 0 && ` · ${successCount} uploaded`}
            {errorCount > 0 && ` · ${errorCount} failed`}
          </div>
          <div className="flex gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            )}
            {pendingCount > 0 && (
              <button
                onClick={handleUploadAll}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-icons text-base">cloud_upload</span>
                {uploading ? 'Uploading…' : `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkDocumentUpload;