import { jest } from '@jest/globals';
const findFirstMock = jest.fn();
const findManyMock = jest.fn();
const updateManyMock = jest.fn();
jest.mock('../../../utils/prisma', () => ({ __esModule: true, default: { creditApplication: { findFirst: findFirstMock }, financialStatement: { findMany: findManyMock, updateMany: updateManyMock } } }));
import { linkStatementsToApplication } from '../statementLinking.service';

beforeEach(() => {
  jest.clearAllMocks();
  findFirstMock.mockResolvedValue({ id: 'app-1', borrowerProfileId: 'bp-1' });
  updateManyMock.mockResolvedValue({ count: 0 });
});

describe('linkStatementsToApplication', () => {
  it('links only unclaimed live statements', async () => {
    findManyMock.mockResolvedValue([{ id: 's1', applicationId: null }, { id: 's2', applicationId: 'app-other' }, { id: 's3', applicationId: null }]);
    updateManyMock.mockResolvedValue({ count: 2 });
    await expect(linkStatementsToApplication('app-1')).resolves.toEqual({ linked: 2, alreadyLinked: 1 });
    expect(findManyMock).toHaveBeenCalledWith({ where: { borrowerProfileId: 'bp-1', deletedAt: null }, select: { id: true, applicationId: true } });
    expect(updateManyMock).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's3'] }, applicationId: null }, data: { applicationId: 'app-1' } });
  });
  it('does not write when all statements are already linked', async () => {
    findManyMock.mockResolvedValue([{ id: 's1', applicationId: 'app-1' }]);
    await expect(linkStatementsToApplication('app-1')).resolves.toEqual({ linked: 0, alreadyLinked: 1 });
    expect(updateManyMock).not.toHaveBeenCalled();
  });
  it('is a no-op for a missing application', async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(linkStatementsToApplication('gone')).resolves.toEqual({ linked: 0, alreadyLinked: 0 });
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
