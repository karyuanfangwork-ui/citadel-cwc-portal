import { createRedisClient } from '../utils/redis';
import { pdfQueue } from '../queues/pdf.queue';
import { logger } from '../utils/logger';

const redis = createRedisClient();
const RESULT_TTL_SECONDS = 3600; // 1 hour

export interface PdfJobResult {
  status: 'pending' | 'done' | 'error';
  presignedUrl?: string;
  error?: string;
}

/**
 * Enqueue an HTML→PDF job. Returns the BullMQ job ID immediately.
 * The PDF is generated async; poll getPdfResult(jobId) for completion.
 *
 * @param html      Full HTML string to render
 * @param s3Prefix  S3 key prefix, e.g. 'credit/loo/' — a unique key is appended
 */
export async function enqueuePdf(html: string, s3Prefix = 'pdf/'): Promise<string> {
  const s3Key = `${s3Prefix}${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  const job = await pdfQueue.add('generate', { html, s3Key });
  const jobId = job.id!;
  // Seed pending state so the poll endpoint can return immediately
  await redis.set(`pdf:result:${jobId}`, JSON.stringify({ status: 'pending' }), 'EX', RESULT_TTL_SECONDS);
  return jobId;
}

/**
 * Check the result of a PDF job.
 * Returns { status: 'pending' } while the worker is running,
 * { status: 'done', presignedUrl } when the PDF is ready,
 * { status: 'error', error } on failure.
 */
export async function getPdfResult(jobId: string): Promise<PdfJobResult> {
  const raw = await redis.get(`pdf:result:${jobId}`);
  if (!raw) return { status: 'error', error: 'Job not found or expired' };
  return JSON.parse(raw) as PdfJobResult;
}

/**
 * Called by the worker to store a successful result.
 */
export async function setPdfResult(jobId: string, presignedUrl: string): Promise<void> {
  await redis.set(`pdf:result:${jobId}`, JSON.stringify({ status: 'done', presignedUrl }), 'EX', RESULT_TTL_SECONDS);
}

/**
 * Called by the worker to store a failure result.
 */
export async function setPdfError(jobId: string, error: string): Promise<void> {
  await redis.set(`pdf:result:${jobId}`, JSON.stringify({ status: 'error', error }), 'EX', RESULT_TTL_SECONDS);
  logger.error(`[PdfJob] Job ${jobId} failed: ${error}`);
}