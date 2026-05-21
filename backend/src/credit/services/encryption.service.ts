import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const rawKey = process.env.CREDIT_ENCRYPTION_KEY;
if (!rawKey) {
  throw new Error('CREDIT_ENCRYPTION_KEY environment variable is required');
}
const KEY = Buffer.from(rawKey, 'hex'); // 32 bytes
const IV_LENGTH = 16;

const rawHmacKey = process.env.CREDIT_HMAC_KEY;
if (!rawHmacKey) {
  throw new Error('CREDIT_HMAC_KEY environment variable is required');
}
const HMAC_KEY = Buffer.from(rawHmacKey, 'hex');

export class CreditEncryptionService {
  static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted; // format: iv:ciphertext
  }

  static decrypt(encoded: string): string {
    const [ivHex, encrypted] = encoded.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static isEncrypted(value: string): boolean {
    return /^\w{32}:\w+$/.test(value); // iv:ciphertext pattern
  }

  /** HMAC-SHA256 for indexed lookup (deterministic, unlike AES-CBC with random IV) */
  static hmacNric(plaintext: string): string {
    return crypto.createHmac('sha256', HMAC_KEY).update(plaintext.trim()).digest('hex');
  }

  /** Mask NRIC — show only last 4 chars, e.g. ****1234 */
  static maskNric(plaintext: string): string {
    if (plaintext.length <= 4) return '****';
    return '****' + plaintext.slice(-4);
  }
}
