import {
  PrismaClient,
  ApplicationState,
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
} from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper: check-before-create (returns existing record or null)
// ---------------------------------------------------------------------------
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
// 2. Borrower Profiles (5) with Directors, Shareholders, UBOs
// ---------------------------------------------------------------------------
async function seedBorrowerProfiles(accounts: any[]) {
  const corporateAccounts = accounts.filter((a: any) => a.accountType === 'CORPORATE');
  const individualAccounts = accounts.filter((a: any) => a.accountType === 'INDIVIDUAL');
  const profiles: any[] = [];

  // --- Corporate borrowers ---
  for (const acct of corporateAccounts) {
    let bp = await findExisting(prisma.borrowerProfile, { accountId: acct.id });
    if (!bp) {
      bp = await prisma.borrowerProfile.create({
        data: {
          borrowerType: BorrowerType.CORPORATE,
          accountId: acct.id,
          creditRiskRating: RiskRating.BBB,
          amlRiskTier: AmlRiskTier.LOW,
          exposureLimit: 10000000,
        },
      });
    }
    profiles.push(bp);

    // Directors (2-3)
    const dirNames = acct.name.includes('SME')
      ? ['Ahmad bin Ali', 'Lim Wei Chong', 'Siti binti Hassan']
      : acct.name.includes('Tech')
        ? ['Raj Kumar', 'Nurul Aisyah']
        : ['Michael Tan', 'Sarah Lee', 'Chen Wei Ming'];

    for (const dName of dirNames) {
      const existingDir = await findExisting(prisma.director, { borrowerProfileId: bp.id, name: dName });
      if (!existingDir) {
        await prisma.director.create({
          data: {
            borrowerProfileId: bp.id,
            name: dName,
            position: dName === dirNames[0] ? 'Managing Director' : 'Director',
            isExecutive: dName === dirNames[0],
            appointmentDate: new Date('2020-01-01'),
          },
        });
      }
    }

    // Shareholders (1-2)
    const shData = acct.name.includes('SME')
      ? [{ name: 'Ahmad Holdings Sdn Bhd', pct: 60 }, { name: 'Lim Capital Sdn Bhd', pct: 40 }]
      : acct.name.includes('Tech')
        ? [{ name: 'Raj Ventures Sdn Bhd', pct: 70 }, { name: 'Nurul Investments', pct: 30 }]
        : [{ name: 'Tan Properties Sdn Bhd', pct: 80 }];

    for (const sh of shData) {
      const existingSh = await findExisting(prisma.shareholder, { borrowerProfileId: bp.id, name: sh.name });
      if (!existingSh) {
        await prisma.shareholder.create({
          data: {
            borrowerProfileId: bp.id,
            name: sh.name,
            shareholdingPct: sh.pct,
            shareClass: 'Ordinary',
          },
        });
      }
    }

    // UBO (1)
    const uboName = acct.name.includes('SME') ? 'Ahmad bin Ali' : acct.name.includes('Tech') ? 'Raj Kumar' : 'Michael Tan';
    const existingUbo = await findExisting(prisma.ultimateBeneficialOwner, { borrowerProfileId: bp.id, name: uboName });
    if (!existingUbo) {
      await prisma.ultimateBeneficialOwner.create({
        data: {
          borrowerProfileId: bp.id,
          name: uboName,
          ownershipPct: acct.name.includes('Property') ? 80 : 60,
          isPep: false,
          sourceOfWealth: 'Business operations',
          countryOfResidence: 'Malaysia',
        },
      });
    }
  }

  // --- Individual borrowers (linked via CrmContact) ---
  for (const acct of individualAccounts) {
    const firstName = acct.name.includes('High') ? 'Dato' : 'Aminah';
    const lastName = acct.name.includes('High') ? 'Lee' : 'binti Yusof';
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
          amlRiskTier: AmlRiskTier.LOW,
          exposureLimit: acct.name.includes('High') ? 5000000 : 500000,
          annualIncome: acct.name.includes('High') ? 2000000 : 120000,
          netWorth: acct.name.includes('High') ? 15000000 : 500000,
          occupation: acct.name.includes('High') ? 'Investor' : 'Engineer',
          sourceOfWealth: acct.name.includes('High') ? 'Investments & Business' : 'Employment',
        },
      });
    }
    profiles.push(bp);
  }

  console.log(`  ✅ ${profiles.length} borrower profiles`);
  return profiles;
}

