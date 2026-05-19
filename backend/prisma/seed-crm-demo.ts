/**
 * CRM Demo Seed — creates sample CRM data owned by emily.chow@citadelgroup.com.my
 * for experiencing the AI features (briefing, lead scoring, win probability, KYC).
 *
 * ⚡ RUN:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo.ts
 * 🗑️ REMOVE:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo-remove.ts
 *
 * All records are tagged with source="PARTNER" and notes mentioning "[DEMO]"
 * so they can be identified and cleaned up easily.
 */
import { PrismaClient, LeadStatus, LeadSource, CrmActivityType } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_OWNER_EMAIL = 'emily.chow@citadelgroup.com.my';
const DEMO_TAG = '[DEMO]';

// ─── Malaysian trust & estate planning companies (Citadel's actual market) ───

const ACCOUNTS = [
  {
    name: `${DEMO_TAG} Tan & Partners Trust Advisory`,
    industry: 'Trust Services',
    companySize: '11-50',
    website: 'https://tanpartners.example.my',
    phone: '+60 3-2780 1100',
    email: 'enquiry@tanpartners.example.my',
    address: 'Level 18, Menara AMDB, Jalan Yap Kwan Seng',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50088',
    registrationNumber: '202001012345',
    taxNumber: 'C25-202001012345',
    bankAccount: 'MBB-3221-0088-9012',
    description: 'Mid-size trust advisory firm specializing in family trusts and estate planning for HNW individuals',
    annualRevenue: 25000000,
    accountType: 'CORPORATE',
    purchaseCashTrust: true,
  },
  {
    name: `${DEMO_TAG} Mahani Wealth Management`,
    industry: 'Financial Services',
    companySize: '51-200',
    website: 'https://mahaniwealth.example.my',
    phone: '+60 3-2690 5500',
    email: 'info@mahaniwealth.example.my',
    address: 'Tower B, Level 22, PJ 8, Jalan Barat',
    city: 'Petaling Jaya',
    state: 'Selangor',
    country: 'Malaysia',
    postalCode: '46050',
    registrationNumber: '201801018876',
    taxNumber: 'C25-201801018876',
    bankAccount: 'CIMB-8002-7799-0055',
    description: 'Wealth management firm offering unit trusts, will writing, and Shariah-compliant estate planning',
    annualRevenue: 80000000,
    accountType: 'CORPORATE',
    purchaseCashTrust: false,
  },
  {
    name: `${DEMO_TAG} Kwok Family Office`,
    industry: 'Family Office',
    companySize: '1-10',
    website: 'https://kwokfamily.example.my',
    phone: '+60 12-888 3200',
    email: 'office@kwokfamily.example.my',
    address: '8, Jalan Damansara Endah, Bukit Damansara',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50490',
    registrationNumber: '202201010099',
    taxNumber: 'IG-202201010099',
    bankAccount: 'HLB-3014-5567-0023',
    description: 'Single family office managing portfolio of RM150M+ across property, equities, and private equity',
    annualRevenue: 5000000,
    accountType: 'INDIVIDUAL',
    purchaseCashTrust: true,
  },
  {
    name: `${DEMO_TAG} Syed Corporation Bhd`,
    industry: 'Conglomerate',
    companySize: '501-1000',
    website: 'https://syedcorp.example.my',
    phone: '+60 4-229 9900',
    email: 'corporate@syedcorp.example.my',
    address: 'Level 30, Komtar Tower, Jalan Penang',
    city: 'George Town',
    state: 'Pulau Pinang',
    country: 'Malaysia',
    postalCode: '10000',
    registrationNumber: '199501010077',
    taxNumber: 'C25-199501010077',
    bankAccount: 'RHB-4400-1122-8899',
    description: 'Diversified conglomerate with interests in property, hospitality, and manufacturing',
    annualRevenue: 350000000,
    accountType: 'CORPORATE',
    purchaseCashTrust: false,
  },
  {
    name: `${DEMO_TAG} Azman & Lee Advocates`,
    industry: 'Legal',
    companySize: '11-50',
    website: 'https://azmanlee.example.my',
    phone: '+60 3-2070 4400',
    email: 'law@azmanlee.example.my',
    address: 'Suite 1205, Menara OCBC, Jalan Tun Perak',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50050',
    registrationNumber: '201001010233',
    taxNumber: 'C25-201001010233',
    bankAccount: 'PBB-3321-0045-7788',
    description: 'Boutique law firm specializing in probate, wills, and trust administration',
    annualRevenue: 12000000,
    accountType: 'CORPORATE',
    purchaseCashTrust: false,
  },
];

