import {
  PrismaClient,
  ApplicationState,
  ApplicationType,
  AccountClassification,
  AccountStrategy,
  BorrowerType,
  CreditProductType,
  FacilityType,
  CurrencyCode,
  RiskRating,
  AmlRiskTier,
  CommitteeMeetingStatus,
  CommitteeMemberRole,
  CommitteeAttendance,
  CommitteeVoteChoice,
  AgendaItemDecisionType,
  FinancialStatementType,
  FinancialPeriod,
  FinancialStatus,
  RatioCategory,
  CovenantType,
  CovenantFrequency,
  ConditionType,
  HealthStatus,
  PaymentStatus,
  SignalType,
  EarlyWarningSeverity,
  DocumentClass,
  ApprovalDecisionType,
  CaRequestType,
  MfrsStage,
  ProjectionScenario,
  CounterpartyRole,
  BureauProvider,
  RiskCategory,
  EsgGuidingPrinciple,
  EsgCategory,
  SicrTriggerType,
  SignoffRole,
} from '@prisma/client';

const prisma = new PrismaClient();

async function findExisting(model: any, where: any) {
  return model.findFirst({ where });
}

// ---------------------------------------------------------------------------
// 1. CRM Accounts (3 corporate + 2 individual)
// ---------------------------------------------------------------------------
async function seedCrmAccounts(adminId: string) {
  const accounts = [
    { name: 'SME Manufacturing Sdn Bhd', industry: 'Manufacturing', accountType: 'CORPORATE', registrationNumber: 'SM-2020010', annualRevenue: 25000000, phone: '+603-8888-1001', email: 'info@smemanufacturing.my', city: 'Shah Alam', state: 'Selangor', country: 'Malaysia' },
    { name: 'Tech Startup Sdn Bhd', industry: 'Technology', accountType: 'CORPORATE', registrationNumber: 'TS-2021035', annualRevenue: 5000000, phone: '+603-8888-1002', email: 'hello@techstartup.my', city: 'Cyberjaya', state: 'Selangor', country: 'Malaysia' },
    { name: 'Property Developer Sdn Bhd', industry: 'Real Estate', accountType: 'CORPORATE', registrationNumber: 'PD-2018007', annualRevenue: 80000000, phone: '+603-8888-1003', email: 'info@propertydev.my', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'Malaysia' },
    { name: 'High Net Worth Individual', industry: 'Finance', accountType: 'INDIVIDUAL', phone: '+6012-345-6789', email: 'hnwi@example.com', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'Malaysia' },
    { name: 'Retail Borrower', industry: 'Services', accountType: 'INDIVIDUAL', phone: '+6017-123-4567', email: 'retail@example.com', city: 'Penang', state: 'Pulau Pinang', country: 'Malaysia' },
  ];

  const created = [];
  for (const a of accounts) {
    let existing = await findExisting(prisma.crmAccount, { name: a.name });
    if (!existing) {
      existing = await prisma.crmAccount.create({
        data: { ...a, ownerId: adminId },
      });
    }
    created.push(existing);
  }
  console.log(`  ✅ ${created.length} CRM accounts`);
  return created;
}

// ---------------------------------------------------------------------------
// 2. Borrower Profiles (5) with Directors, Shareholders, UBOs — ALL fields
// ---------------------------------------------------------------------------
async function seedBorrowerProfiles(accounts: any[]) {
  const corporateAccounts = accounts.filter((a: any) => a.accountType === 'CORPORATE');
  const individualAccounts = accounts.filter((a: any) => a.accountType === 'INDIVIDUAL');
  const profiles: any[] = [];

  // --- Corporate borrowers ---
  for (const acct of corporateAccounts) {
    let bp = await findExisting(prisma.borrowerProfile, { accountId: acct.id });
    if (!bp) {
      const riskRating = acct.name.includes('SME') ? RiskRating.BBB : acct.name.includes('Tech') ? RiskRating.BB : RiskRating.A;
      const amlTier = acct.name.includes('Tech') ? AmlRiskTier.MEDIUM : AmlRiskTier.LOW;
      const exposure = acct.name.includes('Property') ? 50000000 : acct.name.includes('SME') ? 10000000 : 5000000;
      bp = await prisma.borrowerProfile.create({
        data: {
          borrowerType: BorrowerType.CORPORATE,
          accountId: acct.id,
          creditRiskRating: riskRating,
          amlRiskTier: amlTier,
          exposureLimit: exposure,
          totalExposure: acct.name.includes('Property') ? 30000000 : acct.name.includes('SME') ? 6000000 : 2000000,
          isSanctionedEntity: false,
          sourceOfWealth: 'Business operations and investments',
          purposeOfAccount: 'Credit facility application',
        },
      });
    }
    profiles.push(bp);

    // Directors (2-3) — with ALL fields populated
    const dirData = acct.name.includes('SME')
      ? [
          { name: 'Ahmad bin Ali', position: 'Managing Director', isExecutive: true, appointmentDate: '2018-03-15', nricPassport: 'encrypt:800101-10-5123' },
          { name: 'Lim Wei Chong', position: 'Director', isExecutive: false, appointmentDate: '2019-06-01', nricPassport: 'encrypt:750505-14-5231' },
          { name: 'Siti binti Hassan', position: 'Director', isExecutive: false, appointmentDate: '2020-09-20', nricPassport: 'encrypt:850812-06-5028' },
        ]
      : acct.name.includes('Tech')
        ? [
            { name: 'Raj Kumar a/l Muthu', position: 'Managing Director', isExecutive: true, appointmentDate: '2021-01-10', nricPassport: 'encrypt:900211-14-5781' },
            { name: 'Nurul Aisyah binti Yusof', position: 'Director', isExecutive: false, appointmentDate: '2022-04-01', nricPassport: 'encrypt:920530-06-5442' },
          ]
        : [
            { name: 'Michael Tan Wei Ming', position: 'Managing Director', isExecutive: true, appointmentDate: '2016-08-20', nricPassport: 'encrypt:780915-10-5901' },
            { name: 'Sarah Lee Mei Ling', position: 'Director', isExecutive: true, appointmentDate: '2017-01-15', nricPassport: 'encrypt:810322-06-5156' },
            { name: 'Chen Wei Ming', position: 'Non-Executive Director', isExecutive: false, appointmentDate: '2019-07-01', resignationDate: '2025-12-31', nricPassport: 'encrypt:700610-14-5367' },
          ];

    for (const d of dirData) {
      const existingDir = await findExisting(prisma.director, { borrowerProfileId: bp.id, name: d.name });
      if (!existingDir) {
        await prisma.director.create({
          data: {
            borrowerProfileId: bp.id,
            name: d.name,
            nricPassportEncrypted: d.nricPassport,
            position: d.position,
            isExecutive: d.isExecutive,
            appointmentDate: new Date(d.appointmentDate),
            resignationDate: (d as any).resignationDate ? new Date((d as any).resignationDate) : null,
          },
        });
      }
    }

    // Shareholders (1-2) — with numberOfShares
    const shData = acct.name.includes('SME')
      ? [{ name: 'Ahmad Holdings Sdn Bhd', pct: 60, shares: 600000, shareClass: 'Ordinary' }, { name: 'Lim Capital Sdn Bhd', pct: 40, shares: 400000, shareClass: 'Ordinary' }]
      : acct.name.includes('Tech')
        ? [{ name: 'Raj Ventures Sdn Bhd', pct: 70, shares: 700000, shareClass: 'Ordinary' }, { name: 'Nurul Investments Sdn Bhd', pct: 30, shares: 300000, shareClass: 'Preference' }]
        : [{ name: 'Tan Properties Sdn Bhd', pct: 80, shares: 8000000, shareClass: 'Ordinary' }, { name: 'Minority Holdings Sdn Bhd', pct: 20, shares: 2000000, shareClass: 'Ordinary' }];

    for (const sh of shData) {
      const existingSh = await findExisting(prisma.shareholder, { borrowerProfileId: bp.id, name: sh.name });
      if (!existingSh) {
        await prisma.shareholder.create({
          data: {
            borrowerProfileId: bp.id,
            name: sh.name,
            nricPassportEncrypted: sh.shares > 1000000 ? 'encrypt:corporate-ssm' : null,
            shareholdingPct: sh.pct,
            shareClass: sh.shareClass,
            numberOfShares: sh.shares,
          },
        });
      }
    }

    // UBO (1-2) — with ALL fields
    const uboData = acct.name.includes('SME')
      ? [{ name: 'Ahmad bin Ali', pct: 60, isPep: false, source: 'Business operations', country: 'Malaysia', nric: 'encrypt:800101-10-5123' }]
      : acct.name.includes('Tech')
        ? [{ name: 'Raj Kumar a/l Muthu', pct: 70, isPep: false, source: 'Technology startup equity', country: 'Malaysia', nric: 'encrypt:900211-14-5781' }]
        : [
            { name: 'Michael Tan Wei Ming', pct: 55, isPep: true, source: 'Property development & investments', country: 'Malaysia', nric: 'encrypt:780915-10-5901' },
            { name: 'Sarah Lee Mei Ling', pct: 25, isPep: false, source: 'Property investments', country: 'Malaysia', nric: 'encrypt:810322-06-5156' },
          ];

    for (const ubo of uboData) {
      const existingUbo = await findExisting(prisma.ultimateBeneficialOwner, { borrowerProfileId: bp.id, name: ubo.name });
      if (!existingUbo) {
        await prisma.ultimateBeneficialOwner.create({
          data: {
            borrowerProfileId: bp.id,
            name: ubo.name,
            nricPassportEncrypted: ubo.nric,
            ownershipPct: ubo.pct,
            isPep: ubo.isPep,
            sourceOfWealth: ubo.source,
            countryOfResidence: ubo.country,
          },
        });
      }
    }
  }

  // --- Individual borrowers (linked via CrmContact) ---
  for (const acct of individualAccounts) {
    const firstName = acct.name.includes('High') ? 'Dato' : 'Aminah';
    const lastName = acct.name.includes('High') ? 'Lee @ Dato Lee' : 'binti Yusof';
    let contact = await findExisting(prisma.crmContact, { accountId: acct.id, firstName, lastName });
    if (!contact) {
      contact = await prisma.crmContact.create({
        data: { accountId: acct.id, firstName, lastName, isPrimary: true },
      });
    }

    let bp = await findExisting(prisma.borrowerProfile, { contactId: contact.id });
    if (!bp) {
      bp = await prisma.borrowerProfile.create({
        data: {
          borrowerType: BorrowerType.INDIVIDUAL,
          contactId: contact.id,
          creditRiskRating: acct.name.includes('High') ? RiskRating.A : RiskRating.BBB,
          amlRiskTier: acct.name.includes('High') ? AmlRiskTier.MEDIUM : AmlRiskTier.LOW,
          exposureLimit: acct.name.includes('High') ? 5000000 : 500000,
          totalExposure: acct.name.includes('High') ? 2500000 : 0,
          annualIncome: acct.name.includes('High') ? 2000000 : 120000,
          netWorth: acct.name.includes('High') ? 15000000 : 500000,
          occupation: acct.name.includes('High') ? 'Investor & Business Director' : 'Senior Engineer',
          employer: acct.name.includes('High') ? 'Self-employed' : 'Citadel Group Technologies Sdn Bhd',
          sourceOfWealth: acct.name.includes('High') ? 'Investments, property portfolio & business dividends' : 'Employment income',
          purposeOfAccount: acct.name.includes('High') ? 'Investment loan & personal credit facility' : 'Home renovation loan',
          isSanctionedEntity: false,
        },
      });
    }
    profiles.push(bp);
  }

  console.log(`  ✅ ${profiles.length} borrower profiles (with all fields)`);
  return profiles;
}

// ---------------------------------------------------------------------------
// 2b. Related Party Groups — connects borrower profiles
// ---------------------------------------------------------------------------
async function seedRelatedPartyGroups(profiles: any[]) {
  if (profiles.length < 3) return;

  // Group 1: Corporate cross-holding — SME Manufacturing ↔ Property Developer
  let grp1 = await findExisting(prisma.relatedPartyGroup, { name: 'SME-PD Cross Holding Group' });
  if (!grp1) {
    grp1 = await prisma.relatedPartyGroup.create({
      data: {
        name: 'SME-PD Cross Holding Group',
        description: 'Cross-shareholding and common director relationship between SME Manufacturing and Property Developer',
        relationshipType: 'CROSS_SHAREHOLDING',
      },
    });

    await prisma.relatedPartyMember.create({ data: { groupId: grp1.id, borrowerProfileId: profiles[0].id, role: 'Majority Shareholder' } });
    await prisma.relatedPartyMember.create({ data: { groupId: grp1.id, borrowerProfileId: profiles[2].id, role: 'Subsidiary' } });
  }

  // Group 2: Family — HNWI ↔ Retail Borrower
  let grp2 = await findExisting(prisma.relatedPartyGroup, { name: 'Lee-Yusof Family Group' });
  if (!grp2) {
    grp2 = await prisma.relatedPartyGroup.create({
      data: {
        name: 'Lee-Yusof Family Group',
        description: 'Family connection between HNWI and retail borrower — spousal relationship',
        relationshipType: 'FAMILY',
      },
    });

    await prisma.relatedPartyMember.create({ data: { groupId: grp2.id, borrowerProfileId: profiles[3].id, role: 'Spouse' } });
    await prisma.relatedPartyMember.create({ data: { groupId: grp2.id, borrowerProfileId: profiles[4].id, role: 'Spouse' } });
  }

  console.log('  ✅ 2 related party groups with members');
}

