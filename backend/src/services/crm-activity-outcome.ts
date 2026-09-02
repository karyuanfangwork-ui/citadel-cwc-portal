export interface OutcomeFields {
  callOutcome?: string | null;
  emailOutcome?: string | null;
  meetingOutcome?: string | null;
  engagementOutcome?: string | null;
}

const OUTCOME_KEYS: Array<keyof OutcomeFields> = ['callOutcome', 'emailOutcome', 'meetingOutcome', 'engagementOutcome'];

export function outcomeStamp(next: OutcomeFields, previous?: OutcomeFields | null, now: Date = new Date()): { outcomeRecordedAt: Date } | Record<string, never> {
  const changed = OUTCOME_KEYS.some(key => {
    if (!(key in next)) return false;
    return (next[key] ?? null) !== (previous?.[key] ?? null);
  });
  return changed ? { outcomeRecordedAt: now } : {};
}
