import apiClient from './api';

export interface PdfJobStatus {
  status: 'pending' | 'done' | 'error';
  presignedUrl?: string;
  error?: string;
}

/**
 * Poll the PDF job endpoint until the job is done or errors.
 * Returns the presigned S3 URL on success.
 * @param jobId   The job ID returned by the enqueue endpoint
 * @param interval  Polling interval in ms (default 1500)
 * @param timeout   Max time to wait in ms (default 60000)
 */
export async function pollPdfJob(
  jobId: string,
  interval = 1500,
  timeout = 60000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await apiClient.get(`/pdf-jobs/${jobId}`);
    const result: PdfJobStatus = res.data?.data ?? res.data;
    if (result.status === 'done' && result.presignedUrl) {
      return result.presignedUrl;
    }
    if (result.status === 'error') {
      throw new Error(result.error || 'PDF generation failed');
    }
    // status === 'pending' — wait and retry
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('PDF generation timed out');
}

/**
 * Enqueue a PDF generation job and poll until the presigned URL is ready.
 * Used by all 4 PDF endpoints (approval-pack, ca-memo, request-pdf, LOO).
 */
export async function enqueueAndWaitForPdf(
  enqueuePromise: Promise<{ jobId: string }>,
): Promise<string> {
  const { jobId } = await enqueuePromise;
  return pollPdfJob(jobId);
}