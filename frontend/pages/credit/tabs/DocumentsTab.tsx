import React, { useState, useEffect, useRef } from 'react';
import creditService, { CreditApplication, CreditDocument, DocumentStatus, DocumentRequirement, ChecklistProgress } from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import EmptyState from '../../../src/components/EmptyState';
import BulkDocumentUpload from '../../../src/components/credit/BulkDocumentUpload';
import { getBorrowerSegment, SEGMENT_LABELS, SEGMENT_COLORS, BorrowerSegment } from '../creditUtils';

const ALL_DOC_CLASSES: { value: string; label: string; borrowerTypes?: string[]; segments?: BorrowerSegment[] }[] = [
  { value: 'NRIC_PASSPORT', label: 'NRIC / Passport', borrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR'], segments: ['retail', 'sme'] },
  { value: 'PAYSLIP', label: 'Payslip (latest 3 months)', borrowerTypes: ['INDIVIDUAL'], segments: ['retail'] },
  { value: 'BANK_STATEMENT', label: 'Bank Statement', borrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR'], segments: ['retail', 'sme'] },
  { value: 'SSM_CERT', label: 'SSM Certificate', borrowerTypes: ['CORPORATE', 'SOLE_PROPRIETOR'], segments: ['sme', 'corporate'] },
  { value: 'AUDITED_FINANCIALS', label: 'Audited Financials', borrowerTypes: ['CORPORATE', 'JOINT'], segments: ['sme', 'corporate'] },
  { value: 'MOA_AOA', label: 'Memorandum & Articles (MOA/AOA)', borrowerTypes: ['CORPORATE'], segments: ['corporate'] },
  { value: 'JV_AGREEMENT', label: 'JV Agreement', borrowerTypes: ['JOINT'], segments: ['corporate'] },
  { value: 'MEMORANDUM_ARTICLES', label: 'Memorandum & Articles', segments: ['corporate'] },
  { value: 'MANAGEMENT_ACCOUNTS', label: 'Management Accounts', segments: ['sme', 'corporate'] },
  { value: 'TAX_RETURN', label: 'Tax Return', segments: ['retail', 'sme', 'corporate'] },
  { value: 'BUSINESS_PLAN', label: 'Business Plan', segments: ['sme', 'corporate'] },
  { value: 'VALUATION_REPORT', label: 'Valuation Report', segments: ['retail', 'sme', 'corporate'] },
  { value: 'INSURANCE_CERT', label: 'Insurance Certificate', segments: ['retail', 'sme', 'corporate'] },
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution', segments: ['corporate'] },
  { value: 'GUARANTEE_LETTER', label: 'Guarantee Letter', segments: ['retail', 'sme', 'corporate'] },
  { value: 'OTHER', label: 'Other' },
];

function getDocClasses(borrowerType?: string, segment?: BorrowerSegment) {
  let filtered = ALL_DOC_CLASSES;
  if (borrowerType) {
    filtered = filtered.filter((d) => !d.borrowerTypes || d.borrowerTypes.includes(borrowerType));
  }
  if (segment) {
    filtered = filtered.filter((d) => !d.segments || d.segments.includes(segment));
  }
  return filtered;
}

const LABEL: Record<string, string> = Object.fromEntries(ALL_DOC_CLASSES.map((d) => [d.value, d.label]));

const STATUS_STYLE: Record<DocumentStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e', label: 'Pending' },
  VERIFIED: { bg: '#dcfce7', text: '#166534', label: 'Verified' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
};

interface DocumentsTabProps {
  app: CreditApplication;
  canApprove?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ app, canApprove }) => {
  const [docs, setDocs] = useState<CreditDocument[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [progress, setProgress] = useState<ChecklistProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [classification, setClassification] = useState('NRIC_PASSPORT');
  const [description, setDescription] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const list = await creditService.listApplicationDocuments(app.id);
      setDocs(list);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load documents'));
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async () => {
    try {
      let checklist = await creditService.listDocumentRequirements(app.id);
      if (checklist.requirements.length === 0) {
        await creditService.seedDocumentRequirements(app.id);
        checklist = await creditService.listDocumentRequirements(app.id);
      }
      setRequirements(checklist.requirements);
      setProgress(checklist.progress);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load document checklist'));
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchChecklist();
  }, [app.id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a file'); return; }
    if (!app.borrowerProfileId) { toast.error('Application has no linked borrower profile'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('classification', classification);
    if (description.trim()) fd.append('description', description);
    try {
      setUploading(true);
      const uploaded = await creditService.uploadApplicationDocument(app.borrowerProfileId, app.id, fd);
      const match = requirements.find(
        (req) => req.isMandatory && !req.isCollected && req.documentClass === (uploaded.classification ?? ''),
      );
      if (match) {
        await creditService.linkRequirementDoc(match.id, uploaded.id);
      }
      toast.success('Document uploaded');
      setFile(null);
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      await Promise.all([fetchDocs(), fetchChecklist()]);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await creditService.deleteDocument(docId);
      toast.success('Document deleted');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      fetchChecklist();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to delete document'));
    }
  };

  const handleVerify = async (docId: string) => {
    try {
      setVerifying(docId);
      await creditService.verifyDocument(docId);
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, verificationStatus: 'VERIFIED' as DocumentStatus } : d)));
      toast.success('Document verified');
      fetchChecklist();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to verify document'));
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async (docId: string) => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    try {
      setVerifying(docId);
      await creditService.rejectDocument(docId, rejectReason);
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, verificationStatus: 'REJECTED' as DocumentStatus, rejectionReason: rejectReason } : d)));
      toast.success('Document rejected');
      setRejectingId(null);
      setRejectReason('');
      fetchChecklist();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to reject document'));
    } finally {
      setVerifying(null);
    }
  };

  const borrowerType = app.borrowerProfile?.borrowerType;
  const segment = getBorrowerSegment(borrowerType);
  const docClasses = getDocClasses(borrowerType, segment);
  const uploadedClasses = new Set(docs.map((d) => (d as any).classification));
  const nricFromProfile = !!((app.borrowerProfile as any)?.contact?.nricPassport);
  const liveRequiredClasses = new Set(requirements.filter((req) => req.isMandatory).map((req) => req.documentClass));
  const missingRequired = requirements.filter(
    (req) => req.isMandatory && !req.isCollected && !(req.documentClass === 'NRIC_PASSPORT' && nricFromProfile),
  );

  return (
    <div className="space-y-6">
      {/* Segment badge */}
      {segment && (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              background: SEGMENT_COLORS[segment].bg,
              color: SEGMENT_COLORS[segment].text,
              border: `1px solid ${SEGMENT_COLORS[segment].text}30`,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {segment === 'retail' ? 'person' : segment === 'sme' ? 'store' : 'business'}
            </span>
            {SEGMENT_LABELS[segment]} Segment
          </span>
          <span className="text-xs text-gray-500">
            {docClasses.length} document types applicable
          </span>
        </div>
      )}

      {/* Required documents status */}
      {missingRequired.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">warning</span>
          <div>
            <p className="text-sm font-bold text-amber-800 mb-1">Required documents missing</p>
            <ul className="text-xs text-amber-700 space-y-0.5">
              {missingRequired.map((req) => (
                <li key={req.id}>• {req.label}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* NRIC verified from borrower profile */}
      {nricFromProfile && !uploadedClasses.has('NRIC_PASSPORT') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">verified</span>
          <div>
            <p className="text-sm font-bold text-blue-800 mb-0.5">NRIC / Passport — Verified from profile</p>
            <p className="text-xs text-blue-600">
              Borrower's NRIC / Passport is on file from their profile. A scanned copy can still be uploaded below for your records.
            </p>
          </div>
        </div>
      )}

      {progress && (
        <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Required Documents</h3>
              <p className="text-xs text-text-secondary mt-1">Live checklist linked to the application requirement engine.</p>
            </div>
            <span className="text-xs text-text-secondary">
              {progress.collectedMandatory}/{progress.totalMandatory} collected ({progress.completionPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${progress.completionPct}%` }}
            />
          </div>
          <ul className="space-y-2">
            {requirements.map((req) => {
              const collected = req.isCollected;
              return (
                <li key={req.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 text-base ${collected ? 'text-green-600' : 'text-gray-400'}`}>
                    {collected ? '✓' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{req.label}</span>
                      {req.isMandatory && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Required</span>
                      )}
                      {req.linkedDoc?.fileName && (
                        <span className="text-[10px] text-gray-500">Linked: {req.linkedDoc.fileName}</span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {req.documentClass}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Upload form */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Upload Document</h3>
        {/* P2-4: Toggle between single and bulk upload */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowBulkUpload(false)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${!showBulkUpload ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            Single Upload
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1 ${showBulkUpload ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            <span className="material-icons text-sm">upload_file</span>
            Bulk Upload
          </button>
        </div>
        {showBulkUpload ? (
          <BulkDocumentUpload
            borrowerProfileId={app.borrowerProfileId}
            onUploaded={() => fetchDocs()}
          />
        ) : (
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {docClasses.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}{liveRequiredClasses.has(d.value) ? ' (required)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">File <span className="text-red-500">*</span></label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-text-primary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex items-center gap-2 px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50 transition-colors"
              style={{ border: 'none', cursor: uploading || !file ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
        )}
      </div>

      {/* Document list */}
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Uploaded Documents</h3>
          <span className="text-xs text-text-secondary">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-text-secondary">Loading…</div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="No Documents Uploaded"
            description="Upload borrower documents such as ID, payslips, and bank statements to support this application."
            actionLabel="Upload Document"
            onAction={() => fileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          />
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((doc) => {
              const status = (doc.verificationStatus ?? doc.status ?? 'PENDING') as DocumentStatus;
              const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
              const classification = (doc as any).classification as string;
              return (
                <li key={doc.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand-600 text-xl">description</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{doc.fileName}</p>
                      <p className="text-xs text-text-secondary">{LABEL[classification] ?? classification}</p>
                    </div>
                    {/* Status badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.text }}>
                      {style.label}
                    </span>
                    {/* Verify / Reject — only for users with credit:approve */}
                    {canApprove && status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleVerify(doc.id)}
                          disabled={verifying === doc.id}
                          aria-label="Verify document"
                          className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-300 px-2 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
                          style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Verify
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === doc.id ? null : doc.id)}
                          disabled={verifying === doc.id}
                          aria-label="Reject document"
                          className="flex items-center gap-1 text-xs font-semibold text-red-700 border border-red-300 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                          style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const url = await creditService.getDocumentDownloadUrl(doc.id);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        } catch (e) {
                          toast.error(friendlyMessage(e, 'Failed to get download link'));
                        }
                      }}
                      aria-label="Download document"
                      title="Download / View"
                      className="text-text-secondary hover:text-brand-600 transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      aria-label="Delete document"
                      className="text-text-secondary hover:text-red-500 transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                  {/* Rejection reason input */}
                  {rejectingId === doc.id && (
                    <div className="flex items-center gap-2 pl-8">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection…"
                        className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-200"
                        autoFocus
                      />
                      <button
                        onClick={() => handleReject(doc.id)}
                        disabled={verifying === doc.id}
                        className="text-xs font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        className="text-xs text-text-secondary hover:text-text-primary"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DocumentsTab;
