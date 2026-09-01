import crypto from 'crypto';

/** Deterministically serialise a snapshot payload for hashing. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const ctorName = (obj.constructor as { name?: string } | undefined)?.name;
    if (ctorName === 'Decimal' || ctorName === 'BigNumber') return String(obj.toString());

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] !== undefined) out[key] = normalise(obj[key]);
    }
    return out;
  }

  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function hashPayload(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}