// ---------------------------------------------------------------------------
// 3. Credit Applications (17 across all states) + Facilities
// ---------------------------------------------------------------------------
async function seedCreditApplications(profiles: any[], adminId: string, analystId: string) {
  const appDefs: Array<{ state: ApplicationState; productType: CreditProductType; borrowerIdx: number; amount: number; purpose: string }> = [
    { state: ApplicationState.DRAFT, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 2000000, purpose: 'Working capital expansion' },
    { state: ApplicationState.SUBMITTED, productType: CreditProductType.REVOLVING_FACILITY, borrowerIdx: 1, amount: 1000000, purpose: 'Revolving credit line for operations' },
    { state: ApplicationState.KYC_REVIEW, productType: CreditProductType.TRADE_FINANCE, borrowerIdx: 2, amount: 5000000, purpose: 'Letter of credit for import' },
    { state: ApplicationState.CREDIT_ASSESSMENT, productType: CreditProductType.PROJECT_FINANCE, borrowerIdx: 0, amount: 8000000, purpose: 'Factory expansion project' },
    { state: ApplicationState.COMMITTEE_REVIEW, productType: CreditProductType.TERM_LOAN, borrowerIdx: 2, amount: 10000000, purpose: 'Property development phase 2' },
    { state: ApplicationState.APPROVED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 3000000, purpose: 'Machinery purchase' },
    { state: ApplicationState.REJECTED, productType: CreditProductType.OVERDRAFT, borrowerIdx: 3, amount: 500000, purpose: 'Personal overdraft' },
    { state: ApplicationState.WITHDRAWN, productType: CreditProductType.BRIDGING, borrowerIdx: 4, amount: 750000, purpose: 'Bridge loan' },
    { state: ApplicationState.DISBURSED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 0, amount: 5000000, purpose: 'Factory renovation' },
    { state: ApplicationState.ACTIVE, productType: CreditProductType.TERM_LOAN, borrowerIdx: 2, amount: 6000000, purpose: 'Condo development phase 1' },
    { state: ApplicationState.CLOSED, productType: CreditProductType.TRADE_FINANCE, borrowerIdx: 1, amount: 800000, purpose: 'Completed trade finance' },
    { state: ApplicationState.KYC_APPROVED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 3, amount: 3000000, purpose: 'HNWI investment loan' },
    { state: ApplicationState.UNDERWRITING, productType: CreditProductType.REVOLVING_FACILITY, borrowerIdx: 4, amount: 500000, purpose: 'Personal credit line' },
    { state: ApplicationState.OFFER, productType: CreditProductType.PROJECT_FINANCE, borrowerIdx: 2, amount: 4000000, purpose: 'Mixed development project' },
    { state: ApplicationState.ACCEPTED, productType: CreditProductType.HIRE_PURCHASE, borrowerIdx: 0, amount: 600000, purpose: 'Vehicle fleet purchase' },
    { state: ApplicationState.DRAFT, productType: CreditProductType.SYNDICATED, borrowerIdx: 2, amount: 7000000, purpose: 'Syndicated construction loan' },
    { state: ApplicationState.SUBMITTED, productType: CreditProductType.TERM_LOAN, borrowerIdx: 3, amount: 2000000, purpose: 'HNWI property loan' },
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
            requestedTenor: 60,
            currency: CurrencyCode.MYR,
            purpose: def.purpose,
            assignedRmId: adminId,
            assignedAnalystId: analystId,
            submittedAt: def.state !== ApplicationState.DRAFT ? new Date() : undefined,
            decisionedAt: (def.state === ApplicationState.APPROVED || def.state === ApplicationState.REJECTED) ? new Date() : undefined,
            closedAt: (def.state === ApplicationState.WITHDRAWN || def.state === ApplicationState.CLOSED) ? new Date() : undefined,
            rejectionReason: def.state === ApplicationState.REJECTED ? 'Insufficient income documentation' : undefined,
            withdrawalReason: def.state === ApplicationState.WITHDRAWN ? 'Borrower requested withdrawal' : undefined,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') { app = await findExisting(prisma.creditApplication, { applicationNo: appNo }); }
        else throw e;
      }

      // One facility per app
      await prisma.applicationFacility.create({
        data: {
          applicationId: app.id,
          facilityType: facilityTypeMap[def.productType] || FacilityType.TERM_LOAN,
          amount: def.amount,
          tenorMonths: 60,
          ratePct: 4.5,
          purpose: def.purpose,
          approvedAmount: approvedStates.has(def.state) ? def.amount * 0.9 : undefined,
          approvedTenor: approvedStates.has(def.state) ? 60 : undefined,
          approvedRate: approvedStates.has(def.state) ? 4.25 : undefined,
        },
      });
    }
    createdApps.push(app);
  }

  console.log(`  ✅ ${createdApps.length} credit applications`);
  return createdApps;
}

