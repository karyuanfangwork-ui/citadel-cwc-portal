/**
 * P3-04: Queue monitoring controller
 *
 * Provides visibility into BullMQ queue state for ops/admin dashboards.
 * Returns per-queue counts (waiting, active, completed, failed, delayed)
 * for all registered queues.
 */

import { Request, Response, NextFunction } from 'express';
import { getQueueHealth } from '../credit/queues';
import { pdfQueue } from '../queues/pdf.queue';
import { logger } from '../utils/logger';

export async function listQueues(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Credit module queues
        const creditQueues = await getQueueHealth().catch((err) => {
            logger.warn('Failed to query credit queues', { error: String(err) });
            return { error: 'credit queues unavailable' };
        });

        // PDF generation queue
        let pdfInfo: Record<string, any> = {};
        try {
            const counts = await pdfQueue.getJobCounts();
            pdfInfo = {
                'pdf.generation': {
                    waiting: counts.waiting,
                    active: counts.active,
                    completed: counts.completed,
                    failed: counts.failed,
                    delayed: counts.delayed,
                },
            };
        } catch (err) {
            logger.warn('Failed to query PDF queue', { error: String(err) });
            pdfInfo = { 'pdf.generation': { error: 'unavailable' } };
        }

        res.json({
            status: 'success',
            data: {
                queues: { ...creditQueues, ...pdfInfo },
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err) {
        next(err);
    }
}