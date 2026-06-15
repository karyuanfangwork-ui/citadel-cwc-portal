import React, { useState, useRef, useEffect, useCallback } from 'react';
import creditService from '../../services/credit.service';
import { pollPdfJob } from '../../services/pdfJob.service';

/**
 * Section anchors matching the IDs in the approval-pack HTML template.
 * Must stay in sync with APPROVAL_PACK_SECTIONS in approvalPack.service.ts
 */
const SECTIONS = [
  { id: 'header-background', label: '1 — Header & Background' },
  { id: 'parties', label: '2 — Parties' },
  { id: 'facilities', label: '3 — Facilities' },
  { id: 'scoring', label: '4 — Scoring' },
  { id: 'ecl', label: '5 — ECL' },
  { id: 'collateral', label: '6 — Collateral' },
  { id: 'way-out', label: '7 — Way Out' },
  { id: 'conditions', label: '8 — Conditions' },
  { id: 'credit-bureau', label: '14 — Credit Bureau' },
  { id: 'industry-outlook', label: '15 — Industry Outlook' },
  { id: 'risk-assessment', label: '16 — Risk Assessment' },
  { id: 'esg-assessment', label: '17 — ESG' },
  { id: 'sicr-assessment', label: '18 — SICR' },
  { id: 'signoff', label: '19 — Signoff' },
] as const;

interface ApprovalPackPreviewProps {
  applicationId: string;
  applicationNo: string;
  onClose: () => void;
}

const ApprovalPackPreview: React.FC<ApprovalPackPreviewProps> = ({ applicationId, applicationNo, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlUrl, setHtmlUrl] = useState<string>('');
  const blobUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    creditService.getApprovalPackHtml(applicationId)
      .then((html) => {
        if (cancelled) return;
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setHtmlUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to load approval pack');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = '';
      }
    };
  }, [applicationId]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      const el = iframeRef.current.contentWindow.document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      // Blob URL fallback: append fragment to trigger scroll via hash
      if (blobUrlRef.current) {
        setHtmlUrl(`${blobUrlRef.current}#${sectionId}`);
      }
    }
  }, [applicationId]);

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { jobId } = await creditService.downloadApprovalPackPdf(applicationId);
      const url = await pollPdfJob(jobId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${applicationNo}-approval-pack.pdf`;
      a.click();
    } catch {
      // swallow — user can retry
    } finally {
      setDownloading(false);
    }
  };

  // Focus trap and Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: keep Tab within the modal
      if (e.key === 'Tab') {
        const modal = document.getElementById('approval-pack-modal');
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-focus the modal on open
  useEffect(() => {
    const modal = document.getElementById('approval-pack-modal');
    if (modal) {
      const firstFocusable = modal.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      firstFocusable?.focus();
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Approval Pack Preview — ${applicationNo}`}>
      <div
        id="approval-pack-modal"
        className="flex w-full max-w-[95vw] h-[90vh] mx-auto my-[5vh] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-56' : 'w-10'} border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-200 flex-shrink-0`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 text-xs font-semibold"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>
          {sidebarOpen && (
            <nav className="flex-1 overflow-y-auto px-2 pb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 mt-1">
                Sections
              </p>
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  aria-label={`Jump to section: ${s.label}`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Approval Pack — {applicationNo}
              </h2>
              <p className="text-xs text-gray-500">Preview document for approval review</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                title="Download PDF"
                aria-label="Download approval pack as PDF"
              >
                ↓ {downloading ? 'Generating…' : 'Download PDF'}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                aria-label="Close approval pack preview"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Preview iframe */}
          <div className="flex-1 overflow-hidden bg-gray-100 p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Loading approval pack…
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500 text-sm">
                {error}
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={htmlUrl}
                className="w-full h-full border-0 rounded bg-white"
                title={`Approval Pack — ${applicationNo}`}
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalPackPreview;