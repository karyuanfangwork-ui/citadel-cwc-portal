import { outcomeStamp } from '../services/crm-activity-outcome';
const NOW = new Date('2026-09-02T04:00:00.000Z');
describe('outcomeStamp', () => {
  it('stamps first set, changes, and clears', () => {
    expect(outcomeStamp({ meetingOutcome: 'ARRANGED' }, null, NOW)).toEqual({ outcomeRecordedAt: NOW });
    expect(outcomeStamp({ meetingOutcome: 'COMPLETED' }, { meetingOutcome: 'ARRANGED' }, NOW)).toEqual({ outcomeRecordedAt: NOW });
    expect(outcomeStamp({ callOutcome: null }, { callOutcome: 'NO_ANSWER' }, NOW)).toEqual({ outcomeRecordedAt: NOW });
  });
  it('does not stamp absent or unchanged outcomes', () => {
    expect(outcomeStamp({}, { meetingOutcome: 'ARRANGED' }, NOW)).toEqual({});
    expect(outcomeStamp({ meetingOutcome: 'ARRANGED' }, { meetingOutcome: 'ARRANGED' }, NOW)).toEqual({});
  });
});