const CONTACTS: Record<string, Array<{
  firstName: string; lastName: string; jobTitle: string;
  email: string; phone: string; isPrimary: boolean;
  nricPassport?: string; preferredLanguage?: string;
  mobile?: string; department?: string; description?: string;
  riskProfile?: string; marketingOptIn?: boolean;
}>> = {
  [`${DEMO_TAG} Tan & Partners Trust Advisory`]: [
    { firstName: 'Datin', lastName: 'Seri Rosnah', jobTitle: 'Managing Director', email: 'rosnah@tanpartners.example.my', phone: '+60 12-330 1001', isPrimary: true, nricPassport: '750101-01-5123', preferredLanguage: 'ms', mobile: '+60 12-330 1001', department: 'Management', description: 'Primary decision maker for all trust advisory engagements. PEP — requires enhanced due diligence.', riskProfile: 'HIGH', marketingOptIn: true },
    { firstName: 'Rajesh', lastName: 'Menon', jobTitle: 'Senior Trust Consultant', email: 'rajesh@tanpartners.example.my', phone: '+60 16-778 2200', isPrimary: false, preferredLanguage: 'en', mobile: '+60 16-778 2201', department: 'Trust Advisory', description: 'Handles trust restructuring and tax optimization projects', riskProfile: 'MEDIUM', marketingOptIn: false },
  ],
  [`${DEMO_TAG} Mahani Wealth Management`]: [
    { firstName: 'Nurul', lastName: 'Ain Binti Abdullah', jobTitle: 'Head of Private Wealth', email: 'nurul.ain@mahaniwealth.example.my', phone: '+60 13-889 5501', isPrimary: true, nricPassport: '850515-14-5567', preferredLanguage: 'ms', mobile: '+60 13-889 5502', department: 'Private Wealth', description: 'Leads the private wealth division, manages HNW client relationships', riskProfile: 'MEDIUM', marketingOptIn: true },
    { firstName: 'Jonathan', lastName: 'Teh', jobTitle: 'Relationship Manager', email: 'jonathan.t@mahaniwealth.example.my', phone: '+60 17-224 3300', isPrimary: false, preferredLanguage: 'en', mobile: '+60 17-224 3301', department: 'Client Relations', description: 'Day-to-day relationship manager for 50+ wealth management clients', riskProfile: 'LOW', marketingOptIn: true },
  ],
  [`${DEMO_TAG} Kwok Family Office`]: [
    { firstName: 'Kwok', lastName: 'Wei Ming', jobTitle: 'Patriarch / Trust Settlor', email: 'weiming@kwokfamily.example.my', phone: '+60 12-555 9900', isPrimary: true, nricPassport: '620830-10-5543', preferredLanguage: 'en', mobile: '+60 12-555 9901', department: 'Board', description: 'Settlor of the Kwok family trust. Net worth RM150M+. Key decision maker.', riskProfile: 'HIGH', marketingOptIn: false },
    { firstName: 'Kwok', lastName: 'Mei Ling', jobTitle: 'Trustee Designate', email: 'meiling@kwokfamily.example.my', phone: '+60 12-555 9902', isPrimary: false, preferredLanguage: 'en', mobile: '+60 12-555 9903', department: 'Family Office', description: 'Designated trustee for digital asset trust. Holds MBA from INSEAD.', riskProfile: 'MEDIUM', marketingOptIn: false },
  ],
  [`${DEMO_TAG} Syed Corporation Bhd`]: [
    { firstName: 'Datuk', lastName: 'Syed Hamid', jobTitle: 'Group CEO', email: 'syed.hamid@syedcorp.example.my', phone: '+60 4-229 9901', isPrimary: true, nricPassport: '680712-07-5234', preferredLanguage: 'ms', mobile: '+60 12-888 1100', department: 'C-Suite', description: 'PEP — Group CEO of diversified conglomerate. Personal net worth estimated RM200M+', riskProfile: 'HIGH', marketingOptIn: false },
    { firstName: 'Farah', lastName: 'Alzahra', jobTitle: 'Group Legal Counsel', email: 'farah@syedcorp.example.my', phone: '+60 4-229 9902', isPrimary: false, preferredLanguage: 'en', mobile: '+60 16-997 4421', department: 'Legal', description: 'Handles all corporate legal matters including shareholder succession', riskProfile: 'LOW', marketingOptIn: true },
  ],
  [`${DEMO_TAG} Azman & Lee Advocates`]: [
    { firstName: 'Azman', lastName: 'Bin Ishak', jobTitle: 'Senior Partner', email: 'azman@azmanlee.example.my', phone: '+60 3-2070 4401', isPrimary: true, nricPassport: '700406-10-5667', preferredLanguage: 'ms', mobile: '+60 12-345 6677', department: 'Probate & Trust', description: '30+ years in probate law. Referral partner for trust administration matters.', riskProfile: 'LOW', marketingOptIn: true },
    { firstName: 'Lee', lastName: 'Siew Eng', jobTitle: 'Probate Specialist', email: 'sieweng@azmanlee.example.my', phone: '+60 3-2070 4402', isPrimary: false, nricPassport: '780922-14-5521', preferredLanguage: 'en', mobile: '+60 16-890 2233', department: 'Probate & Trust', description: 'Specializes in cross-border probate and Islamic wills (wasiyyah)', riskProfile: 'LOW', marketingOptIn: true },
  ],
};

