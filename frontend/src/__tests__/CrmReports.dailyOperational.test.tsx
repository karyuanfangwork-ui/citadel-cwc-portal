import { describe, expect, it } from 'vitest';
import { DAILY_OPERATIONAL_COLUMNS } from '../../pages/CrmReports';

describe('Daily Operational report surface', () => {
  it('uses one shared column definition for both table and exports', () => {
    const keys = DAILY_OPERATIONAL_COLUMNS.map(([, key]) => key);
    expect(keys).toEqual(expect.arrayContaining([
      'whatsappTouches', 'siteVisits', 'meetingsCancelled', 'meetingsNoShow', 'leadsConverted',
    ]));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
