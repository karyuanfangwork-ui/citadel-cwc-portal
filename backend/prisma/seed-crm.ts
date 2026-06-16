import { PrismaClient, LeadStatus, LeadSource, CrmActivityType } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Sample Malaysian companies
const ACCOUNTS = [
  {
    name: 'Petronas Digital Sdn Bhd',
    industry: 'Oil & Gas',
    companySize: '1001-5000',
    website: 'https://petronas.com',
    phone: '+60 3-2003 2000',
    email: 'info@petronas.com',
    address: 'Menara Petronas, KLCC',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50088',
    registrationNumber: '197401001131',
    taxNumber: 'C25-197401001131',
    bankAccount: 'MBB-1002-3344-5566',
    description: 'National oil and gas company',
    annualRevenue: 500000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: false,
  },
  {
    name: 'Maybank Islamic Berhad',
    industry: 'Financial Services',
    companySize: '5001-10000',
    website: 'https://maybank-islamic.com.my',
    phone: '+60 3-2070 8833',
    email: 'contact@maybank-islamic.com.my',
    address: 'Menara Maybank, 100 Jalan Tun Perak',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50050',
    registrationNumber: '196001000321',
    taxNumber: 'C25-196001000321',
    bankAccount: 'CIMB-2005-6677-8899',
    description: 'Leading Islamic bank in Malaysia',
    annualRevenue: 350000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: true,
  },
  {
    name: 'Top Glove Corporation Bhd',
    industry: 'Manufacturing',
    companySize: '10000+',
    website: 'https://topglove.com',
    phone: '+60 3-3378 8888',
    email: 'enquiry@topglove.com',
    address: 'Lot 888, Jalan Sungai Puloh',
    city: 'Klang',
    state: 'Selangor',
    country: 'Malaysia',
    postalCode: '41000',
    registrationNumber: '199101013844',
    taxNumber: 'C25-199101013844',
    bankAccount: 'HLB-3001-4455-6677',
    description: 'World largest glove manufacturer',
    annualRevenue: 280000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: false,
  },
  {
    name: 'AirAsia Digital Sdn Bhd',
    industry: 'Technology',
    companySize: '501-1000',
    website: 'https://airasiadigital.com',
    phone: '+60 3-8775 4000',
    email: 'digital@airasia.com',
    address: 'RedQ, Jalan Pekeliling 5',
    city: 'Sepang',
    state: 'Selangor',
    country: 'Malaysia',
    postalCode: '43900',
    registrationNumber: '202101023456',
    taxNumber: 'C25-202101023456',
    bankAccount: 'RHB-4002-7788-9900',
    description: 'Digital travel and lifestyle platform',
    annualRevenue: 120000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: false,
  },
  {
    name: 'Grab Malaysia Sdn Bhd',
    industry: 'Technology',
    companySize: '1001-5000',
    website: 'https://grab.com',
    phone: '+60 3-2778 8888',
    email: 'support@grab.com',
    address: 'Sentral Tower, 10A Jalan Stesen Sentral 5',
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    country: 'Malaysia',
    postalCode: '50470',
    registrationNumber: '201201023456',
    taxNumber: 'C25-201201023456',
    bankAccount: 'PBB-5003-1122-3344',
    description: 'Leading superapp for transport, food, and payments',
    annualRevenue: 450000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: true,
  },
  {
    name: 'Sunway Property Holdings',
    industry: 'Real Estate',
    companySize: '501-1000',
    website: 'https://sunwayproperty.com',
    phone: '+60 3-7492 8888',
    email: 'info@sunwayproperty.com',
    address: 'Menara Sunway, Jalan Universiti',
    city: 'Petaling Jaya',
    state: 'Selangor',
    country: 'Malaysia',
    postalCode: '46200',
    registrationNumber: '198801012345',
    taxNumber: 'C25-198801012345',
    bankAccount: 'MBB-6004-5566-7788',
    description: 'Integrated property development group',
    annualRevenue: 200000000,
    accountType: 'CORPORATE' as const,
    purchaseCashTrust: false,
  },
];

