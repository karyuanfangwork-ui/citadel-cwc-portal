import dotenv from 'dotenv';

dotenv.config();

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
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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

    // Elasticsearch
    elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        username: process.env.ELASTICSEARCH_USERNAME || '',
        password: process.env.ELASTICSEARCH_PASSWORD || '',
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'debug',
        format: process.env.LOG_FORMAT || 'json',
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

    // Session
    session: {
        secret: process.env.SESSION_SECRET || '',
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
    },
    // Hardware VP Approval
    hardwareVpApprovalThreshold: parseInt(process.env.HARDWARE_VP_APPROVAL_THRESHOLD || '2500', 10),

    // Finance Group CEO Approval threshold (amounts above this require Group CEO approval)
    groupCeoApprovalThreshold: parseInt(process.env.GROUP_CEO_APPROVAL_THRESHOLD || '15000', 10),

    // SLA Checker Schedule
    // Supports two modes:
    //   'interval' — runs every SLA_CHECK_INTERVAL_MS milliseconds (default 60000 = 1 minute)
    //   'cron'     — runs on a cron schedule defined by SLA_CRON_EXPRESSION (default '0 9 * * 1-5' = Mon-Fri 9am)
    slaSchedule: {
        mode: (process.env.SLA_SCHEDULE_MODE || 'cron') as 'interval' | 'cron',
        intervalMs: parseInt(process.env.SLA_CHECK_INTERVAL_MS || '60000', 10),
        cronExpression: process.env.SLA_CRON_EXPRESSION || '0 9 * * 1-5',
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
