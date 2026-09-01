import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuthRequest } from './auth.middleware';
import { createRedisRateLimitStore } from './rateLimitStore';

// P1-05/P1-06: Create Redis-backed stores when enabled, otherwise undefined
// (express-rate-limit falls back to in-memory store).
//
// Auth and password-reset limiters use a dedicated prefix to isolate their
// keys from general API traffic.
const apiStore = createRedisRateLimitStore({ prefix: 'rl:api:' });
const authStore = createRedisRateLimitStore({ prefix: 'rl:auth:' });
const uploadStore = createRedisRateLimitStore({ prefix: 'rl:upload:' });
const pwResetStore = createRedisRateLimitStore({ prefix: 'rl:pwreset:' });
const bureauStore = createRedisRateLimitStore({ prefix: 'rl:bureau:' });
const exportStore = createRedisRateLimitStore({ prefix: 'rl:export:' });
const piiReadStore = createRedisRateLimitStore({ prefix: 'rl:pii:' });
const scoreOverrideStore = createRedisRateLimitStore({ prefix: 'rl:score:' });
const crmAiStore = createRedisRateLimitStore({ prefix: 'rl:crm-ai:' });

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    store: apiStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limit for SSE connections (long-lived, low frequency)
    skip: (_req) => _req.headers.accept === 'text/event-stream',
    handler: (_req, res, _next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: _req.ip,
            path: _req.path,
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * Auth rate limiter — keyed by email+IP.
 *
 * Per-email tracking means:
 * - A user mistyping their password doesn't block their entire office (shared IP).
 * - An attacker brute-forcing one account from one IP is limited to 20 attempts per 15 min.
 * - An attacker trying one password across many emails from one IP gets 20 attempts per
 *   unique email, which is still bounded.
 *
 * The key includes IP as a second factor so distributed attacks from many IPs against
 * one email are still limited per source.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV !== 'production' ? 1000 : 20,
    store: authStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    keyGenerator: (_req) => {
        // Derive key from email (if present in body) + IP.
        // For login this is the email field; for refresh there's no body so fall back to IP only.
        const email = _req.body?.email?.toString().toLowerCase().trim();
        const ip = _req.ip || 'unknown';
        return email ? `${email}:${ip}` : ip;
    },
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
        logger.warn('Auth rate limit exceeded', {
            ip: _req.ip,
            path: _req.path,
            email: _req.body?.email,
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'development' ? 500 : 300, // 300 uploads per hour
    store: uploadStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many file uploads, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for password reset (prevents token brute-force)
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'development' ? 100 : 20,
    store: pwResetStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many password reset attempts. Please try again in 1 hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
        logger.warn('Password reset rate limit exceeded', {
            ip: _req.ip,
            path: _req.path,
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});

// §2.8 — Credit-specific per-endpoint rate limits

/**
 * Bureau check rate limiter — 5 requests per minute per user.
 * Bureau API calls are expensive and rate-limited by the vendor.
 */
export const creditBureauLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 100 : 5,
    store: bureauStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Bureau check rate limit exceeded. Please wait before making another check.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).user?.id || req.ip!,
    handler: (_req, res, _next, options) => {
        logger.warn('Credit bureau rate limit exceeded', {
            userId: (_req as AuthRequest).user?.id,
            ip: _req.ip,
            path: _req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * Data export rate limiter — 5 requests per minute per user.
 * CSV/PDF exports contain PII and are audit-logged; burst protection required.
 */
export const creditExportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 100 : 5,
    store: exportStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Export rate limit exceeded. Please wait before exporting again.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).user?.id || req.ip!,
    handler: (_req, res, _next, options) => {
        logger.warn('Credit export rate limit exceeded', {
            userId: (_req as AuthRequest).user?.id,
            ip: _req.ip,
            path: _req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * PII read rate limiter — 10 requests per minute per user.
 * Prevents bulk PII scraping through repeated queries.
 */
export const creditPiiReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 200 : 10,
    store: piiReadStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'PII access rate limit exceeded. Please slow down your requests.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).user?.id || req.ip!,
    handler: (_req, res, _next, options) => {
        logger.warn('Credit PII read rate limit exceeded', {
            userId: (_req as AuthRequest).user?.id,
            ip: _req.ip,
            path: _req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * Score override rate limiter — 5 requests per minute per user.
 * Score overrides are sensitive actions requiring dual approval; prevent brute-force.
 */
export const creditScoreOverrideLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 100 : 5,
    store: scoreOverrideStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Score override rate limit exceeded. Please wait before submitting another override.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).user?.id || req.ip!,
    handler: (_req, res, _next, options) => {
        logger.warn('Credit score override rate limit exceeded', {
            userId: (_req as AuthRequest).user?.id,
            ip: _req.ip,
            path: _req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * CRM AI limiter — protects expensive model-backed CRM endpoints.
 */
export const crmAiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    // CRM AI calls are expensive model-backed operations; keep the production
    // protection active in development so the configured contract is testable
    // and local traffic cannot accidentally hide abuse.
    max: 10,
    store: crmAiStore, // P1-06: Redis-backed when RATE_LIMIT_REDIS_ENABLED=true
    message: {
        status: 'error',
        statusCode: 429,
        message: 'CRM AI rate limit exceeded. Please wait before making another AI request.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).user?.id || req.ip!,
    handler: (_req, res, _next, options) => {
        logger.warn('CRM AI rate limit exceeded', {
            userId: (_req as AuthRequest).user?.id,
            ip: _req.ip,
            path: _req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
});
