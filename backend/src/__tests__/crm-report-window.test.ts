import { dateKey, dayWindow, dateKeys, normalizeDayInput, MAX_REPORT_DAYS } from '../services/crm-report-window';

describe('crm report window', () => {
  it('maps KL calendar days and inclusive bounds', () => {
    expect(dateKey(new Date('2026-08-31T16:00:00.000Z'))).toBe('2026-09-01');
    expect(dayWindow('2026-09-01', '2026-09-02')).toEqual({ from: new Date('2026-08-31T16:00:00.000Z'), to: new Date('2026-09-02T15:59:59.999Z') });
    expect(dateKeys('2026-09-01', '2026-09-02')).toEqual(['2026-09-01', '2026-09-02']);
  });
  it('rejects invalid and oversized ranges', () => {
    expect(() => dayWindow('2026-09-02', '2026-09-01')).toThrow('from must not be after to');
    expect(() => dayWindow('2024-01-01', '2026-09-01')).toThrow(`Range exceeds ${MAX_REPORT_DAYS} days`);
    expect(() => dayWindow('01/09/2026', '2026-09-01')).toThrow('Expected a YYYY-MM-DD date');
  });
  it('normalizes missing values from the fallback instant', () => {
    expect(normalizeDayInput(undefined, new Date('2026-08-31T16:30:00.000Z'))).toBe('2026-09-01');
    expect(normalizeDayInput('2026-07-04', new Date())).toBe('2026-07-04');
  });
});
