import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: _req.ip,
            path: _req.path,
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 30,
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
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // 200 uploads per hour (increased for development)
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
    max: process.env.NODE_ENV === 'development' ? 100 : 10,
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
