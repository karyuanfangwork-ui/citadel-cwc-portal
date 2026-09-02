export const CALL_CATEGORIES = ['NEW_CALL', 'FOLLOW_UP_CALL'] as const;
export type CallCategory = typeof CALL_CATEGORIES[number];

export const CALL_OUTCOMES = ['ANSWERED', 'NO_ANSWER', 'NOT_INTERESTED', 'WRONG_NUMBER', 'NOT_REACHABLE', 'INTERESTED'] as const;
export type CallOutcome = typeof CALL_OUTCOMES[number];

export const EMAIL_OUTCOMES = ['SENT', 'BOUNCED', 'REPLIED', 'RESEND_REQUIRED'] as const;
export type EmailOutcome = typeof EMAIL_OUTCOMES[number];

export const MEETING_OUTCOMES = ['ARRANGED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type MeetingOutcome = typeof MEETING_OUTCOMES[number];

export const ENGAGEMENT_OUTCOMES = ['INTERESTED', 'NOT_INTERESTED', 'PENDING'] as const;
export type EngagementOutcome = typeof ENGAGEMENT_OUTCOMES[number];

export interface DailyOperationalRow {
  date: string;
  emailsSent: number; newCalls: number; followUpCalls: number; meetings: number;
  whatsappTouches: number; siteVisits: number;
  emailBounces: number; callEngagement: number; interested: number; noAnswer: number;
  notInterested: number; wrongNumber: number; notReachable: number;
  meetingsArranged: number; meetingsPresented: number; meetingsCancelled: number; meetingsNoShow: number;
  leadsConverted: number; merchantsSignedUp: number; merchantsDeclined: number;
}

export interface DailyOperationalTotals extends Omit<DailyOperationalRow, 'date'> {
  date: 'TOTAL';
}

export interface DailyOperationalCompanyRow extends Omit<DailyOperationalRow, 'date'> {
  companyName: string;
  accountId: string | null;
  activityLoggedCount: number;
  activityOutcomeCount: number;
}

export interface DailyOperationalReport {
  daily: DailyOperationalRow[];
  totals: DailyOperationalTotals;
  byCompany: DailyOperationalCompanyRow[];
  period: { from: Date; to: Date; timezone: string };
}
