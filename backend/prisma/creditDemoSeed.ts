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
  CommitteeMeetingType,
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
  }>> = {
    0: { applicationType: ApplicationType.NEW, accountClassification: AccountClassification.PERFORMING, accountStrategy: AccountStrategy.GROW, customerGroupName: 'SME Group', cifNo: 'CIF-SME-001', originatingDepartment: 'Corporate Banking', teamLeadName: 'Farah binti Ismail', completeDocsDate: '2026-04-15', lastReviewDate: '2026-03-20', nextReviewDate: '2026-09-20', relationshipSince: '2018-06-01', lastSiteVisitDate: '2026-04-28', preambleText: 'SME Manufacturing Sdn Bhd is a well-established manufacturer of industrial components based in Shah Alam, Selangor. The company has been banking with us since 2018 and maintains a strong payment record. This application is for a new term loan to finance expansion of their production line to meet growing demand from semiconductor sector clients.', mattersToHighlight: 'Key matter: Concentration risk in semiconductor sector (65% revenue). Cross-default clause with existing RM3M facility. Collateral valuation pending renewal — current valuation dated Mar 2025.', transactionDetailsText: 'New term loan of RM2,000,000 for a 5-year tenor to finance the purchase and installation of 4 new CNC machines and related tooling. Proposed interest rate BLR + 1.5% (4.25% p.a.). Repayment via monthly installments.' },
    1: { applicationType: ApplicationType.ADDITIONAL, accountClassification: AccountClassification.PERFORMING, cifNo: 'CIF-TECH-001', originatingDepartment: 'Corporate Banking', preambleText: 'Tech Startup Sdn Bhd is a rapidly growing technology services company in Cyberjaya. Established in 2021, they have shown strong revenue growth and require additional working capital to support expansion.', transactionDetailsText: 'Additional revolving credit facility of RM1,000,000 to support daily operations and payroll for 50+ staff.' },
    2: { applicationType: ApplicationType.RENEWAL, accountClassification: AccountClassification.PERFORMING, accountStrategy: AccountStrategy.MAINTAIN, customerGroupName: 'Property Group', cifNo: 'CIF-PD-001', originatingDepartment: 'Corporate Banking', teamLeadName: 'Rizal bin Ahmad', completeDocsDate: '2026-04-20', lastReviewDate: '2025-12-15', nextReviewDate: '2026-12-15', relationshipSince: '2016-08-20', lastSiteVisitDate: '2026-03-10', preambleText: 'Property Developer Sdn Bhd is a major property developer with an established track record spanning 8 years. The group has successfully completed multiple mixed-use and residential projects across the Klang Valley.', mattersToHighlight: 'Exposure to property market cyclical risk. Existing group exposure at RM30M (60% utilization). Pending BNM approval for increased land bank financing.', transactionDetailsText: 'Renewal of trade finance facility of RM5,000,000 for a 12-month tenor to support LC issuance for raw material imports from China for the ongoing township project.' },
    3: { applicationType: ApplicationType.NEW, accountClassification: AccountClassification.EARLY_CARE, accountStrategy: AccountStrategy.GROW, cifNo: 'CIF-HNWI-001', originatingDepartment: 'Priority Banking', teamLeadName: 'Dato Lee @ Dato Lee', connectedPartyFlag: true, connectedPartyStaffName: 'Lee Mei Ling (Director, Priority Banking)', completeDocsDate: '2026-04-10', relationshipSince: '2020-01-15', preambleText: 'High Net Worth Individual seeking investment loan. Connected party — spouse of a Priority Banking director. All compliance and conflict-of-interest protocols have been observed.', mattersToHighlight: 'Connected party flag — spouse is a director in Priority Banking division. Approval must follow the Connected Party Lending Policy (CP-2023-05).', transactionDetailsText: 'New term loan of RM3,000,000 for 3 years to diversify investment portfolio into mixed-asset holdings.' },
    4: { applicationType: ApplicationType.ADDITIONAL, accountClassification: AccountClassification.PERFORMING, cifNo: 'CIF-RB-001', originatingDepartment: 'Retail Banking', preambleText: 'Retail borrower maintaining good conduct on existing facilities. Seeking additional credit line for home renovation.', transactionDetailsText: 'Revolving credit facility of RM500,000 for 24 months for home renovation and improvement works.' },
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

  const approvedStates: Set<string> = new Set([
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
  return createdApps;
}

// ---------------------------------------------------------------------------
// 3b. Credit Documents + Document Requirements + Document Versions
// ---------------------------------------------------------------------------
async function seedDocuments(apps: any[], profiles: any[], adminId: string) {
  const docDefs = [
    { appIdx: 0, borrowerIdx: 0, classification: DocumentClass.AUDITED_FINANCIALS, fileName: 'SME_Audited_FS_2025.pdf', desc: 'Audited financial statements FY2025 for SME Manufacturing' },
    { appIdx: 0, borrowerIdx: 0, classification: DocumentClass.MEMORANDUM_ARTICLES, fileName: 'SME_M_A.pdf', desc: 'Memorandum & Articles of Association' },
    { appIdx: 4, borrowerIdx: 2, classification: DocumentClass.VALUATION_REPORT, fileName: 'PD_Property_Valuation_2026.pdf', desc: 'Property valuation report by Knight Frank Malaysia' },
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
            action: !prevState ? 'submit' : prevState === 'DRAFT' ? 'submit' : prevState === 'KYC_REVIEW' ? 'approve' : prevState === 'COMMITTEE_REVIEW' ? 'approve' : 'advance',
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
    { stateIdx: 3, totalScore: 72.50, riskRating: 'BBB', isOverride: false },
    { stateIdx: 4, totalScore: 58.00, riskRating: 'BB', isOverride: false },
    { stateIdx: 5, totalScore: 81.25, riskRating: 'A', isOverride: false },
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
async function seedCommitteeMeetings(apps: any[], adminId: string, hrId: string, itId: string) {
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

// ===========================================================================
// MAIN EXPORT
// ===========================================================================
export async function seedCreditDemo(adminId: string, analystId: string) {
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
  await seedCommitteeMeetings(apps, adminId, hrUser?.id || analystId, itUser?.id || analystId);
  await seedMonitoring(apps, adminId);
  await seedCollateral(apps, profiles, adminId);
  await seedConditions(apps, adminId);

  console.log('🏦 Credit Module demo data seeded ✅\n');
}