// Leads with realistic trust/estate planning titles
const LEADS = [
  { title: `${DEMO_TAG} Family Trust Setup — Kwok Family Office`, status: 'QUALIFIED', source: 'REFERRAL', estimatedValue: 450000, companyName: 'Kwok Family Office', contactName: 'Kwok Wei Ming', contactEmail: 'weiming@kwokfamily.example.my', description: 'Multi-generational trust structure for RM150M+ family portfolio — referred by existing Azman & Lee client' },
  { title: `${DEMO_TAG} Shariah-Compliant Will Writing — Syed Corp`, status: 'CONTACTED', source: 'LINKEDIN', estimatedValue: 180000, companyName: 'Syed Corporation Bhd', contactName: 'Datuk Syed Hamid', contactEmail: 'syed.hamid@syedcorp.example.my', description: 'Group-wide Islamic will writing and wasiyyah for board directors and C-suite' },
  { title: `${DEMO_TAG} Estate Planning Review — Mahani Wealth`, status: 'QUALIFIED', source: 'WEBSITE', estimatedValue: 320000, companyName: 'Mahani Wealth Management', contactName: 'Nurul Ain', contactEmail: 'nurul.ain@mahaniwealth.example.my', description: 'Comprehensive estate planning review for 50+ HNW clients under Mahani management' },
  { title: `${DEMO_TAG} Trust Restructuring — Tan & Partners`, status: 'CONTACTED' as LeadStatus, source: 'COLD_CALL', estimatedValue: 250000, companyName: 'Tan & Partners Trust Advisory', contactName: 'Datin Seri Rosnah', contactEmail: 'rosnah@tanpartners.example.my', description: 'Restructure 3 existing family trusts to optimise tax position under Budget 2026 changes' },
  { title: `${DEMO_TAG} Probate Administration — Azman & Lee`, status: 'NEW', source: 'PARTNER', estimatedValue: 95000, companyName: 'Azman & Lee Advocates', contactName: 'Azman Bin Ishak', contactEmail: 'azman@azmanlee.example.my', description: 'Probate administration referral for deceased estate valued at RM8.2M' },
  { title: `${DEMO_TAG} Corporate Succession Planning — Syed Corp`, status: 'NEW', source: 'TRADE_SHOW', estimatedValue: 500000, companyName: 'Syed Corporation Bhd', contactName: 'Farah Alzahra', contactEmail: 'farah@syedcorp.example.my', description: 'Cross-shareholder succession plan for 3 key holding companies' },
  { title: `${DEMO_TAG} Unit Trust Distribution — Mahani Wealth`, status: 'LOST' as LeadStatus, source: 'ADVERTISEMENT', estimatedValue: 75000, companyName: 'Mahani Wealth Management', contactName: 'Jonathan Teh', contactEmail: 'jonathan.t@mahaniwealth.example.my', description: 'Small unit trust distribution matter — budget too low for trust structure', lostReason: 'Client opted for direct distribution instead of trust' },
  { title: `${DEMO_TAG} Digital Asset Trust — Kwok Family`, status: 'NEW', source: 'WEBSITE', estimatedValue: 200000, companyName: 'Kwok Family Office', contactName: 'Kwok Mei Ling', contactEmail: 'meiling@kwokfamily.example.my', description: 'New digital asset (crypto + NFT) trust structure for next-gen wealth transfer' },
];

// Opportunities derived from qualified/contacted leads
const OPPORTUNITIES = [
  { name: `${DEMO_TAG} Kwok Family Trust — Full Structure`, stageName: 'Proposal', value: 450000, probability: 50, aiWinProbability: 72, aiWinReason: 'Strong referral source, high-value family office client with existing trust assets', expectedCloseDays: 45 },
  { name: `${DEMO_TAG} Syed Corp Shariah Will Package`, stageName: 'Qualification', value: 180000, probability: 25, aiWinProbability: 45, aiWinReason: 'LinkedIn inbound shows intent, but no meeting set yet — typical B2B trust deal', expectedCloseDays: 90 },
  { name: `${DEMO_TAG} Mahani Estate Planning Review`, stageName: 'Negotiation', value: 320000, probability: 75, aiWinProbability: 68, aiWinReason: 'Multiple stakeholder buy-in, proposal under review — typical long sales cycle', expectedCloseDays: 21 },
  { name: `${DEMO_TAG} Tan & Partners Trust Restructuring`, stageName: 'Prospecting', value: 250000, probability: 10, aiWinProbability: 32, aiWinReason: 'Cold call initial contact, interest expressed but no formal engagement', expectedCloseDays: 120 },
  { name: `${DEMO_TAG} Azman & Lee Probate Referral`, stageName: 'Qualification', value: 95000, probability: 25, aiWinProbability: 55, aiWinReason: 'Partner referral typically converts above 50%, moderate estate value', expectedCloseDays: 60 },
];

