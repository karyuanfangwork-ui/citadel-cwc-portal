import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config';
import { logger } from './utils/logger';
import prisma from './utils/prisma';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { correlationId } from './middleware/correlationId.middleware';
import routes from './routes';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();

// Trust proxy — required behind nginx (Docker Compose production setup)
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
}));

// P3-02: Correlation ID — must be early in the stack so all downstream
// handlers and log entries include the request-scoped ID.
app.use(correlationId);

// Cookie parsing
app.use(cookieParser());

// CORS
const corsOriginsValue: unknown = config.cors.origins;
const corsOrigins = Array.isArray(corsOriginsValue)
    ? corsOriginsValue
    : typeof corsOriginsValue === 'string'
        ? corsOriginsValue.split(',').map((origin: string) => origin.trim()).filter(Boolean)
        : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Serialize BigInt as number in all JSON responses (Prisma fileSize field)
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);

// Body parsing (increased limit for bulk import payloads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression
app.use(compression());

// P1-03: Redact sensitive query params (token) from request logs.
// Morgan logs the full URL including query strings, which can leak JWTs.
morgan.token('url-redacted', (req: Request) => {
    const url = req.originalUrl || req.url;
    return url.replace(/([?&])token=[^&]+/g, '$1token=[REDACTED]');
});

// Request logging
if (config.env === 'development') {
    app.use(morgan(':method :url-redacted :status :response-time ms - :res[content-length]'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message: string) => {
                // P1-03: Redact token= query param from combined log URLs
                const redacted = message.replace(/([?&])token=[^&\s]+/g, '$1token=[REDACTED]');
                logger.info(redacted.trim());
            },
        },
    }));
}

// ============================================================================
// HEALTH CHECKS
// ============================================================================

// Liveness: is the process alive? Always returns 200 if the event loop is responsive.
app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness: can the process serve traffic? Checks DB + Redis connectivity.
app.get('/health/ready', async (_req: Request, res: Response) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Database check
    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'ok', latencyMs: Date.now() - start };
    } catch (err: any) {
        checks.database = { status: 'error', error: err.message || String(err) };
    }

    // Redis check (optional — may not be configured)
    let redisClient: any = null;
    try {
        const { createRedisClient, ensureConnected } = await import('./utils/redis');
        if (config.redis.url) {
            redisClient = createRedisClient();
            await ensureConnected(redisClient);
            const start = Date.now();
            await redisClient.ping();
            checks.redis = { status: 'ok', latencyMs: Date.now() - start };
        }
    } catch {
        // Redis is optional; degraded state, not fatal
        checks.redis = { status: 'degraded', error: 'unavailable' };
    }

    const allOk = checks.database.status === 'ok';
    const status = allOk ? 200 : 503;

    res.status(status).json({
        status: allOk ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
    });
});

// Legacy /health endpoint (combines liveness)
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
    });
});

// ============================================================================
// STATIC FILES
// ============================================================================

// P1-15: Local /uploads serving is disabled in production by default.
// Production uses S3 presigned URLs via /api/v1/files/download/:key.
// Set SERVE_LOCAL_UPLOADS=true in .env to re-enable (dev/legacy migration only).
if (config.serveLocalUploads) {
    app.use('/uploads', express.static('uploads', {
        dotfiles: 'deny',         // Block access to hidden files
        index: false,              // Disable directory index
        maxAge: '1h',              // Cache for 1 hour
        setHeaders: (res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        },
    }));
    logger.info('Local /uploads static serving ENABLED (SERVE_LOCAL_UPLOADS=true)');
} else {
    logger.info('Local /uploads static serving DISABLED (production mode). Files served via S3 presigned URLs.');
}

// ============================================================================
// API ROUTES
// ============================================================================

app.use(config.apiPrefix, routes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
