import apiClient from './api';

// ── Types ───────────────────────────────────────────────────────

export interface DuplicateMatch {
  borrowerProfileId: string;
  borrowerName: string;
  matchFields: string[];
  confidence: number;
  existingApplicationCount: number;
}

export interface DuplicateCheckResult {
  checkedProfileId: string;
  matches: DuplicateMatch[];
  checkedAt: string;
}

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  evidence: string;
  rationale: string;
}

export interface RedFlagResult {
  flags: RedFlag[];
  overallRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  interactionId: string;
  model: string;
  costUsd: number;
}

export interface RiskNarrativeResult {
  narrative: string;
  keyRisks: string[];
  keyStrengths: string[];
  citedFields: string[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export interface ComplianceConcern {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  field: string;
  issue: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  concerns: ComplianceConcern[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export interface PolicyException {
  policyRef: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface AutoExceptionResult {
  exceptions: PolicyException[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export interface AiInteractionRecord {
  id: string;
  entityType: string;
  entityId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  createdAt: string;
  promptVersion: { feature: string; version: number; model: string };
  overrides: { id: string; overrideReason: string; createdAt: string }[];
}

export interface AiOverridePayload {
  feature: string;
  fieldName: string;
  aiValue: string;
  overriddenValue: string;
  reason: string;
}

// ── API Calls ───────────────────────────────────────────────────

const BASE = '/credit/applications';

export async function checkDuplicates(appId: string): Promise<DuplicateCheckResult> {
  const { data } = await apiClient.get<{ data: DuplicateCheckResult }>(`${BASE}/${appId}/ai/duplicates`);
  return data.data;
}

export async function generateRedFlags(appId: string): Promise<RedFlagResult> {
  const { data } = await apiClient.post<{ data: RedFlagResult }>(`${BASE}/${appId}/ai/red-flags`);
  return data.data;
}

export async function generateNarrative(appId: string): Promise<RiskNarrativeResult> {
  const { data } = await apiClient.post<{ data: RiskNarrativeResult }>(`${BASE}/${appId}/ai/narrative`);
  return data.data;
}

export async function runComplianceCheck(appId: string): Promise<ComplianceCheckResult> {
  const { data } = await apiClient.post<{ data: ComplianceCheckResult }>(`${BASE}/${appId}/ai/compliance`);
  return data.data;
}

export async function detectExceptions(appId: string): Promise<AutoExceptionResult> {
  const { data } = await apiClient.post<{ data: AutoExceptionResult }>(`${BASE}/${appId}/ai/exceptions`);
  return data.data;
}

export async function getAiInteractions(appId: string): Promise<AiInteractionRecord[]> {
  const { data } = await apiClient.get<{ data: { interactions: AiInteractionRecord[] } }>(`${BASE}/${appId}/ai/interactions`);
  return data.data.interactions;
}

export async function recordOverride(appId: string, payload: AiOverridePayload): Promise<void> {
  await apiClient.post(`${BASE}/${appId}/ai/overrides`, payload);
}