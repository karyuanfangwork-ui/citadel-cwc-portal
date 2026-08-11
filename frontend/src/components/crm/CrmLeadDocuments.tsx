import React, { useEffect, useRef, useState } from 'react';
import crmService, { CrmLeadDocument } from '../../services/crm.service';

const MAX_DOCUMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const formatSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface Props { leadId: string; canWrite: boolean; }

const CrmLeadDocuments: React.FC<Props> = ({ leadId, canWrite }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CrmLeadDocument[]>([]);
  const [selected, setSelected] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const load = async () => {
    try { setDocuments((await crmService.listLeadDocuments(leadId)).documents); }
    catch { setError('Unable to load documents.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [leadId]);

  const chooseFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setError('');
    if (documents.length + selected.length + incoming.length > MAX_DOCUMENTS) { setError(`A lead can have a maximum of ${MAX_DOCUMENTS} PDF documents.`); return; }
    const invalid = incoming.find(file => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'));
    if (invalid) { setError('Only PDF documents are allowed.'); return; }
    const oversized = incoming.find(file => file.size > MAX_FILE_SIZE);
    if (oversized) { setError(`${oversized.name} exceeds the 10 MB limit.`); return; }
    setSelected(previous => [...previous, ...incoming]);
  };

  const upload = async () => {
    if (!selected.length) return;
    setUploading(true); setProgress(0); setError('');
    try {
      const result = await crmService.uploadLeadDocuments(leadId, selected, setProgress);
      setDocuments(result.documents); setSelected([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || 'Document upload failed.');
    } finally { setUploading(false); }
  };

  const deleteDocument = async (document: CrmLeadDocument) => {
    if (!window.confirm(`Delete ${document.fileName}?`)) return;
    try { await crmService.deleteLeadDocument(leadId, document.id); setDocuments(previous => previous.filter(item => item.id !== document.id)); }
    catch { setError('Unable to delete document.'); }
  };

  const downloadDocument = async (document: CrmLeadDocument) => {
    try {
      const blob = await crmService.downloadLeadDocument(leadId, document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError('Unable to download document.'); }
  };

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4" aria-label="Lead documents">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-[13px] font-bold text-[#0b1c30]">Documents ({documents.length}/{MAX_DOCUMENTS})</h3><p className="text-xs text-[#45464d] mt-1">PDF files only · maximum 10 MB per file</p></div>
        {canWrite && documents.length < MAX_DOCUMENTS && <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-base">upload_file</span> Upload PDF</button>}
      </div>
      {canWrite && documents.length < MAX_DOCUMENTS && <div className="rounded-xl border border-dashed border-[#9aa8ba] bg-[#f8f9ff] p-4"><input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={event => chooseFiles(event.target.files)} /><button type="button" className="text-sm text-[#006a61] font-semibold" onClick={() => inputRef.current?.click()} disabled={uploading}>Select PDF documents</button><span className="text-sm text-[#45464d]"> to attach to this lead.</span>{selected.length > 0 && <div className="mt-3 space-y-2">{selected.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm"><span className="truncate">{file.name} <span className="text-xs text-[#45464d]">({formatSize(file.size)})</span></span><button type="button" onClick={() => setSelected(previous => previous.filter((_, itemIndex) => itemIndex !== index))} className="text-[#ba1a1a]" aria-label={`Remove ${file.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Remove</button></div>)}<button type="button" onClick={upload} disabled={uploading} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}>{uploading ? `Uploading ${progress}%…` : `Upload ${selected.length} PDF${selected.length === 1 ? '' : 's'}`}</button></div>}</div>}
      {error && <p role="alert" className="rounded-lg bg-[#fff5f5] border border-[#f3c7c7] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>}
      {loading ? <p className="text-sm text-[#45464d]">Loading documents…</p> : documents.length === 0 ? <p className="text-sm text-[#45464d]">No documents uploaded yet.</p> : <div className="space-y-2">{documents.map(document => <div key={document.id} className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] px-3 py-3"><span className="material-symbols-outlined text-[#ba1a1a]">picture_as_pdf</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#0b1c30]">{document.fileName}</p><p className="text-xs text-[#45464d]">{formatSize(document.fileSize)} · {formatDate(document.createdAt)}{document.scanStatus !== 'CLEAN' ? ` · ${document.scanStatus.toLowerCase()}` : ''}</p></div><button type="button" onClick={() => void downloadDocument(document)} className="text-sm font-semibold text-[#006a61]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Download</button>{canWrite && <button type="button" onClick={() => void deleteDocument(document)} className="text-sm font-semibold text-[#ba1a1a]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>}</div>)}</div>}
    </section>
  );
};

export default CrmLeadDocuments;