// ---------------------------------------------------------------------------
// 4. Committee Meetings (2)
// ---------------------------------------------------------------------------
async function seedCommitteeMeetings(apps: any[], userIds: string[]) {
  const [adminId, analystId, thirdUserId] = userIds;

  // Meeting 1: APPROVED (3 members, all APPROVE, finalized)
  let meeting1 = await findExisting(prisma.committeeMeeting, { title: 'Sprint 6 Credit Committee - Batch 1' });
  if (!meeting1) {
    meeting1 = await prisma.committeeMeeting.create({
      data: {
        title: 'Sprint 6 Credit Committee - Batch 1',
        scheduledAt: new Date('2026-06-15T10:00:00Z'),
        location: 'Board Room A',
        status: CommitteeMeetingStatus.COMPLETED,
        quorumMin: 3,
        meetingType: CommitteeMeetingType.REGULAR,
      },
    });

    const memberUserIds = [adminId, analystId, thirdUserId];
    const members1: any[] = [];
    for (let i = 0; i < memberUserIds.length; i++) {
      const uid = memberUserIds[i];
      const member = await prisma.committeeMember.create({
        data: {
          meetingId: meeting1.id,
          userId: uid,
          role: i === 0 ? CommitteeMemberRole.CHAIR : CommitteeMemberRole.MEMBER,
          attendance: CommitteeAttendance.PRESENT,
        },
      });
      members1.push(member);
    }

    // Agenda item for COMMITTEE_REVIEW app
    const committeeReviewApp = apps.find((a: any) => a.state === ApplicationState.COMMITTEE_REVIEW);
    if (committeeReviewApp) {
      const agendaItem1 = await prisma.committeeAgendaItem.create({
        data: {
          meetingId: meeting1.id,
          applicationId: committeeReviewApp.id,
          displayOrder: 1,
          decisionType: AgendaItemDecisionType.APPROVE,
          presentedById: analystId,
        },
      });

      // All 3 vote APPROVE
      for (const member of members1) {
        await prisma.committeeVote.create({
          data: {
            agendaItemId: agendaItem1.id,
            memberId: member.id,
            vote: CommitteeVoteChoice.APPROVE,
            comments: 'Application meets all criteria',
          },
        });
      }

      // Finalize
      await prisma.committeeAgendaItem.update({
        where: { id: agendaItem1.id },
        data: { decisionResult: AgendaItemDecisionType.APPROVE, decidedAt: new Date() },
      });
    }
  }

  // Meeting 2: DEFERRED (3 members, 2 APPROVE 1 ABSTAIN, not finalized)
  let meeting2 = await findExisting(prisma.committeeMeeting, { title: 'Sprint 6 Credit Committee - Batch 2' });
  if (!meeting2) {
    meeting2 = await prisma.committeeMeeting.create({
      data: {
        title: 'Sprint 6 Credit Committee - Batch 2',
        scheduledAt: new Date('2026-06-20T14:00:00Z'),
        location: 'Meeting Room B',
        status: CommitteeMeetingStatus.IN_PROGRESS,
        quorumMin: 3,
        meetingType: CommitteeMeetingType.REGULAR,
      },
    });

    const memberUserIds2 = [adminId, analystId, thirdUserId];
    const members2: any[] = [];
    for (let i = 0; i < memberUserIds2.length; i++) {
      const uid = memberUserIds2[i];
      const member = await prisma.committeeMember.create({
        data: {
          meetingId: meeting2.id,
          userId: uid,
          role: i === 0 ? CommitteeMemberRole.CHAIR : CommitteeMemberRole.MEMBER,
          attendance: CommitteeAttendance.PRESENT,
        },
      });
      members2.push(member);
    }

    const creditAssessmentApp = apps.find((a: any) => a.state === ApplicationState.CREDIT_ASSESSMENT);
    if (creditAssessmentApp) {
      const agendaItem2 = await prisma.committeeAgendaItem.create({
        data: {
          meetingId: meeting2.id,
          applicationId: creditAssessmentApp.id,
          displayOrder: 1,
          decisionType: AgendaItemDecisionType.APPROVE,
          presentedById: analystId,
        },
      });

      // Vote pattern: 2 APPROVE, 1 ABSTAIN
      await prisma.committeeVote.create({ data: { agendaItemId: agendaItem2.id, memberId: members2[0].id, vote: CommitteeVoteChoice.APPROVE } });
      await prisma.committeeVote.create({ data: { agendaItemId: agendaItem2.id, memberId: members2[1].id, vote: CommitteeVoteChoice.APPROVE } });
      await prisma.committeeVote.create({ data: { agendaItemId: agendaItem2.id, memberId: members2[2].id, vote: CommitteeVoteChoice.ABSTAIN, comments: 'Need more financial information' } });
      // Not finalized — no decisionResult
    }
  }

  console.log(`  ✅ 2 committee meetings`);
  return [meeting1, meeting2];
}

