import { Worker, Job } from 'bullmq';
import { htmlToPdf } from '../credit/services/htmlToPdf.service';
import { getRedisConnectionConfig } from '../utils/redis';
import { setPdfResult, setPdfError } from '../services/pdfJob.service';
import { s3Service } from '../services/s3.service';
import { logger } from '../utils/logger';

export const PDF_WORKER_CONCURRENCY = Number(process.env.PDF_WORKER_CONCURRENCY ?? '2');

interface PdfJobData {
  html: string;
  s3Key: string;
}

export function startPdfWorker(): Worker<PdfJobData> {
  const worker = new Worker<PdfJobData>(
    'pdf.generation',
    async (job: Job<PdfJobData>) => {
      const { html, s3Key } = job.data;
      logger.info(`[PdfWorker] Generating PDF for job ${job.id} → ${s3Key}`);

      const pdfBuffer = await htmlToPdf(html);
      await s3Service.uploadBuffer(s3Key, pdfBuffer, 'application/pdf');

      // Generate a short-lived presigned URL (1 hour — same as Redis TTL)
      const presignedUrl = await s3Service.getPresignedUrl(s3Key, 1);
      await setPdfResult(job.id!, presignedUrl);

      logger.info(`[PdfWorker] Job ${job.id} complete → ${s3Key}`);
    },
    {
      connection: getRedisConnectionConfig(),
      concurrency: PDF_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', async (job, err) => {
    if (job) await setPdfError(job.id!, err.message);
    logger.error(`[PdfWorker] Job ${job?.id} failed: ${err.message}`);
  });

  logger.info(`[PdfWorker] Started (concurrency: ${PDF_WORKER_CONCURRENCY})`);
  return worker;
}