// ---------------------------------------------------------------------------
// 3. Credit Applications (17 across all states) + Facilities — ALL fields
// ---------------------------------------------------------------------------
async function seedCreditApplications(profiles: any[], adminId: string, analystId: string) {
  // CA Memo Phase 1 — header + narrative fields for seed demo
  const caMemoDefaults: Record<number, Partial<{
    applicationType: ApplicationType; accountClassification: AccountClassification; accountStrategy: AccountStrategy;
    customerGroupName: string; cifNo: string; originatingDepartment: string;
    teamLeadName: string; referredBy: string; connectedPartyFlag: boolean;
    connectedPartyStaffName: string; completeDocsDate: string;
    lastReviewDate: string; nextReviewDate: string; relationshipSince: string;
    lastSiteVisitDate: string; preambleText: string; mattersToHighlight: string;
    transactionDetailsText: string; crossSellingInitiatives: string;
    firstWayOut: string; preparedAt: string;
  }>> = {
    0: { applicationType: ApplicationType.NEW, accountClassification: AccountClassification.PERFORMING, accountStrategy: AccountStrategy.GROW, customerGroupName: 'SME Group', cifNo: 'CIF-SME-001', originatingDepartment: 'Corporate Banking', teamLeadName: 'Farah binti Ismail', completeDocsDate: '2026-04-15', lastReviewDate: '2026-03-20', nextReviewDate: '2026-09-20', relationshipSince: '2018-06-01', lastSiteVisitDate: '2026-04-28', preambleText: 'SME Manufacturing Sdn Bhd is a well-established manufacturer of industrial components based in Shah Alam, Selangor. The company has been banking with us since 2018 and maintains a strong payment record. This application is for a new term loan to finance expansion of their production line to meet growing demand from semiconductor sector clients.', mattersToHighlight: 'Key matter: Concentration risk in semiconductor sector (65% revenue). Cross-default clause with existing RM3M facility. Collateral valuation pending renewal — current valuation dated Mar 2025.', transactionDetailsText: 'New term loan of RM2,000,000 for a 5-year tenor to finance the purchase and installation of 4 new CNC machines and related tooling. Proposed interest rate BLR + 1.5% (4.25% p.a.). Repayment via monthly installments.', firstWayOut: 'Primary repayment from operating cashflows — borrower generated RM3.75M EBITDA in FY2025. Monthly debt service of RM42,000 represents DSR of 0.13x against monthly EBITDA. Secondary: liquidation of accounts receivable (RM3.5M outstanding). Tertiary: enforced sale of charged industrial property (FSV RM3.15M).', preparedAt: '2026-05-10' },
    1: { applicationType: ApplicationType.ADDITIONAL, accountClassification: AccountClassification.PERFORMING, cifNo: 'CIF-TECH-001', originatingDepartment: 'Corporate Banking', preambleText: 'Tech Startup Sdn Bhd is a rapidly growing technology services company in Cyberjaya. Established in 2021, they have shown strong revenue growth and require additional working capital to support expansion.', transactionDetailsText: 'Additional revolving credit facility of RM1,000,000 to support daily operations and payroll for 50+ staff.', firstWayOut: 'Primary repayment from recurring SaaS subscription revenues and professional services billings. ARR at RM4.2M with 95% retention. Secondary: return of undrawn revolving facility from working capital cycle.' },
    2: { applicationType: ApplicationType.RENEWAL, accountClassification: AccountClassification.PERFORMING, accountStrategy: AccountStrategy.MAINTAIN, customerGroupName: 'Property Group', cifNo: 'CIF-PD-001', originatingDepartment: 'Corporate Banking', teamLeadName: 'Rizal bin Ahmad', completeDocsDate: '2026-04-20', lastReviewDate: '2025-12-15', nextReviewDate: '2026-12-15', relationshipSince: '2016-08-20', lastSiteVisitDate: '2026-03-10', preambleText: 'Property Developer Sdn Bhd is a major property developer with an established track record spanning 8 years. The group has successfully completed multiple mixed-use and residential projects across the Klang Valley.', mattersToHighlight: 'Exposure to property market cyclical risk. Existing group exposure at RM30M (60% utilization). Pending BNM approval for increased land bank financing.', transactionDetailsText: 'Renewal of trade finance facility of RM5,000,000 for a 12-month tenor to support LC issuance for raw material imports from China for the ongoing township project.', firstWayOut: 'Primary: LC proceeds upon presentation of compliant shipping documents — self-liquidating trade finance structure. Secondary: group parent guarantee from Property Holdings Group Bhd (net assets RM120M). Tertiary: first charge over township project land (FSV RM9.8M).', preparedAt: '2026-05-12' },
    3: { applicationType: ApplicationType.NEW, accountClassification: AccountClassification.EARLY_CARE, accountStrategy: AccountStrategy.GROW, cifNo: 'CIF-HNWI-001', originatingDepartment: 'Priority Banking', teamLeadName: 'Dato Lee @ Dato Lee', connectedPartyFlag: true, connectedPartyStaffName: 'Lee Mei Ling (Director, Priority Banking)', completeDocsDate: '2026-04-10', relationshipSince: '2020-01-15', preambleText: 'High Net Worth Individual seeking investment loan. Connected party — spouse of a Priority Banking director. All compliance and conflict-of-interest protocols have been observed.', mattersToHighlight: 'Connected party flag — spouse is a director in Priority Banking division. Approval must follow the Connected Party Lending Policy (CP-2023-05).', transactionDetailsText: 'New term loan of RM3,000,000 for 3 years to diversify investment portfolio into mixed-asset holdings.', firstWayOut: 'Primary: dividend income from investment portfolio (avg RM180K p.a.) and rental income from 3 properties (RM12K/month). Secondary: liquidation of listed equity portfolio (market value RM4.2M as at Apr 2026).' },
    4: { applicationType: ApplicationType.ADDITIONAL, accountClassification: AccountClassification.PERFORMING, cifNo: 'CIF-RB-001', originatingDepartment: 'Retail Banking', preambleText: 'Retail borrower maintaining good conduct on existing facilities. Seeking additional credit line for home renovation.', transactionDetailsText: 'Revolving credit facility of RM500,000 for 24 months for home renovation and improvement works.', firstWayOut: 'Primary: monthly salary income of RM8,500 from permanent employment. Secondary: existing fixed deposit savings of RM120,000 pledged as collateral.' },
  };

  const appDefs: Array<{
    state: ApplicationState; productType: CreditProductType; borrowerIdx: number;
    amount: number; purpose: string; tenor?: number; currency?: CurrencyCode;
  }> = [
    { state: ApplicationState.DRAFT, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 2000000, purpose: 'Working capital expansion for new production line', tenor: 60 },
    { state: ApplicationState.SUBMITTED, productType: CreditProductType.REVOLVING_FACILITY, borrowerIdx: 1, amount: 1000000, purpose: 'Revolving credit line for daily operations and payroll', tenor: 36 },
    { state: ApplicationState.KYC_REVIEW, productType: CreditProductType.TRADE_FINANCE, borrowerIdx: 2, amount: 5000000, purpose: 'Letter of credit for raw material import from China', tenor: 12 },
    { state: ApplicationState.CREDIT_ASSESSMENT, productType: CreditProductType.PROJECT_FINANCE, borrowerIdx: 0, amount: 8000000, purpose: 'Factory expansion project — Phase 2', tenor: 84 },
    { state: ApplicationState.COMMITTEE_REVIEW, productType: CreditProductType.TERM_LOAN, borrowerIdx: 2, amount: 10000000, purpose: 'Property development phase 2 — mixed-use tower', tenor: 120 },
    { state: ApplicationState.APPROVED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 3000000, purpose: 'Industrial machinery purchase — CNC & press equipment', tenor: 48 },
    { state: ApplicationState.REJECTED, productType: CreditProductType.OVERDRAFT, borrowerIdx: 3, amount: 500000, purpose: 'Personal overdraft facility for investment liquidity', tenor: 24 },
    { state: ApplicationState.WITHDRAWN, productType: CreditProductType.BRIDGING, borrowerIdx: 4, amount: 750000, purpose: 'Bridge loan pending property sale completion', tenor: 6 },
    { state: ApplicationState.DISBURSED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 5000000, purpose: 'Factory renovation and equipment upgrade', tenor: 72 },
    { state: ApplicationState.ACTIVE, productType: CreditProductType.TERM_LOAN, borrowerIdx: 2, amount: 6000000, purpose: 'Condominium development — Phase 1 infrastructure', tenor: 96 },
    { state: ApplicationState.CLOSED, productType: CreditProductType.TRADE_FINANCE, borrowerIdx: 1, amount: 800000, purpose: 'Completed trade finance — import of semiconductor equipment', tenor: 12 },
    { state: ApplicationState.KYC_APPROVED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 3, amount: 3000000, purpose: 'HNWI investment loan — diversified portfolio', tenor: 36 },
    { state: ApplicationState.UNDERWRITING, productType: CreditProductType.REVOLVING_FACILITY, borrowerIdx: 4, amount: 500000, purpose: 'Personal credit line for home renovation', tenor: 24 },
    { state: ApplicationState.OFFER, productType: CreditProductType.PROJECT_FINANCE, borrowerIdx: 2, amount: 4000000, purpose: 'Mixed development project — retail & residential', tenor: 84 },
    { state: ApplicationState.ACCEPTED, productType: CreditProductType.HIRE_PURCHASE, borrowerIdx: 0, amount: 600000, purpose: 'Vehicle fleet purchase — 12 units for logistics', tenor: 48 },
    { state: ApplicationState.DRAFT, productType: CreditProductType.SYNDICATED, borrowerIdx: 2, amount: 7000000, purpose: 'Syndicated construction loan for township project', tenor: 180 },
    { state: ApplicationState.SUBMITTED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 3, amount: 2000000, purpose: 'HNWI property loan — luxury condominium acquisition', tenor: 48 },
  ];

  const facilityTypeMap: Record<string, FacilityType> = {
    TERM_LOAN: FacilityType.TERM_LOAN,
    REVOLVING_FACILITY: FacilityType.REVOLVING,
    TRADE_FINANCE: FacilityType.LC,
    PROJECT_FINANCE: FacilityType.BRIDGING,
    OVERDRAFT: FacilityType.OVERDRAFT,
    BRIDGING: FacilityType.BRIDGING,
    HIRE_PURCHASE: FacilityType.TERM_LOAN,
    SYNDICATED: FacilityType.TERM_LOAN,
  };

  // States where the facility carries an "approved/recommended" amount on the row.
  // COMMITTEE_REVIEW included so reviewers see the recommended figures during the vote.
  const approvedStates: Set<string> = new Set([
    ApplicationState.COMMITTEE_REVIEW,
    ApplicationState.APPROVED, ApplicationState.OFFER, ApplicationState.ACCEPTED,
    ApplicationState.DISBURSED, ApplicationState.ACTIVE, ApplicationState.CLOSED,
  ]);

  let appCounter = 0;
  const createdApps: any[] = [];

  for (const def of appDefs) {
    const borrower = profiles[def.borrowerIdx];
    const appNo = `CA-2026-${String(++appCounter).padStart(5, '0')}`;
    let app = await findExisting(prisma.creditApplication, { applicationNo: appNo });
    if (!app) {
      try {
        app = await prisma.creditApplication.create({
          data: {
            applicationNo: appNo,
            state: def.state,
            borrowerProfileId: borrower.id,
            productType: def.productType,
            requestedAmount: def.amount,
            requestedTenor: def.tenor || 60,
            currency: def.currency || CurrencyCode.MYR,
            purpose: def.purpose,
            assignedRmId: adminId,
            assignedAnalystId: analystId,
            submittedAt: def.state !== ApplicationState.DRAFT ? new Date('2026-05-01') : undefined,
            decisionedAt: (def.state === ApplicationState.APPROVED || def.state === ApplicationState.REJECTED) ? new Date('2026-05-15') : undefined,
            closedAt: (def.state === ApplicationState.WITHDRAWN || def.state === ApplicationState.CLOSED) ? new Date('2026-06-01') : undefined,
            rejectionReason: def.state === ApplicationState.REJECTED ? 'Insufficient income documentation — debt service ratio exceeds policy threshold of 60%. Average monthly income RM8,500 vs. proposed monthly commitment RM5,200 (DSR 61.2%).' : undefined,
            withdrawalReason: def.state === ApplicationState.WITHDRAWN ? 'Borrower requested withdrawal — property sale fell through, bridge loan no longer required.' : undefined,
            // CA Memo Phase 1 fields — lookup by borrowerIdx
            ...(caMemoDefaults[def.borrowerIdx] ? {
              applicationType: caMemoDefaults[def.borrowerIdx].applicationType,
              accountClassification: caMemoDefaults[def.borrowerIdx].accountClassification,
              accountStrategy: caMemoDefaults[def.borrowerIdx].accountStrategy,
              customerGroupName: caMemoDefaults[def.borrowerIdx].customerGroupName,
              cifNo: caMemoDefaults[def.borrowerIdx].cifNo,
              originatingDepartment: caMemoDefaults[def.borrowerIdx].originatingDepartment,
              teamLeadName: caMemoDefaults[def.borrowerIdx].teamLeadName,
              referredBy: caMemoDefaults[def.borrowerIdx].referredBy,
              connectedPartyFlag: caMemoDefaults[def.borrowerIdx].connectedPartyFlag ?? false,
              connectedPartyStaffName: caMemoDefaults[def.borrowerIdx].connectedPartyStaffName,
              completeDocsDate: caMemoDefaults[def.borrowerIdx].completeDocsDate ? new Date(caMemoDefaults[def.borrowerIdx].completeDocsDate!) : undefined,
              lastReviewDate: caMemoDefaults[def.borrowerIdx].lastReviewDate ? new Date(caMemoDefaults[def.borrowerIdx].lastReviewDate!) : undefined,
              nextReviewDate: caMemoDefaults[def.borrowerIdx].nextReviewDate ? new Date(caMemoDefaults[def.borrowerIdx].nextReviewDate!) : undefined,
              relationshipSince: caMemoDefaults[def.borrowerIdx].relationshipSince ? new Date(caMemoDefaults[def.borrowerIdx].relationshipSince!) : undefined,
              lastSiteVisitDate: caMemoDefaults[def.borrowerIdx].lastSiteVisitDate ? new Date(caMemoDefaults[def.borrowerIdx].lastSiteVisitDate!) : undefined,
              preambleText: caMemoDefaults[def.borrowerIdx].preambleText,
              mattersToHighlight: caMemoDefaults[def.borrowerIdx].mattersToHighlight,
              transactionDetailsText: caMemoDefaults[def.borrowerIdx].transactionDetailsText,
              crossSellingInitiatives: caMemoDefaults[def.borrowerIdx].crossSellingInitiatives,
              firstWayOut: caMemoDefaults[def.borrowerIdx].firstWayOut,
              preparedAt: caMemoDefaults[def.borrowerIdx].preparedAt ? new Date(caMemoDefaults[def.borrowerIdx].preparedAt!) : undefined,
            } : {}),
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') { app = await findExisting(prisma.creditApplication, { applicationNo: appNo }); }
        else throw e;
      }

      // One facility per app — with ALL fields
      await prisma.applicationFacility.create({
        data: {
          applicationId: app.id,
          facilityType: facilityTypeMap[def.productType] || FacilityType.TERM_LOAN,
          amount: def.amount,
          tenorMonths: def.tenor || 60,
          ratePct: def.amount > 5000000 ? 4.75 : 4.25,
          purpose: def.purpose,
          approvedAmount: approvedStates.has(def.state) ? Math.round(def.amount * 0.9 * 100) / 100 : undefined,
          approvedTenor: approvedStates.has(def.state) ? (def.tenor || 60) : undefined,
          approvedRate: approvedStates.has(def.state) ? (def.amount > 5000000 ? 4.50 : 4.00) : undefined,
        },
      });

      // Application parties — borrower + guarantor for approved/post-disbursement apps
      await prisma.applicationParty.create({
        data: { applicationId: app.id, borrowerProfileId: borrower.id, role: 'borrower', liabilityPct: 100 },
      });
      if (approvedStates.has(def.state) && profiles.length > 3) {
        const guarantorIdx = def.borrowerIdx === 0 ? 3 : 0;
        await prisma.applicationParty.create({
          data: { applicationId: app.id, borrowerProfileId: profiles[guarantorIdx].id, role: 'guarantor', liabilityPct: 20 },
        });
      }
    }
    createdApps.push(app);
  }

  console.log(`  ✅ ${createdApps.length} credit applications (with facilities & parties)`);

  // ── Lean S1–S7 Demo Applications (Wave D — no bank-grade data) ──────────

  // App A: Individual borrower, RM80K personal loan, straight-through scoring, APPROVED
  const leanAppAExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-001' });
  if (!leanAppAExists && profiles.length > 3) {
    const bp = profiles[3]; // High Net Worth Individual
    const leanA = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-001',
        borrowerProfileId: bp.id,
        productType: 'TERM_LOAN' as any,
        requestedAmount: 80000,
        requestedTenor: 36,
        currency: 'MYR' as any,
        purpose: 'Personal term loan for home renovation and furniture purchase',
        state: 'APPROVED' as any,
        riskRating: 'BB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-01'),
        decisionedAt: new Date('2026-05-03'),
        firstWayOut: 'SALARY',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanA.id, facilityType: 'TERM_LOAN' as any, currency: 'MYR' as any, amount: 80000, tenorMonths: 36, ratePct: 6.5, purpose: 'Home renovation', approvedAmount: 80000, approvedTenor: 36, approvedRate: 6.5 },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanA.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'High Net Worth Individual', runDate: new Date('2026-05-01'), runById: adminId, hasHits: false, findings: 'CCRIS clean — no adverse credit history. No existing credit facilities.' },
    });
    await prisma.creditDecision.create({
      data: { applicationId: leanA.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-03'), comments: 'Straight-through approval — score 78/100, BB rating, clean bureau, adequate income coverage.' },
    });
    createdApps.push(leanA);
    console.log('  ✅ Lean App A: CA-LEAN-001 (RM80K personal loan, APPROVED)');
  }

  // App B: SME RM1.2M term loan, 2-approver chain, APPROVED with conditions
  const leanAppBExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-002' });
  if (!leanAppBExists && profiles.length > 0) {
    const bp = profiles[0]; // SME Manufacturing Sdn Bhd
    const leanB = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-002',
        borrowerProfileId: bp.id,
        productType: 'TERM_LOAN' as any,
        requestedAmount: 1200000,
        requestedTenor: 60,
        currency: 'MYR' as any,
        purpose: 'Working capital facility to support production line upgrade and raw material purchase',
        state: 'APPROVED' as any,
        riskRating: 'BBB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-05'),
        decisionedAt: new Date('2026-05-12'),
        firstWayOut: 'OPERATING_CASHFLOW',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanB.id, facilityType: 'TERM_LOAN' as any, currency: 'MYR' as any, amount: 1200000, tenorMonths: 60, ratePct: 5.5, purpose: 'Production line upgrade', approvedAmount: 1200000, approvedTenor: 60, approvedRate: 5.5 },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanB.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-05'), runById: adminId, hasHits: true, findings: 'CCRIS shows 2 existing facilities, total outstanding RM4.8M. All facilities current. No adverse findings.' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanB.id, provider: 'CTOS' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-05'), runById: adminId, hasHits: false, findings: 'CTOS clean. No litigation, no bankruptcy proceedings.' },
    });
    await prisma.creditDecision.create({
      data: { applicationId: leanB.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-08'), comments: 'Stage 1 approved. DSCR 1.72x, BBB rating.' },
    });
    await prisma.creditDecision.create({
      data: { applicationId: leanB.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_MANAGER', decisionById: analystId, decisionAt: new Date('2026-05-12'), comments: 'Stage 2 approved. Conditions: quarterly financial statements required within 30 days of quarter end.' },
    });
    await prisma.condition.create({
      data: { applicationId: leanB.id, conditionType: 'PRECEDENT' as any, description: 'Submit latest 3 months bank statements prior to first drawdown.', dueDate: new Date('2026-06-01'), isSatisfied: false, createdById: adminId },
    });
    createdApps.push(leanB);
    console.log('  ✅ Lean App B: CA-LEAN-002 (RM1.2M term loan, APPROVED, 2-stage chain)');
  }

  // App C: SME RM6M project finance, 3-approver chain, COMMITTEE_REVIEW pending
  const leanAppCExists = await findExisting(prisma.creditApplication, { applicationNo: 'CA-LEAN-003' });
  if (!leanAppCExists && profiles.length > 0) {
    const bp = profiles[0]; // SME Manufacturing Sdn Bhd
    const leanC = await prisma.creditApplication.create({
      data: {
        applicationNo: 'CA-LEAN-003',
        borrowerProfileId: bp.id,
        productType: 'PROJECT_FINANCE' as any,
        requestedAmount: 6000000,
        requestedTenor: 84,
        currency: 'MYR' as any,
        purpose: 'Greenfield factory Phase 3 — 30,000 sqft facility for precision aerospace components',
        state: 'COMMITTEE_REVIEW' as any,
        riskRating: 'BB',
        rmId: adminId,
        analystId,
        submittedAt: new Date('2026-05-10'),
        firstWayOut: 'PROJECT_REVENUE',
      },
    });
    await prisma.creditFacility.create({
      data: { applicationId: leanC.id, facilityType: 'PROJECT_FINANCE' as any, currency: 'MYR' as any, amount: 6000000, tenorMonths: 84, ratePct: 6.0, purpose: 'Greenfield factory Phase 3' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanC.id, provider: 'CCRIS_BORROWER_UPLOAD' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-10'), runById: adminId, hasHits: true, findings: 'CCRIS shows 3 existing facilities, total outstanding RM9.8M. All current. No adverse conduct.' },
    });
    await prisma.creditBureauCheck.create({
      data: { applicationId: leanC.id, provider: 'CTOS' as any, subjectName: 'SME Manufacturing Sdn Bhd', runDate: new Date('2026-05-10'), runById: adminId, hasHits: false, findings: 'CTOS clean.' },
    });
    await prisma.creditDecision.create({
      data: { applicationId: leanC.id, decisionType: 'APPROVE' as any, authorityLevel: 'CREDIT_RM', decisionById: adminId, decisionAt: new Date('2026-05-14'), comments: 'Stage 1 approved. Strong project fundamentals. Escalating to CREDIT_MANAGER for stage 2.' },
    });
    createdApps.push(leanC);
    console.log('  ✅ Lean App C: CA-LEAN-003 (RM6M project finance, COMMITTEE_REVIEW, 3-stage chain 1/3 done)');
  }

  return createdApps;
}

// ---------------------------------------------------------------------------
// 3b. Credit Documents + Document Requirements + Document Versions
// ---------------------------------------------------------------------------
async function seedDocuments(apps: any[], profiles: any[], adminId: string) {
  const docDefs = [
    { appIdx: 0, borrowerIdx: 0, classification: DocumentClass.AUDITED_FINANCIALS, fileName: 'SME_Audited_FS_2025.pdf', desc: 'Audited financial statements FY2025 for SME Manufacturing' },
    { appIdx: 0, borrowerIdx: 0, classification: DocumentClass.MEMORANDUM_ARTICLES, fileName: 'SME_M_A.pdf', desc: 'Memorandum & Articles of Association' },
    { appIdx: 3, borrowerIdx: 0, classification: DocumentClass.AUDITED_FINANCIALS, fileName: 'SME_Audited_FS_2025_PhaseII.pdf', desc: 'Audited FS FY2025 — Phase II expansion application' },
    { appIdx: 3, borrowerIdx: 0, classification: DocumentClass.BOARD_RESOLUTION, fileName: 'SME_Board_Resolution_PhaseII.pdf', desc: 'Board resolution authorising Phase II borrowing up to RM8M' },
    { appIdx: 3, borrowerIdx: 0, classification: DocumentClass.BUSINESS_PLAN, fileName: 'SME_PhaseII_Business_Plan.pdf', desc: 'Phase 2 factory expansion business plan & financial projections' },
    { appIdx: 4, borrowerIdx: 2, classification: DocumentClass.VALUATION_REPORT, fileName: 'PD_Property_Valuation_2026.pdf', desc: 'Property valuation report by Knight Frank Malaysia' },
    { appIdx: 4, borrowerIdx: 2, classification: DocumentClass.AUDITED_FINANCIALS, fileName: 'PD_Audited_FS_2025.pdf', desc: 'Audited financial statements FY2025 for Property Developer' },
    { appIdx: 4, borrowerIdx: 2, classification: DocumentClass.BOARD_RESOLUTION, fileName: 'PD_Board_Resolution_Township.pdf', desc: 'Board resolution authorising RM10M township project borrowing' },
    { appIdx: 4, borrowerIdx: 2, classification: DocumentClass.SECURITY_DOCUMENT, fileName: 'PD_Security_Document_Township.pdf', desc: 'Draft security document — first charge over PN 123456' },
    { appIdx: 5, borrowerIdx: 0, classification: DocumentClass.BOARD_RESOLUTION, fileName: 'SME_Board_Resolution_Borrowing.pdf', desc: 'Board resolution authorising borrowing up to RM3M' },
    { appIdx: 5, borrowerIdx: 0, classification: DocumentClass.AUDITED_FINANCIALS, fileName: 'SME_Audited_FS_2024.pdf', desc: 'Audited financial statements FY2024' },
    { appIdx: 8, borrowerIdx: 0, classification: DocumentClass.INSURANCE_CERT, fileName: 'SME_Insurance_Certificate_2026.pdf', desc: 'Fire & machinery insurance certificate' },
    { appIdx: 9, borrowerIdx: 2, classification: DocumentClass.SECURITY_DOCUMENT, fileName: 'PD_Charge_Document.pdf', desc: 'First charge over property — H.S.(D) 12345' },
  ];

  let docCount = 0;
  for (const dd of docDefs) {
    if (dd.appIdx >= apps.length) continue;
    const app = apps[dd.appIdx];
    const bp = profiles[dd.borrowerIdx];

    const existingDoc = await findExisting(prisma.creditDocument, { borrowerProfileId: bp.id, fileName: dd.fileName });
    if (!existingDoc) {
      const doc = await prisma.creditDocument.create({
        data: {
          applicationId: app.id,
          borrowerProfileId: bp.id,
          classification: dd.classification,
          fileName: dd.fileName,
          filePath: `/credit-docs/${dd.fileName}`,
          fileSize: Math.floor(Math.random() * 5000000) + 500000,
          mimeType: 'application/pdf',
          sha256Hash: `e3b0c44298fc1c149afb${String(docCount).padStart(24, '0')}`,
          isAvClean: dd.classification === DocumentClass.INSURANCE_CERT ? true : true,
          uploadedById: adminId,
          description: dd.desc,
        },
      });

      // Create a document version for each doc
      await prisma.creditDocumentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          filePath: doc.filePath,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          sha256Hash: doc.sha256Hash,
          changeSummary: 'Initial upload',
        },
      });

      docCount++;
    }
  }

  // Document requirements for each non-DRAFT application
  let reqCount = 0;
  const reqStates = new Set([
    ApplicationState.SUBMITTED, ApplicationState.KYC_REVIEW, ApplicationState.KYC_APPROVED,
    ApplicationState.UNDERWRITING, ApplicationState.CREDIT_ASSESSMENT, ApplicationState.COMMITTEE_REVIEW,
    ApplicationState.APPROVED, ApplicationState.OFFER, ApplicationState.ACCEPTED,
    ApplicationState.DISBURSED, ApplicationState.ACTIVE,
  ]);

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    if (!reqStates.has(app.state)) continue;

    const reqClasses = app.productType === 'TRADE_FINANCE'
      ? [DocumentClass.AUDITED_FINANCIALS, DocumentClass.BANK_STATEMENT, DocumentClass.BOARD_RESOLUTION, DocumentClass.CREDIT_BUREAU_REPORT]
      : app.productType === 'PROJECT_FINANCE'
        ? [DocumentClass.AUDITED_FINANCIALS, DocumentClass.VALUATION_REPORT, DocumentClass.BOARD_RESOLUTION, DocumentClass.SECURITY_DOCUMENT, DocumentClass.BUSINESS_PLAN]
        : [DocumentClass.AUDITED_FINANCIALS, DocumentClass.BANK_STATEMENT, DocumentClass.BOARD_RESOLUTION, DocumentClass.CREDIT_BUREAU_REPORT];

    for (let j = 0; j < reqClasses.length; j++) {
      const cls = reqClasses[j];
      const existingReq = await findExisting(prisma.documentRequirement, { applicationId: app.id, documentClass: cls });
      if (!existingReq) {
        await prisma.documentRequirement.create({
          data: {
            applicationId: app.id,
            documentClass: cls,
            label: cls.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            isMandatory: j < 2,
            isCollected: j === 0 && reqStates.has(app.state),
            sortOrder: j + 1,
          },
        });
        reqCount++;
      }
    }
  }

  console.log(`  ✅ ${docCount} credit documents (with versions), ${reqCount} document requirements`);
}