// ---------------------------------------------------------------------------
// 5. Financial Statements + Ratios (3 borrowers, 2-3 years each)
// ---------------------------------------------------------------------------
async function seedFinancials(profiles: any[], adminId: string) {
  const finProfiles = profiles.slice(0, 3);
  const years = [2023, 2024, 2025];

  for (const bp of finProfiles) {
    for (const year of years) {
      const baseRevenue = year === 2023 ? 20000000 : year === 2024 ? 22000000 : 25000000;
      const fyEnd = new Date(`${year}-12-31`);

      // Balance Sheet
      let bs = await findExisting(prisma.financialStatement, { borrowerProfileId: bp.id, statementType: FinancialStatementType.BS, fiscalYearEnd: fyEnd });
      if (!bs) {
        bs = await prisma.financialStatement.create({
          data: {
            borrowerProfileId: bp.id,
            period: FinancialPeriod.ANNUAL,
            fiscalYearEnd: fyEnd,
            statementType: FinancialStatementType.BS,
            currency: CurrencyCode.MYR,
            enteredById: adminId,
            status: FinancialStatus.REVIEWED,
            reviewedById: adminId,
          },
        });

        // Balance sheet line items
        const bsItems: Array<{ lineKey: string; lineLabel: string; amount: number; displayOrder: number; parentLineKey?: string }> = [
          { lineKey: 'cash', lineLabel: 'Cash & Cash Equivalents', amount: baseRevenue * 0.1, displayOrder: 1 },
          { lineKey: 'receivables', lineLabel: 'Accounts Receivable', amount: baseRevenue * 0.15, displayOrder: 2 },
          { lineKey: 'inventory', lineLabel: 'Inventories', amount: baseRevenue * 0.12, displayOrder: 3 },
          { lineKey: 'total_current_assets', lineLabel: 'Total Current Assets', amount: baseRevenue * 0.37, displayOrder: 4, parentLineKey: 'current_assets' },
          { lineKey: 'ppe', lineLabel: 'Property, Plant & Equipment', amount: baseRevenue * 0.4, displayOrder: 5 },
          { lineKey: 'total_assets', lineLabel: 'Total Assets', amount: baseRevenue * 0.77, displayOrder: 6 },
          { lineKey: 'payables', lineLabel: 'Accounts Payable', amount: baseRevenue * 0.08, displayOrder: 7 },
          { lineKey: 'short_term_debt', lineLabel: 'Short-Term Debt', amount: baseRevenue * 0.05, displayOrder: 8 },
          { lineKey: 'total_current_liabilities', lineLabel: 'Total Current Liabilities', amount: baseRevenue * 0.13, displayOrder: 9 },
          { lineKey: 'long_term_debt', lineLabel: 'Long-Term Debt', amount: baseRevenue * 0.2, displayOrder: 10 },
          { lineKey: 'total_liabilities', lineLabel: 'Total Liabilities', amount: baseRevenue * 0.33, displayOrder: 11 },
          { lineKey: 'equity', lineLabel: 'Shareholders Equity', amount: baseRevenue * 0.44, displayOrder: 12 },
        ];
        for (const item of bsItems) {
          await prisma.financialLineItem.create({
            data: {
              statementId: bs.id,
              lineKey: item.lineKey,
              lineLabel: item.lineLabel,
              amount: item.amount,
              parentLineKey: item.parentLineKey ?? null,
              displayOrder: item.displayOrder,
            },
          });
        }
      }

      // Income Statement
      let pl = await findExisting(prisma.financialStatement, { borrowerProfileId: bp.id, statementType: FinancialStatementType.PL, fiscalYearEnd: fyEnd });
      if (!pl) {
        pl = await prisma.financialStatement.create({
          data: {
            borrowerProfileId: bp.id,
            period: FinancialPeriod.ANNUAL,
            fiscalYearEnd: fyEnd,
            statementType: FinancialStatementType.PL,
            currency: CurrencyCode.MYR,
            enteredById: adminId,
            status: FinancialStatus.REVIEWED,
            reviewedById: adminId,
          },
        });

        const plItems: Array<{ lineKey: string; lineLabel: string; amount: number; displayOrder: number }> = [
          { lineKey: 'revenue', lineLabel: 'Revenue', amount: baseRevenue, displayOrder: 1 },
          { lineKey: 'cogs', lineLabel: 'Cost of Goods Sold', amount: baseRevenue * 0.6, displayOrder: 2 },
          { lineKey: 'gross_profit', lineLabel: 'Gross Profit', amount: baseRevenue * 0.4, displayOrder: 3 },
          { lineKey: 'opex', lineLabel: 'Operating Expenses', amount: baseRevenue * 0.2, displayOrder: 4 },
          { lineKey: 'ebitda', lineLabel: 'EBITDA', amount: baseRevenue * 0.2, displayOrder: 5 },
          { lineKey: 'depreciation', lineLabel: 'Depreciation & Amortisation', amount: baseRevenue * 0.03, displayOrder: 6 },
          { lineKey: 'ebit', lineLabel: 'EBIT', amount: baseRevenue * 0.17, displayOrder: 7 },
          { lineKey: 'interest_expense', lineLabel: 'Interest Expense', amount: baseRevenue * 0.04, displayOrder: 8 },
          { lineKey: 'net_income', lineLabel: 'Net Income', amount: baseRevenue * 0.1, displayOrder: 9 },
        ];
        for (const item of plItems) {
          await prisma.financialLineItem.create({
            data: {
              statementId: pl.id,
              lineKey: item.lineKey,
              lineLabel: item.lineLabel,
              amount: item.amount,
              displayOrder: item.displayOrder,
            },
          });
        }
      }

      // Financial Ratios (4 per year: DSCR, Current Ratio, Debt/Equity, ROA)
      const existingRatios = await prisma.financialRatio.findMany({ where: { statementId: bs.id } });
      if (existingRatios.length === 0) {
        const currentRatio = year === 2023 ? 2.8 : year === 2024 ? 2.5 : 3.0;
        const dscr = year === 2023 ? 1.8 : year === 2024 ? 1.9 : 2.2;
        const debtEquity = year === 2023 ? 0.75 : year === 2024 ? 0.65 : 0.55;
        const roa = year === 2023 ? 0.13 : year === 2024 ? 0.11 : 0.14;

        const ratios: Array<{ ratioKey: string; ratioLabel: string; value: number; category: RatioCategory }> = [
          { ratioKey: 'dscr', ratioLabel: 'Debt Service Coverage Ratio', value: dscr, category: RatioCategory.COVERAGE },
          { ratioKey: 'current_ratio', ratioLabel: 'Current Ratio', value: currentRatio, category: RatioCategory.LIQUIDITY },
          { ratioKey: 'debt_to_equity', ratioLabel: 'Debt/Equity Ratio', value: debtEquity, category: RatioCategory.LEVERAGE },
          { ratioKey: 'roa', ratioLabel: 'Return on Assets', value: roa, category: RatioCategory.PROFITABILITY },
        ];
        for (const r of ratios) {
          await prisma.financialRatio.create({
            data: {
              statementId: bs.id,
              ratioKey: r.ratioKey,
              ratioLabel: r.ratioLabel,
              value: r.value,
              category: r.category,
            },
          });
        }
      }
    }
  }
  console.log(`  ✅ Financial statements + ratios for 3 borrowers`);
}

