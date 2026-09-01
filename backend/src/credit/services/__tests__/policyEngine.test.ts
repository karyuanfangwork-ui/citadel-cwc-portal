const scoreRunFindFirstMock = jest.fn();
const policyResultCreateManyMock = jest.fn();
const policyResultFindManyMock = jest.fn();
const evaluatePolicyMock = jest.fn();
const readinessMock = jest.fn();
const deviationsMock = jest.fn();
const bureauMock = jest.fn();
const getPolicySetVersionMock = jest.fn();

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScoreRun: { findFirst: scoreRunFindFirstMock },
    policyResult: { createMany: policyResultCreateManyMock, findMany: policyResultFindManyMock },
  },
}));
jest.mock('../policyLimit.service', () => ({ policyLimitService: { evaluatePolicy: evaluatePolicyMock } }));
jest.mock('../submissionReadiness.service', () => ({ validateSubmissionReadiness: readinessMock }));
jest.mock('../deviation.service', () => ({ deviationService: { checkApplicationDeviations: deviationsMock } }));
jest.mock('../bureauCheck.service', () => ({ isBureauCheckFresh: bureauMock }));
jest.mock('../policySet.service', () => ({ getPolicySetVersion: getPolicySetVersionMock }));

import {
  evaluatePolicy,
  persistPolicyEvaluation,
  registerPolicyEngineHook,
  POLICY_EVALUATION_ACTIONS,
} from '../policyEngine.service';
import { clearTransitionHooks, runTransitionHooks } from '../transitionHooks';

const ctx = (over: Record<string, unknown> = {}) => ({
  applicationId: 'app-1', action: 'approve', fromState: 'COMMITTEE_REVIEW', toState: 'APPROVED', actorId: 'user-1', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearTransitionHooks();
  evaluatePolicyMock.mockResolvedValue({ blocks: [], warnings: [] });
  readinessMock.mockResolvedValue({ ready: true, errors: [], warnings: [], satisfied: [{ field: 'signoff', message: 'ok', severity: 'info' }] });
  deviationsMock.mockResolvedValue({ canProceed: true, pendingCount: 0, approvedCount: 0, rejectedCount: 0, total: 0 });
  bureauMock.mockResolvedValue({ fresh: true, staleProviders: [] });
  getPolicySetVersionMock.mockResolvedValue('sha256:abcdef123456');
  scoreRunFindFirstMock.mockResolvedValue({ missingInputs: [] });
  policyResultCreateManyMock.mockResolvedValue({ count: 3 });
});

describe('evaluatePolicy', () => {
  it('fans out to all evaluators and the latest score run', async () => {
    await evaluatePolicy('app-1');
    expect(evaluatePolicyMock).toHaveBeenCalledWith('app-1');
    expect(readinessMock).toHaveBeenCalledWith('app-1', { stage: 'committee' });
    expect(deviationsMock).toHaveBeenCalledWith('app-1');
    expect(bureauMock).toHaveBeenCalledWith('app-1');
    expect(scoreRunFindFirstMock).toHaveBeenCalledWith({ where: { applicationId: 'app-1' }, orderBy: { runAt: 'desc' }, select: { missingInputs: true } });
  });

  it('returns normalised entries and a summary', async () => {
    const result = await evaluatePolicy('app-1');
    expect(result.summary.overall).toBe('PASS');
    expect(result.entries.map((entry) => entry.ruleCode).sort()).toEqual(['BUREAU.FRESHNESS', 'DEVIATION.PENDING', 'READINESS.signoff'].sort());
  });

  it('records one evaluator failure without losing the other results', async () => {
    evaluatePolicyMock.mockRejectedValue(new Error('fx rate missing'));
    const result = await evaluatePolicy('app-1');
    expect(result.entries.find((entry) => entry.ruleCode === 'POLICY_LIMIT.EVALUATION_ERROR')).toMatchObject({ verdict: 'FAIL', message: expect.stringContaining('fx rate missing') });
    expect(result.entries.some((entry) => entry.ruleCode === 'DEVIATION.PENDING')).toBe(true);
    expect(result.summary.overall).toBe('FAIL');
  });

  it('tolerates an application with no score run', async () => {
    scoreRunFindFirstMock.mockResolvedValue(null);
    const result = await evaluatePolicy('app-1');
    expect(result.entries.some((entry) => entry.source === 'MISSING_DATA')).toBe(false);
  });
});

describe('persistPolicyEvaluation', () => {
  it('writes one row per entry sharing an evaluation id and actor', async () => {
    await persistPolicyEvaluation(ctx());
    expect(policyResultCreateManyMock).toHaveBeenCalledTimes(1);
    const { data } = policyResultCreateManyMock.mock.calls[0][0];
    expect(data.length).toBeGreaterThan(0);
    expect(new Set(data.map((row: { evaluationId: string }) => row.evaluationId)).size).toBe(1);
    expect(data[0]).toMatchObject({ applicationId: 'app-1', triggerAction: 'approve', evaluatedById: 'user-1' });
  });

  it('stamps every row with the policy set version', async () => {
    await persistPolicyEvaluation(ctx());
    const { data } = policyResultCreateManyMock.mock.calls[0][0];
    expect(data.every((row: { policySetVersion: string }) => row.policySetVersion === 'sha256:abcdef123456')).toBe(true);
  });

  it('still records the evaluation when the version cannot be resolved', async () => {
    getPolicySetVersionMock.mockRejectedValue(new Error('config table down'));
    await persistPolicyEvaluation(ctx());
    const { data } = policyResultCreateManyMock.mock.calls[0][0];
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].policySetVersion).toBeNull();
  });

  it('is a no-op for non-lifecycle actions', async () => {
    const result = await persistPolicyEvaluation(ctx({ action: 'withdraw' }));
    expect(policyResultCreateManyMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true, evaluationId: null });
  });

  it('evaluates at all lifecycle points and accepts a null actor', async () => {
    expect([...POLICY_EVALUATION_ACTIONS].sort()).toEqual(['approve', 'reject', 'resume_committee', 'submit_to_committee']);
    await persistPolicyEvaluation(ctx({ actorId: null }));
    expect(policyResultCreateManyMock.mock.calls[0][0].data[0].evaluatedById).toBeNull();
  });
});

describe('registerPolicyEngineHook', () => {
  it('registers a hook that persists and cannot fail the transition', async () => {
    registerPolicyEngineHook();
    expect(await runTransitionHooks(ctx())).toEqual([{ name: 'policy-evaluation', ok: true, error: null }]);
    policyResultCreateManyMock.mockRejectedValue(new Error('db down'));
    clearTransitionHooks();
    registerPolicyEngineHook();
    expect(await runTransitionHooks(ctx())).toEqual([{ name: 'policy-evaluation', ok: false, error: 'db down' }]);
  });
});
