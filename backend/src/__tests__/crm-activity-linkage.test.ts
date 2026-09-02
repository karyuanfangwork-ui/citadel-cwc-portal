import { createActivitySchema } from '../validators/crm.validator';
const base = { activityType: 'CALL', subject: 'Intro call' };
const parse = (body: Record<string, unknown>) => createActivitySchema.safeParse({ body: { ...base, ...body } });
describe('activity linkage validation', () => {
  it('accepts a single link and account plus opportunity context', () => {
    expect(parse({ leadId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(parse({ accountId: '11111111-1111-4111-8111-111111111111', opportunityId: '22222222-2222-4222-8222-222222222222' }).success).toBe(true);
  });
  it('rejects conflicting multi-link combinations', () => {
    expect(parse({ leadId: '11111111-1111-4111-8111-111111111111', accountId: '22222222-2222-4222-8222-222222222222' }).success).toBe(false);
    expect(parse({ contactId: '11111111-1111-4111-8111-111111111111', opportunityId: '22222222-2222-4222-8222-222222222222' }).success).toBe(false);
  });
});