// ---------------------------------------------------------------------------
// 6. Scorecard + 5 Score Runs (1 with override)
// ---------------------------------------------------------------------------
async function seedScorecard(apps: any[], adminId: string) {
  let scorecard = await findExisting(prisma.creditScorecard, { name: 'CWC Credit Scorecard v1' });
  if (!scorecard) {
    scorecard = await prisma.creditScorecard.create({
      data: { name: 'CWC Credit Scorecard v1', description: 'Standard credit scoring model for CWC lending', isActive: true },
    });
  }

  let version = await findExisting(prisma.creditScorecardVersion, { scorecardId: scorecard.id, version: 1 });
  if (!version) {
    version = await prisma.creditScorecardVersion.create({
      data: {
        scorecardId: scorecard.id,
        version: 1,
        factorWeights: {
          factors: [
            { key: 'financial_strength', label: 'Financial Strength', weight: 30 },
            { key: 'management_quality', label: 'Management Quality', weight: 20 },
            { key: 'collateral_adequacy', label: 'Collateral Adequacy', weight: 20 },
            { key: 'industry_outlook', label: 'Industry Outlook', weight: 15 },
            { key: 'repayment_track_record', label: 'Repayment Track Record', weight: 15 },
          ],
        },
        isActive: true,
        effectiveFrom: new Date('2026-01-01'),
        approvedById: adminId,
        approvedAt: new Date('2026-01-01'),
      },
    });
  }

  // 5 score runs across different apps
  const targetStates: Set<string> = new Set([
    ApplicationState.CREDIT_ASSESSMENT, ApplicationState.COMMITTEE_REVIEW,
    ApplicationState.APPROVED, ApplicationState.DISBURSED, ApplicationState.ACTIVE,
  ]);
  const appsForScoring = apps.filter((a: any) => targetStates.has(a.state)).slice(0, 5);

  let runCount = 0;
  for (const app of appsForScoring) {
    const existingRun = await findExisting(prisma.creditScoreRun, { applicationId: app.id, scorecardVersionId: version.id });
    if (!existingRun) {
      const isOverride = runCount === 4; // 5th run has override
      const baseScore = 65 + runCount * 5;
      const totalScore = isOverride ? baseScore + 15 : baseScore;
      const riskRating = totalScore >= 80 ? RiskRating.A : totalScore >= 60 ? RiskRating.BBB : RiskRating.BB;

      await prisma.creditScoreRun.create({
        data: {
          applicationId: app.id,
          scorecardVersionId: version.id,
          factorScores: {
            financial_strength: 70 + runCount,
            management_quality: 65 + runCount,
            collateral_adequacy: 60 + runCount * 2,
            industry_outlook: 55 + runCount,
            repayment_track_record: 50 + runCount * 3,
          },
          totalScore,
          riskRating,
          isOverride,
          overrideReason: isOverride ? 'Strong parental guarantee overrides weak financials' : undefined,
          overrideApprovedById: isOverride ? adminId : undefined,
          overrideApprovedAt: isOverride ? new Date() : undefined,
        },
      });
      runCount++;
    }
  }
  console.log(`  ✅ 1 scorecard, 5 score runs (1 override)`);
}

