import OpenAI from 'openai';
import crypto from 'crypto';
import { config } from '../../config';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'gpt-4o':      { input: 2.5 / 1_000_000,  output: 10   / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!config.openai.apiKey) throw new AppError('AI service unavailable — OPENAI_API_KEY not configured', 503);
    _openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _openai;
}

export interface AiPromptVersionRecord {
  id: string;
  feature: string;
  version: number;
  model: string;
  template: string;
  params: Record<string, unknown>;
}

export async function getActivePromptVersion(feature: string): Promise<AiPromptVersionRecord> {
  const pv = await prisma.aiPromptVersion.findFirst({
    where: { feature, active: true },
    orderBy: { version: 'desc' },
  });
  if (!pv) throw new AppError(`No active prompt version for feature: ${feature}`, 500);
  return pv as unknown as AiPromptVersionRecord;
}

export interface CallAiOptions {
  feature: string;
  entityType: string;
  entityId: string;
  userId: string;
  buildMessages: (template: string) => OpenAI.Chat.ChatCompletionMessageParam[];
  maxTokens?: number;
}

export interface AiResult<T> {
  output: T;
  interactionId: string;
  model: string;
  version: number;
  costUsd: number;
}

export async function callAi<T>(opts: CallAiOptions): Promise<AiResult<T>> {
  const pv = await getActivePromptVersion(opts.feature);
  const messages = opts.buildMessages(pv.template);
  const inputHash = crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
  const start = Date.now();

  const completion = await getOpenAI().chat.completions.create({
    model: pv.model,
    max_tokens: opts.maxTokens ?? ((pv.params as Record<string, number>).max_tokens ?? 1024),
    temperature: (pv.params as Record<string, number>).temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages,
  });

  const latencyMs = Date.now() - start;
  const raw = completion.choices[0].message.content ?? '{}';
  const output = parseJson<T>(raw);

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const rates = COST_PER_TOKEN[pv.model] ?? COST_PER_TOKEN['gpt-4o-mini'];
  const costUsd = inputTokens * rates.input + outputTokens * rates.output;

  const interaction = await prisma.aiInteraction.create({
    data: {
      promptVersionId: pv.id,
      entityType: opts.entityType,
      entityId: opts.entityId,
      userId: opts.userId,
      inputHash,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd,
      output: output as object,
    },
  });

  return { output, interactionId: interaction.id, model: pv.model, version: pv.version, costUsd };
}

export async function recordOverride(opts: {
  interactionId: string;
  userId: string;
  overrideReason: string;
  originalOutput: object;
  overrideValue: object;
}): Promise<void> {
  await prisma.aiOverride.create({
    data: {
      interactionId: opts.interactionId,
      userId: opts.userId,
      overrideReason: opts.overrideReason,
      originalOutput: opts.originalOutput,
      overrideValue: opts.overrideValue,
    },
  });
}

/** Record a per-field human override (the governance-relevant variant) */
export async function recordFieldOverride(opts: {
  feature: string;
  entityType: string;
  entityId: string;
  userId: string;
  fieldName: string;
  aiValue: string;
  overriddenValue: string;
  reason: string;
}) {
  // Find the latest interaction for this entity+feature to link the override
  const interaction = await prisma.aiInteraction.findFirst({
    where: { entityType: opts.entityType, entityId: opts.entityId },
    orderBy: { createdAt: 'desc' },
  });

  return prisma.aiOverride.create({
    data: {
      interactionId: interaction?.id ?? '00000000-0000-0000-0000-000000000000',
      userId: opts.userId,
      overrideReason: `${opts.feature}.${opts.fieldName}: ${opts.reason}`,
      originalOutput: { field: opts.fieldName, aiValue: opts.aiValue },
      overrideValue: { field: opts.fieldName, overriddenValue: opts.overriddenValue },
    },
  });
}

/** List AI interactions for a given entity (audit trail) */
export async function listInteractions(entityId: string) {
  return prisma.aiInteraction.findMany({
    where: { entityId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      promptVersion: { select: { feature: true, version: true, model: true } },
      overrides: { select: { id: true, overrideReason: true, createdAt: true } },
    },
  });
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}