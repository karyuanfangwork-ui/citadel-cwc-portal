import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// §2.9 — Credit Encryption Service
// ---------------------------------------------------------------------------
// Supports both AES-256-CBC (legacy) and AES-256-GCM (current).
// The CBC format is: iv:ciphertext (hex)
// The GCM format is: iv:authTag:ciphertext (hex) — includes authentication tag
// ---------------------------------------------------------------------------

const CBC_ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';

const rawKey = process.env.CREDIT_ENCRYPTION_KEY;
if (!rawKey) {
  throw new Error('CREDIT_ENCRYPTION_KEY environment variable is required');
}
const KEY = Buffer.from(rawKey, 'hex'); // 32 bytes

const CBC_IV_LENGTH = 16; // AES block size
const GCM_IV_LENGTH = 12; // GCM recommends 12-byte IV
const GCM_AUTH_TAG_LENGTH = 16; // 128-bit auth tag

const rawHmacKey = process.env.CREDIT_HMAC_KEY;
if (!rawHmacKey) {
  throw new Error('CREDIT_HMAC_KEY environment variable is required');
}
const HMAC_KEY = Buffer.from(rawHmacKey, 'hex');

export class CreditEncryptionService {
  // -------------------------------------------------------------------------
  // Legacy CBC methods (backwards-compatible — reads existing data)
  // -------------------------------------------------------------------------

  /** Encrypt with AES-256-CBC. Format: iv:ciphertext (hex) */
  static encryptCbc(plaintext: string): string {
    const iv = crypto.randomBytes(CBC_IV_LENGTH);
    const cipher = crypto.createCipheriv(CBC_ALGORITHM, KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /** Decrypt AES-256-CBC. Format: iv:ciphertext (hex) */
  static decryptCbc(encoded: string): string {
    const [ivHex, encrypted] = encoded.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // -------------------------------------------------------------------------
  // GCM methods (current — authenticated encryption)
  // -------------------------------------------------------------------------

  /**
   * Encrypt with AES-256-GCM. Format: iv:authTag:ciphertext (hex)
   * Provides both confidentiality and integrity — any tampering with the
   * ciphertext will be detected on decrypt.
   */
  static encrypt(plaintext: string): string {
    return CreditEncryptionService.encryptGcm(plaintext);
  }

  static encryptGcm(plaintext: string): string {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, KEY, iv, { authTagLength: GCM_AUTH_TAG_LENGTH });
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt AES-256-GCM. Format: iv:authTag:ciphertext (hex)
   * Throws on authentication failure (tampered or corrupted data).
   */
  static decrypt(encoded: string): string {
    // Detect format: GCM has 3 parts (iv:authTag:ciphertext), CBC has 2 (iv:ciphertext)
    const parts = encoded.split(':');
    if (parts.length === 3) {
      return CreditEncryptionService.decryptGcm(encoded);
    }
    // Fall back to CBC for legacy data
    return CreditEncryptionService.decryptCbc(encoded);
  }

  static decryptGcm(encoded: string): string {
    const [ivHex, authTagHex, encrypted] = encoded.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, KEY, iv, { authTagLength: GCM_AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // -------------------------------------------------------------------------
  // Encryption migration helper (CBC → GCM)
  // -------------------------------------------------------------------------

  /**
   * Re-encrypt a value from CBC to GCM.
   * If the value is already in GCM format, returns it as-is.
   * If the value is in CBC format, decrypts with CBC and re-encrypts with GCM.
   *
   * @returns { value: string, migrated: boolean } — migrated is true if re-encryption happened
   */
  static migrateToGcm(encoded: string): { value: string; migrated: boolean } {
    if (CreditEncryptionService.isGcmFormat(encoded)) {
      return { value: encoded, migrated: false };
    }
    const plaintext = CreditEncryptionService.decryptCbc(encoded);
    const gcmValue = CreditEncryptionService.encryptGcm(plaintext);
    return { value: gcmValue, migrated: true };
  }

  // -------------------------------------------------------------------------
  // Format detection
  // -------------------------------------------------------------------------

  /**
   * Check if a value is encrypted (either CBC or GCM format).
   * CBC format: 32-hex-chars:ciphertext
   * GCM format: 24-hex-chars:32-hex-chars:ciphertext
   */
  static isEncrypted(value: string): boolean {
    // GCM format: iv(24 hex = 12 bytes):authTag(32 hex = 16 bytes):ciphertext
    if (/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value)) {
      return true;
    }
    // CBC format: iv(32 hex = 16 bytes):ciphertext
    if (/^[0-9a-f]{32}:[0-9a-f]+$/i.test(value)) {
      return true;
    }
    return false;
  }

  /** Check if a value is already in GCM format */
  static isGcmFormat(value: string): boolean {
    return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
  }

  /** Check if a value is in legacy CBC format */
  static isCbcFormat(value: string): boolean {
    // CBC: 32-hex IV + ':' + ciphertext (but NOT 3 parts like GCM)
    const parts = value.split(':');
    return parts.length === 2 && /^[0-9a-f]{32}$/i.test(parts[0]);
  }

  // -------------------------------------------------------------------------
  // HMAC & Masking (unchanged from original)
  // -------------------------------------------------------------------------

  /** HMAC-SHA256 for indexed lookup (deterministic, unlike AES-CBC/GCM with random IV) */
  static hmacNric(plaintext: string): string {
    return crypto.createHmac('sha256', HMAC_KEY).update(plaintext.trim()).digest('hex');
  }

  /** Mask NRIC — show only last 4 chars, e.g. ****1234 */
  static maskNric(plaintext: string): string {
    if (plaintext.length <= 4) return '****';
    return '****' + plaintext.slice(-4);
  }

  // -------------------------------------------------------------------------
  // BorrowerProfile field encryption helpers (§2.9)
  // -------------------------------------------------------------------------

  /**
   * Encrypt sensitive BorrowerProfile fields.
   * Returns an object with encrypted field names suitable for Prisma update.
   */
  static encryptBorrowerFields(data: {
    annualIncome?: number | string | null;
    netWorth?: number | string | null;
    sourceOfWealth?: string | null;
  }): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    if (data.annualIncome !== undefined && data.annualIncome !== null) {
      result.annualIncomeEncrypted = CreditEncryptionService.encryptGcm(String(data.annualIncome));
    }
    if (data.netWorth !== undefined && data.netWorth !== null) {
      result.netWorthEncrypted = CreditEncryptionService.encryptGcm(String(data.netWorth));
    }
    if (data.sourceOfWealth !== undefined && data.sourceOfWealth !== null) {
      result.sourceOfWealthEncrypted = CreditEncryptionService.encryptGcm(data.sourceOfWealth);
    }
    return result;
  }

  /**
   * Decrypt sensitive BorrowerProfile fields.
   * Takes a BorrowerProfile record and returns decrypted values.
   */
  static decryptBorrowerFields(record: {
    annualIncomeEncrypted?: string | null;
    netWorthEncrypted?: string | null;
    sourceOfWealthEncrypted?: string | null;
  }): { annualIncome?: string | null; netWorth?: string | null; sourceOfWealth?: string | null } {
    return {
      annualIncome: record.annualIncomeEncrypted
        ? CreditEncryptionService.decrypt(record.annualIncomeEncrypted)
        : null,
      netWorth: record.netWorthEncrypted
        ? CreditEncryptionService.decrypt(record.netWorthEncrypted)
        : null,
      sourceOfWealth: record.sourceOfWealthEncrypted
        ? CreditEncryptionService.decrypt(record.sourceOfWealthEncrypted)
        : null,
    };
  }
}