// ---------------------------------------------------------------------------
// 4. Credit Audit Events
// ---------------------------------------------------------------------------
async function seedAuditEvents(apps: any[], adminId: string) {
  const stateOrder = ['DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED'];
  const specialStates: Record<string, string[]> = {
    'REJECTED': ['DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW'],
    'WITHDRAWN': ['DRAFT', 'SUBMITTED'],
  };

  let count = 0;
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (const app of apps) {
    const currentState = app.state as string;
    let visitedStates: string[];

    if (specialStates[currentState]) {
      visitedStates = specialStates[currentState];
    } else {
      const idx = stateOrder.indexOf(currentState);
      if (idx < 0) continue;
      visitedStates = stateOrder.slice(0, idx + 1);
    }

    for (let i = 0; i < visitedStates.length; i++) {
      const newState = visitedStates[i];
      const prevState = i > 0 ? visitedStates[i - 1] : null;
      if (prevState === null && newState === 'DRAFT') continue;

      const existing = await findExisting(prisma.creditAuditEvent, { applicationId: app.id, eventType: 'STATE_CHANGE', newState });
      if (!existing) {
        const event = await prisma.creditAuditEvent.create({
          data: {
            applicationId: app.id,
            eventType: 'STATE_CHANGE',
            actorId: adminId,
            action: newState === 'REJECTED' || newState === 'KYC_REJECTED' ? 'reject'
              : newState === 'WITHDRAWN' ? 'withdraw'
              : !prevState ? 'submit'
              : prevState === 'DRAFT' ? 'submit'
              : prevState === 'KYC_REVIEW' ? 'approve'
              : prevState === 'COMMITTEE_REVIEW' ? 'approve'
              : 'advance',
            oldState: prevState,
            newState,
            metadata: { source: 'seed', transition: `${prevState || 'NEW'} → ${newState}` },
            hash: prevHash,
          },
        });
        prevHash = event.id;
        count++;
      }
    }
  }

  console.log(`  ✅ ${count} audit events`);
}

// ---------------------------------------------------------------------------
// 5. Credit Decisions
// ---------------------------------------------------------------------------
async function seedCreditDecisions(apps: any[], adminId: string) {
  const decisionDefs = [
    { stateIdx: 4, decisionType: ApprovalDecisionType.ESCALATE, authorityLevel: 'CREDIT_MANAGER', comments: 'Escalated to Credit Committee — exposure RM10M exceeds Tier 2 limit. Senior Manager recommends approval; pending final committee vote on 2026-05-15.' },
    { stateIdx: 5, decisionType: ApprovalDecisionType.APPROVE, authorityLevel: 'CREDIT_MANAGER', comments: 'Approved based on strong financials and adequate collateral coverage. DSCR at 1.85x exceeds minimum 1.25x threshold.' },
    { stateIdx: 6, decisionType: ApprovalDecisionType.REJECT, authorityLevel: 'CREDIT_RM', comments: 'DSR exceeds policy threshold at 61.2%. Insufficient income documentation provided.' },
    { stateIdx: 8, decisionType: ApprovalDecisionType.APPROVE, authorityLevel: 'CREDIT_RM', comments: 'Approved — strong repayment track record with existing facilities. All covenants met.' },
    { stateIdx: 9, decisionType: ApprovalDecisionType.APPROVE, authorityLevel: 'CREDIT_COMMITTEE', comments: 'Committee approved with conditions. Quarterly covenant monitoring required.' },
  ];

  let count = 0;
  for (const dd of decisionDefs) {
    if (dd.stateIdx >= apps.length) continue;
    const app = apps[dd.stateIdx];
    const existing = await findExisting(prisma.creditDecision, { applicationId: app.id, decisionType: dd.decisionType });
    if (!existing) {
      await prisma.creditDecision.create({
        data: {
          applicationId: app.id,
          decisionType: dd.decisionType,
          decisionById: adminId,
          decisionAt: new Date('2026-05-15'),
          authorityLevel: dd.authorityLevel,
          conditions: dd.decisionType === ApprovalDecisionType.APPROVE ? 'Quarterly review of financial statements. Maintain DSCR above 1.25x.' : null,
          comments: dd.comments,
        },
      });
      count++;
    }
  }
  console.log(`  ✅ ${count} credit decisions`);
}

// ---------------------------------------------------------------------------
// 6. Approval Matrices
// ---------------------------------------------------------------------------
async function seedApprovalMatrices(adminId: string) {
  const matrices = [
    { name: 'Tier 1 — RM Authority', description: 'Relationship Manager can approve exposures up to RM500,000 for all risk ratings', minExposure: 0, maxExposure: 500000, minRating: 'AAA', maxRating: 'D', authorityLevel: 'CREDIT_RM', requiredApproverCount: 1 },
    { name: 'Tier 2 — Senior Manager Authority', description: 'Senior Manager approval required for exposures RM500,001 to RM5,000,000', minExposure: 500001, maxExposure: 5000000, minRating: 'AAA', maxRating: 'D', authorityLevel: 'CREDIT_MANAGER', requiredApproverCount: 2 },
    { name: 'Tier 3 — Credit Committee Authority', description: 'Credit Committee approval required for exposures above RM5,000,000', minExposure: 5000001, maxExposure: 999999999, minRating: 'AAA', maxRating: 'D', authorityLevel: 'CREDIT_COMMITTEE', requiredApproverCount: 3 },
  ];

  let count = 0;
  for (const m of matrices) {
    const existing = await findExisting(prisma.creditApprovalMatrix, { name: m.name });
    if (!existing) {
      const matrix = await prisma.creditApprovalMatrix.create({
        data: {
          name: m.name,
          description: m.description,
          minExposure: m.minExposure,
          maxExposure: m.maxExposure,
          minRating: m.minRating as any,
          maxRating: m.maxRating as any,
          authorityLevel: m.authorityLevel,
          requiredApproverCount: m.requiredApproverCount,
          isActive: true,
          effectiveFrom: new Date('2026-01-01'),
        },
      });

      await prisma.creditApprovalMatrixVersion.create({
        data: {
          matrixId: matrix.id,
          version: 1,
          snapshot: { minExposure: m.minExposure, maxExposure: m.maxExposure, minRating: m.minRating, maxRating: m.maxRating, authorityLevel: m.authorityLevel, requiredApproverCount: m.requiredApproverCount },
          approvedById: adminId,
          approvedAt: new Date('2026-01-01'),
        },
      });
      count++;
    }
  }
  console.log(`  ✅ ${count} approval matrices (with versions)`);
}

