import dotenv from 'dotenv';

dotenv.config();

const corsOrigins = Array.from(
    new Set(
        (process.env.CORS_ORIGIN || 'http://localhost:5173')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
    )
);

if (process.env.NODE_ENV !== 'production') {
    corsOrigins.push('http://localhost:5173');
    corsOrigins.push('http://127.0.0.1:5173');
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || '/api/v1',

    // Database
    database: {
        url: process.env.DATABASE_URL || '',
    },

    // Redis
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || '',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET || '',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },

    // Cookies
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
    },

    // CORS
    cors: {
        origins: corsOrigins,
    },

    // File Upload
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
        allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(','),
    },

    // AWS S3
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        s3BucketName: process.env.S3_BUCKET_NAME || 'help-center-attachments',
        s3Endpoint: process.env.S3_ENDPOINT || '', // For MinIO
    },

    // Email (Resend)
    email: {
        resendApiKey: process.env.RESEND_API_KEY || '',
        from: process.env.EMAIL_FROM || 'Help Center <help@helpdesk.com>',
        replyTo: process.env.EMAIL_REPLY_TO || 'help@helpdesk.com',
        // Dev-only: redirect all outgoing emails to this address (bypasses
        // Resend test-domain restriction that limits recipients to account owner)
        devRecipient: process.env.EMAIL_DEV_RECIPIENT || '',
    },

    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
    },

    // Elasticsearch
    elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        username: process.env.ELASTICSEARCH_USERNAME || '',
        password: process.env.ELASTICSEARCH_PASSWORD || '',
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10),
        // P1-05: Enable Redis-backed rate limiting for cluster-safe counters.
        // When false (default), falls back to in-memory store.
        redisEnabled: process.env.RATE_LIMIT_REDIS_ENABLED === 'true',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'debug',
        format: process.env.LOG_FORMAT || 'json',
        // P1-09: Gate Prisma query/info logging. Only enable in development or
        // when explicitly requested — never in production by default.
        prismaLogQueries: process.env.PRISMA_LOG_QUERIES === 'true',
    },

    // P3-03: Prometheus metrics endpoint
    // When enabled, /metrics is served at root level (no auth).
    // Restrict via network policy in production (e.g. only Prometheus namespace).
    metrics: {
        enabled: process.env.METRICS_ENABLED !== 'false', // enabled by default
    },

    // S3/MinIO Storage
    s3: {
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'helpdesk-uploads',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },

    // P1-15: Static file serving — disabled in production by default.
    // Set SERVE_LOCAL_UPLOADS=true to re-enable (legacy migration / dev only).
    // In production, files should be served through S3 presigned URLs via /api/v1/files/download/:key.
    serveLocalUploads: process.env.SERVE_LOCAL_UPLOADS === 'true',

    // Session
    session: {
        secret: process.env.SESSION_SECRET || '',
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
    },
    // Hardware VP Approval
    hardwareVpApprovalThreshold: parseInt(process.env.HARDWARE_VP_APPROVAL_THRESHOLD || '2500', 10),

    // Finance Group Deputy CEO Approval threshold (amounts above this require Group Deputy CEO approval)
    groupDceoApprovalThreshold: parseInt(process.env.GROUP_DCEO_APPROVAL_THRESHOLD || '15000', 10),

    // SLA Checker Schedule
    // Supports two modes:
    //   'interval' — runs every SLA_CHECK_INTERVAL_MS milliseconds (default 60000 = 1 minute)
    //   'cron'     — runs on a cron schedule defined by SLA_CRON_EXPRESSION (default '0 9 * * 1-5' = Mon-Fri 9am)
    slaSchedule: {
        mode: (process.env.SLA_SCHEDULE_MODE || 'cron') as 'interval' | 'cron',
        intervalMs: parseInt(process.env.SLA_CHECK_INTERVAL_MS || '60000', 10),
        cronExpression: process.env.SLA_CRON_EXPRESSION || '0 9 * * 1-5',
    },

    // Scheduler distributed lock (P3-05)
    // When SCHEDULER_SINGLETON_MODE=true, only one instance runs each cron job.
    // Requires Redis. If Redis is unavailable in singleton mode, jobs are SKIPPED
    // to prevent duplicates. When false (default), jobs run on all instances if
    // Redis is down — matches pre-P3-05 behavior.
    scheduler: {
        singletonMode: process.env.SCHEDULER_SINGLETON_MODE === 'true',
    },

    // CRM Automation Schedule
    // Supports three modes:
    //   'cron'     — uses individual cron expressions per check type
    //   'interval' — runs all CRM checks every CRM_CHECK_INTERVAL_MS milliseconds
    //   'disabled' — no CRM automation checks run
    crmSchedule: {
        mode: (process.env.CRM_SCHEDULE_MODE || 'cron') as 'interval' | 'cron' | 'disabled',
        intervalMs: parseInt(process.env.CRM_CHECK_INTERVAL_MS || '3600000', 10), // default 1 hour
    },

    // Application
    app: {
        name: process.env.APP_NAME || 'Enterprise Help Center',
        url: process.env.APP_URL || 'http://localhost:5173',
        adminEmail: process.env.ADMIN_EMAIL || 'admin@helpdesk.com',
    },

    // Security
    security: {
        checkPasswordBreach: process.env.CHECK_PASSWORD_BREACH === 'true',
        passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
        accountLockoutMaxAttempts: parseInt(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS || '5', 10),
        accountLockoutWindowMs: parseInt(process.env.ACCOUNT_LOCKOUT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
        internalScanToken: process.env.INTERNAL_SCAN_TOKEN || '',
        serviceApiKey: process.env.SERVICE_API_KEY || '',  // P0-5: for service-to-service auth
    },

    // Credit
    credit: {
        encryptionKey: process.env.CREDIT_ENCRYPTION_KEY || '',
        // P1-3 — absolute staleness ceiling for committee submission (days)
        scoreMaxAgeDays: parseInt(process.env.SCORE_MAX_AGE_DAYS || '30', 10),
    },
};

// Validate critical config — enforced in ALL environments, not just production
const requiredSecrets: Array<[string, string | undefined]> = [
    ['JWT_SECRET', config.jwt.secret],
    ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
    ['DATABASE_URL', config.database.url],
];

for (const [name, value] of requiredSecrets) {
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}.\n` +
            `Generate a secure value with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
        );
    }
}
