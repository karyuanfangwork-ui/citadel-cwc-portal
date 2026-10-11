import { agentDashboardQuerySchema } from '../agent-dashboard.validator';

function parse(query: Record<string, unknown>) {
  return agentDashboardQuerySchema.parse({ query }).query;
}

describe('agentDashboardQuerySchema', () => {
  it('applies defaults and trims search input', () => {
    expect(parse({ search: '  laptop ' })).toMatchObject({
      scope: 'mine', queue: 'open', page: 1, limit: 25, search: 'laptop', sort: 'updated-desc',
    });
  });

  it.each([
    ['invalid scope', { scope: 'other' }],
    ['invalid queue', { queue: 'assigned' }],
    ['fractional page', { page: '1.5' }],
    ['unapproved page size', { limit: '200' }],
    ['too-long search', { search: 'x'.repeat(201) }],
    ['malformed request type ID', { requestTypeId: 'request-type' }],
    ['unknown query parameter', { serviceDeskCode: 'IT' }],
  ])('rejects %s', (_label, query) => {
    expect(() => parse(query)).toThrow();
  });
});
