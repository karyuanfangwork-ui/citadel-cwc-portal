const findManyMock = jest.fn();
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { riskAssessment: { findMany: findManyMock } },
}));

import { listByApplication } from '../riskAssessment.service';

const row = (riskCategory: string) => ({
  id: `ra-${riskCategory}`,
  applicationId: 'app-1',
  riskCategory,
  description: 'text',
  mitigation: null,
  sortOrder: 0,
});

beforeEach(() => jest.clearAllMocks());

describe('listByApplication', () => {
  it('attaches the canonical factor to every narrative row', async () => {
    findManyMock.mockResolvedValue([row('PROJECT'), row('PAYMENT')]);
    const result = await listByApplication('app-1');
    expect(result.map((r) => [r.riskCategory, r.riskFactorKey])).toEqual([
      ['PROJECT', 'PRODUCT'],
      ['PAYMENT', 'BEHAVIOUR'],
    ]);
  });

  it('leaves the catch-all unmapped rather than inventing a factor', async () => {
    findManyMock.mockResolvedValue([row('OTHER')]);
    const [result] = await listByApplication('app-1');
    expect(result.riskFactorKey).toBeNull();
  });

  it('never mutates the stored category', async () => {
    findManyMock.mockResolvedValue([row('PACKAGING')]);
    const [result] = await listByApplication('app-1');
    expect(result.riskCategory).toBe('PACKAGING');
  });

  it('returns an empty list without changing it', async () => {
    findManyMock.mockResolvedValue([]);
    expect(await listByApplication('app-1')).toEqual([]);
  });
});
