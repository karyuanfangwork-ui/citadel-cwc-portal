import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

export interface LineItemInput {
  lineKey: string;
  lineLabel: string;
  projectionYear: number;
  amount: string | number;
  displayOrder?: number;
}

class ProjectionService {
  async getByApplication(applicationId: string) {
    return prisma.cashflowProjection.findUnique({
      where: { applicationId },
      include: { lineItems: { orderBy: [{ displayOrder: 'asc' }, { projectionYear: 'asc' }] } },
    });
  }

  async upsertHeader(applicationId: string, assumptions?: string | null) {
    return prisma.cashflowProjection.upsert({
      where: { applicationId },
      update: { assumptions: assumptions ?? undefined },
      create: { applicationId, assumptions: assumptions ?? undefined },
      include: { lineItems: { orderBy: [{ displayOrder: 'asc' }, { projectionYear: 'asc' }] } },
    });
  }

  async upsertLines(applicationId: string, lines: LineItemInput[]) {
    const projection = await this.upsertHeader(applicationId);
    const projectionId = projection.id;

    await Promise.all(
      lines.map(line =>
        prisma.projectionLineItem.upsert({
          where: { projectionId_lineKey_projectionYear: { projectionId, lineKey: line.lineKey, projectionYear: line.projectionYear } },
          update: { amount: new Prisma.Decimal(line.amount), lineLabel: line.lineLabel, displayOrder: line.displayOrder ?? 0 },
          create: { projectionId, lineKey: line.lineKey, lineLabel: line.lineLabel, projectionYear: line.projectionYear, amount: new Prisma.Decimal(line.amount), displayOrder: line.displayOrder ?? 0 },
        }),
      ),
    );

    return this.getByApplication(applicationId);
  }
}

export const projectionService = new ProjectionService();
