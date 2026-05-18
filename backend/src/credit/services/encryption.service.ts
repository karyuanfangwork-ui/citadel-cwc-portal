import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(
  process.env.CREDIT_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  'hex',
); // 32 bytes
const IV_LENGTH = 16;

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
}