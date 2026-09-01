import { hashPayload } from './snapshotHash';

/** CA-P6-003 — reproducible identifier for the active policy set. */
export const POLICY_SET_VERSION_PREFIX = 'sha256:';
export const LEGACY_POLICY_VERSION_PREFIX = 'md5:';

const HASH_WIDTH = 12;

export interface PolicyParameterFingerprint {
  key: string;
  value: unknown;
  productType: string | null;
  lane: string | null;
  borrowerType: string | null;
}

export interface RuleConfigFingerprint {
  kind: string;
  documentClass: string | null;
  fieldPath: string | null;
  productType: string | null;
  lane: string | null;
  borrowerType: string | null;
}

export interface PolicyLimitFingerprint {
  type: string;
  maxValue: string;
  thresholdPct: string;
  sector: string | null;
  productType: string | null;
}

export interface PolicySetInput {
  parameters: PolicyParameterFingerprint[];
  ruleConfigs: RuleConfigFingerprint[];
  limits: PolicyLimitFingerprint[];
}

function sortRows<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function computePolicySetVersion(input: PolicySetInput): string {
  const digest = hashPayload({
    parameters: sortRows(input.parameters),
    ruleConfigs: sortRows(input.ruleConfigs),
    limits: sortRows(input.limits),
  });
  return `${POLICY_SET_VERSION_PREFIX}${digest.slice(0, HASH_WIDTH)}`;
}

/** Values written before CA-P6-003 remain readable and are never rewritten. */
export function isLegacyPolicyVersion(version: string | null | undefined): boolean {
  return typeof version === 'string' && version.startsWith(LEGACY_POLICY_VERSION_PREFIX);
}

export function describePolicyVersion(version: string | null | undefined): string {
  if (!version) return 'Policy version not recorded.';
  if (isLegacyPolicyVersion(version)) return 'Legacy policy version — covers missing-data policies only.';
  if (version.startsWith(POLICY_SET_VERSION_PREFIX)) {
    return 'Policy set version — covers limits, rule configs and policy parameters.';
  }
  return `Unrecognised policy version format: ${version}`;
}
