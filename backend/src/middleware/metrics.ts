/**
 * P3-03: Prometheus-compatible metrics middleware
 *
 * Exposes a /metrics endpoint for monitoring scrapers (Prometheus, Datadog, etc.)
 * Collects:
 *   - HTTP request duration histogram (method, route, status)
 *   - HTTP request counter
 *   - Node.js default metrics (event loop lag, GC, memory, CPU)
 *   - Active connections gauge
 *
 * The /metrics endpoint is UNAUTHENTICATED — it must be restricted via
 * network policy (e.g. only scrape from Prometheus namespace) or behind
 * an internal-only ingress. It is mounted BEFORE auth middleware.
 *
 * Config: METRICS_ENABLED (default: true in production, false in test)
 */

import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// ── Registry ────────────────────────────────────────────────────────────────

const register = new client.Registry();
register.setDefaultLabels({ app: 'cwc-api' });

// ── Default Node.js metrics (GC, event loop, memory, CPU) ──────────────────

let defaultsCollected = false;
export function collectDefaultMetrics(): void {
    if (defaultsCollected) return;
    client.collectDefaultMetrics({ register });
    defaultsCollected = true;
}

// ── HTTP metrics ────────────────────────────────────────────────────────────

export const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [register],
});

// ── Active connections gauge ────────────────────────────────────────────────

export const activeConnections = new client.Gauge({
    name: 'http_active_connections',
    help: 'Number of active HTTP connections',
    registers: [register],
});

// ── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that records HTTP request duration and count.
 * Must be mounted early (before routes) so res.on('finish') captures the status.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        // Normalize route to avoid high-cardinality label explosion.
        // Replace path segments that look like IDs (UUIDs, numbers, ObjectIds).
        const route = normalizeRoute(req.route?.path || req.path || '/');
        const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode),
        };

        const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
        httpDuration.observe(labels, durationSec);
        httpRequestsTotal.inc(labels);
    });

    next();
}

/**
 * Normalize a URL path to reduce label cardinality.
 * Replaces segments that look like IDs with :id.
 */
function normalizeRoute(path: string): string {
    return path
        .split('/')
        .map((seg) => {
            // UUID: 8-4-4-4-12 hex
            if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) return ':id';
            // Mongo ObjectId: 24 hex chars
            if (/^[0-9a-f]{24}$/i.test(seg)) return ':id';
            // Numeric ID
            if (/^\d+$/.test(seg)) return ':id';
            return seg;
        })
        .join('/');
}

// ── Metrics endpoint handler ────────────────────────────────────────────────

/**
 * Returns Prometheus exposition-format metrics.
 * Should be mounted on /metrics (unauthenticated, network-restricted).
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (err) {
        logger.error('Failed to collect metrics', { error: String(err) });
        res.status(500).end('# ERROR collecting metrics\n');
    }
}

export { register };