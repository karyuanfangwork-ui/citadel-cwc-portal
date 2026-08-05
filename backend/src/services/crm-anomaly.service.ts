import { LeadStatus } from '@prisma/client';

import prisma from '../utils/prisma';

// ============================================================================
// ANOMALY DETECTION SERVICE
// ============================================================================

interface Anomaly {
  id: string;
  type: 'DEAL_STUCK' | 'PROBABILITY_DROP' | 'VELOCITY_ANOMALY' | 'STALE_LEAD';
  entityId: string;
  entityType: 'OPPORTUNITY' | 'LEAD';
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  detectedAt: Date;
  message: string;
  recommendation: string;
  metadata: Record<string, any>;
}

const DEFAULT_CONFIGS = [
  { entityType: 'OPPORTUNITY', anomalyType: 'DEAL_STUCK', threshold: 14, severity: 'MODERATE' },
  { entityType: 'OPPORTUNITY', anomalyType: 'PROBABILITY_DROP', threshold: 15, severity: 'MODERATE' },
  { entityType: 'OPPORTUNITY', anomalyType: 'VELOCITY_ANOMALY', threshold: 2, severity: 'LOW' },
  { entityType: 'LEAD', anomalyType: 'STALE_LEAD', threshold: 7, severity: 'MODERATE' },
];

export async function getConfigs(): Promise<any[]> {
  let configs = await prisma.crmAnomalyConfig.findMany({ where: { isActive: true } });
  if (configs.length === 0) {
    await prisma.crmAnomalyConfig.createMany({ data: DEFAULT_CONFIGS as any });
    configs = await prisma.crmAnomalyConfig.findMany({ where: { isActive: true } });
  }
  return configs;
}

export async function updateConfig(id: string, data: { threshold?: number; severity?: string; isActive?: boolean }): Promise<any> {
  return prisma.crmAnomalyConfig.update({ where: { id }, data });
}

