import { emptyRow, applyVolumeMetrics, applyOutcomeMetrics, hasOutcome, MetricInput } from '../services/crm-daily-report.metrics';
const base: MetricInput = { activityType: 'CALL', callCategory: null, callOutcome: null, emailOutcome: null, meetingOutcome: null, engagementOutcome: null };
const run = (activity: Partial<MetricInput>) => { const row = emptyRow('2026-09-01'); applyVolumeMetrics(row, { ...base, ...activity }); return row; };
const outcome = (activity: Partial<MetricInput>) => { const row = emptyRow('2026-09-01'); applyOutcomeMetrics(row, { ...base, ...activity }); return row; };
describe('daily operational metrics', () => {
  it('counts volume types and call guards', () => {
    expect(run({ activityType: 'CALL', callCategory: 'NEW_CALL' }).newCalls).toBe(1);
    expect(run({ activityType: 'FOLLOW_UP', callOutcome: 'ANSWERED' }).followUpCalls).toBe(1);
    expect(run({ activityType: 'FOLLOW_UP' }).followUpCalls).toBe(0);
    expect(run({ activityType: 'EMAIL', emailOutcome: 'BOUNCED' }).emailsSent).toBe(1);
    expect(run({ activityType: 'WHATSAPP' }).whatsappTouches).toBe(1);
    expect(run({ activityType: 'SITE_VISIT' }).siteVisits).toBe(1);
  });
  it('keeps outcomes separate and reconciles meetings', () => {
    expect(outcome({ activityType: 'EMAIL', emailOutcome: 'BOUNCED' }).emailBounces).toBe(1);
    expect(outcome({ callOutcome: 'ANSWERED' }).callEngagement).toBe(1);
    expect(outcome({ callOutcome: 'WRONG_NUMBER' }).callEngagement).toBe(0);
    expect(outcome({ activityType: 'MEETING', engagementOutcome: 'INTERESTED' }).interested).toBe(1);
    expect(outcome({ activityType: 'MEETING', meetingOutcome: 'CANCELLED' }).meetingsCancelled).toBe(1);
    expect(outcome({ activityType: 'MEETING', meetingOutcome: 'NO_SHOW' }).meetingsNoShow).toBe(1);
  });
  it('detects explicit outcomes only', () => {
    expect(hasOutcome({ ...base, callOutcome: 'ANSWERED' })).toBe(true);
    expect(hasOutcome({ ...base, callCategory: 'NEW_CALL' })).toBe(false);
  });
});
