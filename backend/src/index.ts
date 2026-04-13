import dotenv from 'dotenv';
import { config } from './config';
import { logger } from './utils/logger';
import { startSlaChecker } from './jobs/sla-checker';
import app from './app';

// Load environment variables
dotenv.config();

// ============================================================================
// SERVER
// ============================================================================

const PORT = config.port;

const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${config.env} mode`);
    logger.info(`📡 API available at http://localhost:${PORT}${config.apiPrefix}`);
    logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
    startSlaChecker();
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
