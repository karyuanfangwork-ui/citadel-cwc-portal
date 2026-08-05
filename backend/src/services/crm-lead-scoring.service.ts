// ============================================================================
// CRM Lead Scoring — Rule-based
// ============================================================================

export interface ScoringRule {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'starts_with' | 'not_empty';
  value: string;
  points: number;
  isActive: boolean;
}

/**
 * A simplified lead shape used for scoring.
 * Any object with these string-keyed fields works.
 */
export type LeadLike = Record<string, any>;

/**
 * Pure-function rule evaluation.
 * Sums points from all matching *active* rules.
 */
export function computeRuleScore(lead: LeadLike, rules: ScoringRule[]): number {
  let total = 0;

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const raw = lead[rule.field];
    const ruleValue = rule.value;

    let matched = false;

    switch (rule.operator) {
      case 'equals': {
        if (raw == null) break;
        if (typeof raw === 'number') {
          matched = raw === Number(ruleValue);
        } else {
          matched = String(raw).toLowerCase() === ruleValue.toLowerCase();
        }
        break;
      }
      case 'contains': {
        if (raw == null) break;
        matched = String(raw).toLowerCase().includes(ruleValue.toLowerCase());
        break;
      }
      case 'gt': {
        if (raw == null) break;
        const num = typeof raw === 'number' ? raw : Number(raw);
        matched = num > Number(ruleValue);
        break;
      }
      case 'lt': {
        if (raw == null) break;
        const num = typeof raw === 'number' ? raw : Number(raw);
        matched = num < Number(ruleValue);
        break;
      }
      case 'starts_with': {
        if (raw == null) break;
        matched = String(raw).toLowerCase().startsWith(ruleValue.toLowerCase());
        break;
      }
      case 'not_empty': {
        matched = raw != null && raw !== '';
        break;
      }
    }

    if (matched) total += rule.points;
  }

  return total;
}

// ============================================================================
// DB-BOUND RECOMPUTE
// ============================================================================

import prisma from '../utils/prisma';

/**
 * Recompute and persist ruleScore for a single lead.
 */
export async function recomputeLeadRuleScore(leadId: string): Promise<number> {
  const [lead, rules] = await Promise.all([
    prisma.crmLead.findUnique({ where: { id: leadId } }),
    prisma.crmLeadScoringRule.findMany({ where: { isActive: true } }),
  ]);
  if (!lead) return 0;

  const score = computeRuleScore(lead as any, rules as any);
  await prisma.crmLead.update({ where: { id: leadId }, data: { ruleScore: score } });
  return score;
}

/**
 * Nightly batch: recompute ruleScore for all active leads.
 */
export async function recomputeAllLeadScores(): Promise<{ count: number }> {
  const rules = await prisma.crmLeadScoringRule.findMany({ where: { isActive: true } });
  const leads = await prisma.crmLead.findMany({
    where: { deletedAt: null },
    select: { id: true, source: true, status: true, companyName: true, title: true, estimatedValue: true, contactEmail: true, contactPhone: true, description: true },
  });

  let count = 0;
  for (const lead of leads) {
    const score = computeRuleScore(lead as any, rules as any);
    await prisma.crmLead.update({ where: { id: lead.id }, data: { ruleScore: score } });
    count++;
  }
  return { count };
}