import { logger } from '../../utils/logger';

export interface TransitionHookContext {
  applicationId: string;
  action: string;
  fromState: string;
  toState: string;
  actorId: string | null;
}

export type TransitionHook = (ctx: TransitionHookContext) => Promise<void>;

export interface TransitionHookRegistration {
  name: string;
  actions: readonly string[];
  run: TransitionHook;
}

export interface TransitionHookResult {
  name: string;
  ok: boolean;
  error: string | null;
}

const registry: TransitionHookRegistration[] = [];

export function registerTransitionHook(registration: TransitionHookRegistration): void {
  const existing = registry.findIndex((hook) => hook.name === registration.name);
  if (existing >= 0) registry[existing] = registration;
  else registry.push(registration);
}

export function getRegisteredHookNames(): string[] {
  return registry.map((hook) => hook.name);
}

export function clearTransitionHooks(): void {
  registry.length = 0;
}

export async function runTransitionHooks(ctx: TransitionHookContext): Promise<TransitionHookResult[]> {
  const results: TransitionHookResult[] = [];
  for (const hook of registry.filter((entry) => entry.actions.includes(ctx.action))) {
    try {
      await hook.run(ctx);
      results.push({ name: hook.name, ok: true, error: null });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      logger.error(`[TransitionHook] '${hook.name}' failed for application ${ctx.applicationId} on '${ctx.action}': ${message}`);
      results.push({ name: hook.name, ok: false, error: message });
    }
  }
  return results;
}
