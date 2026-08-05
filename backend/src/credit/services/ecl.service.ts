import prisma from '../../utils/prisma';
import { MfrsStage, Prisma } from '@prisma/client';

export interface CreateEclSnapshotData {
  applicationId: string;
  subjectType: string;
  subjectName?: string | null;
  snapshotDate: string;
  miaCount?: number | null;
  mfrsStage?: MfrsStage | null;
  totalOutstanding?: string | number | null;
  pdPct?: string | number | null;
  lgdPct?: string | number | null;
  lossRatePct?: string | number | null;
  eclAmount?: string | number | null;
  potentialEclWriteback?: string | number | null;
  notes?: string | null;
}

export interface UpdateEclSnapshotData extends Partial<Omit<CreateEclSnapshotData, 'applicationId'>> {}

export interface UpsertEclForecastData {
  forecastYear: number;
  mfrsStage?: MfrsStage | null;
  eclAmount?: string | number | null;
  pdPct?: string | number | null;
  lgdPct?: string | number | null;
  assumptions?: string | null;
}

const toD = (v: string | number | null | undefined) =>
  v != null ? new Prisma.Decimal(v) : null;

class EclService {
  // ── Snapshots ──────────────────────────────────────────────────────────────

  async listSnapshots(applicationId: string) {
    return prisma.eclSnapshot.findMany({
      where: { applicationId },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  async createSnapshot(data: CreateEclSnapshotData) {
    return prisma.eclSnapshot.create({
      data: {
        applicationId: data.applicationId,
        subjectType: data.subjectType,
        subjectName: data.subjectName ?? undefined,
        snapshotDate: new Date(data.snapshotDate),
        miaCount: data.miaCount ?? undefined,
        mfrsStage: data.mfrsStage ?? undefined,
        totalOutstanding: toD(data.totalOutstanding) ?? undefined,
        pdPct: toD(data.pdPct) ?? undefined,
        lgdPct: toD(data.lgdPct) ?? undefined,
        lossRatePct: toD(data.lossRatePct) ?? undefined,
        eclAmount: toD(data.eclAmount) ?? undefined,
        potentialEclWriteback: toD(data.potentialEclWriteback) ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
  }

  async updateSnapshot(id: string, data: UpdateEclSnapshotData) {
    const existing = await prisma.eclSnapshot.findUnique({ where: { id } });
    if (!existing) return null;

    const patch: Prisma.EclSnapshotUpdateInput = {};
    if (data.subjectType !== undefined) patch.subjectType = data.subjectType;
    if (data.subjectName !== undefined) patch.subjectName = data.subjectName;
    if (data.snapshotDate !== undefined) patch.snapshotDate = new Date(data.snapshotDate);
    if (data.miaCount !== undefined) patch.miaCount = data.miaCount;
    if (data.mfrsStage !== undefined) patch.mfrsStage = data.mfrsStage;
    if (data.totalOutstanding !== undefined) patch.totalOutstanding = toD(data.totalOutstanding);
    if (data.pdPct !== undefined) patch.pdPct = toD(data.pdPct);
    if (data.lgdPct !== undefined) patch.lgdPct = toD(data.lgdPct);
    if (data.lossRatePct !== undefined) patch.lossRatePct = toD(data.lossRatePct);
    if (data.eclAmount !== undefined) patch.eclAmount = toD(data.eclAmount);
    if (data.potentialEclWriteback !== undefined) patch.potentialEclWriteback = toD(data.potentialEclWriteback);
    if (data.notes !== undefined) patch.notes = data.notes;

    return prisma.eclSnapshot.update({ where: { id }, data: patch });
  }

  async deleteSnapshot(id: string) {
    const existing = await prisma.eclSnapshot.findUnique({ where: { id } });
    if (!existing) return null;
    return prisma.eclSnapshot.delete({ where: { id } });
  }

  // ── Forecasts ──────────────────────────────────────────────────────────────

  async listForecasts(applicationId: string) {
    return prisma.eclForecast.findMany({
      where: { applicationId },
      orderBy: { forecastYear: 'asc' },
    });
  }

  async upsertForecast(applicationId: string, data: UpsertEclForecastData) {
    const payload = {
      mfrsStage: data.mfrsStage ?? undefined,
      eclAmount: toD(data.eclAmount) ?? undefined,
      pdPct: toD(data.pdPct) ?? undefined,
      lgdPct: toD(data.lgdPct) ?? undefined,
      assumptions: data.assumptions ?? undefined,
    };

    return prisma.eclForecast.upsert({
      where: { applicationId_forecastYear: { applicationId, forecastYear: data.forecastYear } },
      update: payload,
      create: { applicationId, forecastYear: data.forecastYear, ...payload },
    });
  }
}

export const eclService = new EclService();
