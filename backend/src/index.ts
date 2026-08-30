import dotenv from 'dotenv';
import { config } from './config';
import { logger } from './utils/logger';
import { initScheduler, shutdownScheduler } from './services/scheduler.service';
import { initSseRedis, disconnectSseRedis } from './utils/sseClients';
import { startWorkflowEngine } from './services/crm-workflow.service';
import { startPdfWorker, stopPdfWorker } from './workers/pdf.worker';
import { startAttachmentScanWorker, stopAttachmentScanWorker } from './workers/attachmentScan.worker';
import { startNotificationWorker } from './workers/notification.worker';
import { attachmentScanQueue } from './queues/attachmentScan.queue';
import { startAttachmentLifecycleReconciler } from './services/attachmentLifecycleReconciler.service';
import { checkCreditConfigurationHealth } from './credit/services/configHealth.service';
import app from './app';

// Load environment variables
dotenv.config();

// ============================================================================
// SERVER
// ============================================================================

const PORT = config.port;
let isShuttingDown = false;
let notificationWorker: ReturnType<typeof startNotificationWorker> | null = null;
let stopAttachmentReconciler: (() => void) | null = null;

const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${config.env} mode`);
    logger.info(`📡 API available at http://localhost:${PORT}${config.apiPrefix}`);
    logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
    void checkCreditConfigurationHealth();
    initScheduler();

    // Initialize Redis pub/sub for SSE fan-out (multi-instance support)
    initSseRedis();

    // Start workflow automation engine
    startWorkflowEngine();

    // Start PDF generation worker (BullMQ)
    startPdfWorker();

    // Start governed malware scanning and quarantine worker (BullMQ)
    startAttachmentScanWorker();
    stopAttachmentReconciler = startAttachmentLifecycleReconciler();

    // Start durable notification delivery worker (BullMQ)
    notificationWorker = startNotificationWorker();
});

// Graceful shutdown
const gracefulShutdown = (signal: string, error?: unknown, exitCode = 0) => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);

    if (error) {
        logger.error(`${signal} triggered by fatal error`, error);
    }

    // Disconnect Redis pub/sub connections
    disconnectSseRedis();

    // Stop scheduled jobs
    shutdownScheduler();
    stopAttachmentReconciler?.();

    const workerShutdown = Promise.allSettled([
        stopPdfWorker(),
        stopAttachmentScanWorker(),
        notificationWorker?.close(),
        attachmentScanQueue.close(),
    ]);

    server.close(async () => {
        await workerShutdown;
        logger.info('Server closed');
        process.exit(exitCode);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => gracefulShutdown('unhandledRejection', reason, 1));
process.on('uncaughtException', (error) => gracefulShutdown('uncaughtException', error, 1));

export default app;