// ---------------------------------------------------------------------------
// 7. Financial Statements + Line Items + Ratios
// ---------------------------------------------------------------------------
async function seedFinancials(profiles: any[], adminId: string) {
  const corporateProfiles = profiles.filter((p: any) => p.borrowerType === 'CORPORATE');
  const years = [2023, 2024, 2025];
  let stmtCount = 0;
  let lineItemCount = 0;
  let ratioCount = 0;

  for (const bp of corporateProfiles) {
    const isSME = (bp as any).creditRiskRating === 'BBB';
    const isTech = (bp as any).creditRiskRating === 'BB';
    const scale = isSME ? 1 : isTech ? 0.5 : 5;

    for (const year of years) {
      const growthFactor = 1 + (year - 2023) * 0.08;

      // --- Balance Sheet ---
      const bsLines = [
        { key: 'cashAndEquivalents', label: 'Cash and Cash Equivalents', amount: Math.round(2000000 * scale * growthFactor) },
        { key: 'accountsReceivable', label: 'Accounts Receivable', amount: Math.round(3500000 * scale * growthFactor) },
        { key: 'inventory', label: 'Inventory', amount: Math.round(2800000 * scale * growthFactor) },
        { key: 'currentAssets', label: 'Total Current Assets', amount: Math.round(8300000 * scale * growthFactor) },
        { key: 'fixedAssets', label: 'Property, Plant & Equipment', amount: Math.round(12000000 * scale * growthFactor) },
        { key: 'totalAssets', label: 'Total Assets', amount: Math.round(20300000 * scale * growthFactor) },
        { key: 'currentLiabilities', label: 'Current Liabilities', amount: Math.round(3100000 * scale * growthFactor) },
        { key: 'longTermDebt', label: 'Long-term Debt', amount: Math.round(5500000 * scale * growthFactor) },
        { key: 'totalLiabilities', label: 'Total Liabilities', amount: Math.round(8600000 * scale * growthFactor) },
        { key: 'shareholdersEquity', label: 'Shareholders Equity', amount: Math.round(11700000 * scale * growthFactor) },
        { key: 'retainedEarnings', label: 'Retained Earnings', amount: Math.round(4200000 * scale * growthFactor) },
      ];

      const bsExisting = await findExisting(prisma.financialStatement, { borrowerProfileId: bp.id, statementType: 'BS', fiscalYearEnd: new Date(`${year}-12-31`) });
      if (!bsExisting) {
        const bs = await prisma.financialStatement.create({
          data: { borrowerProfileId: bp.id, period: 'ANNUAL' as any, fiscalYearEnd: new Date(`${year}-12-31`), statementType: 'BS' as any, currency: 'MYR' as any, enteredById: adminId, status: 'REVIEWED' as any },
        });
        for (let i = 0; i < bsLines.length; i++) {
          await prisma.financialLineItem.create({ data: { statementId: bs.id, lineKey: bsLines[i].key, lineLabel: bsLines[i].label, amount: bsLines[i].amount, displayOrder: i + 1 } });
          lineItemCount++;
        }
        const ratioDefs = [
          { key: 'currentRatio', label: 'Current Ratio', value: 2.68, category: 'LIQUIDITY' as any },
          { key: 'debtToEquity', label: 'Debt-to-Equity Ratio', value: 0.73, category: 'LEVERAGE' as any },
          { key: 'dscr', label: 'Debt Service Coverage Ratio', value: 1.85, category: 'COVERAGE' as any },
          { key: 'returnOnAssets', label: 'Return on Assets', value: 0.058, category: 'PROFITABILITY' as any },
        ];
        for (const r of ratioDefs) {
          await prisma.financialRatio.create({ data: { statementId: bs.id, ratioKey: r.key, ratioLabel: r.label, value: r.value, category: r.category } });
          ratioCount++;
        }
        stmtCount++;
      }

      // --- Profit & Loss ---
      const plLines = [
        { key: 'revenue', label: 'Revenue', amount: Math.round(25000000 * scale * growthFactor) },
        { key: 'costOfGoodsSold', label: 'Cost of Goods Sold', amount: Math.round(16250000 * scale * growthFactor) },
        { key: 'grossProfit', label: 'Gross Profit', amount: Math.round(8750000 * scale * growthFactor) },
        { key: 'operatingExpenses', label: 'Operating Expenses', amount: Math.round(5000000 * scale * growthFactor) },
        { key: 'ebitda', label: 'EBITDA', amount: Math.round(3750000 * scale * growthFactor) },
        { key: 'interestExpense', label: 'Interest Expense', amount: Math.round(750000 * scale * growthFactor) },
        { key: 'netIncome', label: 'Net Income', amount: Math.round(1500000 * scale * growthFactor) },
      ];

      const plExisting = await findExisting(prisma.financialStatement, { borrowerProfileId: bp.id, statementType: 'PL', fiscalYearEnd: new Date(`${year}-12-31`) });
      if (!plExisting) {
        const pl = await prisma.financialStatement.create({
          data: { borrowerProfileId: bp.id, period: 'ANNUAL' as any, fiscalYearEnd: new Date(`${year}-12-31`), statementType: 'PL' as any, currency: 'MYR' as any, enteredById: adminId, status: 'REVIEWED' as any },
        });
        for (let i = 0; i < plLines.length; i++) {
          await prisma.financialLineItem.create({ data: { statementId: pl.id, lineKey: plLines[i].key, lineLabel: plLines[i].label, amount: plLines[i].amount, displayOrder: i + 1 } });
          lineItemCount++;
        }
        stmtCount++;
      }
    }
  }
  console.log(`  ✅ ${stmtCount} financial statements, ${lineItemCount} line items, ${ratioCount} ratios`);
}

// ---------------------------------------------------------------------------
// 8. Credit Scorecard + Version
// ---------------------------------------------------------------------------
async function seedScorecard(adminId: string) {
  let scorecard = await findExisting(prisma.creditScorecard, { name: 'Standard Credit Scoring Model v1' });
  if (!scorecard) {
    scorecard = await prisma.creditScorecard.create({
      data: { name: 'Standard Credit Scoring Model v1', description: 'Primary credit scoring model incorporating financial strength, repayment capacity, collateral coverage, management quality, and industry risk.', isActive: true },
    });
    await prisma.creditScorecardVersion.create({
      data: { scorecardId: scorecard.id, version: 1, factorWeights: { financialStrength: 0.30, repaymentCapacity: 0.25, collateralCoverage: 0.20, managementQuality: 0.15, industryRisk: 0.10 }, isActive: true, effectiveFrom: new Date('2026-01-01'), approvedById: adminId, approvedAt: new Date('2026-01-01') },
    });
    console.log('  ✅ 1 scorecard (with version)');
  } else {
    console.log('  ⏭️  Scorecard already exists');
  }
  return scorecard;
}

// ---------------------------------------------------------------------------
// 9. Credit Score Runs
// ---------------------------------------------------------------------------
async function seedScoreRuns(apps: any[], adminId: string, scorecardVersionId: string) {
  const runDefs = [
    { stateIdx: 0, totalScore: 76.00, riskRating: 'BBB', isOverride: false },
    { stateIdx: 1, totalScore: 68.50, riskRating: 'BB', isOverride: false },
    { stateIdx: 2, totalScore: 79.00, riskRating: 'A', isOverride: false },
    { stateIdx: 3, totalScore: 72.50, riskRating: 'BBB', isOverride: false },
    { stateIdx: 4, totalScore: 58.00, riskRating: 'BB', isOverride: false },
    { stateIdx: 5, totalScore: 81.25, riskRating: 'A', isOverride: false },
    { stateIdx: 6, totalScore: 38.00, riskRating: 'C', isOverride: false },
    { stateIdx: 9, totalScore: 85.00, riskRating: 'AA', isOverride: false },
    { stateIdx: 12, totalScore: 42.00, riskRating: 'BB', isOverride: true, overrideReason: 'Override approved by Senior Manager — mitigating factors include strong parent company guarantee and demonstrated repayment history on existing facilities.' },
  ];

  let count = 0;
  for (const rd of runDefs) {
    if (rd.stateIdx >= apps.length) continue;
    const app = apps[rd.stateIdx];
    const existing = await findExisting(prisma.creditScoreRun, { applicationId: app.id });
    if (!existing) {
      await prisma.creditScoreRun.create({
        data: {
          applicationId: app.id,
          scorecardVersionId,
          factorScores: { financialStrength: rd.totalScore * 0.30 / 100, repaymentCapacity: rd.totalScore * 0.25 / 100, collateralCoverage: rd.totalScore * 0.20 / 100, managementQuality: rd.totalScore * 0.15 / 100, industryRisk: rd.totalScore * 0.10 / 100 },
          totalScore: rd.totalScore,
          riskRating: rd.riskRating as any,
          isOverride: rd.isOverride,
          overrideReason: rd.isOverride ? rd.overrideReason : null,
          overrideApprovedById: rd.isOverride ? adminId : null,
          overrideApprovedAt: rd.isOverride ? new Date('2026-05-10') : null,
        },
      });
      count++;
    }
  }
  console.log(`  ✅ ${count} score runs`);
}

// ---------------------------------------------------------------------------
// 10. Committee Meetings
// ---------------------------------------------------------------------------
async function seedCommitteeMeetings(apps: any[], adminId: string, hrId: string, itId: string, bankGrade = false) {
  if (!bankGrade) {
    console.log('  ⏭ Committee meetings skipped (bank-grade mode off)');
    return;
  }
  const meetingApp = apps.length > 4 ? apps[4] : null;

  let meeting1: any = await findExisting(prisma.committeeMeeting, { title: 'Credit Committee Meeting — May 2026' });
  if (!meeting1 && meetingApp) {
    meeting1 = await prisma.committeeMeeting.create({
      data: { title: 'Credit Committee Meeting — May 2026', scheduledAt: new Date('2026-05-15T10:00:00'), location: 'Level 15 Boardroom, Citadel Tower', status: 'COMPLETED' as any, quorumMin: 3, meetingType: 'REGULAR' as any },
    });
    const member1 = await prisma.committeeMember.create({ data: { meetingId: meeting1.id, userId: adminId, role: 'CHAIR' as any, attendance: 'PRESENT' as any } });
    const member2 = await prisma.committeeMember.create({ data: { meetingId: meeting1.id, userId: hrId, role: 'MEMBER' as any, attendance: 'PRESENT' as any } });
    const member3 = await prisma.committeeMember.create({ data: { meetingId: meeting1.id, userId: itId, role: 'SECRETARY' as any, attendance: 'PRESENT' as any } });
    const agenda1 = await prisma.committeeAgendaItem.create({
      data: { meetingId: meeting1.id, applicationId: meetingApp.id, displayOrder: 1, decisionType: 'APPROVE' as any, presentedById: hrId, decisionResult: 'APPROVE' as any, decidedAt: new Date('2026-05-15T11:30:00') },
    });
    await prisma.committeeVote.create({ data: { agendaItemId: agenda1.id, memberId: member1.id, vote: 'APPROVE' as any, comments: 'Strong application with adequate collateral.' } });
    await prisma.committeeVote.create({ data: { agendaItemId: agenda1.id, memberId: member2.id, vote: 'APPROVE' as any, comments: 'Financials look solid. Recommend approval.' } });
    await prisma.committeeVote.create({ data: { agendaItemId: agenda1.id, memberId: member3.id, vote: 'APPROVE' as any, comments: 'No concerns raised. Approved.' } });
    console.log('  ✅ 1 committee meeting (completed, with members, agenda, votes)');
  }

  const existing2 = await findExisting(prisma.committeeMeeting, { title: 'Credit Committee Meeting — June 2026' });
  if (!existing2) {
    await prisma.committeeMeeting.create({
      data: { title: 'Credit Committee Meeting — June 2026', scheduledAt: new Date('2026-06-15T10:00:00'), location: 'Level 15 Boardroom, Citadel Tower', status: 'SCHEDULED' as any, quorumMin: 3, meetingType: 'REGULAR' as any },
    });
    console.log('  ✅ 1 committee meeting (scheduled)');
  }
}

// ---------------------------------------------------------------------------
// 11. Monitoring — Facility Health, Covenants, Payments, Early Warnings
// ---------------------------------------------------------------------------
async function seedMonitoring(apps: any[], adminId: string) {
  const healthDefs = [
    { stateIdx: 8, status: 'HEALTHY' as any, lastReview: '2026-04-15', nextReview: '2026-07-15', freq: 'QUARTERLY' as any, notes: 'All covenants met. Facility performing within expectations.' },
    { stateIdx: 9, status: 'WATCH' as any, lastReview: '2026-04-01', nextReview: '2026-05-01', freq: 'QUARTERLY' as any, notes: 'Slight deterioration in DSCR — now at 1.28x (threshold 1.25x). Monitoring closely.' },
    { stateIdx: 10, status: 'AT_RISK' as any, lastReview: '2026-03-15', nextReview: '2026-04-15', freq: 'QUARTERLY' as any, notes: 'Payment 30 days overdue. Borrower cited cash flow issues pending receivables collection.' },
  ];

  let healthCount = 0;
  for (const hd of healthDefs) {
    if (hd.stateIdx >= apps.length) continue;
    const app = apps[hd.stateIdx];
    const existing = await findExisting(prisma.facilityHealth, { applicationId: app.id });
    if (!existing) {
      await prisma.facilityHealth.create({
        data: { applicationId: app.id, healthStatus: hd.status, lastReviewDate: new Date(hd.lastReview), nextReviewDate: new Date(hd.nextReview), reviewFrequency: hd.freq, notes: hd.notes, updatedById: adminId },
      });
      healthCount++;
    }
  }
  console.log(`  ✅ ${healthCount} facility health records`);

  // --- Covenant Definitions ---
  const covenantDefs = [
    { desc: 'Maintain minimum Debt Service Coverage Ratio (DSCR) of 1.25x', type: 'DEBT_SERVICE_COVERAGE' as any, metricKey: 'dscr', threshold: 1.25, freq: 'QUARTERLY' as any },
    { desc: 'Maintain current ratio above 1.50x', type: 'FINANCIAL_RATIO' as any, metricKey: 'currentRatio', threshold: 1.50, freq: 'QUARTERLY' as any },
    { desc: 'Maximum loan-to-value ratio of 70%', type: 'LOAN_TO_VALUE' as any, metricKey: 'ltv', threshold: 0.70, freq: 'SEMI_ANNUALLY' as any },
    { desc: 'Maintain property insurance on all collateral assets', type: 'INSURANCE' as any, metricKey: null, threshold: null, freq: 'ANNUALLY' as any },
    { desc: 'Submit quarterly management accounts within 30 days of quarter end', type: 'REPORTING' as any, metricKey: null, threshold: null, freq: 'QUARTERLY' as any },
  ];

  const approvedApp = apps.length > 5 ? apps[5] : null;
  let covCount = 0;
  if (approvedApp) {
    for (const cd of covenantDefs) {
      const existing = await findExisting(prisma.covenantDefinition, { applicationId: approvedApp.id, description: cd.desc });
      if (!existing) {
        await prisma.covenantDefinition.create({
          data: { applicationId: approvedApp.id, description: cd.desc, covenantType: cd.type, metricKey: cd.metricKey, threshold: cd.threshold, frequency: cd.freq, isActive: true },
        });
        covCount++;
      }
    }
  }
  console.log(`  ✅ ${covCount} covenant definitions`);

  // --- Covenant Tests ---
  const covDefs2 = approvedApp ? await prisma.covenantDefinition.findMany({ where: { applicationId: approvedApp.id } }) : [];
  const testDefs = [
    { covIdx: 0, testDate: '2026-04-15', reportedValue: 1.85, isCompliant: true, notes: 'DSCR well above threshold.' },
    { covIdx: 1, testDate: '2026-04-15', reportedValue: 2.68, isCompliant: true, notes: 'Current ratio satisfactory.' },
    { covIdx: 2, testDate: '2026-04-15', reportedValue: 0.55, isCompliant: true, notes: 'LTV at 55%, below 70% threshold.' },
  ];
  let testCount = 0;
  for (const td of testDefs) {
    if (td.covIdx >= covDefs2.length) continue;
    const existing = await findExisting(prisma.covenantTest, { covenantId: covDefs2[td.covIdx].id, testDate: new Date(td.testDate) });
    if (!existing) {
      await prisma.covenantTest.create({
        data: { covenantId: covDefs2[td.covIdx].id, testDate: new Date(td.testDate), reportedValue: td.reportedValue, isCompliant: td.isCompliant, testedById: adminId, notes: td.notes },
      });
      testCount++;
    }
  }
  console.log(`  ✅ ${testCount} covenant tests`);

  // --- Payment Events ---
  const paymentDefs = [
    { stateIdx: 8, dueDate: '2026-01-15', paidDate: '2026-01-14', amount: 85000, status: 'ON_TIME' as any },
    { stateIdx: 8, dueDate: '2026-02-15', paidDate: '2026-02-15', amount: 85000, status: 'ON_TIME' as any },
    { stateIdx: 8, dueDate: '2026-03-15', paidDate: '2026-03-14', amount: 85000, status: 'ON_TIME' as any },
    { stateIdx: 8, dueDate: '2026-04-15', paidDate: '2026-04-15', amount: 85000, status: 'ON_TIME' as any },
    { stateIdx: 9, dueDate: '2026-01-15', paidDate: '2026-02-14', amount: 125000, status: 'LATE_30' as any },
    { stateIdx: 9, dueDate: '2026-02-15', paidDate: '2026-03-17', amount: 125000, status: 'LATE_30' as any },
    { stateIdx: 10, dueDate: '2026-03-01', paidDate: '2026-05-30', amount: 50000, status: 'LATE_90' as any },
  ];
  let payCount = 0;
  for (const pd of paymentDefs) {
    if (pd.stateIdx >= apps.length) continue;
    const app = apps[pd.stateIdx];
    const existing = await findExisting(prisma.paymentEvent, { applicationId: app.id, dueDate: new Date(pd.dueDate) });
    if (!existing) {
      await prisma.paymentEvent.create({
        data: { applicationId: app.id, dueDate: new Date(pd.dueDate), paidDate: pd.paidDate ? new Date(pd.paidDate) : null, amount: pd.amount, status: pd.status },
      });
      payCount++;
    }
  }
  console.log(`  ✅ ${payCount} payment events`);

  // --- Early Warning Signals ---
  const ewsDefs = [
    { stateIdx: 9, signalType: 'PAYMENT_OVERDUE' as any, severity: 'MEDIUM' as any, description: 'Borrower 30 days overdue on last 2 instalments. DSCR now at 1.10x — approaching covenant breach threshold.' },
    { stateIdx: 10, signalType: 'COVENANT_BREACH' as any, severity: 'HIGH' as any, description: 'DSCR at 0.95x — below 1.25x covenant threshold. Immediate review required per facility agreement terms.' },
  ];
  let ewsCount = 0;
  for (const ed of ewsDefs) {
    if (ed.stateIdx >= apps.length) continue;
    const app = apps[ed.stateIdx];
    const existing = await findExisting(prisma.earlyWarningSignal, { applicationId: app.id, signalType: ed.signalType });
    if (!existing) {
      await prisma.earlyWarningSignal.create({
        data: { applicationId: app.id, signalType: ed.signalType, severity: ed.severity, description: ed.description, openedAt: new Date('2026-05-01') },
      });
      ewsCount++;
    }
  }
  console.log(`  ✅ ${ewsCount} early warning signals`);
}

