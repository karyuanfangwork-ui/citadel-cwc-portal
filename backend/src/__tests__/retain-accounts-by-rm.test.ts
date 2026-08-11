import { isRetainedAccountOwner, RETAINED_ACCOUNT_OWNER_EMAILS } from '../scripts/retain-accounts-by-rm';

describe('CRM account RM retention', () => {
  it('retains only the three approved account owners', () => {
    expect(RETAINED_ACCOUNT_OWNER_EMAILS).toHaveLength(3);
    expect(isRetainedAccountOwner('thasha.shaharis@citadelgroup.com.my')).toBe(true);
    expect(isRetainedAccountOwner('rohani.munir@citadelgroup.com.my')).toBe(true);
    expect(isRetainedAccountOwner('cristel.erguiza@citadelgroup.com.my')).toBe(true);
    expect(isRetainedAccountOwner('salesmanager@test.local')).toBe(false);
  });
});