const ACTIVITIES = [
  { type: 'CALL' as CrmActivityType, subject: `${DEMO_TAG} Initial call — Kwok Family Trust`, description: 'Called Kwok Wei Ming to discuss family trust structure. He expressed strong interest in setting up a multi-generational trust for his portfolio.' },
  { type: 'MEETING' as CrmActivityType, subject: `${DEMO_TAG} Discovery meeting — Mahani Estate Review`, description: 'Met with Nurul Ain and Jonathan Teh at Mahani office. Scope confirmed for 50+ HNW clients. Need Shariah-compliant options for 60% of portfolio.' },
  { type: 'EMAIL' as CrmActivityType, subject: `${DEMO_TAG} Follow-up proposal — Syed Corp Wills`, description: 'Sent Datuk Syed Hamid the Shariah-compliant will package overview. Awaiting board approval timeline.' },
  { type: 'FOLLOW_UP' as CrmActivityType, subject: `${DEMO_TAG} Follow up — Tan & Partners restructuring`, description: 'Sent restructuring options document. Datin Seri Rosnah requested 2 weeks to review with her board.' },
  { type: 'WHATSAPP' as CrmActivityType, subject: `${DEMO_TAG} WhatsApp — Kwok family trust update`, description: 'Brief WhatsApp exchange with Kwok Mei Ling about digital asset trust options. She wants a follow-up meeting.' },
  { type: 'MEETING' as CrmActivityType, subject: `${DEMO_TAG} Site visit — Syed Corp HQ Penang`, description: 'Visited Syed Corp HQ in Komtar. Met Datuk Syed Hamid and Farah. Discussed group-wide succession for 3 holding companies.' },
  { type: 'CALL' as CrmActivityType, subject: `${DEMO_TAG} Cold call — Tan & Partners`, description: 'Cold call to Datin Seri Rosnah. Budget 2026 tax changes creating demand for trust restructuring. She asked for written proposal.' },
  { type: 'EMAIL' as CrmActivityType, subject: `${DEMO_TAG} Proposal sent — Mahani Estate Review`, description: 'Submitted comprehensive estate planning proposal to Nurul Ain. Awaiting counter-offer on pricing.' },
  { type: 'TASK' as CrmActivityType, subject: `${DEMO_TAG} Prepare NRIC verification — Kwok Wei Ming`, description: 'Need to verify NRIC and source of funds documentation before trust deed can be drafted.' },
  { type: 'FOLLOW_UP' as CrmActivityType, subject: `${DEMO_TAG} Board decision pending — Syed Corp`, description: 'Board meeting scheduled for next week. Farah will present the succession plan internally. Follow up afterward.' },
  { type: 'SITE_VISIT' as CrmActivityType, subject: `${DEMO_TAG} Client site visit — Mahani Wealth PJ office`, description: 'Visited Mahani Wealth PJ office to review client portfolio lists and discuss onboarding logistics.' },
  { type: 'CALL' as CrmActivityType, subject: `${DEMO_TAG} Check-in call — Kwok Family digital assets`, description: 'Called Kwok Mei Ling. She confirmed RM2.3M in digital assets and wants them included in the trust structure.' },
];

const NOTES = [
  { content: `${DEMO_TAG} **Kwok Family Trust — Key Decisions**\n\n- Settlor: Kwok Wei Ming (62M)\n- Trustees: Kwok Mei Ling + Citadel Trustee Bhd\n- Beneficiaries: 3 children + 2 grandchildren\n- Asset classes: Property (RM80M), Equities (RM40M), PE (RM30M), Digital (RM2.3M)\n- Priority: Shariah-compliant structure for portion of portfolio`, isPinned: true },
  { content: `${DEMO_TAG} **Mahani Estate Review — Scope Confirmed**\n\n- 50 HNW clients to review\n- 60% require Shariah-compliant options\n- Target completion: Q3 2026\n- Fee structure: RM6,400/client for standard, RM12,000 for complex estates\n- Key contact: Nurul Ain (Head of Private Wealth)`, isPinned: true },
  { content: `${DEMO_TAG} **Syed Corp — Succession Planning Notes**\n\n- 3 holding companies need restructuring\n- Family shareholders want to avoid probate delays\n- Estimated estate value: RM350M across companies\n- Datuk Syed Hamid wants board presentation next week`, isPinned: true },
  { content: `${DEMO_TAG} **General Pipeline Notes**\n\n- Q2 pipeline looking strong at RM1.3M estimated value\n- All deals are trust/estate focused (core competency)\n- Average deal size: RM259K\n- Conversion rate from qualified to closed won: ~40%`, isPinned: false },
  { content: `${DEMO_TAG} **Compliance Reminder**\n\n- All trust setups require KYC/AML checks before deed execution\n- Updated BNM guidelines effective Jan 2026 require enhanced due diligence for PEP clients\n- PEP flag on Datin Seri Rosnah — need compliance clearance`, isPinned: false },
];

