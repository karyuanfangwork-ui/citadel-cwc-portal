import { isRetainedOwner, RETAINED_OWNER_EMAILS } from '../scripts/retain-contacts-by-rm';

describe('CRM contact RM retention', () => {
  it('retains only the three approved RM owners', () => {
    expect(RETAINED_OWNER_EMAILS).toHaveLength(3);
    expect(isRetainedOwner('thasha.shaharis@citadelgroup.com.my')).toBe(true);
    expect(isRetainedOwner('rohani.munir@citadelgroup.com.my')).toBe(true);
    expect(isRetainedOwner('cristel.erguiza@citadelgroup.com.my')).toBe(true);
    expect(isRetainedOwner('salesmanager@test.local')).toBe(false);
  });
});
