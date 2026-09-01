const findManyMock = jest.fn();
jest.mock('../../../utils/prisma', () => ({ __esModule: true, default: { creditDecision: { findMany: findManyMock } } }));
import { overrideReportService } from '../overrideReport.service';

const decision = (over: Record<string, unknown> = {}) => ({
  id: 'dec-1', decisionAt: new Date('2026-06-15T00:00:00Z'), decisionType: 'APPROVE',
  authorityLevel: 'MANAGER', systemRecommendation: 'APPROVE', isOverride: false,
  overrideReason: null, approvedAmount: null, decisionById: 'u-1',
  decidedBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lim' }, application: { applicationNo: 'CA-0001' }, ...over,
});
beforeEach(() => jest.clearAllMocks());

describe('getOverrideRate', () => {
  it('uses only classifiable terminal decisions in the denominator', async () => {
    findManyMock.mockResolvedValue([decision({ id: 'd1' }), decision({ id: 'd2', systemRecommendation: 'REJECT', isOverride: true, overrideReason: 'Guarantee.' }), decision({ id: 'd3', systemRecommendation: null })]);
    const result = await overrideReportService.getOverrideRate();
    expect(result.summary).toMatchObject({ terminalDecisions: 2, overrides: 1, overrideRate: 50, unlinked: 1 });
  });
  it('excludes routing decisions and returns zero for no denominator', async () => {
    findManyMock.mockResolvedValue([decision({ systemRecommendation: null }), decision({ decisionType: 'RETURN' })]);
    const result = await overrideReportService.getOverrideRate();
    expect(result.summary).toMatchObject({ terminalDecisions: 0, overrideRate: 0, unlinked: 1 });
  });
  it('groups by approver, authority, and month', async () => {
    findManyMock.mockResolvedValue([decision({ id: 'd1', isOverride: true, systemRecommendation: 'REJECT' }), decision({ id: 'd2', decisionById: 'u-2', authorityLevel: 'COMMITTEE', decisionAt: new Date('2026-07-02T00:00:00Z'), decidedBy: { id: 'u-2', firstName: 'Bo', lastName: 'Tan' } })]);
    expect((await overrideReportService.getOverrideRate({ groupBy: 'approver' })).groups.map(g => g.key).sort()).toEqual(['u-1', 'u-2']);
    expect((await overrideReportService.getOverrideRate({ groupBy: 'authority' })).groups.map(g => g.key).sort()).toEqual(['COMMITTEE', 'MANAGER']);
    expect((await overrideReportService.getOverrideRate({ groupBy: 'month' })).groups.map(g => g.key)).toEqual(['2026-06', '2026-07']);
  });
  it('passes filters and lists reasons', async () => {
    findManyMock.mockResolvedValue([decision({ isOverride: true, systemRecommendation: 'REJECT', overrideReason: 'Guarantee covers it.' })]);
    await overrideReportService.getOverrideRate({ approverId: 'u-7', authorityLevel: 'COMMITTEE', dateFrom: new Date('2026-01-01'), dateTo: new Date('2026-12-31') });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ decisionById: 'u-7', authorityLevel: 'COMMITTEE', decisionAt: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') } }) }));
    expect((await overrideReportService.getOverrideRate()).decisions[0]).toMatchObject({ isOverride: true, overrideReason: 'Guarantee covers it.' });
  });
});