async function main() {
  console.log(`🌱 Starting CRM ${DEMO_TAG} demo seed (owner: ${DEMO_OWNER_EMAIL})...`);

  // ── 0. Find owner user ──
  const owner = await prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL } });
  if (!owner) {
    console.error(`❌ User ${DEMO_OWNER_EMAIL} not found. Run main seed or seed-admin-config first.`);
    process.exit(1);
  }
  console.log(`👤 Owner: ${owner.firstName} ${owner.lastName} (${owner.email})`);

  // ── 1. Create Accounts ──
  console.log('\n📦 Creating Demo Accounts...');
  const accounts: Record<string, { id: string }> = {};
  for (const acc of ACCOUNTS) {
    const created = await prisma.crmAccount.create({
      data: { ...acc, ownerId: owner.id },
    });
    accounts[acc.name] = created;
    console.log(`   ✓ ${acc.name}`);
  }

  // ── 2. Create Contacts ──
  console.log('\n👥 Creating Demo Contacts...');
  const allContactIds: string[] = [];
  const contactByEmail: Record<string, string> = {};

  for (const [accountName, contactList] of Object.entries(CONTACTS)) {
    const accountId = accounts[accountName]?.id;
    if (!accountId) continue;

    for (const contact of contactList) {
      const created = await prisma.crmContact.create({
        data: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          jobTitle: contact.jobTitle,
          email: contact.email,
          phone: contact.phone,
          isPrimary: contact.isPrimary,
          accountId,
          nricPassport: contact.nricPassport || null,
          preferredLanguage: contact.preferredLanguage || 'en',
          pdpaConsent: contact.isPrimary,
          pdpaConsentDate: contact.isPrimary ? new Date() : null,
          mobile: contact.mobile || null,
          department: contact.department || null,
          description: contact.description || null,
          riskProfile: contact.riskProfile || null,
          marketingOptIn: contact.marketingOptIn ?? false,
        },
      });
      allContactIds.push(created.id);
      contactByEmail[contact.email] = created.id;
      console.log(`   ✓ ${contact.firstName} ${contact.lastName} — ${contact.jobTitle}`);
    }
  }

  // ── 3. Create KYC Records for primary contacts ──
  console.log('\n🔐 Creating KYC Records for primary contacts...');
  let kycCreated = 0;
  for (const [_accountName, contactList] of Object.entries(CONTACTS)) {
    const primaries = contactList.filter(c => c.isPrimary && c.nricPassport);
    for (const primary of primaries) {
      const contactId = contactByEmail[primary.email];
      if (!contactId) continue;
      const isPep = primary.email.includes('syed') || primary.email.includes('rosnah');
      const riskLvl = primary.riskProfile || 'MEDIUM';
      await prisma.crmKycRecord.create({
        data: {
          contactId,
          status: 'APPROVED',
          riskLevel: riskLvl,
          nricVerified: true,
          addressVerified: true,
          incomeVerified: true,
          sourceOfFundsVerified: true,
          riskProfileDone: true,
          isPep,
          amlRiskTier: isPep ? 'ENHANCED' : (riskLvl === 'HIGH' ? 'ENHANCED' : riskLvl === 'MEDIUM' ? 'STANDARD' : 'SIMPLIFIED'),
          screeningStatus: 'CLEAR',
          screeningHits: [{ source: 'PEP_SCREENING', result: isPep ? 'MATCH_FOUND' : 'NO_MATCH', checkedAt: new Date().toISOString(), details: isPep ? 'Politically Exposed Person identified' : 'No adverse findings' }],
          lastScreeningAt: new Date(),
          nextScreeningDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          approvedBy: owner.id,
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          notes: `${DEMO_TAG} Demo KYC — verified for trust setup`,
        },
      });
      kycCreated++;
    }
  }
  console.log(`   ✓ ${kycCreated} KYC records created`);

  // ── 4. Create Sales Pipeline ──
  console.log('\n🔀 Creating Demo Pipeline...');
  // Check if pipeline already exists (avoid duplicate)
  const existingPipeline = await prisma.crmPipeline.findFirst({ where: { name: `${DEMO_TAG} Sales Pipeline` } });
  let pipeline;
  if (existingPipeline) {
    pipeline = await prisma.crmPipeline.findUnique({ where: { id: existingPipeline.id }, include: { stages: true } });
    console.log(`   Pipeline already exists, reusing: ${pipeline!.name}`);
  } else {
    pipeline = await prisma.crmPipeline.create({
      data: {
        name: `${DEMO_TAG} Sales Pipeline`,
        description: 'Demo pipeline for Citadel trust & estate planning AI feature walkthrough',
        isDefault: false,
        stages: {
          create: [
            { name: 'Prospecting', displayOrder: 0, probability: 10, color: '#8b5cf6', isWonStage: false, isLostStage: false },
            { name: 'Qualification', displayOrder: 1, probability: 25, color: '#3b82f6', isWonStage: false, isLostStage: false },
            { name: 'Proposal', displayOrder: 2, probability: 50, color: '#0ea5e9', isWonStage: false, isLostStage: false },
            { name: 'Negotiation', displayOrder: 3, probability: 75, color: '#f59e0b', isWonStage: false, isLostStage: false },
            { name: 'Closed Won', displayOrder: 4, probability: 100, color: '#10b981', isWonStage: true, isLostStage: false },
            { name: 'Closed Lost', displayOrder: 5, probability: 0, color: '#ef4444', isWonStage: false, isLostStage: true },
          ],
        },
      },
      include: { stages: true },
    });
  }
  console.log(`   ✓ Pipeline: ${pipeline!.name} with ${pipeline!.stages.length} stages`);

  const stageMap: Record<string, string> = {};
  for (const stage of pipeline!.stages) {
    stageMap[stage.name] = stage.id;
  }

  // ── 5. Create Leads ──
  console.log('\n🎯 Creating Demo Leads...');
  const accountNames = Object.keys(accounts);
  let leadsCreated = 0;
  const leadScores = [82, 58, 74, 35, 61, 43, 12, 55]; // AI scores to pre-populate
  const leadScoreReasons = [
    'High-value referral with strong contact info. Multiple touchpoints.',
    'LinkedIn inbound — warm lead with verified email. Needs meeting.',
    'Website inquiry for 50+ clients. High estimated value, strong buyer signals.',
    'Cold call — interest expressed but no formal engagement yet.',
    'Partner referral — probate cases convert well. Moderate value.',
    'Trade show lead — large corporate. Initial interest only.',
    'Low conversion probability — budget below threshold and client chose alternative.',
    'Website inquiry for new digital asset trust product. Growing market.',
  ];

  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    const randomAccountName = accountNames[i % accountNames.length] || accountNames[0];
    await prisma.crmLead.create({
      data: {
        title: lead.title,
        status: lead.status as LeadStatus,
        source: lead.source as LeadSource,
        ownerId: owner.id,
        accountId: accounts[randomAccountName]?.id || null,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        companyName: lead.companyName,
        estimatedValue: lead.estimatedValue,
        description: lead.description,
        lostReason: lead.lostReason || null,
        followUpDate: i < 5 ? new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000) : null, // future follow-up for first 5
        followUpNote: i < 5 ? `${DEMO_TAG} Follow up on ${lead.title}` : null,
        // Pre-populate AI scores so the lead list has data immediately
        aiScore: leadScores[i],
        aiScoreReason: leadScoreReasons[i],
        aiScoredAt: new Date(),
      },
    });
    leadsCreated++;
  }
  console.log(`   ✓ ${leadsCreated} leads created (with AI scores pre-populated)`);

  // ── 6. Create Opportunities ──
  console.log('\n💰 Creating Demo Opportunities...');
  let oppsCreated = 0;

  for (const opp of OPPORTUNITIES) {
    const aName = accountNames[oppsCreated % accountNames.length] || accountNames[0];
    const accountId = accounts[aName].id;
    const stageId = stageMap[opp.stageName];
    if (!stageId) {
      console.warn(`   ⚠ Stage "${opp.stageName}" not found, skipping opportunity: ${opp.name}`);
      continue;
    }

    // Find a primary contact for this account
    const accountContacts = CONTACTS[aName] || Object.values(CONTACTS)[oppsCreated % Object.keys(CONTACTS).length];
    const primaryContact = accountContacts?.find(c => c.isPrimary);
    const contactId = primaryContact ? contactByEmail[primaryContact.email] : null;

    await prisma.crmOpportunity.create({
      data: {
        name: opp.name,
        accountId,
        contactId,
        pipelineId: pipeline!.id,
        stageId,
        ownerId: owner.id,
        value: opp.value,
        currency: 'MYR',
        probability: opp.probability,
        expectedCloseDate: new Date(Date.now() + opp.expectedCloseDays * 24 * 60 * 60 * 1000),
        description: `${DEMO_TAG} Trust & estate planning opportunity`,
        // Pre-populate AI win probability
        aiWinProbability: opp.aiWinProbability,
        aiWinReason: opp.aiWinReason,
        aiScoredAt: new Date(),
      },
    });
    oppsCreated++;
  }
  console.log(`   ✓ ${oppsCreated} opportunities created (with AI win probability pre-populated)`);

  // ── 7. Create Activities ──
  console.log('\n📅 Creating Demo Activities...');
  let activitiesCreated = 0;

  for (let i = 0; i < ACTIVITIES.length; i++) {
    const act = ACTIVITIES[i];
    const accountName = accountNames[i % accountNames.length] || accountNames[0];
    const accountId = accounts[accountName].id;
    const contactId = allContactIds[i % allContactIds.length] || null;

    await prisma.crmActivity.create({
      data: {
        activityType: act.type,
        subject: act.subject,
        description: act.description,
        userId: owner.id,
        accountId,
        contactId,
        scheduledAt: new Date(Date.now() + (i - 3) * 24 * 60 * 60 * 1000), // spread around today
        completedAt: i < 6 ? new Date(Date.now() - i * 24 * 60 * 60 * 1000) : null, // first 6 completed
        durationMinutes: 30 + (i % 4) * 15,
      },
    });
    activitiesCreated++;
  }
  console.log(`   ✓ ${activitiesCreated} activities created`);

  // ── 8. Create Notes ──
  console.log('\n📝 Creating Demo Notes...');
  let notesCreated = 0;

  for (const note of NOTES) {
    const accountName = accountNames[notesCreated % accountNames.length] || accountNames[0];
    const accountId = accounts[accountName].id;

    await prisma.crmNote.create({
      data: {
        content: note.content,
        authorId: owner.id,
        accountId,
        isPinned: note.isPinned,
      },
    });
    notesCreated++;
  }
  console.log(`   ✓ ${notesCreated} notes created`);

  // ── 9. Create Beneficiaries ──
  console.log('\n👨‍👩‍👧‍👦 Creating Demo Beneficiaries...');
  let beneficiariesCreated = 0;

  // Kwok family — 3 children + 2 grandchildren as beneficiaries of Kwok Wei Ming's contact
  const kwokWeiMingContactId = contactByEmail['weiming@kwokfamily.example.my'];
  if (kwokWeiMingContactId) {
    const kwokBeneficiaries = [
      { firstName: 'Kwok', lastName: 'Jia Hao', relationship: 'SON', allocationPct: 30, email: 'jiahao@kwokfamily.example.my', phone: '+60 12-555 9910', nricPassport: '900515-10-5601', dateOfBirth: new Date('1990-05-15'), isMinor: false, notes: 'Eldest son, involved in family business operations' },
      { firstName: 'Kwok', lastName: 'Su Mei', relationship: 'DAUGHTER', allocationPct: 25, email: 'sumei@kwokfamily.example.my', phone: '+60 12-555 9911', nricPassport: '930822-14-5580', dateOfBirth: new Date('1993-08-22'), isMinor: false, notes: 'Second child, medical doctor in Singapore' },
      { firstName: 'Kwok', lastName: 'Jun Wei', relationship: 'SON', allocationPct: 25, email: 'junwei@kwokfamily.example.my', phone: '+60 12-555 9912', nricPassport: '960101-10-5623', dateOfBirth: new Date('1996-01-01'), isMinor: false, notes: 'Youngest son, studying in UK' },
      { firstName: 'Kwok', lastName: 'Yi Xuan', relationship: 'GRANDCHILD', allocationPct: 10, nricPassport: '20180901-10-5544', dateOfBirth: new Date('2018-09-01'), isMinor: true, guardianName: 'Kwok Jia Hao', notes: 'Grandson via Jia Hao' },
      { firstName: 'Kwok', lastName: 'Xin Er', relationship: 'GRANDCHILD', allocationPct: 10, nricPassport: '20210315-14-5501', dateOfBirth: new Date('2021-03-15'), isMinor: true, guardianName: 'Kwok Su Mei', notes: 'Granddaughter via Su Mei' },
    ];
    for (const b of kwokBeneficiaries) {
      await prisma.crmBeneficiary.create({
        data: {
          contactId: kwokWeiMingContactId,
          firstName: b.firstName,
          lastName: b.lastName,
          relationship: b.relationship,
          allocationPct: b.allocationPct,
          email: b.email || null,
          phone: b.phone || null,
          nricPassport: b.nricPassport || null,
          dateOfBirth: b.dateOfBirth || null,
          isMinor: b.isMinor,
          guardianName: b.guardianName || null,
          notes: b.notes || null,
        },
      });
      beneficiariesCreated++;
    }
  }

  // Syed Corp — Datuk Syed Hamid beneficiaries
  const syedHamidContactId = contactByEmail['syed.hamid@syedcorp.example.my'];
  if (syedHamidContactId) {
    const syedBeneficiaries: Array<{ firstName: string; lastName: string; relationship: string; allocationPct: number; email?: string; phone?: string; nricPassport?: string; dateOfBirth?: Date; isMinor: boolean; guardianName?: string; notes?: string }> = [
      { firstName: 'Syed', lastName: 'Aiman', relationship: 'SON', allocationPct: 40, email: 'aiman@syedcorp.example.my', phone: '+60 12-888 1110', nricPassport: '920710-07-5201', dateOfBirth: new Date('1992-07-10'), isMinor: false, notes: 'Eldest son, Group COO' },
      { firstName: 'Syed', lastName: 'Aisyah', relationship: 'DAUGHTER', allocationPct: 35, email: 'aisyah@syedcorp.example.my', nricPassport: '950418-10-5580', dateOfBirth: new Date('1995-04-18'), isMinor: false, notes: 'Daughter, runs family foundation' },
      { firstName: 'Syed', lastName: 'Zara', relationship: 'SPOUSE', allocationPct: 25, email: 'zara@syedcorp.example.my', nricPassport: '700902-10-5543', dateOfBirth: new Date('1970-09-02'), isMinor: false, notes: 'Wife, holds 15% of Syed Corp directly' },
    ];
    for (const b of syedBeneficiaries) {
      await prisma.crmBeneficiary.create({
        data: {
          contactId: syedHamidContactId,
          firstName: b.firstName,
          lastName: b.lastName,
          relationship: b.relationship,
          allocationPct: b.allocationPct,
          email: b.email || null,
          phone: b.phone || null,
          nricPassport: b.nricPassport || null,
          dateOfBirth: b.dateOfBirth || null,
          isMinor: b.isMinor,
          guardianName: b.guardianName || null,
          notes: b.notes || null,
        },
      });
      beneficiariesCreated++;
    }
  }
  console.log(`   ✓ ${beneficiariesCreated} beneficiaries created`);

  // ── 10. Create Trust Products ──
  console.log('\n🏦 Creating Demo Trust Products...');
  let trustProductsCreated = 0;

  // Trust products for Kwok Family Office account
  const kwokAccountName = `${DEMO_TAG} Kwok Family Office`;
  const kwokAccountId = accounts[kwokAccountName]?.id;
  if (kwokAccountId) {
    const kwokTrustProducts = [
      { trustType: 'FAMILY_TRUST', deedRefNumber: 'TD-KWK-2024-001', status: 'ACTIVE', assetValue: 80000000, assetDescription: 'Combined property and equity portfolio — 3 commercial properties (KL Sentral, Bukit Damansara, Penang) + Bursa Malaysia blue chips', trusteeName: 'Citadel Trustee Bhd', trusteeContact: '+60 3-2780 9900', settlementDate: null, maturityDate: null, nextReviewDate: new Date('2026-07-01') },
      { trustType: 'UNIT_TRUST', deedRefNumber: 'UT-KWK-2025-002', status: 'ACTIVE', assetValue: 40000000, assetDescription: 'Unit trust portfolio — diversified across Shariah-compliant equity funds and bond funds', trusteeName: 'Citadel Trustee Bhd', trusteeContact: '+60 3-2780 9900', settlementDate: new Date('2024-01-15'), maturityDate: new Date('2034-01-15'), nextReviewDate: new Date('2026-04-01') },
      { trustType: 'DIGITAL_TRUST', deedRefNumber: 'DT-KWK-2026-003', status: 'PENDING', assetValue: 2300000, assetDescription: 'Digital assets — Bitcoin (15 BTC), Ethereum (80 ETH), and NFT portfolio', trusteeName: 'Citadel Digital Custody Sdn Bhd', trusteeContact: '+60 3-2780 9950', settlementDate: null, maturityDate: null, nextReviewDate: new Date('2026-06-01') },
    ];
    const kwokWeiMingId = contactByEmail['weiming@kwokfamily.example.my'];
    for (const tp of kwokTrustProducts) {
      await prisma.crmTrustProduct.create({
        data: {
          accountId: kwokAccountId,
          contactId: kwokWeiMingId || null,
          trustType: tp.trustType,
          deedRefNumber: tp.deedRefNumber,
          status: tp.status,
          assetValue: tp.assetValue,
          currency: 'MYR',
          assetDescription: tp.assetDescription,
          trusteeName: tp.trusteeName,
          trusteeContact: tp.trusteeContact,
          settlementDate: tp.settlementDate,
          maturityDate: tp.maturityDate,
          nextReviewDate: tp.nextReviewDate,
          ownerId: owner.id,
        },
      });
      trustProductsCreated++;
    }
  }

  // Trust product for Syed Corp
  const syedAccountName = `${DEMO_TAG} Syed Corporation Bhd`;
  const syedAccountId = accounts[syedAccountName]?.id;
  if (syedAccountId) {
    const syedTrustProducts = [
      { trustType: 'CORPORATE_TRUST', deedRefNumber: 'CT-SYD-2023-010', status: 'ACTIVE', assetValue: 150000000, assetDescription: 'Syed Corp Holdings — property portfolio across 3 holding companies (Syed Land Sdn Bhd, Syed Hospitality Sdn Bhd, Syed Manufacturing Sdn Bhd)', trusteeName: 'Amanah Raya Berhad', trusteeContact: '+60 3-2693 7000', settlementDate: new Date('2023-06-01'), maturityDate: new Date('2043-06-01'), nextReviewDate: new Date('2026-09-01') },
      { trustType: 'INSURANCE_TRUST', deedRefNumber: 'IT-SYD-2024-011', status: 'ACTIVE', assetValue: 25000000, assetDescription: 'Key-man insurance trust — RM25M coverage for Datuk Syed Hamid (Group CEO) and Farah Alzahra (Group Legal Counsel)', trusteeName: 'Citadel Trustee Bhd', trusteeContact: '+60 3-2780 9900', settlementDate: new Date('2024-03-15'), maturityDate: new Date('2039-03-15'), nextReviewDate: new Date('2026-03-15') },
    ];
    for (const tp of syedTrustProducts) {
      await prisma.crmTrustProduct.create({
        data: {
          accountId: syedAccountId,
          contactId: syedHamidContactId || null,
          trustType: tp.trustType,
          deedRefNumber: tp.deedRefNumber,
          status: tp.status,
          assetValue: tp.assetValue,
          currency: 'MYR',
          assetDescription: tp.assetDescription,
          trusteeName: tp.trusteeName,
          trusteeContact: tp.trusteeContact,
          settlementDate: tp.settlementDate,
          maturityDate: tp.maturityDate,
          nextReviewDate: tp.nextReviewDate,
          ownerId: owner.id,
        },
      });
      trustProductsCreated++;
    }
  }

  // Trust product for Mahani Wealth
  const mahaniAccountName = `${DEMO_TAG} Mahani Wealth Management`;
  const mahaniAccountId = accounts[mahaniAccountName]?.id;
  if (mahaniAccountId) {
    await prisma.crmTrustProduct.create({
      data: {
        accountId: mahaniAccountId,
        contactId: contactByEmail['nurul.ain@mahaniwealth.example.my'] || null,
        trustType: 'UNIT_TRUST',
        deedRefNumber: 'UT-MHN-2025-005',
        status: 'ACTIVE',
        assetValue: 32000000,
        currency: 'MYR',
        assetDescription: 'Shariah-compliant unit trust distribution — 50+ HNW client portfolios under Mahani management',
        trusteeName: 'Citadel Trustee Bhd',
        trusteeContact: '+60 3-2780 9900',
        settlementDate: new Date('2025-01-10'),
        maturityDate: new Date('2030-01-10'),
        nextReviewDate: new Date('2026-01-10'),
        ownerId: owner.id,
      },
    });
    trustProductsCreated++;
  }
  console.log(`   ✓ ${trustProductsCreated} trust products created`);

  // ── Summary ──
  console.log(`\n✅ CRM ${DEMO_TAG} demo seed completed!`);
  console.log('\n📊 Summary:');
  console.log(`   • Owner:     ${owner.firstName} ${owner.lastName} (${DEMO_OWNER_EMAIL})`);
  console.log(`   • Accounts:  ${ACCOUNTS.length}`);
  console.log(`   • Contacts:  ${Object.values(CONTACTS).flat().length}`);
  console.log(`   • KYC:       ${kycCreated}`);
  console.log(`   • Beneficiaries: ${beneficiariesCreated}`);
  console.log(`   • Trust Products: ${trustProductsCreated}`);
  console.log(`   • Pipeline:  1 (${pipeline!.stages.length} stages)`);
  console.log(`   • Leads:     ${leadsCreated} (AI scores pre-filled)`);
  console.log(`   • Opportunities: ${oppsCreated} (AI win probability pre-filled)`);
  console.log(`   • Activities: ${activitiesCreated}`);
  console.log(`   • Notes:     ${notesCreated}`);
  console.log('\n🔑 Login as emily.chow@citadelgroup.com.my to experience AI features:');
  console.log('   • Dashboard → Auto-loaded daily briefing');
  console.log('   • Leads → Priority sort by AI score');
  console.log('   • Opportunities → AI win probability badges');
  console.log('   • Pipeline → AI badges on kanban cards');
  console.log('   • Contact Detail → Auto-loaded KYC gaps & risk profile');
  console.log('\n🗑️ To remove all demo data, run:');
  console.log('   npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/seed-crm-demo-remove.ts');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });