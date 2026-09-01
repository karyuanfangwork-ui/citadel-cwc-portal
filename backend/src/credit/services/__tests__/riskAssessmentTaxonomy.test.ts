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
  it('returns narrative rows in sort order, unchanged', async () => {
    findManyMock.mockResolvedValue([row('PROJECT'), row('PAYMENT')]);
    const result = await listByApplication('app-1');
    expect(findManyMock).toHaveBeenCalledWith({
      where: { applicationId: 'app-1' },
      orderBy: { sortOrder: 'asc' },
    });
    expect(result.map((r) => r.riskCategory)).toEqual(['PROJECT', 'PAYMENT']);
  });

  it('does not decorate rows with a scoring factor', async () => {
    findManyMock.mockResolvedValue([row('PROJECT')]);
    const [result] = await listByApplication('app-1');
    expect(result).not.toHaveProperty('riskFactorKey');
  });
});