export async function detectAnomalies(userId: string): Promise<Anomaly[]> {
  const configs = await getConfigs();
  const configMap = new Map(configs.map(c => [`${c.entityType}:${c.anomalyType}`, c]));
  const anomalies: Anomaly[] = [];

  const opportunities = await prisma.crmOpportunity.findMany({
    where: { ownerId: userId, deletedAt: null },
    include: { stage: true },
  });

  const leads = await prisma.crmLead.findMany({
    where: { ownerId: userId },
  });

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;

  // ── DEAL_STUCK ──
  const stuckConfig = configMap.get('OPPORTUNITY:DEAL_STUCK');
  if (stuckConfig) {
    const thresholdDays = stuckConfig.threshold;
    for (const opp of opportunities) {
      // Open opportunities = not won and not lost
      if (opp.wonAt || opp.lostAt || opp.deletedAt) continue;
      // Use updatedAt as proxy for last stage change if stageChangedAt not available
      const lastChange = opp.updatedAt;
      const daysInStage = Math.floor((now - lastChange.getTime()) / dayMs);
      if (daysInStage > thresholdDays) {
        const ratio = daysInStage / thresholdDays;
        const severity: Anomaly['severity'] = ratio >= 2 ? 'CRITICAL' : ratio >= 1.5 ? 'MODERATE' : 'LOW';
        anomalies.push({
          id: `stuck-${opp.id}`,
          type: 'DEAL_STUCK',
          entityId: opp.id,
          entityType: 'OPPORTUNITY',
          severity,
          detectedAt: new Date(),
          message: `"${opp.name}" has been in ${opp.stage?.name || 'current stage'} for ${daysInStage} days (threshold: ${thresholdDays} days).`,
          recommendation: 'Review the deal. Consider re-engaging, adjusting the close date, or moving to a different stage.',
          metadata: { daysInStage, thresholdDays, ratio: Math.round(ratio * 100) / 100, stageName: opp.stage?.name },
        });
      }
    }
  }

  // ── PROBABILITY_DROP ──
  const probConfig = configMap.get('OPPORTUNITY:PROBABILITY_DROP');
  if (probConfig) {
    const thresholdDrop = probConfig.threshold;
    for (const opp of opportunities) {
      if (opp.wonAt || opp.lostAt || opp.deletedAt) continue;
      if (opp.aiWinProbability == null) continue;
      const histories = await prisma.crmOpportunityStageHistory.findMany({
        where: { opportunityId: opp.id },
        orderBy: { movedAt: 'desc' },
        take: 5,
      });
      // Use probability delta: compare current AI probability to the base stage probability
      const stageProb = opp.stage?.probability || 0;
      const currProb = opp.aiWinProbability;
      const drop = stageProb - currProb;
      // Also check if there's recent stage regression in history
      if (histories.length >= 2 && drop >= thresholdDrop) {
        const severity: Anomaly['severity'] = drop >= thresholdDrop * 2 ? 'CRITICAL' : drop >= thresholdDrop * 1.5 ? 'MODERATE' : 'LOW';
        anomalies.push({
          id: `prob-drop-${opp.id}`,
          type: 'PROBABILITY_DROP',
          entityId: opp.id,
          entityType: 'OPPORTUNITY',
          severity,
          detectedAt: new Date(),
          message: `"${opp.name}" win probability dropped by ${Math.round(drop)}% (stage baseline: ${Math.round(stageProb)}%, AI predicts: ${Math.round(currProb)}%).`,
          recommendation: 'Investigate cause. Consider outreach, re-qualification, or stage regression.',
          metadata: { previousProbability: stageProb, currentProbability: currProb, drop, thresholdDrop },
        });
      }
    }
  }

  // ── VELOCITY_ANOMALY ──
  const velocityConfig = configMap.get('OPPORTUNITY:VELOCITY_ANOMALY');
  if (velocityConfig) {
    const stddevThreshold = velocityConfig.threshold;
    const openOpps = opportunities.filter(o => !o.wonAt && !o.lostAt && !o.deletedAt);
    if (openOpps.length >= 3) {
      const velocities = openOpps.map(o => (now - o.createdAt.getTime()) / dayMs);
      const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
      const stdDev = Math.sqrt(variance);
      for (let i = 0; i < openOpps.length; i++) {
        const days = velocities[i];
        if (stdDev > 0 && (days - mean) / stdDev > stddevThreshold) {
          anomalies.push({
            id: `velocity-${openOpps[i].id}`,
            type: 'VELOCITY_ANOMALY',
            entityId: openOpps[i].id,
            entityType: 'OPPORTUNITY',
            severity: 'LOW',
            detectedAt: new Date(),
            message: `"${openOpps[i].name}" is progressing ${Math.round(days)} days in (${Math.round(((days - mean) / stdDev) * 10) / 10}σ slower than average).`,
            recommendation: 'Check if this deal needs re-scoping, smaller milestones, or disqualification.',
            metadata: { daysInPipeline: Math.round(days), averageDays: Math.round(mean), standardDeviation: Math.round(stdDev * 10) / 10, zScore: Math.round(((days - mean) / (stdDev || 1)) * 10) / 10 },
          });
        }
      }
    }
  }

  // ── STALE_LEAD ──
  const staleConfig = configMap.get('LEAD:STALE_LEAD');
  if (staleConfig) {
    const thresholdDays = staleConfig.threshold;
    const activeStatuses: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];
    for (const lead of leads) {
      if (!activeStatuses.includes(lead.status)) continue;
      const recentActivity = await prisma.crmActivity.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });
      const lastActivityDate = recentActivity?.createdAt || lead.updatedAt;
      const daysSinceActivity = Math.floor((now - lastActivityDate.getTime()) / dayMs);
      if (daysSinceActivity > thresholdDays) {
        const severity: Anomaly['severity'] = daysSinceActivity >= thresholdDays * 3 ? 'CRITICAL' : daysSinceActivity >= thresholdDays * 2 ? 'MODERATE' : 'LOW';
        anomalies.push({
          id: `stale-${lead.id}`,
          type: 'STALE_LEAD',
          entityId: lead.id,
          entityType: 'LEAD',
          severity,
          detectedAt: new Date(),
          message: `"${lead.contactName || lead.id}" has had no activity for ${daysSinceActivity} days (threshold: ${thresholdDays} days).`,
          recommendation: 'Reach out to re-engage the lead. Consider a follow-up call, email, or re-qualification.',
          metadata: { daysSinceActivity, thresholdDays, lastActivityDate },
        });
      }
    }
  }

  const severityOrder: Record<string, number> = { CRITICAL: 0, MODERATE: 1, LOW: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return anomalies;
}

export default { getConfigs, updateConfig, detectAnomalies };