// ---------------------------------------------------------------------------
// 7. Monitoring data (3 applications)
// ---------------------------------------------------------------------------
async function seedMonitoring(apps: any[], adminId: string) {
  const monitoredAppStates: Set<string> = new Set([
    ApplicationState.DISBURSED, ApplicationState.ACTIVE, ApplicationState.CLOSED,
  ]);
  const monitoredApps = apps.filter((a: any) => monitoredAppStates.has(a.state));

  // FacilityHealth
  for (const app of monitoredApps) {
    const existingHealth = await findExisting(prisma.facilityHealth, { applicationId: app.id });
    if (!existingHealth) {
      await prisma.facilityHealth.create({
        data: {
          applicationId: app.id,
          healthStatus: app.state === ApplicationState.ACTIVE ? HealthStatus.WATCH : HealthStatus.HEALTHY,
          lastReviewDate: new Date('2026-05-01'),
          nextReviewDate: new Date('2026-08-01'),
          reviewFrequency: CovenantFrequency.QUARTERLY,
          notes: app.state === ApplicationState.ACTIVE ? 'Covenant test pending — watch status' : 'Performing within expectations',
          updatedById: adminId,
        },
      });
    }
  }

  // 5 Covenant Definitions (on the first monitored app)
  const covenantApp = monitoredApps[0];
  if (covenantApp) {
    const covenantDefs: Array<{ desc: string; covenantType: CovenantType; metricKey: string; threshold: number; freq: CovenantFrequency }> = [
      { desc: 'Minimum DSCR of 1.25x', covenantType: CovenantType.DEBT_SERVICE_COVERAGE, metricKey: 'dscr', threshold: 1.25, freq: CovenantFrequency.QUARTERLY },
      { desc: 'Maximum LTV of 70%', covenantType: CovenantType.LOAN_TO_VALUE, metricKey: 'ltv', threshold: 70, freq: CovenantFrequency.QUARTERLY },
      { desc: 'Minimum Current Ratio of 1.5x', covenantType: CovenantType.FINANCIAL_RATIO, metricKey: 'current_ratio', threshold: 1.5, freq: CovenantFrequency.QUARTERLY },
      { desc: 'Minimum Tangible Net Worth RM 5M', covenantType: CovenantType.FINANCIAL_RATIO, metricKey: 'tangible_net_worth', threshold: 5000000, freq: CovenantFrequency.SEMI_ANNUALLY },
      { desc: 'Maximum Debt/Equity of 1.5x', covenantType: CovenantType.FINANCIAL_RATIO, metricKey: 'debt_to_equity', threshold: 1.5, freq: CovenantFrequency.QUARTERLY },
    ];

    for (const cd of covenantDefs) {
      const existing = await findExisting(prisma.covenantDefinition, { applicationId: covenantApp.id, description: cd.desc });
      if (!existing) {
        await prisma.covenantDefinition.create({
          data: {
            applicationId: covenantApp.id,
            description: cd.desc,
            covenantType: cd.covenantType,
            metricKey: cd.metricKey,
            threshold: cd.threshold,
            frequency: cd.freq,
          },
        });
      }
    }

    // 3 Covenant Tests (on covenants of the first app)
    const covenants = await prisma.covenantDefinition.findMany({ where: { applicationId: covenantApp.id }, take: 3 });
    const testData: Array<{ idx: number; reportedValue: number; isCompliant: boolean }> = [
      { idx: 0, reportedValue: 2.1, isCompliant: true },
      { idx: 1, reportedValue: 65, isCompliant: true },
      { idx: 2, reportedValue: 1.2, isCompliant: false }, // non-compliant
    ];
    for (const td of testData) {
      if (covenants[td.idx]) {
        const existingTest = await findExisting(prisma.covenantTest, { covenantId: covenants[td.idx].id, testDate: new Date('2026-03-31') });
        if (!existingTest) {
          await prisma.covenantTest.create({
            data: {
              covenantId: covenants[td.idx].id,
              testDate: new Date('2026-03-31'),
              reportedValue: td.reportedValue,
              isCompliant: td.isCompliant,
              testedById: adminId,
              notes: td.isCompliant ? 'Within threshold' : 'Breach — below minimum threshold',
            },
          });
        }
      }
    }
  }

  // 4 Payment Events (2 ON_TIME, 1 LATE_30, 1 LATE_90) on first 2 monitored apps
  for (let i = 0; i < Math.min(2, monitoredApps.length); i++) {
    const app = monitoredApps[i];
    const payments: Array<{ dueDate: Date; paidDate: Date; amount: number; status: PaymentStatus }> = [
      { dueDate: new Date('2026-01-15'), paidDate: new Date('2026-01-15'), amount: 50000, status: PaymentStatus.ON_TIME },
      { dueDate: new Date('2026-02-15'), paidDate: new Date('2026-02-15'), amount: 50000, status: PaymentStatus.ON_TIME },
      { dueDate: new Date('2026-03-15'), paidDate: new Date('2026-04-10'), amount: 50000, status: PaymentStatus.LATE_30 },
    ];
    if (i === 0) {
      payments.push({ dueDate: new Date('2026-04-15'), paidDate: new Date('2026-07-20'), amount: 50000, status: PaymentStatus.LATE_90 });
    }
    for (const p of payments) {
      const existingPayment = await findExisting(prisma.paymentEvent, { applicationId: app.id, dueDate: p.dueDate, amount: p.amount });
      if (!existingPayment) {
        await prisma.paymentEvent.create({
          data: {
            applicationId: app.id,
            dueDate: p.dueDate,
            paidDate: p.paidDate,
            amount: p.amount,
            status: p.status,
          },
        });
      }
    }
  }

  // 2 Early Warning Signals (1 open, 1 resolved)
  const firstMonitored = monitoredApps[0];
  const secondMonitored = monitoredApps[1];
  if (firstMonitored) {
    const existingSignal1 = await findExisting(prisma.earlyWarningSignal, { applicationId: firstMonitored.id, signalType: SignalType.COVENANT_BREACH, severity: EarlyWarningSeverity.HIGH });
    if (!existingSignal1) {
      await prisma.earlyWarningSignal.create({
        data: {
          applicationId: firstMonitored.id,
          signalType: SignalType.COVENANT_BREACH,
          severity: EarlyWarningSeverity.HIGH,
          description: 'Current ratio covenant breach detected — value fell below 1.5x threshold',
          openedAt: new Date('2026-04-01'),
          resolvedById: adminId,
          closedAt: new Date('2026-04-15'),
        },
      });
    }
  }
  if (secondMonitored) {
    const existingSignal2 = await findExisting(prisma.earlyWarningSignal, { applicationId: secondMonitored.id, signalType: SignalType.PAYMENT_OVERDUE, severity: EarlyWarningSeverity.MEDIUM });
    if (!existingSignal2) {
      await prisma.earlyWarningSignal.create({
        data: {
          applicationId: secondMonitored.id,
          signalType: SignalType.PAYMENT_OVERDUE,
          severity: EarlyWarningSeverity.MEDIUM,
          description: 'Payment overdue by 30+ days — monitoring escalated',
          openedAt: new Date('2026-05-10'),
        },
      });
    }
  }

  console.log(`  ✅ Monitoring data (health, covenants, payments, signals)`);
}

