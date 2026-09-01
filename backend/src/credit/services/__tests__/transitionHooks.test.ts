import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { clearTransitionHooks, getRegisteredHookNames, registerTransitionHook, runTransitionHooks, type TransitionHookContext } from '../transitionHooks';

const ctx = (over: Partial<TransitionHookContext> = {}): TransitionHookContext => ({ applicationId: 'app-1', action: 'approve', fromState: 'COMMITTEE_REVIEW', toState: 'APPROVED', actorId: 'user-1', ...over });

beforeEach(() => clearTransitionHooks());

describe('transition hooks', () => {
  it('runs matching hooks sequentially and ignores other actions', async () => {
    const order: string[] = [];
    const approve = jest.fn(async () => { order.push('approve'); });
    const submit = jest.fn(async () => { order.push('submit'); });
    registerTransitionHook({ name: 'approve', actions: ['approve'], run: approve });
    registerTransitionHook({ name: 'submit', actions: ['submit_to_committee'], run: submit });
    await runTransitionHooks(ctx());
    expect(order).toEqual(['approve']);
    expect(submit).not.toHaveBeenCalled();
  });
  it('isolates failures and reports results', async () => {
    registerTransitionHook({ name: 'boom', actions: ['approve'], run: jest.fn(async () => { throw new Error('broken'); }) });
    const after = jest.fn(async () => undefined);
    registerTransitionHook({ name: 'after', actions: ['approve'], run: after });
    await expect(runTransitionHooks(ctx())).resolves.toEqual([{ name: 'boom', ok: false, error: 'broken' }, { name: 'after', ok: true, error: null }]);
    expect(after).toHaveBeenCalled();
  });
  it('replaces duplicate names', async () => {
    const first = jest.fn(async () => undefined);
    const second = jest.fn(async () => undefined);
    registerTransitionHook({ name: 'same', actions: ['approve'], run: first });
    registerTransitionHook({ name: 'same', actions: ['approve'], run: second });
    await runTransitionHooks(ctx());
    expect(getRegisteredHookNames()).toEqual(['same']);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
