import { DailyOperationalCompanyRow, DailyOperationalRow } from './crm-daily-report.types';

export interface MetricInput {
  activityType: string;
  callCategory: string | null;
  callOutcome: string | null;
  emailOutcome: string | null;
  meetingOutcome: string | null;
  engagementOutcome: string | null;
}
type Metrics = Omit<DailyOperationalRow, 'date'>;
const ENGAGED_CALL_OUTCOMES = new Set(['ANSWERED', 'INTERESTED', 'NOT_INTERESTED']);

export function emptyRow(date: string): DailyOperationalRow {
  return { date, emailsSent: 0, newCalls: 0, followUpCalls: 0, meetings: 0, whatsappTouches: 0, siteVisits: 0, emailBounces: 0, callEngagement: 0, interested: 0, noAnswer: 0, notInterested: 0, wrongNumber: 0, notReachable: 0, meetingsArranged: 0, meetingsPresented: 0, meetingsCancelled: 0, meetingsNoShow: 0, leadsConverted: 0, merchantsSignedUp: 0, merchantsDeclined: 0 };
}
export function emptyCompanyRow(companyName: string, accountId: string | null): DailyOperationalCompanyRow {
  const { date: _date, ...metrics } = emptyRow('COMPANY');
  return { companyName, accountId, activityLoggedCount: 0, activityOutcomeCount: 0, ...metrics };
}
export function hasOutcome(activity: MetricInput): boolean {
  return Boolean(activity.callOutcome || activity.emailOutcome || activity.meetingOutcome || activity.engagementOutcome);
}
function isCall(activity: MetricInput): boolean {
  return activity.activityType === 'CALL' || (activity.activityType === 'FOLLOW_UP' && Boolean(activity.callCategory || activity.callOutcome));
}
export function applyVolumeMetrics(row: Metrics, activity: MetricInput): void {
  if (activity.activityType === 'EMAIL') row.emailsSent++;
  if (activity.activityType === 'MEETING') row.meetings++;
  if (activity.activityType === 'WHATSAPP') row.whatsappTouches++;
  if (activity.activityType === 'SITE_VISIT') row.siteVisits++;
  if (isCall(activity)) {
    if (activity.callCategory === 'FOLLOW_UP_CALL' || activity.activityType === 'FOLLOW_UP') row.followUpCalls++;
    else row.newCalls++;
  }
}
export function applyOutcomeMetrics(row: Metrics, activity: MetricInput): void {
  if (activity.emailOutcome === 'BOUNCED') row.emailBounces++;
  if (activity.callOutcome) {
    if (ENGAGED_CALL_OUTCOMES.has(activity.callOutcome)) row.callEngagement++;
    if (activity.callOutcome === 'NO_ANSWER') row.noAnswer++;
    if (activity.callOutcome === 'WRONG_NUMBER') row.wrongNumber++;
    if (activity.callOutcome === 'NOT_REACHABLE') row.notReachable++;
  }
  if (activity.callOutcome === 'INTERESTED' || activity.engagementOutcome === 'INTERESTED') row.interested++;
  if (activity.callOutcome === 'NOT_INTERESTED' || activity.engagementOutcome === 'NOT_INTERESTED') row.notInterested++;
  if (activity.meetingOutcome === 'ARRANGED') row.meetingsArranged++;
  if (activity.meetingOutcome === 'COMPLETED') row.meetingsPresented++;
  if (activity.meetingOutcome === 'CANCELLED') row.meetingsCancelled++;
  if (activity.meetingOutcome === 'NO_SHOW') row.meetingsNoShow++;
}
