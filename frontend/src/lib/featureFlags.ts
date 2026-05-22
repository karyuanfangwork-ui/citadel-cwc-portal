const truthy = (v: unknown) => v === true || v === 'true' || v === '1';

export const featureFlags = {
  kb: truthy(import.meta.env.VITE_FEATURE_KB) || import.meta.env.DEV,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export const isFeatureEnabled = (flag: FeatureFlag): boolean => featureFlags[flag];
