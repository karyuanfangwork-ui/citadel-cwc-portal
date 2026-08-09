import prisma from '../../utils/prisma';

export async function getCaMemoData(applicationId: string) {
  const app = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        include: {
          account: { select: { id: true, name: true, registrationNumber: true, industry: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          directors: { orderBy: { createdAt: 'asc' } },
          shareholders: { orderBy: { shareholdingPct: 'desc' } },
          financialStatements: { include: { lineItems: { orderBy: { displayOrder: 'asc' } } }, orderBy: { fiscalYearEnd: 'desc' } },
        },
      },
      // RM & Analyst
      assignedRm: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedAnalyst: { select: { id: true, firstName: true, lastName: true, email: true } },
      facilities: {
        include: {
          collaterals: true,
          guarantees: { include: { guarantorProfile: { include: { account: true, contact: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
      requestItems: { orderBy: { createdAt: 'asc' } },
      // Parties (directors/UBOs at application level)
      parties: { include: { borrowerProfile: { include: { account: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'asc' } },
      exposureSummary: true,
      externalRatings: { orderBy: { fiscalYear: 'desc' } },
      eclSnapshots: { orderBy: { createdAt: 'desc' } },
      cashflowProjection: { include: { lineItems: { orderBy: [{ lineKey: 'asc' }, { projectionYear: 'asc' }] } } },
      sensitivityScenarios: { orderBy: { scenario: 'asc' } },
      accountProfitability: { include: { lines: { orderBy: { displayOrder: 'asc' } } } },
      walletShares: { orderBy: { facilityType: 'asc' } },
      bureauChecks: { orderBy: { createdAt: 'asc' } },
      industryAssessment: true,
      riskAssessments: { orderBy: { sortOrder: 'asc' } },
      rmdIssues: { orderBy: { sortOrder: 'asc' } },
      esgAssessment: true,
      sicrAssessments: { orderBy: { triggerType: 'asc' } },
      signoffs: { include: { signedBy: { select: { firstName: true, lastName: true } } }, orderBy: { signedAt: 'asc' } },
      conditions: {
        include: {
          fulfilledBy: { select: { firstName: true, lastName: true } },
          waivedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ conditionType: 'asc' }, { createdAt: 'asc' }],
      },
      scoreRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      decisions: { include: { decidedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      // LOS-016 — The decision basis. All of this was already stored; the pack
      // simply never asked for it, so approvers had to navigate the whole
      // Application 360 to answer "why this rating, and what was overridden?"
      recommendations: {
        where: { status: { in: ['SUBMITTED', 'ACKNOWLEDGED'] } },
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { submittedAt: 'desc' },
      },
      assessmentResults: {
        where: { status: 'FROZEN' },
        orderBy: { version: 'desc' },
        take: 1,
      },
      scoreOverrides: {
        include: {
          firstApprover: { select: { firstName: true, lastName: true } },
          secondApprover: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      deviations: { orderBy: { createdAt: 'desc' } },
      documents: {
        where: { deletedAt: null },
        select: {
          id: true, classification: true, fileName: true, sha256Hash: true,
          verificationStatus: true, verifiedAt: true, createdAt: true,
        },
        orderBy: [{ classification: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  return app;
}

export type CaMemoData = Awaited<ReturnType<typeof getCaMemoData>>;