// ---------------------------------------------------------------------------
// 12. Collateral + Valuations + Liens + Insurance + Guarantees
// ---------------------------------------------------------------------------
async function seedCollateral(apps: any[], profiles: any[], adminId: string) {
  const collateralDefs = [
    { stateIdx: 4, type: 'PROPERTY', description: 'Township project land at Jalan Ampang, KL — leasehold 99 years (proposed first charge for committee review)', titleRef: 'PN 123456', registeredTo: 'Property Developer Sdn Bhd', marketValue: 14000000, forcedSaleValue: 9800000, valuer: 'CBRE|WTW Malaysia', insured: true, insurer: 'AIG Malaysia', policyNo: 'AIG-2026-PROP-PEND', coverage: 14000000 },
    { stateIdx: 5, type: 'PROPERTY', description: 'Industrial property at Section 15, Shah Alam — freehold land & factory', titleRef: 'HS(D) 12345/2024', registeredTo: 'SME Manufacturing Sdn Bhd', marketValue: 4500000, forcedSaleValue: 3150000, valuer: 'Knight Frank Malaysia', insured: true, insurer: 'Tokio Marine Life', policyNo: 'TM-2026-PROP-00456', coverage: 4500000 },
    { stateIdx: 8, type: 'EQUIPMENT', description: 'CNC machining centre & press equipment — S/N: CNC-2024-001', titleRef: null, registeredTo: 'SME Manufacturing Sdn Bhd', marketValue: 1200000, forcedSaleValue: 720000, valuer: 'Chartered Assets Malaysia', insured: true, insurer: 'Allianz Malaysia', policyNo: 'AZ-2026-EQP-00789', coverage: 1200000 },
    { stateIdx: 9, type: 'PROPERTY', description: 'Mixed-use development land at Jalan Ampang, KL — leasehold 99 years', titleRef: 'PN 123456', registeredTo: 'Property Developer Sdn Bhd', marketValue: 12000000, forcedSaleValue: 8400000, valuer: 'CBRE|WTW Malaysia', insured: true, insurer: 'AIG Malaysia', policyNo: 'AIG-2026-PROP-01234', coverage: 12000000 },
  ];

  let collCount = 0;
  for (let ci = 0; ci < collateralDefs.length; ci++) {
    const cd = collateralDefs[ci];
    if (cd.stateIdx >= apps.length) continue;
    const app = apps[cd.stateIdx];
    const facilities = await prisma.applicationFacility.findMany({ where: { applicationId: app.id } });
    if (facilities.length === 0) continue;
    const facilityId = facilities[0].id;

    const existing = await findExisting(prisma.collateral, { description: cd.description });
    if (!existing) {
      const collateral = await prisma.collateral.create({
        data: { facilityId, collateralType: cd.type, description: cd.description, titleReference: cd.titleRef, registeredTo: cd.registeredTo, marketValue: cd.marketValue, forcedSaleValue: cd.forcedSaleValue, valuationDate: new Date('2026-03-15'), valuer: cd.valuer, insuranceCoverRequired: cd.insured },
      });

      await prisma.collateralValuation.create({
        data: { collateralId: collateral.id, marketValue: cd.marketValue, forcedSaleValue: cd.forcedSaleValue, valuationDate: new Date('2026-03-15'), valuer: cd.valuer, reportReference: `VAL-2026-${ci + 1}` },
      });

      await prisma.collateralLien.create({
        data: { collateralId: collateral.id, lienHolder: 'Citadel Group Technologies Sdn Bhd', lienAmount: cd.marketValue * 0.9, priority: 1, registeredAt: new Date('2026-05-20') },
      });

      if (cd.insured && cd.insurer) {
        await prisma.insuranceCover.create({
          data: { collateralId: collateral.id, insurer: cd.insurer, policyNumber: cd.policyNo, coverageAmount: cd.coverage, effectiveDate: new Date('2026-01-01'), expiryDate: new Date('2027-01-01') },
        });
      }

      collCount++;
    }
  }
  console.log(`  ✅ ${collCount} collateral (with valuations, liens, insurance)`);

  // --- Guarantees ---
  const guarantorProfile = profiles.length > 3 ? profiles[3] : null;
  if (guarantorProfile && apps.length > 5) {
    const app5 = apps[5];
    const facilities5 = await prisma.applicationFacility.findMany({ where: { applicationId: app5.id } });
    if (facilities5.length > 0) {
      const existing = await findExisting(prisma.guarantee, { guarantorProfileId: guarantorProfile.id, facilityId: facilities5[0].id });
      if (!existing) {
        await prisma.guarantee.create({ data: { facilityId: facilities5[0].id, guarantorProfileId: guarantorProfile.id, guaranteeType: 'PERSONAL', amount: 600000, isLimited: true } });
        console.log('  ✅ 1 guarantee');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 13. Conditions — precedent and subsequent
// ---------------------------------------------------------------------------
async function seedConditions(apps: any[], adminId: string) {
  const conditionDefs = [
    { stateIdx: 5, type: 'PRECEDENT' as any, desc: 'Submission of signed letter of offer and acceptance', dueDate: '2026-05-20', fulfilled: true, fulfilledAt: '2026-05-19', notes: 'Signed offer letter received and verified.' },
    { stateIdx: 5, type: 'PRECEDENT' as any, desc: 'Registration of first charge over property HS(D) 12345', dueDate: '2026-05-30', fulfilled: true, fulfilledAt: '2026-05-28', notes: 'Charge registered with Land Office.' },
    { stateIdx: 5, type: 'SUBSEQUENT' as any, desc: 'Quarterly submission of management accounts within 30 days of quarter end', dueDate: '2026-06-30', fulfilled: false },
    { stateIdx: 5, type: 'SUBSEQUENT' as any, desc: 'Maintain minimum DSCR of 1.25x throughout facility tenure', dueDate: null, fulfilled: false },
    { stateIdx: 5, type: 'SUBSEQUENT' as any, desc: 'Annual property valuation by independent valuer', dueDate: '2027-03-31', fulfilled: false },
  ];

  let condCount = 0;
  for (const cd of conditionDefs) {
    if (cd.stateIdx >= apps.length) continue;
    const app = apps[cd.stateIdx];
    const existing = await findExisting(prisma.condition, { applicationId: app.id, description: cd.desc });
    if (!existing) {
      await prisma.condition.create({
        data: { applicationId: app.id, conditionType: cd.type, description: cd.desc, dueDate: cd.dueDate ? new Date(cd.dueDate) : null, isFulfilled: cd.fulfilled, fulfilledAt: cd.fulfilledAt ? new Date(cd.fulfilledAt) : null, fulfilledById: cd.fulfilled ? adminId : null, fulfilmentNotes: cd.notes || null },
      });
      condCount++;
    }
  }
  console.log(`  ✅ ${condCount} conditions`);
}

// ---------------------------------------------------------------------------
// 14. CA Memo Phases 2-5 — Full dummy data for end-to-end walkthrough
// ---------------------------------------------------------------------------
// Anchor apps: idx 0 (DRAFT/SME), idx 3 (CREDIT_ASSESSMENT/SME), idx 5 (APPROVED/SME)
// Also add lighter data for idx 1 (SUBMITTED/Tech), idx 2 (KYC_REVIEW/PD), idx 4 (COMMITTEE_REVIEW/PD)

async function seedCaMemoData(apps: any[], profiles: any[], adminId: string, hrId: string, itId: string, bankGrade = false) {
  // ── Phase 2: Request Items ──────────────────────────────────────────────
  const requestDefs = [
    { stateIdx: 0, type: CaRequestType.FACILITY_RENEWAL, approvLevel: 'CREDIT_MANAGER', rationale: 'Renewal of existing term loan facility — borrower has maintained good repayment track record for past 36 months. Recommended for renewal at BLR + 1.5%.' },
    { stateIdx: 0, type: CaRequestType.VARIATION, approvLevel: 'CREDIT_MANAGER', rationale: 'Variation to increase facility limit from RM1.5M to RM2.0M to support production line expansion (CNC machines & tooling).' },
    { stateIdx: 1, type: CaRequestType.FACILITY_RENEWAL, approvLevel: 'CREDIT_RM', rationale: 'Renewal of revolving credit facility to support daily operations and payroll expansion for growing team.' },
    { stateIdx: 2, type: CaRequestType.FACILITY_RENEWAL, approvLevel: 'CREDIT_COMMITTEE', rationale: 'Annual renewal of trade finance facility. Continued import of raw materials from China for township project Phase 1.' },
    { stateIdx: 3, type: CaRequestType.POLICY_BREACH_RATIFICATION, approvLevel: 'CREDIT_COMMITTEE', rationale: 'Policy breach — concentration ratio in semiconductor sector at 65% (policy limit 50%). Ratification requested given borrower strong cashflows and DSCR at 1.85x.' },
    { stateIdx: 3, type: CaRequestType.VARIATION, approvLevel: 'CREDIT_MANAGER', rationale: 'Variation to extend tenor from 60 to 84 months for factory expansion Phase 2.' },
    { stateIdx: 4, type: CaRequestType.FACILITY_RENEWAL, approvLevel: 'CREDIT_COMMITTEE', rationale: 'Renewal of RM10M project finance facility. Property Developer group exposure at RM30M (60% utilization).' },
    { stateIdx: 5, type: CaRequestType.FACILITY_RENEWAL, approvLevel: 'CREDIT_MANAGER', rationale: 'Renewal of approved RM3M term loan. All covenants met, DSCR at 1.85x.' },
  ];
  let riCount = 0;
  for (const rd of requestDefs) {
    if (rd.stateIdx >= apps.length) continue;
    const app = apps[rd.stateIdx];
    const existing = await findExisting(prisma.requestItem, { applicationId: app.id, requestType: rd.type });
    if (!existing) {
      await prisma.requestItem.create({
        data: { applicationId: app.id, requestType: rd.type, approvingLevel: rd.approvLevel, rationale: rd.rationale, sortOrder: riCount + 1 },
      });
      riCount++;
    }
  }
  console.log(`  ✅ ${riCount} request items`);

  // ── Phase 2: Exposure Summaries ──────────────────────────────────────────
  const exposureDefs = [
    // idx 0: DRAFT/SME — RM2M new term loan
    { stateIdx: 0, thisSec: 1800000, thisUnsec: 200000, otherSec: 3000000, otherUnsec: 1000000, cSec: 4800000, cUnsec: 1200000, rSec: 500000, rUnsec: 300000, gSec: 5300000, gUnsec: 1500000 },
    // idx 3: CREDIT_ASSESSMENT/SME — RM8M project finance
    { stateIdx: 3, thisSec: 5600000, thisUnsec: 2400000, otherSec: 3000000, otherUnsec: 1000000, cSec: 8600000, cUnsec: 3400000, rSec: 800000, rUnsec: 400000, gSec: 9400000, gUnsec: 3800000 },
    // idx 4: COMMITTEE_REVIEW/PD — RM10M project finance
    { stateIdx: 4, thisSec: 7000000, thisUnsec: 3000000, otherSec: 15000000, otherUnsec: 5000000, cSec: 22000000, cUnsec: 8000000, rSec: 2500000, rUnsec: 1200000, gSec: 24500000, gUnsec: 9200000 },
    // idx 5: APPROVED/SME — RM3M term loan
    { stateIdx: 5, thisSec: 2700000, thisUnsec: 300000, otherSec: 3000000, otherUnsec: 1000000, cSec: 5700000, cUnsec: 1300000, rSec: 500000, rUnsec: 300000, gSec: 6200000, gUnsec: 1600000 },
  ];
  let esCount = 0;
  for (const ed of exposureDefs) {
    if (ed.stateIdx >= apps.length) continue;
    const app = apps[ed.stateIdx];
    const existing = await findExisting(prisma.exposureSummary, { applicationId: app.id });
    if (!existing) {
      await prisma.exposureSummary.create({
        data: {
          applicationId: app.id,
          thisAppSecured: ed.thisSec, thisAppUnsecured: ed.thisUnsec,
          otherAppSecured: ed.otherSec, otherAppUnsecured: ed.otherUnsec,
          customerTotalSecured: ed.cSec, customerTotalUnsecured: ed.cUnsec,
          relatedCounterpartySecured: ed.rSec, relatedCounterpartyUnsecured: ed.rUnsec,
          groupTotalSecured: ed.gSec, groupTotalUnsecured: ed.gUnsec,
        },
      });
      esCount++;
    }
  }
  console.log(`  ✅ ${esCount} exposure summaries`);

  // ── Phase 3: External Ratings ── (bank-grade only: MARC/RAM not applicable to SME non-bank lender)
  if (bankGrade) {
  const ratingDefs = [
    { stateIdx: 0, subjectType: 'BORROWER', subjectName: 'SME Manufacturing Sdn Bhd', agency: 'MARC', rating: 'AA-', outlook: 'Stable', fiscalYear: 2025 },
    { stateIdx: 0, subjectType: 'BORROWER', subjectName: 'SME Manufacturing Sdn Bhd', agency: 'RAM', rating: 'AA2', outlook: 'Stable', fiscalYear: 2024 },
    { stateIdx: 2, subjectType: 'BORROWER', subjectName: 'Property Developer Sdn Bhd', agency: 'MARC', rating: 'A+', outlook: 'Positive', fiscalYear: 2025 },
    { stateIdx: 2, subjectType: 'BORROWER', subjectName: 'Property Developer Sdn Bhd', agency: 'RAM', rating: 'AA3', outlook: 'Stable', fiscalYear: 2024 },
    { stateIdx: 3, subjectType: 'BORROWER', subjectName: 'SME Manufacturing Sdn Bhd', agency: 'MARC', rating: 'AA-', outlook: 'Stable', fiscalYear: 2025 },
    { stateIdx: 4, subjectType: 'BORROWER', subjectName: 'Property Developer Sdn Bhd', agency: 'MARC', rating: 'A+', outlook: 'Positive', fiscalYear: 2025 },
    { stateIdx: 5, subjectType: 'BORROWER', subjectName: 'SME Manufacturing Sdn Bhd', agency: 'MARC', rating: 'AA-', outlook: 'Stable', fiscalYear: 2025 },
  ];
  let ratingCount = 0;
  for (const rd of ratingDefs) {
    if (rd.stateIdx >= apps.length) continue;
    const app = apps[rd.stateIdx];
    const existing = await findExisting(prisma.externalRating, { applicationId: app.id, subjectName: rd.subjectName, agency: rd.agency });
    if (!existing) {
      await prisma.externalRating.create({
        data: { applicationId: app.id, subjectType: rd.subjectType, subjectName: rd.subjectName, agency: rd.agency as any, rating: rd.rating, ratingDate: new Date(`${rd.fiscalYear}-06-30`), outlook: rd.outlook, fiscalYear: rd.fiscalYear },
      });
      ratingCount++;
    }
  }
  console.log(`  ✅ ${ratingCount} external ratings`);
  } // end bankGrade: external ratings

  // ── Phase 3: ECL Snapshots + Forecasts ── (bank-grade only: MFRS 9 not applicable)
  if (bankGrade) {
  const eclDefs = [
    { stateIdx: 0, stage: 'STAGE_1' as any, mia: 0, outstanding: 2000000, pd: 0.012, lgd: 0.25, lossRate: 0.003, ecl: 6000, writeback: null },
    { stateIdx: 1, stage: 'STAGE_1' as any, mia: 0, outstanding: 1000000, pd: 0.018, lgd: 0.30, lossRate: 0.0054, ecl: 5400, writeback: null },
    { stateIdx: 2, stage: 'STAGE_1' as any, mia: 0, outstanding: 5000000, pd: 0.008, lgd: 0.20, lossRate: 0.0016, ecl: 8000, writeback: null },
    { stateIdx: 3, stage: 'STAGE_1' as any, mia: 0, outstanding: 8000000, pd: 0.015, lgd: 0.22, lossRate: 0.0033, ecl: 26400, writeback: null },
    { stateIdx: 4, stage: 'STAGE_2' as any, mia: 2, outstanding: 10000000, pd: 0.045, lgd: 0.30, lossRate: 0.0135, ecl: 135000, writeback: null },
    { stateIdx: 5, stage: 'STAGE_1' as any, mia: 0, outstanding: 3000000, pd: 0.008, lgd: 0.18, lossRate: 0.00144, ecl: 4320, writeback: null },
  ];
  let eclCount = 0;
  for (const ed of eclDefs) {
    if (ed.stateIdx >= apps.length) continue;
    const app = apps[ed.stateIdx];
    const existing = await findExisting(prisma.eclSnapshot, { applicationId: app.id, subjectType: 'BORROWER' });
    if (!existing) {
      const snap = await prisma.eclSnapshot.create({
        data: {
          applicationId: app.id, subjectType: 'BORROWER', subjectName: app.purpose?.substring(0, 60) ?? 'Borrower',
          snapshotDate: new Date('2026-05-01'), miaCount: ed.mia,
          mfrsStage: ed.stage, totalOutstanding: ed.outstanding,
          pdPct: ed.pd, lgdPct: ed.lgd, lossRatePct: ed.lossRate,
          eclAmount: ed.ecl, potentialEclWriteback: ed.writeback,
          notes: ed.stage === 'STAGE_2' ? 'Increased PD due to sector concentration risk and property market outlook.' : 'Performing exposure — ECL at 12-month PD per MFRS 9.',
        },
      });
      eclCount++;

      // ECL forecasts (Y1, Y2, Y3) — lifetime ECL for comparison
      const basePd = Number(ed.pd);
      for (let y = 1; y <= 3; y++) {
        const pd = basePd * (1 + y * 0.3); // gradually increasing PD
        await prisma.eclForecast.create({
          data: {
            applicationId: app.id, forecastYear: y,
            mfrsStage: ed.stage, eclAmount: Math.round(ed.ecl * (1 + y * 0.15)),
            pdPct: Math.min(pd, 1).toFixed(6), lgdPct: ed.lgd,
            assumptions: `Year ${y} — assumes ${y === 1 ? 'stable' : y === 2 ? 'moderate stress' : 'severe stress'} macro conditions with ${y * 15}% ECL increase.`,
          },
        });
      }
    }
  }
  console.log(`  ✅ ${eclCount} ECL snapshots (+ Y1-Y3 forecasts each)`);
  } // end bankGrade: ECL

  // ── Phase 3: Cashflow Projections ── (bank-grade only: project finance >RM5M only)
  if (bankGrade) {
  const cfDefs = [
    { stateIdx: 0, assumptions: 'Base case assumes 8% revenue growth, stable COGS at 65% of revenue, and capex of RM500K for CNC machines. Interest expense at BLR+1.5%.' },
    { stateIdx: 3, assumptions: 'Project finance base case — 3-year construction Phase 2 ramp-up with revenue recognition from year 2. Interest during construction capitalized per MFRS 123.' },
    { stateIdx: 4, assumptions: 'Township project base case — phased revenue recognition from land sales and residential units. Working capital drawdown in year 1 with interest capitalization.' },
  ];
  let cfCount = 0;
  const lineKeys = ['revenue', 'costOfGoodsSold', 'grossProfit', 'operatingExpenses', 'ebitda', 'interestExpense', 'taxExpense', 'netIncome', 'depreciation', 'capex', 'freeCashFlow', 'debtService'];
  const lineLabels = ['Revenue', 'Cost of Goods Sold', 'Gross Profit', 'Operating Expenses', 'EBITDA', 'Interest Expense', 'Tax Expense', 'Net Income', 'Depreciation', 'Capital Expenditure', 'Free Cash Flow', 'Debt Service'];
  const baseAmounts: Record<number, number[]> = {
    0: [25000000, 16250000, 8750000, 5000000, 3750000, 750000, 562500, 1437500, 1200000, 500000, 2050000, 1500000],
    3: [80000000, 52000000, 28000000, 15000000, 13000000, 3200000, 1950000, 7850000, 4000000, 8000000, 5850000, 5000000],
    4: [120000000, 84000000, 36000000, 18000000, 18000000, 4500000, 2700000, 10800000, 6000000, 12000000, 12800000, 9000000],
  };
  const growthFactors = [1.08, 1.10, 1.12]; // Y1, Y2, Y3 growth
  for (const cd of cfDefs) {
    if (cd.stateIdx >= apps.length) continue;
    const app = apps[cd.stateIdx];
    const existing = await findExisting(prisma.cashflowProjection, { applicationId: app.id });
    if (!existing) {
      const proj = await prisma.cashflowProjection.create({
        data: { applicationId: app.id, assumptions: cd.assumptions },
      });
      const amounts = baseAmounts[cd.stateIdx] || baseAmounts[0];
      for (let y = 0; y < 3; y++) {
        const gf = growthFactors[y];
        for (let i = 0; i < lineKeys.length; i++) {
          await prisma.projectionLineItem.create({
            data: {
              projectionId: proj.id, lineKey: lineKeys[i], lineLabel: lineLabels[i],
              projectionYear: 2026 + y, amount: Math.round(amounts[i] * gf / 100) * 100,
              displayOrder: i + 1,
            },
          });
        }
      }
      cfCount++;
    }
  }
  console.log(`  ✅ ${cfCount} cashflow projections (with line items)`);
  } // end bankGrade: cashflow projections

  // ── Phase 3: Sensitivity Scenarios ── (bank-grade only: replaced by DSR stress in Wave B)
  if (bankGrade) {
  const seDefs = [
    // idx 0 — SME DRAFT
    { stateIdx: 0, scenario: ProjectionScenario.BASE, label: 'Base Case', assumptions: 'Revenue growth 8%, stable COGS, BLR+1.5%', rev: 27000000, opCf: 6500000, ebitda: 4050000, finCost: 750000, gearing: 0.73, dscr: 1.85 },
    { stateIdx: 0, scenario: ProjectionScenario.SCENARIO_1, label: 'Stress — Revenue -15%', assumptions: 'Revenue drops 15%, COGS maintained, DSCR pressure', rev: 22950000, opCf: 4500000, ebitda: 2800000, finCost: 750000, gearing: 0.85, dscr: 1.12 },
    { stateIdx: 0, scenario: ProjectionScenario.SCENARIO_2, label: 'Severe Stress — Revenue -25%', assumptions: 'Revenue drops 25%, margin compression, DSCR below threshold', rev: 20250000, opCf: 3200000, ebitda: 1800000, finCost: 750000, gearing: 0.95, dscr: 0.85 },
    // idx 3 — CREDIT_ASSESSMENT
    { stateIdx: 3, scenario: ProjectionScenario.BASE, label: 'Base Case', assumptions: 'Phase 2 revenue ramp as planned, 8% growth', rev: 86400000, opCf: 19500000, ebitda: 14000000, finCost: 3200000, gearing: 0.68, dscr: 2.10 },
    { stateIdx: 3, scenario: ProjectionScenario.SCENARIO_1, label: 'Stress — Delayed Revenue', assumptions: '6-month revenue delay, higher interest during construction', rev: 72000000, opCf: 12000000, ebitda: 8500000, finCost: 3600000, gearing: 0.78, dscr: 1.45 },
    // idx 4 — COMMITTEE_REVIEW
    { stateIdx: 4, scenario: ProjectionScenario.BASE, label: 'Base Case', assumptions: 'Township sales as projected, 10% growth', rev: 132000000, opCf: 28000000, ebitda: 20000000, finCost: 5500000, gearing: 0.72, dscr: 1.95 },
    { stateIdx: 4, scenario: ProjectionScenario.SCENARIO_1, label: 'Property Market Downturn', assumptions: 'Property market corrects 20%, delayed sales', rev: 105600000, opCf: 18000000, ebitda: 12000000, finCost: 6000000, gearing: 0.88, dscr: 1.15 },
    { stateIdx: 4, scenario: ProjectionScenario.SCENARIO_2, label: 'Severe Downturn + Rate Hike', assumptions: 'Property market -30%, BLR+100bps, liquidity crunch', rev: 92400000, opCf: 10000000, ebitda: 6000000, finCost: 7500000, gearing: 1.05, dscr: 0.72 },
  ];
  let ssCount = 0;
  for (const sd of seDefs) {
    if (sd.stateIdx >= apps.length) continue;
    const app = apps[sd.stateIdx];
    const existing = await findExisting(prisma.sensitivityScenario, { applicationId: app.id, scenario: sd.scenario });
    if (!existing) {
      await prisma.sensitivityScenario.create({
        data: {
          applicationId: app.id, scenario: sd.scenario, label: sd.label, assumptions: sd.assumptions,
          revenueAmount: sd.rev, opCashflow: sd.opCf, ebitda: sd.ebitda, financingCosts: sd.finCost,
          gearingRatio: sd.gearing, dscr: sd.dscr,
        },
      });
      ssCount++;
    }
  }
  console.log(`  ✅ ${ssCount} sensitivity scenarios`);
  } // end bankGrade: sensitivity scenarios

  // ── Phase 4: Account Profitability ── (bank-grade only: requires transfer pricing)
  if (bankGrade) {
  const profitDefs = [
    { stateIdx: 0, period: 'H1 2026', lines: [
      { cat: 'Term Loan Interest', profitYtd: 150000, profitProj: 300000, feeYtd: 25000, feeProj: 50000 },
      { cat: 'Overdraft Interest', profitYtd: 45000, profitProj: 90000, feeYtd: 10000, feeProj: 20000 },
      { cat: 'Trade Finance Fees', profitYtd: 15000, profitProj: 30000, feeYtd: 8000, feeProj: 16000 },
      { cat: 'FX Commission', profitYtd: 20000, profitProj: 40000, feeYtd: 5000, feeProj: 10000 },
      { cat: 'Deposit Spread', profitYtd: 35000, profitProj: 70000, feeYtd: 0, feeProj: 0 },
    ]},
    { stateIdx: 3, period: 'H1 2026', lines: [
      { cat: 'Project Finance Interest', profitYtd: 400000, profitProj: 800000, feeYtd: 60000, feeProj: 120000 },
      { cat: 'Term Loan Interest', profitYtd: 160000, profitProj: 320000, feeYtd: 25000, feeProj: 50000 },
      { cat: 'Cash Management Fees', profitYtd: 30000, profitProj: 60000, feeYtd: 15000, feeProj: 30000 },
    ]},
    { stateIdx: 4, period: 'H1 2026', lines: [
      { cat: 'Project Finance Interest', profitYtd: 500000, profitProj: 1000000, feeYtd: 75000, feeProj: 150000 },
      { cat: 'Term Loan Interest', profitYtd: 225000, profitProj: 450000, feeYtd: 35000, feeProj: 70000 },
      { cat: 'Trade Finance Fees', profitYtd: 50000, profitProj: 100000, feeYtd: 20000, feeProj: 40000 },
      { cat: 'FX Commission', profitYtd: 40000, profitProj: 80000, feeYtd: 10000, feeProj: 20000 },
      { cat: 'Deposit Spread', profitYtd: 60000, profitProj: 120000, feeYtd: 0, feeProj: 0 },
    ]},
    { stateIdx: 5, period: 'H1 2026', lines: [
      { cat: 'Term Loan Interest', profitYtd: 120000, profitProj: 240000, feeYtd: 20000, feeProj: 40000 },
      { cat: 'Cash Management Fees', profitYtd: 15000, profitProj: 30000, feeYtd: 8000, feeProj: 16000 },
    ]},
  ];
  let profCount = 0;
  for (const pd of profitDefs) {
    if (pd.stateIdx >= apps.length) continue;
    const app = apps[pd.stateIdx];
    const existing = await findExisting(prisma.accountProfitability, { applicationId: app.id });
    if (!existing) {
      const prof = await prisma.accountProfitability.create({
        data: { applicationId: app.id, reportingPeriod: pd.period, notes: 'Account relationship profitability for H1 2026. All figures in MYR.' },
      });
      for (let i = 0; i < pd.lines.length; i++) {
        const l = pd.lines[i];
        await prisma.profitabilityLine.create({
          data: { profitabilityId: prof.id, productCategory: l.cat, netProfitYtd: l.profitYtd, netProfitProjected: l.profitProj, feeIncomeYtd: l.feeYtd, feeIncomeProjected: l.feeProj, displayOrder: i + 1 },
        });
      }
      profCount++;
    }
  }
  console.log(`  ✅ ${profCount} account profitability records`);
  } // end bankGrade: account profitability

  // ── Phase 4: Wallet Share ── (bank-grade only: multi-product banking relationship tracking)
  if (bankGrade) {
  const walletDefs = [
    { stateIdx: 0, entries: [
      { ft: 'Term Loan', ourLimit: 2000000, totalMarket: 5000000, ourShare: 40.0, yoy: 5.0, notes: 'Primary lender for term loan facility' },
      { ft: 'Overdraft', ourLimit: 500000, totalMarket: 1000000, ourShare: 50.0, yoy: -2.0, notes: 'Competitive OD facility' },
      { ft: 'Trade Finance', ourLimit: 800000, totalMarket: 2000000, ourShare: 40.0, yoy: 10.0, notes: 'Growing trade finance business' },
    ]},
    { stateIdx: 3, entries: [
      { ft: 'Project Finance', ourLimit: 8000000, totalMarket: 20000000, ourShare: 40.0, yoy: 5.0, notes: 'Lead arranger for Phase 2' },
      { ft: 'Term Loan', ourLimit: 3000000, totalMarket: 8000000, ourShare: 37.5, yoy: 3.0, notes: 'Existing term loan relationship' },
    ]},
    { stateIdx: 4, entries: [
      { ft: 'Project Finance', ourLimit: 10000000, totalMarket: 25000000, ourShare: 40.0, yoy: 0.0, notes: 'Sole mandated lead arranger' },
      { ft: 'Term Loan', ourLimit: 6000000, totalMarket: 15000000, ourShare: 40.0, yoy: 5.0, notes: 'Strong relationship' },
      { ft: 'Trade Finance', ourLimit: 5000000, totalMarket: 12000000, ourShare: 41.7, yoy: 8.0, notes: 'Primary trade finance provider' },
    ]},
    { stateIdx: 5, entries: [
      { ft: 'Term Loan', ourLimit: 3000000, totalMarket: 6000000, ourShare: 50.0, yoy: 5.0, notes: 'Sole lender' },
      { ft: 'Cash Management', ourLimit: 200000, totalMarket: 500000, ourShare: 40.0, yoy: 10.0, notes: 'Growing share in CMS' },
    ]},
  ];
  let wsCount = 0;
  for (const wd of walletDefs) {
    if (wd.stateIdx >= apps.length) continue;
    const app = apps[wd.stateIdx];
    for (const e of wd.entries) {
      const existing = await findExisting(prisma.walletShare, { applicationId: app.id, facilityType: e.ft });
      if (!existing) {
        await prisma.walletShare.create({
          data: { applicationId: app.id, facilityType: e.ft, ourLimitAmount: e.ourLimit, totalMarketAmount: e.totalMarket, ourSharePct: e.ourShare, yoyChangePct: e.yoy, notes: e.notes },
        });
        wsCount++;
      }
    }
  }
  console.log(`  ✅ ${wsCount} wallet share entries`);
  } // end bankGrade: wallet share

  // ── Phase 4: Key Counterparties ──────────────────────────────────────────
  const cpDefs = [
    // SME Manufacturing counterparties
    { bpIdx: 0, entries: [
      { role: CounterpartyRole.SUPPLIER, name: 'SteelTech Sdn Bhd', addr: 'Lot 15, Persiaran Industri, Shah Alam', tel: '+603-5511-2233', years: 5, creditDays: 30, salesPct: 35, payment: 'Bank Transfer' },
      { role: CounterpartyRole.SUPPLIER, name: 'Precision Components Mfg', addr: 'No. 8, Jalan Perusahaan, Prai', tel: '+604-399-8877', years: 3, creditDays: 45, salesPct: 20, payment: 'LC' },
      { role: CounterpartyRole.BUYER, name: 'GlobalTech Semiconductor Sdn Bhd', addr: 'Kulim Hi-Tech Park, Kedah', tel: '+604-400-1234', years: 4, creditDays: 60, salesPct: 45, payment: 'Letter of Credit' },
      { role: CounterpartyRole.BUYER, name: 'Infineon Technologies Malaysia', addr: 'Melaka Hi-Tech Park', tel: '+606-232-5678', years: 2, creditDays: 45, salesPct: 20, payment: 'Open Account' },
      { role: CounterpartyRole.COMPETITOR, name: 'Mega Manufacturing Sdn Bhd', addr: 'Petaling Jaya, Selangor', tel: '+603-7800-9900', years: null, creditDays: null, salesPct: null, payment: 'N/A' },
    ]},
    // Property Developer counterparties
    { bpIdx: 2, entries: [
      { role: CounterpartyRole.SUPPLIER, name: 'Cement Industries Malaysia', addr: 'Bukit Raja, Klang', tel: '+603-3344-5566', years: 6, creditDays: 30, salesPct: 25, payment: 'Bank Transfer' },
      { role: CounterpartyRole.SUPPLIER, name: 'Top Builders Hardware', addr: 'Jalan Klang Lama, KL', tel: '+603-7980-1122', years: 4, creditDays: 45, salesPct: 15, payment: 'Cheque' },
      { role: CounterpartyRole.BUYER, name: 'Ministry of Housing Malaysia', addr: 'Putrajaya', tel: '+603-8888-1000', years: 8, creditDays: 90, salesPct: 40, payment: 'Government LC' },
      { role: CounterpartyRole.BUYER, name: 'Mid Valley Buyers Consortium', addr: 'Mid Valley City, KL', tel: '+603-2288-3344', years: 3, creditDays: 60, salesPct: 25, payment: 'Progressive Payment' },
    ]},
  ];
  let cpCount = 0;
  for (const cd of cpDefs) {
    if (cd.bpIdx >= profiles.length) continue;
    const bp = profiles[cd.bpIdx];
    for (let i = 0; i < cd.entries.length; i++) {
      const e = cd.entries[i];
      const existing = await findExisting(prisma.keyCounterparty, { borrowerProfileId: bp.id, name: e.name });
      if (!existing) {
        await prisma.keyCounterparty.create({
          data: { borrowerProfileId: bp.id, role: e.role, name: e.name, address: e.addr, telephone: e.tel, yearsOfRelationship: e.years, creditTermsDays: e.creditDays, salesOrPurchasePct: e.salesPct, modeOfPayment: e.payment, sortOrder: i + 1 },
        });
        cpCount++;
      }
    }
  }
  console.log(`  ✅ ${cpCount} key counterparties`);

  // ── Phase 4: Account Utilisation Snapshots ── (bank-grade only: banks monitor held accounts)
  if (bankGrade) {
  const utilDefs = [
    { stateIdx: 0, entries: [
      { acct: 'CA-SME-001', ft: 'Term Loan', month: '2026-01-01', withdrawal: 0, deposit: 85000, balance: 1800000, cheques: 0, limit: 2000000, outstanding: 1800000, overdue: 0, arrears: 0 },
      { acct: 'CA-SME-001', ft: 'Term Loan', month: '2026-02-01', withdrawal: 0, deposit: 85000, balance: 1715000, cheques: 0, limit: 2000000, outstanding: 1715000, overdue: 0, arrears: 0 },
      { acct: 'CA-SME-001', ft: 'Term Loan', month: '2026-03-01', withdrawal: 0, deposit: 85000, balance: 1630000, cheques: 0, limit: 2000000, outstanding: 1630000, overdue: 0, arrears: 0 },
      { acct: 'CA-SME-OD1', ft: 'Overdraft', month: '2026-03-01', withdrawal: 200000, deposit: 350000, balance: 150000, cheques: 0, limit: 500000, outstanding: 350000, overdue: 0, arrears: 0 },
    ]},
    { stateIdx: 5, entries: [
      { acct: 'CA-SME-TL3', ft: 'Term Loan', month: '2026-03-01', withdrawal: 0, deposit: 62500, balance: 2625000, cheques: 0, limit: 3000000, outstanding: 2625000, overdue: 0, arrears: 0 },
      { acct: 'CA-SME-TL3', ft: 'Term Loan', month: '2026-04-01', withdrawal: 0, deposit: 62500, balance: 2562500, cheques: 0, limit: 3000000, outstanding: 2562500, overdue: 0, arrears: 0 },
    ]},
  ];
  let utilCount = 0;
  for (const ud of utilDefs) {
    if (ud.stateIdx >= apps.length) continue;
    const app = apps[ud.stateIdx];
    for (const e of ud.entries) {
      const existing = await findExisting(prisma.accountUtilisationSnapshot, { applicationId: app.id, accountNo: e.acct, snapshotMonth: new Date(e.month) });
      if (!existing) {
        await prisma.accountUtilisationSnapshot.create({
          data: {
            applicationId: app.id, accountNo: e.acct, facilityType: e.ft, snapshotMonth: new Date(e.month),
            withdrawalAmount: e.withdrawal, depositAmount: e.deposit, monthEndBalance: e.balance, returnedChequesCount: e.cheques,
            approvedLimit: e.limit, outstandingAmount: e.outstanding, overdueAmount: e.overdue, instalmentsInArrears: e.arrears,
          },
        });
        utilCount++;
      }
    }
  }
  console.log(`  ✅ ${utilCount} account utilisation snapshots`);
  } // end bankGrade: account utilisation

  // ── Phase 5: Bureau Checks ───────────────────────────────────────────────
  const bureauDefs = [
    { stateIdx: 0, checks: [
      { provider: BureauProvider.CCRIS_BORROWER_UPLOAD, subject: 'SME Manufacturing Sdn Bhd', hits: true, findings: 'CCRIS shows 3 active facilities with total outstanding RM9.8M. All facilities current with no missed payments. Dues conduct satisfactory. No legal actions recorded. 2 bureau enquiries in past 12 months.' },
      { provider: BureauProvider.CTOS, subject: 'SME Manufacturing Sdn Bhd', hits: true, findings: 'CTOS report clean — no litigation, no bankruptcy proceedings, no SSM adverse filings. Company registration confirmed active since 2001. Directors PEP check negative.' },
      { provider: BureauProvider.SSM_EINFO, subject: 'SME Manufacturing Sdn Bhd', hits: true, findings: 'SSM e-Info confirms: Company registration SM-2020010, incorporated 15 Mar 2001. Paid-up capital RM5M. Last annual return filed 2025. No striking off notices.' },
    ]},
    { stateIdx: 3, checks: [
      { provider: BureauProvider.CCRIS_BORROWER_UPLOAD, subject: 'SME Manufacturing Sdn Bhd', hits: true, findings: 'CCRIS shows 5 active facilities, total outstanding RM11.8M. All current. One 30-day late payment in Mar 2025 on OD facility — subsequently regularized. No legal actions.' },
      { provider: BureauProvider.CTOS, subject: 'SME Manufacturing Sdn Bhd', hits: false, findings: 'No adverse CTOS findings. Clean litigation and bankruptcy search. Director PEP check — Ahmad bin Ali confirmed non-PEP.' },
      { provider: BureauProvider.PEP_WATCHLIST, subject: 'SME Manufacturing Sdn Bhd', hits: false, findings: 'PEP and sanctions screening clear. No matches against OFAC, EU, UN, or BNM watchlists.' },
    ]},
    { stateIdx: 4, checks: [
      { provider: BureauProvider.CCRIS_BORROWER_UPLOAD, subject: 'Property Developer Sdn Bhd', hits: true, findings: 'CCRIS shows 4 active facilities, total group exposure RM30M. Current on all facilities. 2 group companies with cross-guarantees. No Dues default.' },
      { provider: BureauProvider.CTOS, subject: 'Property Developer Sdn Bhd', hits: true, findings: 'CTOS shows 1 settled litigation (contractor dispute, 2023, settled via mediation). No bankruptcy proceedings. Director Michael Tan Wei Ming flagged as PEP — further due diligence required.' },
      { provider: BureauProvider.PEP_WATCHLIST, subject: 'Property Developer Sdn Bhd', hits: true, findings: 'Director Michael Tan Wei Ming identified as PEP (advisory board member of state-owned enterprise). Enhanced due diligence and connected party lending policy applies.' },
      { provider: BureauProvider.SSM_EINFO, subject: 'Property Developer Sdn Bhd', hits: true, findings: 'SSM confirms: Registration PD-2018007, incorporated 20 Aug 2016. Paid-up capital RM10M. Last annual return filed 2025. Auditors: PwC Malaysia.' },
    ]},
    { stateIdx: 5, checks: [
      { provider: BureauProvider.CCRIS_BORROWER_UPLOAD, subject: 'SME Manufacturing Sdn Bhd', hits: true, findings: 'Post-approval CCRIS re-check: 3 active facilities, all current. No new adverse findings. Dues conduct satisfactory throughout facility tenure.' },
      { provider: BureauProvider.CTOS, subject: 'SME Manufacturing Sdn Bhd', hits: false, findings: 'CTOS check clean. No new litigation, no bankruptcy filings since last check.' },
    ]},
  ];
  let bcCount = 0;
  for (const bd of bureauDefs) {
    if (bd.stateIdx >= apps.length) continue;
    const app = apps[bd.stateIdx];
    for (const c of bd.checks) {
      const existing = await findExisting(prisma.creditBureauCheck, { applicationId: app.id, provider: c.provider, subjectName: c.subject });
      if (!existing) {
        await prisma.creditBureauCheck.create({
          data: { applicationId: app.id, provider: c.provider, subjectName: c.subject, runDate: new Date('2026-04-28'), runById: adminId, hasHits: c.hits, findings: c.findings },
        });
        bcCount++;
      }
    }
  }
  console.log(`  ✅ ${bcCount} bureau checks`);

  // ── Phase 5: Industry Assessment ─────────────────────────────────────────
  const industryDefs = [
    { stateIdx: 0, sector: 'Manufacturing', subsector: 'Industrial Components & Precision Engineering', outlook: 'The Malaysian manufacturing sector continues to show resilience, driven by strong demand from the semiconductor and electronics supply chain. The Industrial Production Index (IPI) grew 4.8% YoY in Q1 2026. Government incentives under the National Investment Aspiration (NIA) framework support capital investment in advanced manufacturing. Key risk: concentration in semiconductor supply chain (65% of SME Manufacturing revenue) exposes borrower to cyclical demand fluctuations.', subOutlook: 'Precision engineering subsector benefiting from global supply chain diversification (China+1 strategy). Order books healthy at 6-8 months. Labour cost pressures moderate but manageable through automation investment. ESG compliance requirements increasing but borrower has invested in green manufacturing Initiatives.' },
    { stateIdx: 3, sector: 'Manufacturing', subsector: 'Industrial Components & Precision Engineering', outlook: 'Same sector outlook as CA-2026-00001. Sector remains positive with IPI growth of 4.8%. The planned CAPEX for Phase 2 expansion aligns with industry growth trajectory. Risk concentration in semiconductor sector remains the key watch item — recommended diversification into automotive and medical device segments.', subOutlook: 'Precision engineering capacity expansion via Phase 2 is well-timed. New CNC machines will increase capacity by 35% and reduce unit costs by ~15%. Break-even on CAPEX estimated at 18-24 months.' },
    { stateIdx: 4, sector: 'Real Estate', subsector: 'Property Development — Mixed-Use & Residential', outlook: 'Klang Valley property market showing mixed signals. Residential transaction volume up 8% YoY but average transaction value down 3%. Oversupply risk in high-end condominium segment (>RM1M per unit). Affordable housing segment (<RM500K) remains undersupplied. BNM OPR hold at 3.25% supports borrowing affordability. Key risk: potential OPR hike in H2 2026 could dampen demand.', subOutlook: 'Township projects with affordable housing components continue to outperform. Developer\'s ongoing township project at Jalan Ampang targets mixed-use with 60% affordable units — well-aligned with market demand. Land bank acquisition cost reasonable at RM80/psf.' },
    { stateIdx: 5, sector: 'Manufacturing', subsector: 'Industrial Components & Precision Engineering', outlook: 'Sector outlook unchanged from initial assessment — positive with IPI growth of 4.8%. Borrower has maintained strong performance metrics throughout facility tenure. Repayment track record excellent — no missed payments in 36 months.', subOutlook: 'Precision engineering subsector continuing to grow. Borrower investment in automation yielding productivity gains of 20%. Well-positioned for continued growth.' },
  ];
  let iaCount = 0;
  for (const id of industryDefs) {
    if (id.stateIdx >= apps.length) continue;
    const app = apps[id.stateIdx];
    const existing = await findExisting(prisma.industryAssessment, { applicationId: app.id });
    if (!existing) {
      await prisma.industryAssessment.create({
        data: { applicationId: app.id, sectorName: id.sector, subsectorName: id.subsector, sectorOutlook: id.outlook, subsectorOutlook: id.subOutlook },
      });
      iaCount++;
    }
  }
  console.log(`  ✅ ${iaCount} industry assessments`);

  // ── Phase 5: Risk Assessment + RMD Issues ──────────────────────────────
  const riskDefs = [
    { stateIdx: 0, risks: [
      { cat: 'PERFORMANCE' as any, desc: 'Concentration risk in semiconductor sector (65% of revenue). Top customer GlobalTech accounts for 30% of total sales.', mitigant: 'Diversification strategy in progress — automotive and medical device segments targeted to reduce concentration to 50% by FY2027. Strong order book provides near-term revenue visibility.' },
      { cat: 'PAYMENT' as any, desc: 'Cross-default clause with existing RM3M facility. Default on one facility triggers acceleration on all.', mitigant: 'Historical repayment track record excellent — 36 months with zero missed payments. DSCR at 1.85x provides adequate buffer above 1.25x covenant threshold.' },
      { cat: 'PROJECT' as any, desc: 'Capital expenditure commitment of RM2M for new CNC machines — cash flow impact during installation period.', mitigant: 'Phased drawdown schedule. Vendor offers 90-day payment terms. Projected free cash flow remains positive even under stress scenario.' },
    ]},
    { stateIdx: 3, risks: [
      { cat: 'PERFORMANCE' as any, desc: 'High concentration in semiconductor sector. Proposed RM8M facility increases total group exposure to RM11.8M.', mitigant: 'Diversification roadmap in place. New facility includes capex for automotive and medical device production lines, reducing semiconductor dependency to 40% by FY2028.' },
      { cat: 'PROJECT' as any, desc: 'Phase 2 factory expansion carries execution risk — 18-month construction timeline with potential cost overruns.', mitigant: 'Fixed-price contract with main contractor. 10% contingency budgeted. Project management team experienced with 3 prior expansions.' },
      { cat: 'PAYMENT' as any, desc: 'Proposed DSCR of 1.72x under base case — adequate but limited headroom under stress scenario (DSCR drops to 1.12x at -15% revenue).', mitigant: 'Maintain minimum DSCR covenant at 1.25x. Quarterly financial review covenants included. Step-up pricing if DSCR falls below 1.50x.' },
      { cat: 'PACKAGING' as any, desc: 'Collateral coverage at 56% (RM4.5M collateral vs RM8M facility). Insufficient security ratio.', mitigant: 'Personal guarantee from MD Ahmad bin Ali. Corporate guarantee from parent company. Collateral monitoring with annual re-valuation covenant.' },
    ]},
    { stateIdx: 4, risks: [
      { cat: 'PERFORMANCE' as any, desc: 'Property market cyclical risk. Klang Valley high-end residential oversupply — 24-month absorption period for luxury units.', mitigant: 'Project design emphasizes affordable component (60% units < RM500K). Pre-launch show of interest at 40% take-up. Phased release strategy to match market absorption.' },
      { cat: 'PAYMENT' as any, desc: 'Group total exposure at RM30M (60% utilization). Additional RM10M takes total to RM40M — exceeds single-borrower limit of RM35M for BB-rated accounts.', mitigant: 'Risk rating upgrade under review if Phase 1 township project achieves >80% take-up by Q3 2026. Enhanced monitoring covenants with quarterly reporting.' },
      { cat: 'OTHER' as any, desc: 'Director Michael Tan Wei Ming identified as PEP — connected party lending policy (CP-2023-05) applies.', mitigant: 'Connected party approval obtained per CP-2023-05. Independent credit assessment confirms no preferential treatment. Enhanced transparency and disclosure requirements in place.' },
    ]},
    { stateIdx: 5, risks: [
      { cat: 'PERFORMANCE' as any, desc: 'Moderate concentration risk in semiconductor sector, but diversification reducing dependency.', mitigant: 'Diversification into automotive and medical devices progressing. Semiconductor revenue share reduced from 65% to 55% over past 12 months.' },
      { cat: 'PAYMENT' as any, desc: 'DSCR at 1.85x — well above covenant threshold. Cross-default with existing RM3M facility.', mitigant: '36-month perfect repayment history. All covenants met. Quarterly monitoring confirms stable financial position.' },
    ]},
  ];
  let raCount = 0;
  for (const rd of riskDefs) {
    if (rd.stateIdx >= apps.length) continue;
    const app = apps[rd.stateIdx];
    for (let i = 0; i < rd.risks.length; i++) {
      const r = rd.risks[i];
      const existing = await findExisting(prisma.riskAssessment, { applicationId: app.id, riskCategory: r.cat });
      if (!existing) {
        await prisma.riskAssessment.create({
          data: { applicationId: app.id, riskCategory: r.cat, description: r.desc, mitigation: r.mitigant, sortOrder: i + 1 },
        });
        raCount++;
      }
    }
  }
  console.log(`  ✅ ${raCount} risk assessments`);

  // RMD Issues
  const rmdDefs = [
    { stateIdx: 3, issues: [
      { desc: 'Concentration risk in semiconductor sector (65%) exceeds policy threshold of 50%. Ratification recommended per CaRequestType.POLICY_BREACH_RATIFICATION.', response: 'Management has commenced diversification strategy targeting automotive and medical device segments. Projected reduction to 50% by FY2027. Recommended: approve with condition to reduce concentration below 55% within 24 months.' },
      { desc: 'Total group exposure RM11.8M exceeds single-borrower limit of RM10M for BBB-rated accounts.', response: 'Risk rating upgrade under consideration based on improving financials. Interim approval recommended with enhanced quarterly monitoring.' },
    ]},
    { stateIdx: 4, issues: [
      { desc: 'PEP director identified — connected party lending policy applies. Ensure compliance with CP-2023-05 for all approval stages.', response: 'Connected party approval process completed per CP-2023-05. Independent credit assessment confirms commercial terms are arm\'s length. No preferential treatment identified.' },
    ]},
  ];
  let rmdCount = 0;
  for (const rd of rmdDefs) {
    if (rd.stateIdx >= apps.length) continue;
    const app = apps[rd.stateIdx];
    for (let i = 0; i < rd.issues.length; i++) {
      const iss = rd.issues[i];
      const existing = await findExisting(prisma.rmdIssue, { applicationId: app.id, issueDescription: iss.desc });
      if (!existing) {
        await prisma.rmdIssue.create({
          data: { applicationId: app.id, issueDescription: iss.desc, businessUnitResponse: iss.response, sortOrder: i + 1 },
        });
        rmdCount++;
      }
    }
  }
  console.log(`  ✅ ${rmdCount} RMD issues`);

  // ── Phase 5: ESG Assessment ── (bank-grade only: BNM VBI ESG framework not applicable)
  if (bankGrade) {
  const esgDefs = [
    { stateIdx: 0, gp: EsgGuidingPrinciple.GP3, cat: EsgCategory.C2, justification: 'Manufacturing operations involve moderate environmental impact (energy consumption, waste generation). The company has invested in solar panels (200kW capacity, 15% of energy needs) and implemented ISO 14001 environmental management system. Waste recycling rate at 78%.', mitigants: 'Green manufacturing investment plan targets carbon neutrality by 2030. Solar panel ROI achieved within 4 years. EMS certification provides governance framework for continuous improvement.' },
    { stateIdx: 3, gp: EsgGuidingPrinciple.GP3, cat: EsgCategory.C2, justification: 'Factory expansion project requires enhanced environmental considerations — new CNC machines will increase energy consumption by ~25%. Company committed to renewable energy offset for expansion.', mitigants: 'Environmental impact assessment completed. Commitment to install additional 100kW solar capacity alongside expansion. Green building standards considered for Phase 2 construction.' },
    { stateIdx: 4, gp: EsgGuidingPrinciple.GP1, cat: EsgCategory.C5, justification: 'Property development has significant environmental footprint — land use change, construction emissions, traffic impact. Township project includes affordable housing which is a social good (S component). ESG governance framework requires annual sustainability reporting.', mitigants: 'Green building certifications (GreenRE) targeted for all residential towers. 30% green space allocation in township master plan. Affordable housing component (60% of units) addresses social housing needs. TCC reporting commitment for transparency.' },
    { stateIdx: 5, gp: EsgGuidingPrinciple.GP2, cat: EsgCategory.C1, justification: 'Ongoing ESG monitoring confirms satisfactory performance. Environmental investments (solar panels, ISO 14001) operational and effective. Social initiatives include local employment and apprenticeship programs.', mitigants: 'Annual ESG review cycle maintained. No material ESG incidents reported during facility tenure.' },
  ];
  let esgCount = 0;
  for (const ed of esgDefs) {
    if (ed.stateIdx >= apps.length) continue;
    const app = apps[ed.stateIdx];
    const existing = await findExisting(prisma.esgAssessment, { applicationId: app.id });
    if (!existing) {
      await prisma.esgAssessment.create({
        data: { applicationId: app.id, assignedGp: ed.gp, assignedCategory: ed.cat, justification: ed.justification, mitigatingFactors: ed.mitigants },
      });
      esgCount++;
    }
  }
  console.log(`  ✅ ${esgCount} ESG assessments`);
  } // end bankGrade: ESG

  // ── Phase 5: SICR Assessment ── (bank-grade only: MFRS 9 SICR not applicable)
  if (bankGrade) {
  const sicrDefs = [
    { stateIdx: 0, triggers: [
      { type: SicrTriggerType.OBLIGATORY_WATCHLIST, event: 'Automated CCRIS trigger — 2 consecutive months of late payment on any facility triggers watchlist review.', hit: false, classification: null, rationale: 'No CCRIS watchlist triggers detected. All facilities current. Automated monitoring will continue per standard procedure.' },
      { type: SicrTriggerType.OBJECTIVE_JUDGMENTAL, event: 'Concentration risk in semiconductor sector (>50% revenue from single sector) may warrant SICR assessment if sector downturn materializes.', hit: false, classification: null, rationale: 'SICR assessment deferred as sector outlook remains positive. Enhanced monitoring in place — quarterly review of sector concentration ratios and customer diversification metrics.' },
    ]},
    { stateIdx: 3, triggers: [
      { type: SicrTriggerType.OBLIGATORY_WATCHLIST, event: 'Concentration risk policy breach (65% semiconductor sector) — mandatory watchlist assessment.', hit: false, classification: null, rationale: 'Watchlist assessment completed. Sector concentration acknowledged but mitigated by diversification roadmap. Account remains PERFORMING with enhanced monitoring covenant.' },
      { type: SicrTriggerType.OBJECTIVE_JUDGMENTAL, event: 'Total group exposure (RM11.8M) exceeds single-borrower limit for BBB-rated accounts.', hit: false, classification: null, rationale: 'Exposure exception approved by Credit Committee with conditions. Quarterly financial review and concentration reduction targets in place.' },
    ]},
    { stateIdx: 4, triggers: [
      { type: SicrTriggerType.OBLIGATORY_WATCHLIST, event: 'PEP director identified — mandatory enhanced due diligence under BNM guidelines.', hit: true, classification: 'WATCHLIST' as any, rationale: 'Director Michael Tan Wei Ming confirmed as PEP. Connected party lending policy CP-2023-05 applies. Account placed on watch list for enhanced monitoring. Independent credit assessment confirms arm\'s length terms.' },
      { type: SicrTriggerType.SUBJECTIVE_JUDGMENTAL, event: 'Property market downturn risk — 2 consecutive quarters of declining property transaction values in Klang Valley.', hit: false, classification: null, rationale: 'Market correction risk acknowledged. Township project\'s affordable housing component provides buffer against high-end segment weakness. Monitor quarterly. No SICR trigger at this time.' },
    ]},
  ];
  let sicrCount = 0;
  for (const sd of sicrDefs) {
    if (sd.stateIdx >= apps.length) continue;
    const app = apps[sd.stateIdx];
    for (const t of sd.triggers) {
      const existing = await findExisting(prisma.sicrAssessment, { applicationId: app.id, triggerType: t.type });
      if (!existing) {
        await prisma.sicrAssessment.create({
          data: { applicationId: app.id, triggerType: t.type, triggeringEvent: t.event, hasHit: t.hit, rationale: t.rationale, resultingClassification: t.classification },
        });
        sicrCount++;
      }
    }
  }
  console.log(`  ✅ ${sicrCount} SICR assessments`);
  } // end bankGrade: SICR

  // ── Phase 5: Application Sign-offs ──────────────────────────────────────
  const signoffDefs = [
    // DRAFT — only PREPARED_BY (in progress)
    { stateIdx: 0, role: SignoffRole.PREPARED_BY, userId: adminId, designation: 'Senior Relationship Manager' },
    // CREDIT_ASSESSMENT — PREPARED_BY + REVIEWED_BY (ready for committee)
    { stateIdx: 3, role: SignoffRole.PREPARED_BY, userId: adminId, designation: 'Senior Relationship Manager' },
    { stateIdx: 3, role: SignoffRole.REVIEWED_BY, userId: hrId, designation: 'Credit Analyst' },
    // COMMITTEE_REVIEW — all three sign-offs (presented to committee)
    { stateIdx: 4, role: SignoffRole.PREPARED_BY, userId: adminId, designation: 'Senior Relationship Manager' },
    { stateIdx: 4, role: SignoffRole.REVIEWED_BY, userId: hrId, designation: 'Credit Analyst' },
    { stateIdx: 4, role: SignoffRole.CONCURRED_BY, userId: itId, designation: 'Senior Credit Manager' },
    // APPROVED — all three sign-offs (approved by committee)
    { stateIdx: 5, role: SignoffRole.PREPARED_BY, userId: adminId, designation: 'Senior Relationship Manager' },
    { stateIdx: 5, role: SignoffRole.REVIEWED_BY, userId: hrId, designation: 'Credit Analyst' },
    { stateIdx: 5, role: SignoffRole.CONCURRED_BY, userId: itId, designation: 'Senior Credit Manager' },
  ];
  let soCount = 0;
  for (const sd of signoffDefs) {
    if (sd.stateIdx >= apps.length) continue;
    const app = apps[sd.stateIdx];
    const existing = await findExisting(prisma.applicationSignoff, { applicationId: app.id, role: sd.role });
    if (!existing) {
      await prisma.applicationSignoff.create({
        data: { applicationId: app.id, role: sd.role, signedById: sd.userId, designationSnapshot: sd.designation, signedAt: new Date('2026-05-15'), ipAddress: '192.168.1.100' },
      });
      soCount++;
    }
  }
  console.log(`  ✅ ${soCount} application sign-offs`);
}

// ===========================================================================
// MAIN EXPORT
// ===========================================================================
export async function seedCreditDemo(adminId: string, analystId: string) {
  const bankGrade = process.argv.includes('--bank-grade');
  if (bankGrade) console.log('  🏦 Bank-grade mode ON — seeding ECL, Sensitivity, CommitteeMeeting, Profitability, WalletShare, Utilisation, ESG, SICR');
  console.log('\n🏦 Seeding Credit Module demo data...');

  const accounts = await seedCrmAccounts(adminId);
  const profiles = await seedBorrowerProfiles(accounts);
  await seedRelatedPartyGroups(profiles);
  const apps = await seedCreditApplications(profiles, adminId, analystId);
  await seedDocuments(apps, profiles, adminId);
  await seedAuditEvents(apps, adminId);
  await seedCreditDecisions(apps, adminId);
  await seedApprovalMatrices(adminId);
  await seedFinancials(profiles, adminId);
  const scorecard = await seedScorecard(adminId);
  const versions = await prisma.creditScorecardVersion.findMany({ where: { scorecardId: scorecard.id } });
  await seedScoreRuns(apps, adminId, versions[0]?.id || '');
  const hrUser = await findExisting(prisma.user, { email: 'hr@test.local' });
  const itUser = await findExisting(prisma.user, { email: 'it@test.local' });
  await seedCommitteeMeetings(apps, adminId, hrUser?.id || analystId, itUser?.id || analystId, bankGrade);
  await seedMonitoring(apps, adminId);
  await seedCollateral(apps, profiles, adminId);
  await seedConditions(apps, adminId);

  // Phase 2-5 CA Memo data
  await seedCaMemoData(apps, profiles, adminId, hrUser?.id || analystId, itUser?.id || analystId, bankGrade);

  console.log('🏦 Credit Module demo data seeded ✅\n');
}