// Contacts per account (2 each)
const CONTACTS: Record<string, Array<{
  firstName: string; lastName: string; jobTitle: string;
  email: string; phone: string; isPrimary: boolean;
  mobile?: string; department?: string; description?: string;
  riskProfile?: string; marketingOptIn?: boolean;
}>> = {
  'Petronas Digital Sdn Bhd': [
    { firstName: 'Azman', lastName: 'Ibrahim', jobTitle: 'Chief Information Officer', email: 'azman.ibrahim@petronas.com', phone: '+60 12-345 6789', isPrimary: true, mobile: '+60 12-345 6780', department: 'IT', description: 'Key decision maker for all digital transformation initiatives', riskProfile: 'LOW', marketingOptIn: true },
    { firstName: 'Siti', lastName: 'Nurhaliza', jobTitle: 'IT Director', email: 'siti.n@petronas.com', phone: '+60 12-345 6790', isPrimary: false, mobile: '+60 12-345 6791', department: 'IT Operations', description: 'Oversees cloud and infrastructure projects', riskProfile: 'LOW', marketingOptIn: false },
  ],
  'Maybank Islamic Berhad': [
    { firstName: 'Mohd', lastName: 'Faizal', jobTitle: 'Head of Digital Banking', email: 'faizal@maybank-islamic.com.my', phone: '+60 13-456 7890', isPrimary: true, mobile: '+60 13-456 7880', department: 'Digital Banking', description: 'Leads digital banking product strategy across 200+ branches', riskProfile: 'LOW', marketingOptIn: true },
    { firstName: 'Aishah', lastName: 'Rahman', jobTitle: 'IT Manager', email: 'aishah.r@maybank-islamic.com.my', phone: '+60 13-456 7891', isPrimary: false, mobile: '+60 13-456 7881', department: 'Technology', description: 'Manages core banking system integrations', riskProfile: 'LOW', marketingOptIn: true },
  ],
  'Top Glove Corporation Bhd': [
    { firstName: 'Lim', lastName: 'Wee Chai', jobTitle: 'Managing Director', email: 'lim.wc@topglove.com', phone: '+60 14-567 8901', isPrimary: true, mobile: '+60 14-567 8900', department: 'Executive', description: 'Group MD, oversees 50+ manufacturing facilities globally', riskProfile: 'MEDIUM', marketingOptIn: false },
    { firstName: 'Tan', lastName: 'Mei Ling', jobTitle: 'Operations Director', email: 'tan.ml@topglove.com', phone: '+60 14-567 8902', isPrimary: false, mobile: '+60 14-567 8903', department: 'Operations', description: 'Manages supply chain and quality assurance', riskProfile: 'LOW', marketingOptIn: true },
  ],
  'AirAsia Digital Sdn Bhd': [
    { firstName: 'Riad', lastName: 'Asmat', jobTitle: 'CEO', email: 'riad@airasiadigital.com', phone: '+60 15-678 9012', isPrimary: true, mobile: '+60 15-678 9010', department: 'C-Suite', description: 'CEO of AirAsia Digital, driving tech-led transformation', riskProfile: 'MEDIUM', marketingOptIn: false },
    { firstName: 'Nadia', lastName: 'Khalid', jobTitle: 'CTO', email: 'nadia.k@airasiadigital.com', phone: '+60 15-678 9013', isPrimary: false, mobile: '+60 15-678 9014', department: 'Engineering', description: 'CTO responsible for platform architecture and data strategy', riskProfile: 'LOW', marketingOptIn: true },
  ],
  'Grab Malaysia Sdn Bhd': [
    { firstName: 'Ooi', lastName: 'Kuang Ping', jobTitle: 'Managing Director', email: 'kuangping@grab.com', phone: '+60 16-789 0123', isPrimary: true, mobile: '+60 16-789 0120', department: 'Management', description: 'MD for Malaysia operations, 15+ years in tech leadership', riskProfile: 'MEDIUM', marketingOptIn: true },
    { firstName: 'Sarah', lastName: 'Tan', jobTitle: 'Head of Engineering', email: 'sarah.t@grab.com', phone: '+60 16-789 0124', isPrimary: false, mobile: '+60 16-789 0125', department: 'Engineering', description: 'Leads 300+ engineering team across Southeast Asia', riskProfile: 'LOW', marketingOptIn: true },
  ],
  'Sunway Property Holdings': [
    { firstName: 'Jeffrey', lastName: 'Cheah', jobTitle: 'Executive Chairman', email: 'jeffrey.cheah@sunwayproperty.com', phone: '+60 17-890 1234', isPrimary: true, mobile: '+60 17-890 1230', department: 'Board', description: 'Founder and Chairman of Sunway Group. Tan Sri title holder.', riskProfile: 'HIGH', marketingOptIn: false },
    { firstName: 'Michelle', lastName: 'Wong', jobTitle: 'Sales Director', email: 'michelle.w@sunwayproperty.com', phone: '+60 17-890 1235', isPrimary: false, mobile: '+60 17-890 1236', department: 'Sales & Marketing', description: 'Oversees all residential and commercial property sales', riskProfile: 'LOW', marketingOptIn: true },
  ],
};

