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
 * P01 Task 4 (Finding #13): The Redis key now includes the userId
 * so that only the creating user can poll the job result.
 *
 * @param html      Full HTML string to render
 * @param s3Prefix  S3 key prefix, e.g. 'credit/loo/' — a unique key is appended
 * @param userId    The authenticated user who initiated the job
 */
export async function enqueuePdf(html: string, s3Prefix = 'pdf/', userId?: string): Promise<string> {
  const s3Key = `${s3Prefix}${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  const job = await pdfQueue.add('generate', { html, s3Key, userId });
  const jobId = job.id!;
  // Seed pending state — key is scoped to user if userId provided
  const redisKey = userId ? `pdf:result:${userId}:${jobId}` : `pdf:result:${jobId}`;
  await redis.set(redisKey, JSON.stringify({ status: 'pending' }), 'EX', RESULT_TTL_SECONDS);
  return jobId;
}

/**
 * Check the result of a PDF job.
 * P01 Task 4: userId is required; only the creating user can poll their own jobs.
 * Falls back to the legacy key format for backward compatibility during migration.
 *
 * Returns { status: 'pending' } while the worker is running,
 * { status: 'done', presignedUrl } when the PDF is ready,
 * { status: 'error', error } on failure.
 */
export async function getPdfResult(jobId: string, userId?: string): Promise<PdfJobResult> {
  // Try user-scoped key first (P01-13)
  if (userId) {
    const userKey = `pdf:result:${userId}:${jobId}`;
    const userRaw = await redis.get(userKey);
    if (userRaw) return JSON.parse(userRaw) as PdfJobResult;
  }
  // Legacy fallback for jobs created before the user-scope migration
  const legacyKey = `pdf:result:${jobId}`;
  const raw = await redis.get(legacyKey);
  if (!raw) return { status: 'error', error: 'Job not found or expired' };
  return JSON.parse(raw) as PdfJobResult;
}

/**
 * Called by the worker to store a successful result.
 * P01 Task 4: Stores under the user-scoped key if userId provided.
 */
export async function setPdfResult(jobId: string, presignedUrl: string, userId?: string): Promise<void> {
  const redisKey = userId ? `pdf:result:${userId}:${jobId}` : `pdf:result:${jobId}`;
  await redis.set(redisKey, JSON.stringify({ status: 'done', presignedUrl }), 'EX', RESULT_TTL_SECONDS);
}

/**
 * Called by the worker to store a failure result.
 * P01 Task 4: Stores under the user-scoped key if userId provided.
 */
export async function setPdfError(jobId: string, error: string, userId?: string): Promise<void> {
  const redisKey = userId ? `pdf:result:${userId}:${jobId}` : `pdf:result:${jobId}`;
  await redis.set(redisKey, JSON.stringify({ status: 'error', error }), 'EX', RESULT_TTL_SECONDS);
  logger.error(`[PdfJob] Job ${jobId} failed: ${error}`);
}