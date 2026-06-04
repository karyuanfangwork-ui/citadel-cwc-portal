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
        // Case-insensitive string comparison; numeric exact match
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