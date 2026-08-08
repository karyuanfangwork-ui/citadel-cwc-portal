import { describe, expect, it, vi, afterEach } from 'vitest';
import { getSlaDisplayDueMs } from '../slaDisplay';

describe('getSlaDisplayDueMs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the displayed remaining time frozen while paused', () => {
    const pausedAt = '2026-08-07T07:00:00.000Z';
    const dueAt = '2026-08-08T07:00:00.000Z';

    const oneHourLater = getSlaDisplayDueMs(dueAt, pausedAt, Date.parse('2026-08-07T08:00:00.000Z'));
    const tenHoursLater = getSlaDisplayDueMs(dueAt, pausedAt, Date.parse('2026-08-07T17:00:00.000Z'));

    expect(oneHourLater! - Date.parse('2026-08-07T08:00:00.000Z')).toBe(24 * 60 * 60 * 1000);
    expect(tenHoursLater! - Date.parse('2026-08-07T17:00:00.000Z')).toBe(24 * 60 * 60 * 1000);
  });

  it('uses the persisted deadline when the SLA is active', () => {
    const dueAt = '2026-08-08T07:00:00.000Z';
    expect(getSlaDisplayDueMs(dueAt, null, Date.parse('2026-08-07T08:00:00.000Z')))
      .toBe(Date.parse(dueAt));
  });
});
