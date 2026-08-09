// backend/src/credit/utils/optimisticConcurrency.ts

/**
 * LOS-018 — Optimistic concurrency for child records.
 *
 * The application root carries an integer `version`; child records do not.
 * Every credit model has an `updatedAt` column, so we use its ISO string as
 * the concurrency token. Clients echo back the `updatedAt` they rendered; if
 * the stored value has moved on, another user saved first and we refuse the
 * write with 409 rather than losing their edit.
 *
 * Omitting the token is allowed so existing API consumers keep working; new UI
 * code should always send it.
 */
export function assertVersionMatch(
  current: Date | null | undefined,
  expected: string | undefined,
  entity: string,
): void {
  if (expected === undefined) return;

  const expectedMs = Date.parse(expected);
  if (Number.isNaN(expectedMs)) {
    throw Object.assign(
      new Error(`${entity} concurrency token is not a valid timestamp. Reload the record and retry.`),
      { statusCode: 409 },
    );
  }

  if (!current || current.getTime() !== expectedMs) {
    throw Object.assign(
      new Error(
        `${entity} has changed since you loaded it. Reload to see the latest values, then reapply your edit.`,
      ),
      { statusCode: 409 },
    );
  }
}