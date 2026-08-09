/**
 * LOS-017 — Canonical form for identity numbers (NRIC, passport, company
 * registration).
 *
 * Duplicate detection previously compared raw strings, so `880101-14-5523` and
 * `880101145523` were two different borrowers with split exposure and split KYC
 * history. Everything that is not a letter or digit is noise for matching
 * purposes; case is noise too.
 *
 * Values shorter than MIN_IDENTITY_LENGTH normalize to null: matching on three
 * characters produces false positives that are worse than the miss.
 */
export const MIN_IDENTITY_LENGTH = 6;

export function normalizeIdentity(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < MIN_IDENTITY_LENGTH) return null;
  return normalized;
}