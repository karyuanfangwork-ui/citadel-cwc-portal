/**
 * Mask an NRIC value — show only last 4 chars, e.g. ****1234
 * Mirrors CreditEncryptionService.maskNric but works on plaintext strings
 * (no encryption/decryption dependency) so it can be used in any layer.
 */
export function maskNric(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}