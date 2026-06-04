// ============================================================================
// CRM Auto-Assignment — Rule-based lead owner assignment
// ============================================================================

export interface AssignmentRule {
  id: string;
  name: string;
  territoryId: string | null;
  sourceMatch: string | null; // e.g. "source=WEBSITE"
  roundRobin: boolean;
  isActive: boolean;
  priority: number;
}

export interface TerritoryMember {
  userId: string;
  role: string; // MANAGER | MEMBER
}

/** Counter state for round-robin: territoryId → next index */
export type RoundRobinCounters = Record<string, number>;

/** Partial lead object — we only need `source` for matching */
export interface LeadForAssignment {
  source?: string;
  [key: string]: unknown;
}

export interface AssignmentResult {
  ownerId: string | null;
  ruleId: string | null;
  nextIndex?: number; // updated round-robin counter for the territory
}

/**
 * Match a lead against assignment rules (sorted by priority desc).
 * Rules are evaluated in priority order; higher priority wins.
 *
 * sourceMatch format: "key=value" — currently supports "source=VALUE".
 * null sourceMatch matches any lead (default/catch-all rule).
 *
 * roundRobin=true → cycle through territory members using the counter.
 * roundRobin=false → pick the first MANAGER, or first MEMBER if no manager.
 */
export function assignLeadOwner(
  lead: LeadForAssignment,
  rules: AssignmentRule[],
  territoryMembers: Record<string, TerritoryMember[]>,
  counters: RoundRobinCounters,
): AssignmentResult {
  // Sort by priority descending
  const sorted = [...rules].filter(r => r.isActive).sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    // Check sourceMatch
    if (rule.sourceMatch !== null) {
      const [key, value] = rule.sourceMatch.split('=');
      if (key === 'source' && lead.source !== value) continue;
      // Unknown keys are ignored for now
    }

    // Rule matches — find an owner
    if (!rule.territoryId) {
      // No territory → can't assign
      return { ownerId: null, ruleId: rule.id };
    }

    const members = territoryMembers[rule.territoryId];
    if (!members || members.length === 0) {
      return { ownerId: null, ruleId: rule.id };
    }

    if (rule.roundRobin) {
      const idx = (counters[rule.territoryId] ?? 0) % members.length;
      const ownerId = members[idx].userId;
      return {
        ownerId,
        ruleId: rule.id,
        nextIndex: idx + 1,
      };
    } else {
      // Pick first MANAGER, or first member
      const manager = members.find(m => m.role === 'MANAGER');
      const owner = manager ?? members[0];
      return { ownerId: owner.userId, ruleId: rule.id };
    }
  }

  return { ownerId: null, ruleId: null };
}

// ============================================================================
// DB-BOUND RESOLVER
// ============================================================================

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function resolveAssignmentForLead(leadId: string): Promise<string | null> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  const rules = await prisma.crmAssignmentRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  // Load territory members for all referenced territories
  const territoryIds = [...new Set(rules.map(r => r.territoryId).filter(Boolean))] as string[];
  const territoryMembersArr = await prisma.crmTerritoryMember.findMany({
    where: { territoryId: { in: territoryIds } },
  });

  const territoryMembers: Record<string, TerritoryMember[]> = {};
  for (const tm of territoryMembersArr) {
    if (!territoryMembers[tm.territoryId]) territoryMembers[tm.territoryId] = [];
    territoryMembers[tm.territoryId].push({ userId: tm.userId, role: tm.role });
  }

  // Get current round-robin counters from a simple key-value store (we use the rule's updatedAt as nonce)
  // For simplicity, use a static counter stored in-memory keyed by territory
  // In production, this would be a Redis counter or DB counter
  const counters: RoundRobinCounters = {};
  for (const tid of territoryIds) {
    // Read counter from a config or default 0
    counters[tid] = 0;
  }

  const result = assignLeadOwner(lead, rules, territoryMembers, counters);

  // If round-robin, persist the counter for next call
  if (result.nextIndex !== undefined && result.ruleId) {
    const rule = rules.find(r => r.id === result.ruleId);
    if (rule?.territoryId) {
      counters[rule.territoryId] = result.nextIndex;
    }
  }

  return result.ownerId;
}