// Leads with varied statuses and sources
const LEADS = [
  { title: 'Enterprise CRM Implementation', companyName: 'Petronas Digital', contactName: 'Azman Ibrahim', contactEmail: 'azman.ibrahim@petronas.com', estimatedValue: 250000, source: 'REFERRAL', status: 'QUALIFIED', description: 'Full CRM rollout for 500+ users' },
  { title: 'Cloud Migration Project', companyName: 'Maybank Islamic', contactName: 'Mohd Faizal', contactEmail: 'faizal@maybank-islamic.com.my', estimatedValue: 180000, source: 'LINKEDIN', status: 'CONTACTED', description: 'AWS/Azure migration consulting' },
  { title: 'IoT Sensor Network', companyName: 'Top Glove', contactName: 'Lim Wee Chai', contactEmail: 'lim.wc@topglove.com', estimatedValue: 320000, source: 'TRADE_SHOW', status: 'NEW', description: 'Factory floor monitoring system' },
  { title: 'Mobile App Development', companyName: 'AirAsia Digital', contactName: 'Riad Asmat', contactEmail: 'riad@airasiadigital.com', estimatedValue: 150000, source: 'WEBSITE', status: 'NEW', description: 'Customer loyalty app revamp' },
  { title: 'Data Analytics Platform', companyName: 'Grab Malaysia', contactName: 'Ooi Kuang Ping', contactEmail: 'kuangping@grab.com', estimatedValue: 400000, source: 'PARTNER', status: 'QUALIFIED', description: 'Real-time analytics dashboard' },
  { title: 'Property Management System', companyName: 'Sunway Property', contactName: 'Jeffrey Cheah', contactEmail: 'jeffrey.cheah@sunwayproperty.com', estimatedValue: 280000, source: 'REFERRAL', status: 'CONTACTED', description: 'Integrated PMS for 10 properties' },
  { title: 'Cybersecurity Audit', companyName: 'TechCorp Sdn Bhd', contactName: 'David Lee', contactEmail: 'david@techcorp.my', estimatedValue: 75000, source: 'COLD_CALL', status: 'UNQUALIFIED', description: 'Budget too small' },
  { title: 'HR System Integration', companyName: 'HR Solutions KL', contactName: 'Priya Sharma', contactEmail: 'priya@hrsolutions.my', estimatedValue: 95000, source: 'ADVERTISEMENT', status: 'LOST', lostReason: 'Went with competitor', description: 'Lost to Oracle HCM' },
  { title: 'E-commerce Platform', companyName: 'Retail Giant MY', contactName: 'Ahmad Zaki', contactEmail: 'zaki@retailgiant.my', estimatedValue: 220000, source: 'WEBSITE', status: 'NEW', description: 'Multi-vendor marketplace build' },
  { title: 'AI Chatbot Implementation', companyName: 'Bank Rakyat', contactName: 'Fatimah Ali', contactEmail: 'fatimah@bankrakyat.com.my', estimatedValue: 130000, source: 'LINKEDIN', status: 'CONTACTED', description: 'Customer service automation' },
  { title: 'Supply Chain Optimization', companyName: 'Logistics Pro', contactName: 'Wong Kim Fatt', contactEmail: 'kimfatt@logisticspro.my', estimatedValue: 190000, source: 'REFERRAL', status: 'QUALIFIED', description: 'AI-driven route optimization' },
  { title: 'Digital Transformation', companyName: 'GovTech Agency', contactName: 'Ramesh Kumar', contactEmail: 'ramesh@govtech.gov.my', estimatedValue: 500000, source: 'PARTNER', status: 'NEW', description: 'Government digital services platform' },
  { title: 'POS System Upgrade', companyName: 'Cafe Chain MY', contactName: 'Lisa Chen', contactEmail: 'lisa@cafechain.my', estimatedValue: 45000, source: 'COLD_CALL', status: 'NEW', description: '10 outlet POS replacement' },
  { title: 'Learning Management System', companyName: 'EduTech Malaysia', contactName: 'Nurul Huda', contactEmail: 'nurul@edutech.my', estimatedValue: 110000, source: 'WEBSITE', status: 'CONTACTED', description: 'Online learning platform' },
  { title: 'Blockchain Supply Chain', companyName: 'Pharma Distributors', contactName: 'Dr. Hassan Ali', contactEmail: 'hassan@pharmadist.my', estimatedValue: 350000, source: 'TRADE_SHOW', status: 'QUALIFIED', description: 'Drug traceability system' },
];

