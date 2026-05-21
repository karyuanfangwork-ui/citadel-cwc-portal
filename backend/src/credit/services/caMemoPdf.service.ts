import prisma from '../../utils/prisma';

export async function getCaMemoData(applicationId: string) {
  const app = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        include: {
          account: { select: { id: true, name: true, registrationNo: true, industry: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          directors: { orderBy: { createdAt: 'asc' } },
          shareholders: { orderBy: { shareholdingPct: 'desc' } },
        },
      },
      facilities: {
        include: { collaterals: true, guarantees: { include: { guarantorProfile: { include: { account: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
      requestItems: { orderBy: { createdAt: 'asc' } },
      exposureSummary: true,
      externalRatings: { orderBy: { financialYear: 'desc' } },
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
      financialStatements: { orderBy: [{ financialYear: 'desc' }], take: 3 },
    },
  });

  return app;
}

export type CaMemoData = Awaited<ReturnType<typeof getCaMemoData>>;
