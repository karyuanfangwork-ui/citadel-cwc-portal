/**
 * GAP-P0-01 — Credit SLA Policy Validator
 *
 * SLA auto-escalation exists to escalate ATTENTION, never to make a credit
 * decision. Only non-decisional states may be auto-escalation targets.
 */

import { z } from 'zod';

/** Application states an SLA breach may legitimately escalate an application into. */
export const SAFE_ESCALATION_STATES = ['COMPLIANCE_HOLD', 'REFERRED_BACK'] as const;

export type SafeEscalationState = (typeof SAFE_ESCALATION_STATES)[number];

const APPLICATION_STATES = [
  'DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED',
  'KYC_REJECTED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW',
  'APPROVED', 'REJECTED', 'CONDITION_FULFILMENT', 'OFFER', 'ACCEPTED',
  'DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN', 'REFERRED_BACK',
] as const;

export function isSafeEscalationState(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return (SAFE_ESCALATION_STATES as readonly string[]).includes(value);
}

const escalateToStateSchema = z.enum(SAFE_ESCALATION_STATES, {
  errorMap: () => ({
    message:
      `escalateToState must be one of ${SAFE_ESCALATION_STATES.join(', ')}. ` +
      'SLA escalation cannot move an application into a decision, offer, disbursement or closure state — those require an approval decision.',
  }),
});

const escalationPairing = <T extends { escalateToState?: unknown; escalateAfterHours?: unknown }>(
  data: T,
): boolean => {
  const hasState = data.escalateToState !== null && data.escalateToState !== undefined;
  const hasHours = data.escalateAfterHours !== null && data.escalateAfterHours !== undefined;
  return hasState === hasHours;
};

const escalationPairingMessage = {
  message: 'escalateToState and escalateAfterHours must be set together, or both omitted.',
  path: ['escalateToState'],
};

export const createSlaPolicySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional().nullable(),
    targetState: z.enum(APPLICATION_STATES),
    slaHours: z.number().int().positive().max(8760),
    notifyRoles: z.array(z.string().min(1).max(50)).default([]),
    escalateAfterHours: z.number().int().positive().max(8760).optional().nullable(),
    escalateToState: escalateToStateSchema.optional().nullable(),
    productType: z.string().max(30).optional().nullable(),
  }).refine(escalationPairing, escalationPairingMessage),
});

export const updateSlaPolicySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional().nullable(),
    slaHours: z.number().int().positive().max(8760).optional(),
    notifyRoles: z.array(z.string().min(1).max(50)).optional(),
    escalateAfterHours: z.number().int().positive().max(8760).optional().nullable(),
    escalateToState: escalateToStateSchema.optional().nullable(),
    productType: z.string().max(30).optional().nullable(),
    isActive: z.boolean().optional(),
  }).refine((data) => {
    const touchesState = 'escalateToState' in data;
    const touchesHours = 'escalateAfterHours' in data;
    if (!touchesState && !touchesHours) return true;
    return escalationPairing(data);
  }, escalationPairingMessage),
});

export type CreateSlaPolicyInput = z.infer<typeof createSlaPolicySchema>['body'];
export type UpdateSlaPolicyInput = z.infer<typeof updateSlaPolicySchema>['body'];
