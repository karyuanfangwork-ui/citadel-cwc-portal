import { PrismaClient, LeadStatus, LeadSource, OpportunityStage, CrmActivityType } from '@prisma/client';

const prisma = new PrismaClient();

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
    country: 'Malaysia',
    registrationNumber: '197401001131',
    description: 'National oil and gas company',
    annualRevenue: 500000000,
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
    country: 'Malaysia',
    registrationNumber: '196001000321',
    description: 'Leading Islamic bank in Malaysia',
    annualRevenue: 350000000,
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
    registrationNumber: '199101013844',
    description: 'World largest glove manufacturer',
    annualRevenue: 280000000,
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
    registrationNumber: '202101023456',
    description: 'Digital travel and lifestyle platform',
    annualRevenue: 120000000,
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
    country: 'Malaysia',
    registrationNumber: '201201023456',
    description: 'Leading superapp for transport, food, and payments',
    annualRevenue: 450000000,
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
    registrationNumber: '198801012345',
    description: 'Integrated property development group',
    annualRevenue: 200000000,
  },
];

// Contacts per account (2 each)
const CONTACTS: Record<string, Array<{ firstName: string; lastName: string; jobTitle: string; email: string; phone: string; isPrimary: boolean }>> = {
  'Petronas Digital Sdn Bhd': [
    { firstName: 'Azman', lastName: 'Ibrahim', jobTitle: 'Chief Information Officer', email: 'azman.ibrahim@petronas.com', phone: '+60 12-345 6789', isPrimary: true },
    { firstName: 'Siti', lastName: 'Nurhaliza', jobTitle: 'IT Director', email: 'siti.n@petronas.com', phone: '+60 12-345 6790', isPrimary: false },
  ],
  'Maybank Islamic Berhad': [
    { firstName: 'Mohd', lastName: 'Faizal', jobTitle: 'Head of Digital Banking', email: 'faizal@maybank-islamic.com.my', phone: '+60 13-456 7890', isPrimary: true },
    { firstName: 'Aishah', lastName: 'Rahman', jobTitle: 'IT Manager', email: 'aishah.r@maybank-islamic.com.my', phone: '+60 13-456 7891', isPrimary: false },
  ],
  'Top Glove Corporation Bhd': [
    { firstName: 'Lim', lastName: 'Wee Chai', jobTitle: 'Managing Director', email: 'lim.wc@topglove.com', phone: '+60 14-567 8901', isPrimary: true },
    { firstName: 'Tan', lastName: 'Mei Ling', jobTitle: 'Operations Director', email: 'tan.ml@topglove.com', phone: '+60 14-567 8902', isPrimary: false },
  ],
  'AirAsia Digital Sdn Bhd': [
    { firstName: 'Riad', lastName: 'Asmat', jobTitle: 'CEO', email: 'riad@airasiadigital.com', phone: '+60 15-678 9012', isPrimary: true },
    { firstName: 'Nadia', lastName: 'Khalid', jobTitle: 'CTO', email: 'nadia.k@airasiadigital.com', phone: '+60 15-678 9013', isPrimary: false },
  ],
  'Grab Malaysia Sdn Bhd': [
    { firstName: 'Ooi', lastName: 'Kuang Ping', jobTitle: 'Managing Director', email: 'kuangping@grab.com', phone: '+60 16-789 0123', isPrimary: true },
    { firstName: 'Sarah', lastName: 'Tan', jobTitle: 'Head of Engineering', email: 'sarah.t@grab.com', phone: '+60 16-789 0124', isPrimary: false },
  ],
  'Sunway Property Holdings': [
    { firstName: 'Jeffrey', lastName: 'Cheah', jobTitle: 'Executive Chairman', email: 'jeffrey.cheah@sunwayproperty.com', phone: '+60 17-890 1234', isPrimary: true },
    { firstName: 'Michelle', lastName: 'Wong', jobTitle: 'Sales Director', email: 'michelle.w@sunwayproperty.com', phone: '+60 17-890 1235', isPrimary: false },
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
      data: { ...acc, ownerId: owner.id },
    });
    accounts[acc.name] = created;
    console.log(`   ✓ ${acc.name} (Owner: ${owner.firstName})`);
  }

  // 2. Create Contacts
  console.log('\n👥 Creating CRM Contacts...');
  const contacts: Record<string, string[]> = {};
  
  for (const [accountName, contactList] of Object.entries(CONTACTS)) {
    const accountId = accounts[accountName].id;
    contacts[accountName] = [];
    
    for (const contact of contactList) {
      const created = await prisma.crmContact.create({
        data: { ...contact, accountId },
      });
      contacts[accountName].push(created.id);
    }
    console.log(`   ✓ ${accountName}: ${contactList.length} contacts`);
  }

  // 3. Create Sales Pipeline with Stages
  console.log('\n🔀 Creating CRM Pipeline...');
  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: 'Sales Pipeline',
      description: 'Unified sales pipeline for tracking deals from prospecting to close',
      isDefault: true,
      stages: {
        create: [
          { name: 'Prospecting', displayOrder: 0, probability: 10, color: '#6366f1', isWonStage: false, isLostStage: false },
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
  console.log(`   ✓ Pipeline: ${pipeline.name} with ${pipeline.stages.length} stages`);

  const stageMap: Record<string, string> = {};
  console.log('\n🎯 Creating CRM Leads...');
  let leadsCreated = 0;
  const accountNames = Object.keys(accounts);
  
  for (const lead of LEADS) {
    const randomAccount = accountNames[Math.floor(Math.random() * accountNames.length)];
    await prisma.crmLead.create({
      data: {
        title: lead.title,
        status: lead.status as LeadStatus,
        source: lead.source as LeadSource,
        ownerId: salesRep.id,
        accountId: accounts[randomAccount]?.id || null,
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
        name: `${lead.title} - Opportunity`,
        accountId,
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
        content: `**Meeting Notes #${i + 1}**\n\n- Discussed project scope and requirements\n- Client interested in Q3 implementation\n- Budget approved, waiting for final sign-off\n- Next follow-up scheduled for next week\n\n*Key contacts: Technical team + decision makers*`,
        authorId: salesRep.id,
        accountId,
        isPinned: i < 3, // Pin first 3 notes
      },
    });
    notesCreated++;
  }
  console.log(`   ✓ ${notesCreated} notes created`);

  // Summary
  console.log('\n✅ CRM sample data seed completed!');
  console.log('\n📊 Summary:');
  console.log(`   • Accounts: ${ACCOUNTS.length}`);
  console.log(`   • Contacts: ${Object.values(CONTACTS).flat().length}`);
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
