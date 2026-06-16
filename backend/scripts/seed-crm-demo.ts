/**
 * CRM Demo Seed Script
 * Creates comprehensive demo data for the entire CRM module showcase.
 *
 * Usage:  npx tsx scripts/seed-crm-demo.ts
 *
 * Creates: pipelines, accounts (corporate/SME/individual), contacts, leads,
 *          opportunities at various stages, activities, and notes.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── User IDs (production server) ──────────────────────────────────────────
// These IDs are environment-specific. Update when deploying to a new server.
const USERS = {
  admin:    '3b612a93-dc95-4749-bb47-7587a09d4d55',  // Fang Kar Yuan (admin@test.local)
  emily:    '03e2bac8-c435-40b0-bd81-cfd010c131dc',  // Emily Chow (CEO)
  ahmad:    '3113c091-8a86-4a97-a2e8-ab44d11867e2',  // Ahmad Razali (Sales Manager)
  nurul:    'd9a3da4c-bf9e-4e88-9967-e15bc474f7d5',  // Nurul Ain (Relationship Manager)
  sarah:    'ead05048-1c1c-41ce-86e7-4a47737d0e6e',  // Sarah Tan (Credit Manager)
  rajesh:   '68cbc3b0-d609-4104-b1a3-2e6728dd14fa',  // Rajesh Kumar (Credit Analyst)
  jane:     'ec8475f9-2523-485e-bfb8-63b917a60411',  // Jane Smith (Marketing Manager)
};

const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);
const futureDate = (d: number) => new Date(NOW.getTime() + d * 86400000);

async function main() {
  console.log('🌱 Seeding CRM demo data...\n');

  // ─── 1. Pipelines ────────────────────────────────────────────────────────
  console.log('1. Creating pipelines & stages...');

  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: 'Sales Pipeline',
      description: 'Standard sales pipeline for CRM opportunities',
      isDefault: true,
      isActive: true,
      stages: {
        create: [
          { name: 'Prospecting',   displayOrder: 1, probability: 10, color: '#6366f1' },
          { name: 'Qualification',  displayOrder: 2, probability: 25, color: '#8b5cf6' },
          { name: 'Proposal',       displayOrder: 3, probability: 50, color: '#f59e0b' },
          { name: 'Negotiation',    displayOrder: 4, probability: 75, color: '#ef4444' },
          { name: 'Closed Won',     displayOrder: 5, probability: 100, color: '#059669', isWonStage: true },
          { name: 'Closed Lost',    displayOrder: 6, probability: 0, color: '#9ca3af', isLostStage: true },
        ],
      },
    },
    include: { stages: true },
  });

  const stageMap: Record<string, string> = {};
  for (const s of pipeline.stages) stageMap[s.name] = s.id;

  // ─── 2. Accounts (Customers) ────────────────────────────────────────────
  console.log('2. Creating accounts...');

  const accounts = await Promise.all([
    // CORPORATE accounts
    prisma.crmAccount.create({ data: {
      name: 'Petronas Digital Solutions Sdn Bhd', accountType: 'CORPORATE',
      industry: 'Oil & Gas', companySize: 'Enterprise (1000+)', website: 'https://petronas-digital.com.my',
      phone: '+60-3-2331-8888', email: 'procurement@petronas-digital.com.my',
      address: 'Tower 1, PETRONAS Twin Towers, KLCC', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '50088',
      description: 'Major national oil company digital transformation arm. Key strategic account for enterprise trust products.',
      annualRevenue: 250000000, registrationNumber: '201901234567', taxNumber: 'GST-123456-789',
      ownerId: USERS.ahmad, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Maybank Islamic Banking', accountType: 'CORPORATE',
      industry: 'Banking & Finance', companySize: 'Enterprise (1000+)', website: 'https://maybankislamic.com.my',
      phone: '+60-3-2074-6888', email: 'corporate.banking@maybankislamic.com.my',
      address: 'Menara Maybank, 100 Jalan Tun Perak', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '50050',
      description: 'Islamic banking division of Maybank. Interested in wealth management trust products.',
      annualRevenue: 180000000, registrationNumber: '202005678901', taxNumber: 'GST-234567-890',
      ownerId: USERS.ahmad, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Genting Berhad', accountType: 'CORPORATE',
      industry: 'Hospitality & Gaming', companySize: 'Enterprise (1000+)', website: 'https://genting.com',
      phone: '+60-3-2718-2828', email: 'corp.services@genting.com',
      address: 'Genting Malaysia Berhad, Wisma Genting, Jalan Sultan Ismail', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '50250',
      description: 'Hospitality and entertainment conglomerate. Exploring corporate trust restructuring.',
      annualRevenue: 120000000, registrationNumber: '197801234567', taxNumber: 'GST-345678-901',
      ownerId: USERS.nurul, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Sime Darby Plantation', accountType: 'CORPORATE',
      industry: 'Agriculture & Plantation', companySize: 'Enterprise (1000+)', website: 'https://simedarbyplantation.com',
      phone: '+60-3-2717-6000', email: 'finance@simedarbyplantation.com',
      address: 'Menara Sime Darby, Jalan Raja Laut', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '50200',
      description: 'One of the world\'s largest palm oil plantation companies. Needs corporate trust for employee benefits.',
      annualRevenue: 95000000, registrationNumber: '200907890123', taxNumber: 'GST-456789-012',
      ownerId: USERS.nurul, isActive: true,
    }}),

    // SME accounts
    prisma.crmAccount.create({ data: {
      name: 'TechVenture Solutions Sdn Bhd', accountType: 'CORPORATE',
      industry: 'Technology', companySize: 'SME (51-200)', website: 'https://techventure.com.my',
      phone: '+60-4-228-3399', email: 'info@techventure.com.my',
      address: 'Gurney Tower, Unit 12-05, Jalan Kelawai', city: 'George Town', state: 'Pulau Pinang', country: 'MY', postalCode: '10250',
      description: 'Growing fintech startup in Penang. Needs cash management trust for B2B operations.',
      annualRevenue: 8500000, registrationNumber: '202103456789', taxNumber: 'GST-567890-123',
      ownerId: USERS.nurul, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Green Valley Organics Sdn Bhd', accountType: 'CORPORATE',
      industry: 'Agriculture', companySize: 'SME (11-50)', website: 'https://greenvalleyorganics.my',
      phone: '+60-5-245-1188', email: 'hello@greenvalleyorganics.my',
      address: 'Lot 45, Jalan Ipoh-Lumut, Taman Klebang', city: 'Ipoh', state: 'Perak', country: 'MY', postalCode: '30000',
      description: 'Organic food producer with growing export market. Needs trust for supply chain financing.',
      annualRevenue: 3200000, registrationNumber: '202004567890', taxNumber: 'GST-678901-234',
      ownerId: USERS.ahmad, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Penang Property Holdings Sdn Bhd', accountType: 'CORPORATE',
      industry: 'Real Estate', companySize: 'SME (11-50)', website: 'https://penangproperty.com.my',
      phone: '+60-4-265-7799', email: 'sales@penangproperty.com.my',
      address: 'Suite 8A, Gama Tower, Jalan Macalister', city: 'George Town', state: 'Pulau Pinang', country: 'MY', postalCode: '10400',
      description: 'Property developer in northern region. Needs trust for project escrow management.',
      annualRevenue: 15000000, registrationNumber: '201805678901', taxNumber: 'GST-789012-345',
      bankAccount: 'MBB-4523-8901-2345',
      ownerId: USERS.nurul, isActive: true,
    }}),

    // INDIVIDUAL accounts (retail)
    prisma.crmAccount.create({ data: {
      name: 'Tan Boon Wah', accountType: 'INDIVIDUAL',
      industry: 'Professional Services', companySize: 'Individual',
      phone: '+60-12-345-6789', email: 'boonwah.tan@gmail.com',
      address: '12, Jalan SS2/72, Petaling Jaya', city: 'Petaling Jaya', state: 'Selangor', country: 'MY', postalCode: '47300',
      description: 'High-net-worth individual. Interested in personal trust and estate planning.',
      annualRevenue: 500000, ownerId: USERS.ahmad, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Lim Siew Kheng', accountType: 'INDIVIDUAL',
      industry: 'Retail', companySize: 'Individual',
      phone: '+60-16-789-0123', email: 'siewkheng.lim@yahoo.com',
      address: '45, Taman Megah, SS4/2', city: 'Petaling Jaya', state: 'Selangor', country: 'MY', postalCode: '47301',
      description: 'Retired school principal looking for wealth preservation trust.',
      annualRevenue: 180000, ownerId: USERS.nurul, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Dr. Rajesh Nair', accountType: 'INDIVIDUAL',
      industry: 'Healthcare', companySize: 'Individual',
      phone: '+60-19-234-5678', email: 'rajesh.nair@clinic.com.my',
      address: '88, Jalan Ampang Hilir', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '55000',
      description: 'Medical specialist. Interested in medical practice trust and family wealth protection.',
      annualRevenue: 750000, ownerId: USERS.ahmad, isActive: true,
    }}),
    prisma.crmAccount.create({ data: {
      name: 'Aisha Binti Mohammad', accountType: 'INDIVIDUAL',
      industry: 'Education', companySize: 'Individual',
      phone: '+60-13-567-8901', email: 'aisha.mohammad@outlook.com',
      address: '23, Jalan Beringin, Taman Tun Dr Ismail', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', country: 'MY', postalCode: '60000',
      description: 'University professor seeking education trust for children.',
      annualRevenue: 200000, ownerId: USERS.nurul, isActive: true,
    }}),
    // Inactive account for testing
    prisma.crmAccount.create({ data: {
      name: 'Closed Enterprise Sdn Bhd', accountType: 'CORPORATE',
      industry: 'Manufacturing', companySize: 'SME (11-50)',
      phone: '+60-6-234-5678', email: 'info@closed-enterprise.my',
      address: 'Lot 12, Melaka Industrial Park', city: 'Melaka', state: 'Melaka', country: 'MY', postalCode: '75450',
      description: 'Former client. Account closed after bankruptcy proceedings.',
      annualRevenue: 5000000, ownerId: USERS.ahmad, isActive: false,
    }}),
  ]);

  const [petronas, maybank, genting, simeDarby, techVenture, greenValley, penangProp, boonWah, siewKheng, rajeshNair, aisha, closedEnt] = accounts;

  // ─── 3. Contacts ──────────────────────────────────────────────────────────
  console.log('3. Creating contacts...');

  const contacts = await Promise.all([
    // Petronas contacts
    prisma.crmContact.create({ data: { accountId: petronas.id, firstName: 'Farid', lastName: 'Abdul Rahman', email: 'farid.ar@petronas-digital.com.my', phone: '+60-3-2331-8901', mobile: '+60-12-234-5678', jobTitle: 'Chief Technology Officer', department: 'Technology', isPrimary: true }}),
    prisma.crmContact.create({ data: { accountId: petronas.id, firstName: 'Siti', lastName: 'Hassan', email: 'siti.hassan@petronas-digital.com.my', phone: '+60-3-2331-8902', jobTitle: 'Procurement Manager', department: 'Procurement', isPrimary: false }}),
    // Maybank contacts
    prisma.crmContact.create({ data: { accountId: maybank.id, firstName: 'David', lastName: 'Liew', email: 'david.liew@maybankislamic.com.my', phone: '+60-3-2074-6901', mobile: '+60-16-789-2345', jobTitle: 'VP of Corporate Trust', department: 'Trust Services', isPrimary: true }}),
    prisma.crmContact.create({ data: { accountId: maybank.id, firstName: 'Amirah', lastName: 'Othman', email: 'amirah.o@maybankislamic.com.my', phone: '+60-3-2074-6902', jobTitle: 'Relationship Manager', department: 'Wealth Management', isPrimary: false }}),
    // Genting contacts
    prisma.crmContact.create({ data: { accountId: genting.id, firstName: 'Michael', lastName: 'Tan', email: 'michael.tan@genting.com', phone: '+60-3-2718-2829', mobile: '+60-19-345-6789', jobTitle: 'CFO', department: 'Finance', isPrimary: true }}),
    // Sime Darby contacts
    prisma.crmContact.create({ data: { accountId: simeDarby.id, firstName: 'Priya', lastName: 'Menon', email: 'priya.m@simedarbyplantation.com', phone: '+60-3-2717-6010', jobTitle: 'Head of HR', department: 'Human Resources', isPrimary: true }}),
    // TechVenture contacts
    prisma.crmContact.create({ data: { accountId: techVenture.id, firstName: 'Kumar', lastName: 'Subramaniam', email: 'kumar@techventure.com.my', phone: '+60-4-228-3400', mobile: '+60-11-456-7890', jobTitle: 'CEO & Founder', department: 'Executive', isPrimary: true }}),
    // Green Valley contacts
    prisma.crmContact.create({ data: { accountId: greenValley.id, firstName: 'Azlan', lastName: 'Ibrahim', email: 'azlan@greenvalleyorganics.my', phone: '+60-5-245-1199', jobTitle: 'Managing Director', department: 'Executive', isPrimary: true }}),
    // Penang Property contacts
    prisma.crmContact.create({ data: { accountId: penangProp.id, firstName: 'Chew', lastName: 'Wei Jie', email: 'chew.wj@penangproperty.com.my', phone: '+60-4-265-7800', mobile: '+60-17-890-1234', jobTitle: 'Project Director', department: 'Development', isPrimary: true }}),
    // Individual account contacts (they are their own primary contacts)
    prisma.crmContact.create({ data: { accountId: boonWah.id, firstName: 'Boon Wah', lastName: 'Tan', email: 'boonwah.tan@gmail.com', phone: '+60-12-345-6789', jobTitle: 'Consultant', department: 'Self-employed', isPrimary: true }}),
    prisma.crmContact.create({ data: { accountId: siewKheng.id, firstName: 'Siew Kheng', lastName: 'Lim', email: 'siewkheng.lim@yahoo.com', phone: '+60-16-789-0123', jobTitle: 'Retiree', department: 'N/A', isPrimary: true }}),
    prisma.crmContact.create({ data: { accountId: rajeshNair.id, firstName: 'Rajesh', lastName: 'Nair', email: 'rajesh.nair@clinic.com.my', phone: '+60-19-234-5678', jobTitle: 'Medical Specialist', department: 'Healthcare', isPrimary: true }}),
    prisma.crmContact.create({ data: { accountId: aisha.id, firstName: 'Aisha', lastName: 'Mohammad', email: 'aisha.mohammad@outlook.com', phone: '+60-13-567-8901', jobTitle: 'Associate Professor', department: 'Education', isPrimary: true }}),
  ]);

  // ─── 4. Leads ─────────────────────────────────────────────────────────────
  console.log('4. Creating leads...');

  // Create territories
  const kvTerritory = await prisma.crmTerritory.create({
    data: { name: '[DEMO] Klang Valley', description: 'Klang Valley region — Selangor, KL, Putrajaya', regions: { states: ['Selangor', 'Wilayah Persekutuan', 'Putrajaya'], countries: ['MY'] }, isActive: true, createdBy: USERS.admin },
  });
  const nrTerritory = await prisma.crmTerritory.create({
    data: { name: '[DEMO] Northern Region', description: 'Northern region — Penang, Kedah, Perak', regions: { states: ['Pulau Pinang', 'Kedah', 'Perak'], countries: ['MY'] }, isActive: true, createdBy: USERS.admin },
  });
  const territoryKV = kvTerritory.id;
  const territoryNR = nrTerritory.id;

  const leads = await Promise.all([
    // Hot leads
    prisma.crmLead.create({ data: {
      title: 'CelcomDigi Enterprise Trust Partnership', status: 'QUALIFIED', source: 'REFERRAL',
      accountId: null, contactId: null, ownerId: USERS.ahmad, territoryId: territoryKV,
      contactName: 'Zulkifli Ismail', contactEmail: 'zulkifli@celcomdigi.com', contactPhone: '+60-13-888-1234', companyName: 'CelcomDigi Berhad',
      estimatedValue: 4500000, description: 'Large telco looking for corporate trust restructuring. Strong interest from CFO.',
      followUpDate: futureDate(3), followUpNote: 'Follow up with Zulkifli on proposal feedback.',
      aiScore: 92, aiScoreReason: 'High-value enterprise prospect with executive sponsor.', ruleScore: 85,
    }}),
    prisma.crmLead.create({ data: {
      title: 'AirAsia Superapp Trust Infrastructure', status: 'QUALIFIED', source: 'TRADE_SHOW',
      accountId: null, contactId: null, ownerId: USERS.nurul, territoryId: territoryKV,
      contactName: 'Sharmila Devi', contactEmail: 'sharmila@airasia.com', contactPhone: '+60-19-777-5678', companyName: 'AirAsia Group Berhad',
      estimatedValue: 8000000, description: 'Digital superapp requiring trust infrastructure for escrow and payment trust services.',
      followUpDate: futureDate(5), followUpNote: 'Schedule demo with technical team.',
      aiScore: 88, aiScoreReason: 'High-value digital economy player with immediate need.', ruleScore: 80,
    }}),
    // Warm leads
    prisma.crmLead.create({ data: {
      title: 'IGB Corporation Trust Review', status: 'CONTACTED', source: 'LINKEDIN',
      accountId: null, contactId: null, ownerId: USERS.ahmad, territoryId: territoryKV,
      contactName: 'Richard Yoong', contactEmail: 'richard.y@igb.com.my', contactPhone: '+60-3-7958-2200', companyName: 'IGB Corporation',
      estimatedValue: 2000000, description: 'Property conglomerate exploring trust options for REIT restructuring.',
      followUpDate: futureDate(10), followUpNote: 'Send comparison proposal for REIT trust vs. direct.',
      aiScore: 72, aiScoreReason: 'Established property group with active REIT operations.', ruleScore: 65,
    }}),
    prisma.crmLead.create({ data: {
      title: 'MBSB Bank Wealth Trust', status: 'CONTACTED', source: 'WEBSITE',
      accountId: null, contactId: null, ownerId: USERS.nurul, territoryId: territoryKV,
      contactName: 'Hafiz Othman', contactEmail: 'hafiz@mbsb.com.my', contactPhone: '+60-3-2606-6600', companyName: 'MBSB Bank Berhad',
      estimatedValue: 3500000, description: 'Islamic bank seeking trust product partnerships for wealth management.',
      followUpDate: futureDate(7),
      aiScore: 65, ruleScore: 58,
    }}),
    // New leads
    prisma.crmLead.create({ data: {
      title: 'Sunway Group Corporate Trust', status: 'NEW', source: 'COLD_CALL',
      accountId: null, contactId: null, ownerId: USERS.ahmad, territoryId: territoryKV,
      contactName: 'Jenny Loo', contactEmail: 'jenny.loo@sunway.com.my', contactPhone: '+60-3-7495-1888', companyName: 'Sunway Group',
      estimatedValue: 5500000, description: 'Conglomerate with diverse business units. Initial cold call yielded interest.',
      followUpDate: futureDate(14),
      aiScore: 55, ruleScore: 50,
    }}),
    prisma.crmLead.create({ data: {
      title: 'Northern Palm Oil Millers Association', status: 'NEW', source: 'WHATSAPP',
      accountId: null, contactId: null, ownerId: USERS.nurul, territoryId: territoryNR,
      contactName: 'Encik Razak', contactEmail: 'razak@npoma.my', contactPhone: '+60-4-555-2345', companyName: 'Northern Palm Oil Millers Association',
      estimatedValue: 750000, description: 'Association of 15 millers in Kedah/Perak interested in collective trust services.',
      followUpDate: futureDate(14),
      aiScore: 42, ruleScore: 40,
    }}),
    // Converted lead
    prisma.crmLead.create({ data: {
      title: 'TechVenture Solutions Trust Setup', status: 'CONVERTED', source: 'REFERRAL',
      accountId: techVenture.id, contactId: contacts[6].id, ownerId: USERS.nurul, territoryId: territoryNR,
      contactName: 'Kumar Subramaniam', contactEmail: 'kumar@techventure.com.my', companyName: 'TechVenture Solutions Sdn Bhd',
      estimatedValue: 850000, description: 'Fintech startup requiring corporate trust for B2B operations.',
      convertedAt: daysAgo(30),
      aiScore: 78, ruleScore: 72,
    }}),
    // Lost lead
    prisma.crmLead.create({ data: {
      title: 'Top Glove Corporation Trust', status: 'LOST', source: 'LINKEDIN',
      accountId: null, contactId: null, ownerId: USERS.ahmad, territoryId: territoryKV,
      contactName: 'Dr. Lim Wee Chai', contactEmail: 'lim.wc@topglove.com', contactPhone: '+60-3-7806-6888', companyName: 'Top Glove Corporation',
      estimatedValue: 6000000, description: 'Glove manufacturer explored trust options but decided to stay with incumbent bank.',
      lostReason: 'Chose competitor — existing banking relationship too entrenched.',
      aiScore: 35, ruleScore: 30,
    }}),
    // Unqualified
    prisma.crmLead.create({ data: {
      title: 'Freelance Designer Trust Inquiry', status: 'UNQUALIFIED', source: 'WEBSITE',
      accountId: null, contactId: null, ownerId: USERS.nurul,
      contactName: 'Nadia Hassan', contactEmail: 'nadia.h@gmail.com', contactPhone: '+60-11-222-3344', companyName: 'N/A',
      estimatedValue: 5000, description: 'Freelance designer with minimal assets. Does not meet minimum trust threshold.',
      lostReason: 'Below minimum trust threshold (RM50K).',
      ruleScore: 10,
    }}),
  ]);

  // ─── 5. Opportunities ────────────────────────────────────────────────────
  console.log('5. Creating opportunities...');

  const opportunities = await Promise.all([
    // Prospecting
    prisma.crmOpportunity.create({ data: {
      name: 'Petronas Digital Trust Restructuring', accountId: petronas.id, contactId: contacts[0].id,
      pipelineId: pipeline.id, stageId: stageMap['Prospecting'], ownerId: USERS.ahmad,
      value: 12000000, currency: 'MYR', probability: 10, expectedCloseDate: futureDate(90),
      description: 'Enterprise trust restructuring for Petronas Digital. Initial conversations with CTO.',
    }}),
    // Qualification
    prisma.crmOpportunity.create({ data: {
      name: 'Maybank Islamic Wealth Trust', accountId: maybank.id, contactId: contacts[2].id,
      pipelineId: pipeline.id, stageId: stageMap['Qualification'], ownerId: USERS.ahmad,
      value: 8500000, currency: 'MYR', probability: 25, expectedCloseDate: futureDate(60),
      description: 'Islamic banking trust product partnership. VP of Corporate Trust is very interested.',
    }}),
    // Proposal
    prisma.crmOpportunity.create({ data: {
      name: 'Gentining Corporate Escrow', accountId: genting.id, contactId: contacts[4].id,
      pipelineId: pipeline.id, stageId: stageMap['Proposal'], ownerId: USERS.nurul,
      value: 6000000, currency: 'MYR', probability: 50, expectedCloseDate: futureDate(30),
      description: 'Corporate trust restructuring proposal submitted. CFO reviewing terms.',
    }}),
    prisma.crmOpportunity.create({ data: {
      name: 'Sime Darby Employee Benefits Trust', accountId: simeDarby.id, contactId: contacts[5].id,
      pipelineId: pipeline.id, stageId: stageMap['Proposal'], ownerId: USERS.nurul,
      value: 4500000, currency: 'MYR', probability: 50, expectedCloseDate: futureDate(45),
      description: 'Employee benefits trust proposal for plantation workers. HR Head is champion.',
    }}),
    // Negotiation
    prisma.crmOpportunity.create({ data: {
      name: 'TechVenture B2B Trust Platform', accountId: techVenture.id, contactId: contacts[6].id,
      pipelineId: pipeline.id, stageId: stageMap['Negotiation'], ownerId: USERS.nurul,
      value: 2800000, currency: 'MYR', probability: 75, expectedCloseDate: futureDate(14),
      description: 'Final negotiation on pricing. CEO wants 15% discount on annual fee.',
    }}),
    // Closed Won
    prisma.crmOpportunity.create({ data: {
      name: 'Green Valley Supply Chain Trust', accountId: greenValley.id, contactId: contacts[7].id,
      pipelineId: pipeline.id, stageId: stageMap['Closed Won'], ownerId: USERS.ahmad,
      value: 1500000, currency: 'MYR', probability: 100, expectedCloseDate: daysAgo(10),
      description: 'Supply chain financing trust signed. Annual renewal expected.',
      wonAt: daysAgo(10),
    }}),
    prisma.crmOpportunity.create({ data: {
      name: 'Penang Property Escrow Trust', accountId: penangProp.id, contactId: contacts[8].id,
      pipelineId: pipeline.id, stageId: stageMap['Closed Won'], ownerId: USERS.nurul,
      value: 3500000, currency: 'MYR', probability: 100, expectedCloseDate: daysAgo(25),
      description: 'Property development escrow trust won. 3-year contract signed.',
      wonAt: daysAgo(25),
    }}),
    // Closed Lost
    prisma.crmOpportunity.create({ data: {
      name: 'Tan Boon Wah Personal Trust', accountId: boonWah.id, contactId: contacts[9].id,
      pipelineId: pipeline.id, stageId: stageMap['Closed Lost'], ownerId: USERS.ahmad,
      value: 800000, currency: 'MYR', probability: 0, expectedCloseDate: daysAgo(20),
      description: 'HNWI decided to go with a private banker\'s trust recommendation instead.',
      lostReason: 'Competitor offered better terms through private banking channel.',
      lostAt: daysAgo(20),
    }}),
    // Individual account opportunities
    prisma.crmOpportunity.create({ data: {
      name: 'Dr. Nair Medical Practice Trust', accountId: rajeshNair.id, contactId: contacts[11].id,
      pipelineId: pipeline.id, stageId: stageMap['Qualification'], ownerId: USERS.ahmad,
      value: 1200000, currency: 'MYR', probability: 25, expectedCloseDate: futureDate(60),
      description: 'Medical specialist seeking practice protection trust and family wealth trust.',
    }}),
    prisma.crmOpportunity.create({ data: {
      name: 'Aisha Education Trust', accountId: aisha.id, contactId: contacts[12].id,
      pipelineId: pipeline.id, stageId: stageMap['Prospecting'], ownerId: USERS.nurul,
      value: 400000, currency: 'MYR', probability: 10, expectedCloseDate: futureDate(90),
      description: 'Professor exploring education trust for children\'s university fund.',
    }}),
  ]);

  // ─── 6. Stage History ────────────────────────────────────────────────────
  console.log('6. Creating stage histories...');

  const stageHistories = [
    // Green Valley: Prospecting → Qualification → Proposal → Negotiation → Closed Won
    { oppId: opportunities[5].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(90), movedBy: USERS.ahmad },
    { oppId: opportunities[5].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(75), movedBy: USERS.ahmad },
    { oppId: opportunities[5].id, fromName: 'Qualification', toName: 'Proposal', movedAt: daysAgo(60), movedBy: USERS.ahmad },
    { oppId: opportunities[5].id, fromName: 'Proposal', toName: 'Negotiation', movedAt: daysAgo(30), movedBy: USERS.ahmad },
    { oppId: opportunities[5].id, fromName: 'Negotiation', toName: 'Closed Won', movedAt: daysAgo(10), movedBy: USERS.emily },
    // Penang Property: similar progression
    { oppId: opportunities[6].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(120), movedBy: USERS.nurul },
    { oppId: opportunities[6].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(100), movedBy: USERS.nurul },
    { oppId: opportunities[6].id, fromName: 'Qualification', toName: 'Proposal', movedAt: daysAgo(70), movedBy: USERS.nurul },
    { oppId: opportunities[6].id, fromName: 'Proposal', toName: 'Negotiation', movedAt: daysAgo(45), movedBy: USERS.nurul },
    { oppId: opportunities[6].id, fromName: 'Negotiation', toName: 'Closed Won', movedAt: daysAgo(25), movedBy: USERS.emily },
    // TechVenture: current at Negotiation
    { oppId: opportunities[4].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(60), movedBy: USERS.nurul },
    { oppId: opportunities[4].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(50), movedBy: USERS.nurul },
    { oppId: opportunities[4].id, fromName: 'Qualification', toName: 'Proposal', movedAt: daysAgo(35), movedBy: USERS.nurul },
    { oppId: opportunities[4].id, fromName: 'Proposal', toName: 'Negotiation', movedAt: daysAgo(15), movedBy: USERS.nurul },
    // Genting: current at Proposal
    { oppId: opportunities[2].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(50), movedBy: USERS.nurul },
    { oppId: opportunities[2].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(40), movedBy: USERS.nurul },
    { oppId: opportunities[2].id, fromName: 'Qualification', toName: 'Proposal', movedAt: daysAgo(20), movedBy: USERS.nurul },
    // Sime Darby: current at Proposal
    { oppId: opportunities[3].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(40), movedBy: USERS.nurul },
    { oppId: opportunities[3].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(30), movedBy: USERS.nurul },
    { oppId: opportunities[3].id, fromName: 'Qualification', toName: 'Proposal', movedAt: daysAgo(15), movedBy: USERS.nurul },
    // Maybank: current at Qualification
    { oppId: opportunities[1].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(35), movedBy: USERS.ahmad },
    { oppId: opportunities[1].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(20), movedBy: USERS.ahmad },
    // Petronas: current at Prospecting
    { oppId: opportunities[0].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(14), movedBy: USERS.ahmad },
    // Dr Nair: current at Qualification
    { oppId: opportunities[8].id, fromName: null, toName: 'Prospecting', movedAt: daysAgo(20), movedBy: USERS.ahmad },
    { oppId: opportunities[8].id, fromName: 'Prospecting', toName: 'Qualification', movedAt: daysAgo(10), movedBy: USERS.ahmad },
  ];

  for (const h of stageHistories) {
    await prisma.crmOpportunityStageHistory.create({
      data: {
        opportunityId: h.oppId,
        fromStageName: h.fromName,
        toStageName: h.toName,
        movedByUserId: h.movedBy,
        movedAt: h.movedAt,
      },
    });
  }

  // ─── 7. Activities ────────────────────────────────────────────────────────
  console.log('7. Creating activities...');

  const activities: Array<{ activityType: string; subject: string; accountId: string; ownerId: string; scheduledAt: Date; completedAt?: Date; durationMinutes?: number; description?: string; contactId?: string; opportunityId?: string; leadId?: string }> = [
    // Petronas activities
    { activityType: 'MEETING', subject: 'Initial meeting with CTO Farid', accountId: petronas.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(14), completedAt: daysAgo(14), durationMinutes: 60, description: 'Discussed trust restructuring requirements. CTO very interested.' },
    { activityType: 'CALL', subject: 'Follow-up call with Procurement', accountId: petronas.id, contactId: contacts[1].id, ownerId: USERS.ahmad, scheduledAt: daysAgo(7), completedAt: daysAgo(7), durationMinutes: 30, description: 'Siti requested formal proposal document.' },
    { activityType: 'EMAIL', subject: 'Send trust product brochure', accountId: petronas.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(5), completedAt: daysAgo(5) },
    { activityType: 'FOLLOW_UP', subject: 'Follow up on proposal', accountId: petronas.id, ownerId: USERS.ahmad, scheduledAt: futureDate(3) },
    // Maybank activities
    { activityType: 'MEETING', subject: 'VP Liew — trust product presentation', accountId: maybank.id, contactId: contacts[2].id, ownerId: USERS.ahmad, scheduledAt: daysAgo(21), completedAt: daysAgo(21), durationMinutes: 90, description: 'Presented Islamic wealth trust products. Strong interest.' },
    { activityType: 'SITE_VISIT', subject: 'Maybank HQ office visit', accountId: maybank.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(10), completedAt: daysAgo(10), durationMinutes: 120 },
    { activityType: 'CALL', subject: 'Qualification call with Amirah', accountId: maybank.id, contactId: contacts[3].id, ownerId: USERS.nurul, scheduledAt: daysAgo(3), completedAt: daysAgo(3), durationMinutes: 25 },
    // Genting activities
    { activityType: 'MEETING', subject: 'Proposal presentation to CFO', accountId: genting.id, contactId: contacts[4].id, ownerId: USERS.nurul, scheduledAt: daysAgo(10), completedAt: daysAgo(10), durationMinutes: 75, description: 'Presented corporate trust restructuring proposal. CFO reviewing.' },
    { activityType: 'EMAIL', subject: 'Revised terms follow-up', accountId: genting.id, ownerId: USERS.nurul, scheduledAt: daysAgo(2), completedAt: daysAgo(2) },
    // Sime Darby
    { activityType: 'MEETING', subject: 'HR Head Priya — employee benefits trust', accountId: simeDarby.id, contactId: contacts[5].id, ownerId: USERS.nurul, scheduledAt: daysAgo(30), completedAt: daysAgo(30), durationMinutes: 60, description: 'Initial discovery meeting. HR champion for employee benefits trust.' },
    { activityType: 'CALL', subject: 'Follow-up on benefits proposal', accountId: simeDarby.id, ownerId: USERS.nurul, scheduledAt: daysAgo(5), completedAt: daysAgo(5), durationMinutes: 20 },
    // TechVenture
    { activityType: 'MEETING', subject: 'Negotiation meeting with CEO Kumar', accountId: techVenture.id, contactId: contacts[6].id, opportunityId: opportunities[4].id, ownerId: USERS.nurul, scheduledAt: daysAgo(3), completedAt: daysAgo(3), durationMinutes: 90, description: 'Price negotiation. CEO requested 15% discount on annual fee.' },
    { activityType: 'FOLLOW_UP', subject: 'Final terms review', accountId: techVenture.id, opportunityId: opportunities[4].id, ownerId: USERS.nurul, scheduledAt: futureDate(2) },
    // Won deal activities
    { activityType: 'MEETING', subject: 'Contract signing — Green Valley', accountId: greenValley.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(10), completedAt: daysAgo(10), durationMinutes: 30, description: 'Supply chain trust contract signed. 3-year term.' },
    { activityType: 'MEETING', subject: 'Contract signing — Penang Property', accountId: penangProp.id, ownerId: USERS.nurul, scheduledAt: daysAgo(25), completedAt: daysAgo(25), durationMinutes: 45, description: 'Escrow trust contract signed.' },
    // Individual account activities
    { activityType: 'CALL', subject: 'Initial consultation with Dr. Nair', accountId: rajeshNair.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(5), completedAt: daysAgo(5), durationMinutes: 30, description: 'Discussed medical practice trust needs.' },
    { activityType: 'CALL', subject: 'Introduction call with Aisha', accountId: aisha.id, ownerId: USERS.nurul, scheduledAt: daysAgo(2), completedAt: daysAgo(2), durationMinutes: 20 },
    { activityType: 'WHATSAPP', subject: 'WhatsApp follow-up — Tan Boon Wah', accountId: boonWah.id, ownerId: USERS.ahmad, scheduledAt: daysAgo(1), completedAt: daysAgo(1), durationMinutes: 10 },
  ];

  for (const a of activities) {
    await prisma.crmActivity.create({
      data: {
        activityType: a.activityType as any,
        subject: a.subject,
        description: a.description,
        userId: a.ownerId,
        accountId: a.accountId,
        contactId: a.contactId || undefined,
        opportunityId: a.opportunityId || undefined,
        leadId: a.leadId || undefined,
        scheduledAt: a.scheduledAt,
        completedAt: a.completedAt || undefined,
        durationMinutes: a.durationMinutes || undefined,
      },
    });
  }

  // ─── 8. Notes ────────────────────────────────────────────────────────────
  console.log('8. Creating notes...');

  const notes: Array<{ content: string; authorId: string; accountId?: string; contactId?: string; opportunityId?: string; isPinned?: boolean }> = [
    { content: 'Key strategic account. Petronas Digital is our top enterprise prospect this quarter. CTO Farid is the champion — ensure all communications go through him first.', authorId: USERS.ahmad, accountId: petronas.id },
    { content: 'Islamic banking compliance is critical for this deal. All trust products must be Shariah-compliant. Coordinate with our Islamic finance team.', authorId: USERS.ahmad, accountId: maybank.id },
    { content: 'CFO Michael Tan is detail-oriented. Provide quantitative ROI comparisons in all proposals. He responds well to case studies.', authorId: USERS.nurul, accountId: genting.id },
    { content: 'HR champion Priya needs board approval by Q3. Expedite proposal turnaround.', authorId: USERS.nurul, accountId: simeDarby.id },
    { content: 'TechVenture CEO Kumar is aggressive negotiator. Stick firm on pricing but offer value-adds (reporting, analytics) instead of discounts.', authorId: USERS.nurul, accountId: techVenture.id },
    { content: 'Contract signed 2026-06-04. Green Valley is our first supply chain trust client — use as reference case.', authorId: USERS.ahmad, accountId: greenValley.id, isPinned: true },
    { content: 'Dr. Nair is a high-net-worth individual. Focus on asset protection and family trust. Medical practice liability is a key concern.', authorId: USERS.ahmad, accountId: rajeshNair.id },
    { content: 'Aisha needs education trust for 2 children. Budget conscious — consider our starter trust package.', authorId: USERS.nurul, accountId: aisha.id },
    { content: 'Ahmad closed the Green Valley deal. Total pipeline contribution RM1.5M this quarter.', authorId: USERS.emily, opportunityId: opportunities[5].id, isPinned: true },
    { content: 'Nurul — please prepare the final TechVenture agreement by end of week. Kumar wants to sign before month-end.', authorId: USERS.emily, opportunityId: opportunities[4].id },
  ];

  for (const n of notes) {
    await prisma.crmNote.create({
      data: {
        content: n.content,
        authorId: n.authorId,
        accountId: n.accountId || undefined,
        contactId: n.contactId || undefined,
        opportunityId: n.opportunityId || undefined,
        isPinned: n.isPinned || false,
      },
    });
  }

  // ─── 9. Update quotas to match pipeline ───────────────────────────────────
  console.log('9. Updating quotas for current quarter...');

  // Update existing quotas to realistic targets
  const existingQuotas = await prisma.crmQuota.findMany();
  for (const q of existingQuotas) {
    // Emily's personal quotas
    if (q.userId === USERS.emily && q.periodType === 'QUARTERLY') {
      await prisma.crmQuota.update({ where: { id: q.id }, data: { targetAmount: 3000000 } });
    }
    if (q.userId === USERS.emily && q.periodType === 'MONTHLY') {
      await prisma.crmQuota.update({ where: { id: q.id }, data: { targetAmount: 1000000 } });
    }
    // Klang Valley territory quota
    if (q.territoryId && q.territoryId === territoryKV) {
      await prisma.crmQuota.update({ where: { id: q.id }, data: { targetAmount: 10000000 } });
    }
    // Northern Region territory quota
    if (q.territoryId && q.territoryId === territoryNR) {
      await prisma.crmQuota.update({ where: { id: q.id }, data: { targetAmount: 7000000 } });
    }
  }

  // Create new quotas for sales team members
  await prisma.crmQuota.create({ data: { userId: USERS.ahmad, period: '2026-Q2', periodType: 'QUARTERLY', targetAmount: 8000000, currency: 'MYR' } });
  await prisma.crmQuota.create({ data: { userId: USERS.nurul, period: '2026-Q2', periodType: 'QUARTERLY', targetAmount: 6000000, currency: 'MYR' } });
  await prisma.crmQuota.create({ data: { userId: USERS.ahmad, period: '2026-06', periodType: 'MONTHLY', targetAmount: 2700000, currency: 'MYR' } });
  await prisma.crmQuota.create({ data: { userId: USERS.nurul, period: '2026-06', periodType: 'MONTHLY', targetAmount: 2000000, currency: 'MYR' } });

  // ─── Done ────────────────────────────────────────────────────────────────
  console.log('\n✅ CRM demo seed complete!');
  console.log(`   Accounts:        ${accounts.length}`);
  console.log(`   Contacts:        ${contacts.length}`);
  console.log(`   Leads:           ${leads.length}`);
  console.log(`   Opportunities:   ${opportunities.length}`);
  console.log(`   Activities:      ${activities.length}`);
  console.log(`   Notes:           ${notes.length}`);
  console.log(`   Quotas:          5 (updated/created)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});