async function main() {
  console.log('🌱 Starting CRM sample data seed...');

  // Get sales team users
  const salesManager = await prisma.user.findUnique({ where: { email: 'salesmanager@test.local' } });
  const salesRep = await prisma.user.findUnique({ where: { email: 'salesrep@test.local' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });

  if (!salesManager || !salesRep || !adminUser) {
    console.error('❌ Missing required users. Run main seed.ts first.');
    process.exit(1);
  }

  console.log(`👥 Sales Manager: ${salesManager.firstName} ${salesManager.lastName} (${salesManager.id})`);
  console.log(`👥 Sales Rep: ${salesRep.firstName} ${salesRep.lastName} (${salesRep.id})`);
  console.log(`👥 Admin: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.id})`);

  // 1. Create Accounts
  console.log('\n📦 Creating CRM Accounts...');
  const accounts: Record<string, { id: string }> = {};
  
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const acc = ACCOUNTS[i];
    const owner = i < 2 ? salesManager : (i < 4 ? salesRep : adminUser);
    const created = await prisma.crmAccount.create({
      data: { ...acc, tenantId: DEFAULT_TENANT_ID, ownerId: owner.id },
    });
    accounts[acc.name] = created;
    console.log(`   ✓ ${acc.name} (Owner: ${owner.firstName})`);
  }

  // 2. Create Contacts
  console.log('\n👥 Creating CRM Contacts...');
  const contacts: Record<string, string[]> = {};
  const contactByEmail: Record<string, string> = {};
  
  for (const [accountName, contactList] of Object.entries(CONTACTS)) {
    const accountId = accounts[accountName].id;
    contacts[accountName] = [];
    
    for (const contact of contactList) {
      const created = await prisma.crmContact.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          firstName: contact.firstName,
          lastName: contact.lastName,
          jobTitle: contact.jobTitle,
          email: contact.email,
          phone: contact.phone,
          isPrimary: contact.isPrimary,
          accountId,
          mobile: contact.mobile || null,
          department: contact.department || null,
          description: contact.description || null,
          riskProfile: contact.riskProfile || null,
          marketingOptIn: contact.marketingOptIn ?? false,
        },
      });
      contacts[accountName].push(created.id);
      contactByEmail[contact.email] = created.id;
    }
    console.log(`   ✓ ${accountName}: ${contactList.length} contacts`);
  }

  // 3. Reuse or create the default Sales Pipeline with Stages
  console.log('\n🔀 Creating CRM Pipeline...');
  const stageData = [
    { name: 'Prospecting', displayOrder: 0, probability: 10, color: '#6366f1', isWonStage: false, isLostStage: false },
    { name: 'Qualification', displayOrder: 1, probability: 25, color: '#3b82f6', isWonStage: false, isLostStage: false },
    { name: 'Proposal', displayOrder: 2, probability: 50, color: '#0ea5e9', isWonStage: false, isLostStage: false },
    { name: 'Negotiation', displayOrder: 3, probability: 75, color: '#f59e0b', isWonStage: false, isLostStage: false },
    { name: 'Closed Won', displayOrder: 4, probability: 100, color: '#10b981', isWonStage: true, isLostStage: false },
    { name: 'Closed Lost', displayOrder: 5, probability: 0, color: '#ef4444', isWonStage: false, isLostStage: true },
  ];
  const existingPipeline = await prisma.crmPipeline.findFirst({ where: { name: 'Sales Pipeline' }, include: { stages: true } });
  let pipeline: typeof existingPipeline & { stages: { id: string; name: string; displayOrder: number }[] };
  if (existingPipeline) {
    pipeline = existingPipeline;
    console.log(`   Pipeline already exists, reusing: ${pipeline.name}`);
  } else {
    pipeline = await prisma.crmPipeline.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        name: 'Sales Pipeline',
        description: 'Unified sales pipeline for tracking deals from prospecting to close',
        isDefault: true,
        stages: { create: stageData },
      },
      include: { stages: true },
    });
  }
  console.log(`   ✓ Pipeline: ${pipeline.name} with ${pipeline.stages.length} stages`);

  const stageMap: Record<string, string> = {};
  for (const stage of pipeline.stages) {
    stageMap[stage.name] = stage.id;
  }
  console.log('\n🎯 Creating CRM Leads...');
  let leadsCreated = 0;
  const accountNames = Object.keys(accounts);
  
  for (const lead of LEADS) {
    const randomAccount = accountNames[Math.floor(Math.random() * accountNames.length)];
    await prisma.crmLead.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        title: lead.title,
        status: lead.status as LeadStatus,
        source: lead.source as LeadSource,
        ownerId: salesRep.id,
        accountId: accounts[randomAccount]?.id || null,
        contactId: contactByEmail[lead.contactEmail] || null,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        companyName: lead.companyName,
        estimatedValue: lead.estimatedValue,
        description: lead.description,
        lostReason: lead.lostReason || null,
      },
    });
    leadsCreated++;
  }
  console.log(`   ✓ ${leadsCreated} leads created`);

  // 5. Create Opportunities (convert some leads to opps)
  console.log('\n💰 Creating CRM Opportunities...');
  const qualifiedLeads = LEADS.filter(l => l.status === 'QUALIFIED' || l.status === 'CONTACTED');
  let oppsCreated = 0;
  
  for (let i = 0; i < Math.min(qualifiedLeads.length, 8); i++) {
    const lead = qualifiedLeads[i];
    const accountName = accountNames[i % accountNames.length];
    const accountId = accounts[accountName].id;
    const stageName = lead.status === 'QUALIFIED' ? 'Proposal' : 'Qualification';
    
    await prisma.crmOpportunity.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        name: `${lead.title} - Opportunity`,
        accountId,
        contactId: contactByEmail[lead.contactEmail] || null,
        pipelineId: pipeline.id,
        stageId: stageMap[stageName],
        ownerId: salesRep.id,
        value: lead.estimatedValue || 50000,
        currency: 'MYR',
        probability: stageName === 'Proposal' ? 50 : 30,
        description: lead.description,
        expectedCloseDate: new Date(Date.now() + (30 + i * 15) * 24 * 60 * 60 * 1000), // 30-120 days out
      },
    });
    oppsCreated++;
  }
  console.log(`   ✓ ${oppsCreated} opportunities created`);

  // 6. Create Activities
  console.log('\n📅 Creating CRM Activities...');
  const activityTypes: CrmActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'TASK'];
  let activitiesCreated = 0;
  
  for (let i = 0; i < 20; i++) {
    const activityType = activityTypes[i % activityTypes.length];
    const accountName = accountNames[i % accountNames.length];
    const accountId = accounts[accountName].id;
    const contactIds = contacts[accountName];
    
    await prisma.crmActivity.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        activityType,
        subject: `${activityType} - ${accountName} Follow-up #${i + 1}`,
        description: `Sample activity: Discuss project requirements and timeline`,
        userId: salesRep.id,
        accountId,
        contactId: contactIds?.[0] || null,
        scheduledAt: new Date(Date.now() + (i * 2) * 24 * 60 * 60 * 1000),
        durationMinutes: 30 + (i % 3) * 30,
      },
    });
    activitiesCreated++;
  }
  console.log(`   ✓ ${activitiesCreated} activities created`);

  // 7. Create Notes
  console.log('\n📝 Creating CRM Notes...');
  let notesCreated = 0;
  
  for (let i = 0; i < 15; i++) {
    const accountName = accountNames[i % accountNames.length];
    const accountId = accounts[accountName].id;
    
    await prisma.crmNote.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        content: `**Meeting Notes #${i + 1}**\n\n- Discussed project scope and requirements\n- Client interested in Q3 implementation\n- Budget approved, waiting for final sign-off\n- Next follow-up scheduled for next week\n\n*Key contacts: Technical team + decision makers*`,
        authorId: salesRep.id,
        accountId,
        isPinned: i < 3, // Pin first 3 notes
      },
    });
    notesCreated++;
  }
  console.log(`   ✓ ${notesCreated} notes created`);

  // 8. Create KYC Records for primary contacts
  console.log('\n🔐 Creating KYC Records for primary contacts...');
  let kycCreated = 0;
  
  for (const [accountName, contactList] of Object.entries(CONTACTS)) {
    for (const contact of contactList) {
      if (!contact.isPrimary) continue;
      const contactId = contacts[accountName]?.[0];
      if (!contactId) continue;
      const isPep = contact.riskProfile === 'HIGH';
      await prisma.crmKycRecord.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          contactId,
          status: 'APPROVED',
          riskLevel: contact.riskProfile || 'MEDIUM',
          nricVerified: true,
          addressVerified: true,
          incomeVerified: true,
          sourceOfFundsVerified: true,
          riskProfileDone: true,
          isPep,
          amlRiskTier: isPep ? 'ENHANCED' : (contact.riskProfile === 'HIGH' ? 'ENHANCED' : contact.riskProfile === 'MEDIUM' ? 'STANDARD' : 'SIMPLIFIED'),
          screeningStatus: 'CLEAR',
          screeningHits: [{ source: 'PEP_SCREENING', result: isPep ? 'MATCH_FOUND' : 'NO_MATCH', checkedAt: new Date().toISOString(), details: isPep ? 'Politically Exposed Person identified' : 'No adverse findings' }],
          lastScreeningAt: new Date(),
          nextScreeningDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          approvedBy: salesRep.id,
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          notes: `CRM seed KYC — verified for ${contact.firstName} ${contact.lastName}`,
        },
      });
      kycCreated++;
    }
  }
  console.log(`   ✓ ${kycCreated} KYC records created`);

  // 9. Create Beneficiaries for Sunway Jeffrey Cheah
  console.log('\n👨‍👩‍👧‍👦 Creating Demo Beneficiaries...');
  let beneficiariesCreated = 0;
  
  const sunwayPrimaryId = contacts['Sunway Property Holdings']?.[0];
  if (sunwayPrimaryId) {
    const beneficiaries = [
      { firstName: 'Cheah', lastName: 'Yu Jin', relationship: 'SON', allocationPct: 40, email: 'yujin@sunwayproperty.com', nricPassport: '870101-10-5543', dateOfBirth: new Date('1987-01-01'), isMinor: false, notes: 'Eldest son, manages Sunway Construction' },
      { firstName: 'Cheah', lastName: 'Mei Lin', relationship: 'DAUGHTER', allocationPct: 35, email: 'meilin@sunwayproperty.com', nricPassport: '900505-14-5521', dateOfBirth: new Date('1990-05-05'), isMinor: false, notes: 'Daughter, runs Sunway Foundation' },
      { firstName: 'Cheah', lastName: 'Yu Hao', relationship: 'SON', allocationPct: 25, email: 'yuhao@sunwayproperty.com', nricPassport: '930812-10-5567', dateOfBirth: new Date('1993-08-12'), isMinor: false, notes: 'Youngest son, studying finance in London' },
    ];
    for (const b of beneficiaries) {
      await prisma.crmBeneficiary.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          contactId: sunwayPrimaryId,
          firstName: b.firstName,
          lastName: b.lastName,
          relationship: b.relationship,
          allocationPct: b.allocationPct,
          email: b.email,
          nricPassport: b.nricPassport,
          dateOfBirth: b.dateOfBirth,
          isMinor: b.isMinor,
          notes: b.notes,
        },
      });
      beneficiariesCreated++;
    }
  }
  console.log(`   ✓ ${beneficiariesCreated} beneficiaries created`);

  // 10. Create Trust Products
  console.log('\n🏦 Creating Demo Trust Products...');
  let trustProductsCreated = 0;
  
  // Family trust for Sunway
  const sunwayAccountId = accounts['Sunway Property Holdings']?.id;
  if (sunwayAccountId && sunwayPrimaryId) {
    await prisma.crmTrustProduct.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        accountId: sunwayAccountId,
        contactId: sunwayPrimaryId,
        trustType: 'FAMILY_TRUST',
        deedRefNumber: 'FT-SNW-2024-001',
        status: 'ACTIVE',
        assetValue: 120000000,
        currency: 'MYR',
        assetDescription: 'Sunway Group family trust — property portfolio across 15 developments',
        trusteeName: 'Citadel Trustee Bhd',
        trusteeContact: '+60 3-2780 9900',
        settlementDate: new Date('2024-01-15'),
        maturityDate: new Date('2044-01-15'),
        nextReviewDate: new Date('2026-01-15'),
        ownerId: salesManager.id,
      },
    });
    trustProductsCreated++;
  }
  
  // Corporate trust for Maybank
  const maybankAccountId = accounts['Maybank Islamic Berhad']?.id;
  const maybankPrimaryId = contacts['Maybank Islamic Berhad']?.[0];
  if (maybankAccountId && maybankPrimaryId) {
    await prisma.crmTrustProduct.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        accountId: maybankAccountId,
        contactId: maybankPrimaryId,
        trustType: 'CORPORATE_TRUST',
        deedRefNumber: 'CT-MYB-2023-005',
        status: 'ACTIVE',
        assetValue: 50000000,
        currency: 'MYR',
        assetDescription: 'Islamic corporate trust — sukuk portfolio management',
        trusteeName: 'Amanah Raya Berhad',
        trusteeContact: '+60 3-2693 7000',
        settlementDate: new Date('2023-06-01'),
        maturityDate: new Date('2038-06-01'),
        nextReviewDate: new Date('2026-06-01'),
        ownerId: salesManager.id,
      },
    });
    trustProductsCreated++;
  }
  console.log(`   ✓ ${trustProductsCreated} trust products created`);

  // Summary
  console.log('\n✅ CRM sample data seed completed!');
  console.log('\n📊 Summary:');
  console.log(`   • Accounts: ${ACCOUNTS.length}`);
  console.log(`   • Contacts: ${Object.values(CONTACTS).flat().length}`);
  console.log(`   • KYC: ${kycCreated}`);
  console.log(`   • Beneficiaries: ${beneficiariesCreated}`);
  console.log(`   • Trust Products: ${trustProductsCreated}`);
  console.log(`   • Pipelines: 1 (Sales: ${pipeline.stages.length} stages)`);
  console.log(`   • Leads: ${leadsCreated}`);
  console.log(`   • Opportunities: ${oppsCreated}`);
  console.log(`   • Activities: ${activitiesCreated}`);
  console.log(`   • Notes: ${notesCreated}`);
  console.log('\n💡 Login as:');
  console.log(`   • Sales Manager: salesmanager@test.local / abc@123`);
  console.log(`   • Sales Rep: salesrep@test.local / abc@123`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
