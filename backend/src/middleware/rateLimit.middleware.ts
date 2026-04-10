import rateLimit from 'express-rate-limit';
import { config } from '../config';

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
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 10,
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
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
