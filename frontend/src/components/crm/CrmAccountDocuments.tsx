import React, { useEffect, useRef, useState } from 'react';
import crmService, { CrmAccountDocument, Pagination } from '../../services/crm.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;
const PAGE_SIZE = 20;
const formatSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface Props {
  accountId: string;
  canWrite: boolean;
  openPickerRequested?: boolean;
  onPickerOpened?: () => void;
}

const CrmAccountDocuments: React.FC<Props> = ({ accountId, canWrite, openPickerRequested, onPickerOpened }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CrmAccountDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (page = 1, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const result = await crmService.listAccountDocuments(accountId, { page, limit: PAGE_SIZE });
      setDocuments(previous => append ? [...previous, ...result.documents] : result.documents);
      setPagination(result.pagination);
      setError('');
    } catch {
      setError('Unable to load client documents.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { void load(); }, [accountId]);
  useEffect(() => {
    if (openPickerRequested && canWrite) {
      inputRef.current?.click();
      onPickerOpened?.();
    }
  }, [canWrite, onPickerOpened, openPickerRequested]);

  const chooseFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setError(''); setSuccess('');
    if (incoming.length + selected.length > MAX_FILES_PER_UPLOAD) {
      setError(`Select no more than ${MAX_FILES_PER_UPLOAD} PDFs per upload.`); return;
    }
    const invalid = incoming.find(file => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'));
    if (invalid) { setError('Only PDF documents are allowed.'); return; }
    const empty = incoming.find(file => file.size === 0);
    if (empty) { setError(`${empty.name} is empty.`); return; }
    const oversized = incoming.find(file => file.size > MAX_FILE_SIZE);
    if (oversized) { setError(`${oversized.name} exceeds the 10 MB limit.`); return; }
    const combined = [...selected, ...incoming];
    const uniqueKeys = new Set(combined.map(file => `${file.name}:${file.size}:${file.lastModified}`));
    if (uniqueKeys.size !== combined.length) { setError('The same document was selected more than once.'); return; }
    setSelected(combined);
  };

  const upload = async () => {
    if (!selected.length || uploading) return;
    setUploading(true); setProgress(0); setError(''); setSuccess('');
    try {
      const count = selected.length;
      await crmService.uploadAccountDocuments(accountId, selected, setProgress);
      setSelected([]);
      if (inputRef.current) inputRef.current.value = '';
      await load();
      setSuccess(`${count} document${count === 1 ? '' : 's'} uploaded successfully.`);
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || 'Document upload failed.');
    } finally { setUploading(false); }
  };

  const deleteDocument = async (document: CrmAccountDocument) => {
    if (!window.confirm(`Delete ${document.fileName}?`)) return;
    setError(''); setSuccess('');
    try {
      await crmService.deleteAccountDocument(accountId, document.id);
      await load();
      setSuccess('Document deleted.');
    } catch { setError('Unable to delete document.'); }
  };

  const downloadDocument = async (document: CrmAccountDocument) => {
    setError('');
    try {
      const blob = await crmService.downloadAccountDocument(accountId, document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = document.fileName; anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError('Unable to download document.'); }
  };

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 space-y-4" aria-label="Client documents">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-[15px] font-bold text-[#0b1c30]">Client Documents{pagination ? ` (${pagination.total})` : ''}</h3><p className="text-xs text-[#45464d] mt-1">PDF files only · maximum 10 MB per file</p></div>
        {canWrite && <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-base">upload_file</span> Upload PDF</button>}
      </div>
      {canWrite && <div className="rounded-xl border border-dashed border-[#9aa8ba] bg-[#f8f9ff] p-4"><input ref={inputRef} aria-label="Select client PDF documents" type="file" accept="application/pdf,.pdf" multiple hidden onChange={event => chooseFiles(event.target.files)} /><button type="button" className="text-sm text-[#006a61] font-semibold" onClick={() => inputRef.current?.click()} disabled={uploading}>Select PDF documents</button><span className="text-sm text-[#45464d]"> to attach to this client.</span>{selected.length > 0 && <div className="mt-3 space-y-2">{selected.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm"><span className="truncate">{file.name} <span className="text-xs text-[#45464d]">({formatSize(file.size)})</span></span><button type="button" onClick={() => setSelected(previous => previous.filter((_, itemIndex) => itemIndex !== index))} className="text-[#ba1a1a]" aria-label={`Remove ${file.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Remove</button></div>)}<button type="button" onClick={upload} disabled={uploading} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}>{uploading ? `Uploading ${progress}%…` : `Upload ${selected.length} PDF${selected.length === 1 ? '' : 's'}`}</button></div>}</div>}
      {error && <p role="alert" className="rounded-lg bg-[#fff5f5] border border-[#f3c7c7] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-[#f0fdf8] border border-[#a7e8d8] px-3 py-2 text-sm text-[#006a61]">{success}</p>}
      {loading ? <p className="text-sm text-[#45464d]">Loading client documents…</p> : documents.length === 0 ? <p className="text-sm text-[#45464d]">No client documents uploaded yet.</p> : <div className="space-y-2">{documents.map(document => <div key={document.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8f0] px-3 py-3"><span className="material-symbols-outlined text-[#ba1a1a]">picture_as_pdf</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#0b1c30]">{document.fileName}</p><p className="text-xs text-[#45464d]">{formatSize(document.fileSize)} · {formatDate(document.createdAt)}</p></div><button type="button" onClick={() => void downloadDocument(document)} className="text-sm font-semibold text-[#006a61]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Download</button>{canWrite && <button type="button" onClick={() => void deleteDocument(document)} className="text-sm font-semibold text-[#ba1a1a]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>}</div>)}</div>}
      {pagination && pagination.page < pagination.totalPages && <button type="button" onClick={() => void load(pagination.page + 1, true)} disabled={loadingMore} className="text-sm font-semibold text-[#006a61] disabled:opacity-50" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>{loadingMore ? 'Loading…' : 'Load more documents'}</button>}
    </section>
  );
};

export default CrmAccountDocuments;
