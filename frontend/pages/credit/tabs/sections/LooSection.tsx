import React, { useState, useEffect, useCallback } from 'react';
import creditService, { looApi, LooStatus } from '../../../../src/services/credit.service';
import { pollPdfJob } from '../../../../src/services/pdfJob.service';

interface Props {
  applicationId: string;
  state: string; // CreditApplication.state
  readOnly?: boolean;
}

const LooSection: React.FC<Props> = ({ applicationId, state, readOnly = false }) => {
  const [status, setStatus] = useState<LooStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPdfJobId, setLastPdfJobId] = useState<string | null>(null);

  const canGenerate = !readOnly && (state === 'APPROVED' || state === 'OFFER');

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await looApi.status(applicationId);
      setStatus(s);
    } catch {
      // No LOO yet — that's OK, only show generate button if allowed
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await looApi.generate(applicationId);
      setLastPdfJobId(result.pdfJobId);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to generate LOO');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await looApi.regenerate(applicationId);
      setLastPdfJobId(result.pdfJobId);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to regenerate LOO');
    } finally {
      setGenerating(false);
    }
  };

  const [pdfPending, setPdfPending] = useState(false);

  const handleDownload = async () => {
    if (!status?.documentId) return;
    setPdfPending(true);
    try {
      // If we have a pdfJobId from the generate response, poll until the PDF is ready
      if (lastPdfJobId) {
        try {
          await pollPdfJob(lastPdfJobId, 1500, 30000);
        } catch {
          // Job may have expired (TTL 1h) — try download anyway
        }
      }
      const url = await creditService.getDocumentDownloadUrl(status.documentId);
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to download LOO PDF');
    } finally {
      setPdfPending(false);
    }
  };

  // Don't render if no LOO exists AND user can't generate one
  if (!status && !canGenerate) return null;

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Letter of Offer (LOO)</h3>
        <p className="text-xs text-gray-400">Loading…</p>
      </div>
    );
  }

  const expiryBadge = () => {
    if (!status?.expiryDate) return null;
    if (status.expired) {
      return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">Expired</span>;
    }
    const days = status.daysRemaining ?? 0;
    if (days <= 1) {
      return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">Expires in {days} day{days !== 1 ? 's' : ''}!</span>;
    }
    if (days <= 3) {
      return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Expires in {days} days</span>;
    }
    if (days <= 7) {
      return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Expires in {days} days</span>;
    }
    return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">Expires in {days} days</span>;
  };

  return (
    <div className="bg-white border rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Letter of Offer (LOO)</h3>
        {status && <span className="text-xs text-gray-500">Version {status.version}</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 mb-3 text-xs text-red-700">{error}</div>
      )}

      {!status ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">No Letter of Offer has been generated yet.</p>
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate Letter of Offer'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="text-gray-500">Generated:</span>{' '}
              <span className="font-medium">{status.generatedAt ? new Date(status.generatedAt).toLocaleDateString('en-MY') : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Expiry:</span>{' '}
              <span className="font-medium">{status.expiryDate ? new Date(status.expiryDate).toLocaleDateString('en-MY') : '—'}</span>
              {' '}{expiryBadge()}
            </div>
            {status.generatedBy && (
              <div>
                <span className="text-gray-500">Prepared by:</span>{' '}
                <span className="font-medium">{status.generatedBy.firstName} {status.generatedBy.lastName}</span>
              </div>
            )}
          </div>

          {status.expired && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 mb-3 text-xs text-red-700">
              <strong>Expired:</strong> This Letter of Offer has expired. Please regenerate to proceed.
            </div>
          )}

          <div className="flex items-center gap-2">
            {canGenerate && (
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? 'Regenerating…' : 'Regenerate LOO'}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!status?.documentId || pdfPending}
              className="px-3 py-1.5 border text-xs font-medium rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {pdfPending ? 'Generating PDF…' : 'Download PDF'}
            </button>
          </div>

          <div className="mt-3 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
            Send this letter to the borrower for signing. Once signed, upload the executed copy as a <strong>Legal</strong> document and have it verified to accept the offer.
          </div>
        </>
      )}
    </div>
  );
};

export default LooSection;