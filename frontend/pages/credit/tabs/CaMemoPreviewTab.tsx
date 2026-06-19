import React, { useCallback, useEffect, useRef, useState } from 'react';
import creditService from '../../../src/services/credit.service';
import { pollPdfJob } from '../../../src/services/pdfJob.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

interface CaMemoPreviewTabProps {
  applicationId: string;
  applicationNo: string;
}

const CaMemoPreviewTab: React.FC<CaMemoPreviewTabProps> = ({ applicationId, applicationNo }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string>('');
  const blobUrlRef = useRef<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const html = await creditService.previewCaMemoHtml(applicationId);
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      setHtmlUrl(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load CA Memo preview');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadPreview();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [loadPreview]);

  const handleDownloadPdf = async () => {
    const { jobId } = await creditService.downloadCaMemo(applicationId);
    const url = await pollPdfJob(jobId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${applicationNo}-ca-memo.pdf`;
    a.click();
  };

  const scrollToTop = () => {
    iframeRef.current?.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <CaMemoSection
      title="CA Memo Preview"
      phase="Phase 5"
      actions={(
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPreview}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={scrollToTop}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            Top
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700"
          >
            Download PDF
          </button>
        </div>
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-600 py-10 justify-center">
          <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
          Loading CA Memo preview…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && htmlUrl && (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            title="CA Memo Preview"
            src={htmlUrl}
            className="w-full min-h-[900px]"
            style={{ border: 0 }}
          />
        </div>
      )}
    </CaMemoSection>
  );
};

export default CaMemoPreviewTab;
