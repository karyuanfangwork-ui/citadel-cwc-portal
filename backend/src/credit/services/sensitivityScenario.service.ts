import prisma from '../../utils/prisma';
import { ProjectionScenario, Prisma } from '@prisma/client';

export interface UpsertScenarioData {
  label?: string | null;
  assumptions?: string | null;
  revenueAmount?: string | number | null;
  opCashflow?: string | number | null;
  ebitda?: string | number | null;
  financingCosts?: string | number | null;
  gearingRatio?: string | number | null;
  dscr?: string | number | null;
}

const toD = (v: string | number | null | undefined) =>
  v != null ? new Prisma.Decimal(v) : null;

class SensitivityScenarioService {
  async listByApplication(applicationId: string) {
    return prisma.sensitivityScenario.findMany({
      where: { applicationId },
      orderBy: { scenario: 'asc' },
    });
  }

  async upsert(applicationId: string, scenario: ProjectionScenario, data: UpsertScenarioData) {
    const payload = {
      label: data.label ?? undefined,
      assumptions: data.assumptions ?? undefined,
      revenueAmount: toD(data.revenueAmount),
      opCashflow: toD(data.opCashflow),
      ebitda: toD(data.ebitda),
      financingCosts: toD(data.financingCosts),
      gearingRatio: toD(data.gearingRatio),
      dscr: toD(data.dscr),
    };

    return prisma.sensitivityScenario.upsert({
      where: { applicationId_scenario: { applicationId, scenario } },
      update: payload,
      create: { applicationId, scenario, ...payload },
    });
  }
}

export const sensitivityScenarioService = new SensitivityScenarioService();
