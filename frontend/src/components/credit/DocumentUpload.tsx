import React, { useState, useCallback } from 'react';
import creditService, { CreditDocument, DocumentType, DocumentStatus } from '../../services/credit.service';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  NRIC: 'NRIC',
  PASSPORT: 'Passport',
  BUSINESS_REG: 'Business Registration',
  TAX_RETURN: 'Tax Return',
  BANK_STATEMENT: 'Bank Statement',
  FINANCIAL_STATEMENT: 'Financial Statement',
  UTILITY_BILL: 'Utility Bill',
  OTHER: 'Other',
};

const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  NRIC: 'badge',
  PASSPORT: 'flight',
  BUSINESS_REG: 'corporate_fare',
  TAX_RETURN: 'receipt_long',
  BANK_STATEMENT: 'account_balance',
  FINANCIAL_STATEMENT: 'monitoring',
  UTILITY_BILL: 'receipt',
  OTHER: 'description',
};

const STATUS_BADGE_STYLES: Record<DocumentStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#f59e0b20', text: '#d97706', label: 'Pending' },
  VERIFIED: { bg: '#22c55e20', text: '#16a34a', label: 'Verified' },
  REJECTED: { bg: '#ef444420', text: '#dc2626', label: 'Rejected' },
};

interface DocumentUploadProps {
  borrowerProfileId: string;
  documents?: CreditDocument[];
  onUploaded?: () => void;
  onVerify?: (docId: string) => void;
  onReject?: (docId: string, reason: string) => void;
  onDelete?: (docId: string) => void;
  canUpload?: boolean;
  canVerify?: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  borrowerProfileId,
  documents = [],
  onUploaded,
  onVerify,
  onReject,
  onDelete,
  canUpload = true,
  canVerify = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('NRIC');
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFiles(files);
      setError(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const formData = new FormData();
        formData.append('file', selectedFiles[i]);
        formData.append('documentType', documentType);
        await creditService.uploadDocument(borrowerProfileId, formData);
      }
      setSelectedFiles(null);
      setShowUpload(false);
      onUploaded?.();
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, documentType, borrowerProfileId, onUploaded]);

  const handleRejectSubmit = async (docId: string) => {
    if (!rejectReason.trim()) return;
    onReject?.(docId, rejectReason);
    setRejectingId(null);
    setRejectReason('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Upload button & area */}
      {canUpload && (
        <div className="mb-4">
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              Upload Document
            </button>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-6 transition-colors ${
                dragOver ? 'border-brand-500 bg-brand-50' : 'border-border bg-bg-surface'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm font-semibold text-text-primary shrink-0">Document Type</label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value as DocumentType)}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white outline-none cursor-pointer"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="text-sm"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                />
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="mb-3 space-y-1">
                  {Array.from(selectedFiles).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="material-symbols-outlined text-base text-brand-700">description</span>
                      {f.name} ({formatFileSize(f.size)})
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                  className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  <span className="material-symbols-outlined text-base">{uploading ? 'progress_activity' : 'cloud_upload'}</span>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  onClick={() => { setShowUpload(false); setSelectedFiles(null); setError(null); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">folder_open</span>
          <p className="font-semibold text-sm">No documents uploaded yet</p>
          {canUpload && <p className="text-xs mt-1">Upload NRIC, bank statements, or other supporting documents</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const badge = STATUS_BADGE_STYLES[doc.status];
            return (
              <div key={doc.id} className="flex items-center gap-3 bg-bg-surface border border-border rounded-xl p-3 hover:border-brand-300 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-indigo-600 text-lg">
                    {DOCUMENT_TYPE_ICONS[doc.documentType] || 'description'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-primary truncate">{doc.fileName}</span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                    <span>{DOCUMENT_TYPE_LABELS[doc.documentType]}</span>
                    <span>·</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>·</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {doc.rejectionReason && (
                    <p className="text-xs text-red-600 mt-0.5">Reason: {doc.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canVerify && doc.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => onVerify?.(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        title="Verify document"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Verify
                      </button>
                      <button
                        onClick={() => setRejectingId(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        title="Reject document"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Reject
                      </button>
                    </>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors"
                      style={{ border: 'none', cursor: 'pointer', background: 'none' }}
                      title="Delete document"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Reject Document</h2>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Rejection Reason *</label>
              <textarea
                required
                rows={4}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
                style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}
                placeholder="Explain why this document is being rejected..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectSubmit(rejectingId)}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;