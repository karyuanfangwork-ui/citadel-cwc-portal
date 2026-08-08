/**
 * Return the deadline used by the request-detail SLA UI.
 *
 * The persisted slaDueAt is extended when a paused clock resumes. While a
 * request is currently paused, add only the current pause duration so the
 * displayed remaining time stays frozen instead of counting down.
 */
export function getSlaDisplayDueMs(
  slaDueAt: string | null | undefined,
  slaPausedAt: string | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (!slaDueAt) return null;

  const dueMs = new Date(slaDueAt).getTime();
  if (!slaPausedAt) return dueMs;

  return dueMs + Math.max(0, nowMs - new Date(slaPausedAt).getTime());
}
