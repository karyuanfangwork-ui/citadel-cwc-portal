import crypto from 'crypto';
import Redis from 'ioredis';
import { createRedisClient } from '../../utils/redis';

// ---------------------------------------------------------------------------
// §2.5 — Data Loss Prevention (DLP) Service
// ---------------------------------------------------------------------------
// Prevents bulk PII extraction from credit exports via:
//   1. Short-lived export tokens (Redis-backed, 5-min TTL)
//   2. PII redaction rules for CSV/JSON/PDF formats
//   3. Watermark injection for PDF content
// ---------------------------------------------------------------------------

const EXPORT_TOKEN_PREFIX = 'dlp:export:';
const EXPORT_TOKEN_TTL_SECONDS = 300; // 5 minutes

// PII patterns to redact in exports
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // NRIC / IC numbers (Malaysian format: XXXXXX-XX-XXXX or XXXXXX XX XXXX)
  { pattern: /\d{6}[-\s]?\d{2}[-\s]?\d{4}/g, replacement: '[NRIC-REDACTED]', label: 'NRIC' },
  // Phone numbers (Malaysian: 01X-XXXXXXX or +60-XX-XXXXXXX)
  { pattern: /(\+?6?01\d[-\s]?\d{3,4}[-\s]?\d{3,4})/g, replacement: '[PHONE-REDACTED]', label: 'PHONE' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL-REDACTED]', label: 'EMAIL' },
  // Bank account numbers (10-16 digits with optional spaces/dashes)
  { pattern: /\b\d{3,4}[-\s]?\d{4,}[-\s]?\d{4,}\b/g, replacement: '[ACCT-REDACTED]', label: 'BANK_ACCOUNT' },
];

// Fields that should always be redacted in non-admin exports
const ALWAYS_REDACT_FIELDS = new Set([
  'nric',
  'nricNumber',
  'idNumber',
  'passportNumber',
  'phoneNumber',
  'mobileNumber',
  'email',
  'emailAddress',
  'bankAccount',
  'bankAccountNumber',
  'annualIncome',
  'netWorth',
  'sourceOfWealth',
  'dateOfBirth',
  'homeAddress',
  'mailingAddress',
]);

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = createRedisClient({ maxRetriesPerRequest: 1 });
  }
  return redis;
}

class DlpService {
  // -------------------------------------------------------------------------
  // Export Tokens (short-lived, one-time-use)
  // -------------------------------------------------------------------------

  /**
   * Generate a short-lived export token. The token must be provided when
   * downloading the export file — prevents link sharing and replay attacks.
   */
  async createExportToken(userId: string, exportType: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const key = `${EXPORT_TOKEN_PREFIX}${token}`;
    const payload = JSON.stringify({
      userId,
      exportType,
      createdAt: new Date().toISOString(),
    });

    await getRedis().set(key, payload, 'EX', EXPORT_TOKEN_TTL_SECONDS);
    return token;
  }

  /**
   * Validate and consume an export token. Returns the payload if valid,
   * or null if the token is expired, already used, or invalid.
   * Tokens are single-use — consumed immediately after validation.
   */
  async consumeExportToken(token: string): Promise<{ userId: string; exportType: string; createdAt: string } | null> {
    const key = `${EXPORT_TOKEN_PREFIX}${token}`;
    const raw = await getRedis().get(key);

    if (!raw) return null;

    // Delete immediately — single use
    await getRedis().del(key);

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // PII Redaction
  // -------------------------------------------------------------------------

  /**
   * Redact known PII patterns from a text string.
   * Used for CSV content and free-text fields in JSON exports.
   */
  redactPiiPatterns(text: string): string {
    let result = text;
    for (const { pattern, replacement } of PII_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * Redact PII fields from a JSON object (for API responses / JSON exports).
   * If `isAdmin` is false, always-redact fields are masked.
   * If `isAdmin` is true, only patterns in string values are redacted.
   */
  redactObject(obj: Record<string, any>, isAdmin: boolean): Record<string, any> {
    const redacted = { ...obj };

    for (const key of Object.keys(redacted)) {
      // Always redact sensitive fields for non-admin users
      if (!isAdmin && ALWAYS_REDACT_FIELDS.has(key)) {
        redacted[key] = '[REDACTED]';
        continue;
      }

      // Recursively redact nested objects
      if (typeof redacted[key] === 'object' && redacted[key] !== null && !Array.isArray(redacted[key])) {
        redacted[key] = this.redactObject(redacted[key], isAdmin);
      }

      // Redact PII patterns in string values
      if (typeof redacted[key] === 'string') {
        redacted[key] = this.redactPiiPatterns(redacted[key]);
      }
    }

    return redacted;
  }

  /**
   * Redact PII from an array of objects.
   */
  redactArray(items: Record<string, any>[], isAdmin: boolean): Record<string, any>[] {
    return items.map(item => this.redactObject(item, isAdmin));
  }

  // -------------------------------------------------------------------------
  // Watermark (for PDF exports)
  // -------------------------------------------------------------------------

  /**
   * Generate a watermark string to embed in PDF / printed exports.
   * Includes user ID and timestamp for traceability.
   */
  generateWatermark(userId: string): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `CWC-CONFIDENTIAL | User: ${userId} | ${ts}`;
  }

  /**
   * Inject watermark footer into CSV content.
   * Appends a comment row at the end of the CSV.
   */
  injectCsvWatermark(csv: string, userId: string): string {
    const watermark = this.generateWatermark(userId);
    return `${csv}\n# ${watermark}`;
  }

  /**
   * Inject watermark metadata into JSON export response.
   */
  injectJsonWatermark(data: any, userId: string): any {
    return {
      ...data,
      _watermark: this.generateWatermark(userId),
      _warning: 'This document contains confidential information. Unauthorized distribution is prohibited.',
    };
  }
}

export const dlpService = new DlpService();