// ---------------------------------------------------------------------------
// 8. Collaterals (3) with valuations, lien, insurance, guarantee
// ---------------------------------------------------------------------------
async function seedCollaterals(apps: any[], profiles: any[]) {
  const collateralAppStates: Set<string> = new Set([
    ApplicationState.APPROVED, ApplicationState.DISBURSED, ApplicationState.ACTIVE,
  ]);
  const collateralApps = apps.filter((a: any) => collateralAppStates.has(a.state)).slice(0, 3);

  for (let cIdx = 0; cIdx < collateralApps.length; cIdx++) {
    const app = collateralApps[cIdx];
    const facility = await prisma.applicationFacility.findFirst({ where: { applicationId: app.id } });
    if (!facility) continue;

    const collDesc = `Commercial property — ${app.purpose || 'credit facility'}`;
    let collateral = await findExisting(prisma.collateral, { facilityId: facility.id, description: collDesc });
    if (!collateral) {
      collateral = await prisma.collateral.create({
        data: {
          facilityId: facility.id,
          collateralType: 'REAL_ESTATE',
          description: collDesc,
          titleReference: `H.S.(D) ${Math.floor(Math.random() * 99999)}`,
          registeredTo: 'CWC Bank Berhad',
          marketValue: app.requestedAmount || 5000000,
          forcedSaleValue: (app.requestedAmount || 5000000) * 0.7,
          valuationDate: new Date('2026-03-01'),
          valuer: 'Jones Lang Wootton',
          insuranceCoverRequired: true,
        },
      });

      // 2 valuations
      const existingValuations = await prisma.collateralValuation.findMany({ where: { collateralId: collateral.id } });
      if (existingValuations.length === 0) {
        await prisma.collateralValuation.create({
          data: { collateralId: collateral.id, marketValue: collateral.marketValue || 5000000, forcedSaleValue: collateral.forcedSaleValue || 3500000, valuationDate: new Date('2026-01-15'), valuer: 'Jones Lang Wootton', reportReference: 'JLW-2026-001' },
        });
        await prisma.collateralValuation.create({
          data: { collateralId: collateral.id, marketValue: collateral.marketValue || 5000000, forcedSaleValue: collateral.forcedSaleValue || 3500000, valuationDate: new Date('2026-03-01'), valuer: 'Knight Frank Malaysia', reportReference: 'KF-2026-042' },
        });
      }

      // 1 lien (first collateral only)
      if (cIdx === 0) {
        const existingLien = await findExisting(prisma.collateralLien, { collateralId: collateral.id });
        if (!existingLien) {
          await prisma.collateralLien.create({
            data: {
              collateralId: collateral.id,
              lienHolder: 'CWC Bank Berhad',
              lienAmount: app.requestedAmount || 5000000,
              priority: 1,
              registeredAt: new Date('2026-03-15'),
            },
          });
        }
      }

      // 1 insurance cover (first collateral only)
      if (cIdx === 0) {
        const existingInsurance = await findExisting(prisma.insuranceCover, { collateralId: collateral.id });
        if (!existingInsurance) {
          await prisma.insuranceCover.create({
            data: {
              collateralId: collateral.id,
              insurer: 'Allianz General Insurance',
              policyNumber: 'AGI-FIRE-2026-88901',
              coverageAmount: collateral.marketValue || 5000000,
              effectiveDate: new Date('2026-03-15'),
              expiryDate: new Date('2027-03-14'),
            },
          });
        }
      }

      // 1 guarantee (link guarantor profile to facility)
      if (cIdx === 0 && profiles.length > 1) {
        const guarantorProfile = profiles.find((p: any) => p.borrowerType === BorrowerType.INDIVIDUAL);
        if (guarantorProfile) {
          const existingGuarantee = await findExisting(prisma.guarantee, { facilityId: facility.id, guarantorProfileId: guarantorProfile.id });
          if (!existingGuarantee) {
            await prisma.guarantee.create({
              data: {
                facilityId: facility.id,
                guarantorProfileId: guarantorProfile.id,
                guaranteeType: 'PERSONAL',
                amount: app.requestedAmount || 5000000,
                isLimited: true,
              },
            });
          }
        }
      }
    }
  }
  console.log(`  ✅ 3 collaterals with valuations, lien, insurance, guarantee`);
}

