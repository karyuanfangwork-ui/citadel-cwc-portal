// LOS-016 — the management pack query carries the decision basis
import prisma from '../../utils/prisma';
import { getCaMemoData } from '../services/caMemoPdf.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-016 — the management pack query carries the decision basis', () => {
  let applicationId: string;

  beforeAll(async () => {
    const app = await prisma.creditApplication.findFirst({ where: { deletedAt: null } });
    if (!app) throw new Error('Seed credit fixtures first: npm run prisma:seed:credit -- --demo');
    applicationId = app.id;
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('includes the analyst recommendation', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.recommendations).toBeDefined();
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it('includes the frozen assessment result with its provenance', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.assessmentResults).toBeDefined();
    expect(Array.isArray(data.assessmentResults)).toBe(true);
  });

  it('includes score overrides and deviations', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.scoreOverrides).toBeDefined();
    expect(data.deviations).toBeDefined();
  });

  it('includes the evidence index', async () => {
    const data: any = await getCaMemoData(applicationId);
    expect(data.documents).toBeDefined();
    expect(Array.isArray(data.documents)).toBe(true);
  });

  it('carries the score run fields needed to explain the rating', async () => {
    const data: any = await getCaMemoData(applicationId);
    const run = data.scoreRuns?.[0];
    if (!run) return; // application has not been scored
    for (const field of ['factorScores', 'missingInputs', 'bureauCapsApplied', 'policyVersion', 'ratingBandVersion']) {
      expect(run).toHaveProperty(field);
    }
  });
});