// ---------------------------------------------------------------------------
// 9. Credit Conditions (5: 3 PRECEDENT, 2 SUBSEQUENT, 2 completed, 1 waived)
// ---------------------------------------------------------------------------
async function seedConditions(apps: any[], adminId: string) {
  const condApp = apps.find((a: any) => a.state === ApplicationState.APPROVED || a.state === ApplicationState.ACCEPTED);
  if (!condApp) {
    console.log('  ⚠️  No suitable app found for conditions');
    return;
  }

  const conditions: Array<{ conditionType: ConditionType; description: string; dueDate: Date; isFulfilled: boolean; fulfilledAt?: Date; fulfilledById?: string; fulfilmentNotes?: string }> = [
    { conditionType: ConditionType.PRECEDENT, description: 'Submit audited financial statements for FY2025', dueDate: new Date('2026-07-01'), isFulfilled: true, fulfilledAt: new Date('2026-06-15'), fulfilledById: adminId, fulfilmentNotes: 'Received from auditor' },
    { conditionType: ConditionType.PRECEDENT, description: 'Provide signed board resolution authorising borrowing', dueDate: new Date('2026-06-30'), isFulfilled: true, fulfilledAt: new Date('2026-06-10'), fulfilledById: adminId, fulfilmentNotes: 'Board resolution received' },
    { conditionType: ConditionType.PRECEDENT, description: 'Submit updated business plan', dueDate: new Date('2026-08-01'), isFulfilled: false },
    { conditionType: ConditionType.SUBSEQUENT, description: 'Submit quarterly financial statements within 45 days of quarter end', dueDate: new Date('2026-09-15'), isFulfilled: false },
    { conditionType: ConditionType.SUBSEQUENT, description: 'Maintain insurance coverage on collateral assets', dueDate: new Date('2027-03-14'), isFulfilled: false, fulfilmentNotes: 'Waived — existing coverage from parent company' },
  ];

  for (const c of conditions) {
    const existing = await findExisting(prisma.condition, { applicationId: condApp.id, description: c.description });
    if (!existing) {
      // The 5th condition is "waived"
      const isWaived = c.description.includes('Waived');
      await prisma.condition.create({
        data: {
          applicationId: condApp.id,
          conditionType: c.conditionType,
          description: c.description,
          dueDate: c.dueDate,
          isFulfilled: c.isFulfilled || isWaived,
          fulfilledAt: isWaived ? new Date() : (c.fulfilledAt ?? undefined),
          fulfilledById: isWaived ? adminId : (c.fulfilledById ?? undefined),
          fulfilmentNotes: isWaived ? 'Waived — existing coverage from parent company' : (c.fulfilmentNotes ?? undefined),
        },
      });
    }
  }
  console.log(`  ✅ 5 conditions (3 CP, 2 CS, 2 completed, 1 waived)`);
}

// ===========================================================================
// Main seed function
// ===========================================================================
export async function seedCreditDemo() {
  console.log('🌱 Seeding Credit Demo data for Sprint 6...');

  // Find admin user to use as owner
  const admin = await prisma.user.findFirst({ where: { email: 'admin@test.local' } });
  if (!admin) {
    throw new Error('Admin user (admin@test.local) not found. Run the main seed first.');
  }

  // Find other users for committee
  const analyst = await prisma.user.findFirst({ where: { email: { not: 'admin@test.local' } } });
  const thirdUsers = await prisma.user.findMany({ where: { email: { notIn: ['admin@test.local', analyst?.email || ''] } }, take: 1 });
  const analystId = analyst?.id || admin.id;
  const thirdUserId = thirdUsers[0]?.id || admin.id;

  // 1. CRM Accounts
  const accounts = await seedCrmAccounts(admin.id);

  // 2. Borrower Profiles
  const profiles = await seedBorrowerProfiles(accounts);

  // 3. Credit Applications
  const apps = await seedCreditApplications(profiles, admin.id, analystId);

  // 4. Committee Meetings
  await seedCommitteeMeetings(apps, [admin.id, analystId, thirdUserId]);

  // 5. Financial Statements + Ratios
  await seedFinancials(profiles, admin.id);

  // 6. Scorecard + Score Runs
  await seedScorecard(apps, admin.id);

  // 7. Monitoring Data
  await seedMonitoring(apps, admin.id);

  // 8. Collaterals
  await seedCollaterals(apps, profiles);

  // 9. Conditions
  await seedConditions(apps, admin.id);

  // Summary
  const borrowerCount = await prisma.borrowerProfile.count();
  const appCount = await prisma.creditApplication.count();
  const meetingCount = await prisma.committeeMeeting.count();
  const scoreRunCount = await prisma.creditScoreRun.count();
  const covenantCount = await prisma.covenantDefinition.count();

  console.log(`✅ Credit demo data seeded: ${borrowerCount} borrowers, ${appCount} applications, ${meetingCount} meetings, ${scoreRunCount} score runs, ${covenantCount} covenants`);

  await prisma.$disconnect();
}

// Allow direct execution
seedCreditDemo().catch((e) => {
  console.error('❌ Credit demo seed failed:', e);
  process.exit(1);
});