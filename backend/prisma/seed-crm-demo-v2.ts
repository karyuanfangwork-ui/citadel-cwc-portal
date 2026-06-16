/**
 * CRM Demo Seed V2 — comprehensive end-to-end demo data.
 *
 * Covers ALL CRM models in the current schema that make sense for seed data:
 *   ✅ CrmAccount, CrmContact, CrmLead, CrmPipeline, CrmPipelineStage
 *   ✅ CrmOpportunity, CrmOpportunityStageHistory
 *   ✅ CrmActivity, CrmNote
 *   ✅ CrmBeneficiary, CrmTrustProduct, CrmKycRecord
 *   ✅ CrmTerritory, CrmTerritoryMember, CrmQuota
 *   ✅ CrmAccountRequest (links to service desk)
 *   ✅ CrmCustomFieldDefinition (+ custom field values on entities)
 *   ✅ CrmAnomalyConfig
 *   ✅ CrmDashboardLayout
 *   ✅ CrmWorkflow, CrmWorkflowExecution
 *   ✅ BorrowerProfile (CRM → Credit bridge)
 *   ✅ Director, Shareholder (corporate borrower profile)
 *
 * All records tagged with source="PARTNER" or names prefixed with [DEMO].
 *
 * ⚡ RUN:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo-v2.ts
 * 🗑️ REMOVE: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo-remove.ts
 *              (still works — removes all [DEMO]-tagged records)
 */
import { PrismaClient, LeadStatus, LeadSource, CrmActivityType } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_TAG = '[DEMO]';
const DEMO_OWNER_EMAIL = 'emily.chow@citadelgroup.com.my';

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
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

// ─── CONTACTS ─────────────────────────────────────────────────────────────────
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

// ─── LEADS ─────────────────────────────────────────────────────────────────────
const LEADS = [
  { title: `${DEMO_TAG} Family Trust Setup — Kwok Family Office`, status: 'QUALIFIED', source: 'REFERRAL', estimatedValue: 450000, companyName: 'Kwok Family Office', contactName: 'Kwok Wei Ming', contactEmail: 'weiming@kwokfamily.example.my', description: 'Multi-generational trust structure for RM150M+ family portfolio — referred by existing Azman & Lee client' },
  { title: `${DEMO_TAG} Shariah-Compliant Will Writing — Syed Corp`, status: 'CONTACTED', source: 'LINKEDIN', estimatedValue: 180000, companyName: 'Syed Corporation Bhd', contactName: 'Datuk Syed Hamid', contactEmail: 'syed.hamid@syedcorp.example.my', description: 'Group-wide Islamic will writing and wasiyyah for board directors and C-suite' },
  { title: `${DEMO_TAG} Estate Planning Review — Mahani Wealth`, status: 'QUALIFIED', source: 'WEBSITE', estimatedValue: 320000, companyName: 'Mahani Wealth Management', contactName: 'Nurul Ain', contactEmail: 'nurul.ain@mahaniwealth.example.my', description: 'Comprehensive estate planning review for 50+ HNW clients under Mahani management' },
  { title: `${DEMO_TAG} Trust Restructuring — Tan & Partners`, status: 'CONTACTED', source: 'COLD_CALL', estimatedValue: 250000, companyName: 'Tan & Partners Trust Advisory', contactName: 'Datin Seri Rosnah', contactEmail: 'rosnah@tanpartners.example.my', description: 'Restructure 3 existing family trusts to optimise tax position under Budget 2026 changes' },
  { title: `${DEMO_TAG} Probate Administration — Azman & Lee`, status: 'NEW', source: 'PARTNER', estimatedValue: 95000, companyName: 'Azman & Lee Advocates', contactName: 'Azman Bin Ishak', contactEmail: 'azman@azmanlee.example.my', description: 'Probate administration referral for deceased estate valued at RM8.2M' },
  { title: `${DEMO_TAG} Corporate Succession Planning — Syed Corp`, status: 'NEW', source: 'TRADE_SHOW', estimatedValue: 500000, companyName: 'Syed Corporation Bhd', contactName: 'Farah Alzahra', contactEmail: 'farah@syedcorp.example.my', description: 'Cross-shareholder succession plan for 3 key holding companies' },
  { title: `${DEMO_TAG} Unit Trust Distribution — Mahani Wealth`, status: 'LOST', source: 'ADVERTISEMENT', estimatedValue: 75000, companyName: 'Mahani Wealth Management', contactName: 'Jonathan Teh', contactEmail: 'jonathan.t@mahaniwealth.example.my', description: 'Small unit trust distribution matter — budget too low for trust structure', lostReason: 'Client opted for direct distribution instead of trust' },
  { title: `${DEMO_TAG} Digital Asset Trust — Kwok Family`, status: 'NEW', source: 'WEBSITE', estimatedValue: 200000, companyName: 'Kwok Family Office', contactName: 'Kwok Mei Ling', contactEmail: 'meiling@kwokfamily.example.my', description: 'New digital asset (crypto + NFT) trust structure for next-gen wealth transfer' },
  // NEW statuses not in V1 seed:
  { title: `${DEMO_TAG} Family Office Onboarding — Lim Holdings`, status: 'UNQUALIFIED', source: 'COLD_CALL', estimatedValue: 30000, companyName: 'Lim Holdings Sdn Bhd', contactName: 'Lim Chee Wai', contactEmail: 'cheewai@limholdings.example.my', description: 'Cold call — prospect not ready for trust services. Budget below minimum.' },
  { title: `${DEMO_TAG} Corporate Trust Conversion — Tan & Partners`, status: 'CONVERTED', source: 'REFERRAL', estimatedValue: 120000, companyName: 'Tan & Partners Trust Advisory', contactName: 'Datin Seri Rosnah', contactEmail: 'rosnah@tanpartners.example.my', description: 'Referral from RHB Private Banking — converting existing corporate trust' },
];

// ─── OPPORTUNITIES ─────────────────────────────────────────────────────────────
const OPPORTUNITIES = [
  { name: `${DEMO_TAG} Kwok Family Trust — Full Structure`, stageName: 'Proposal', value: 450000, probability: 50, aiWinProbability: 72, aiWinReason: 'Strong referral source, high-value family office client with existing trust assets', expectedCloseDays: 45 },
  { name: `${DEMO_TAG} Syed Corp Shariah Will Package`, stageName: 'Qualification', value: 180000, probability: 25, aiWinProbability: 45, aiWinReason: 'LinkedIn inbound shows intent, but no meeting set yet — typical B2B trust deal', expectedCloseDays: 90 },
  { name: `${DEMO_TAG} Mahani Estate Planning Review`, stageName: 'Negotiation', value: 320000, probability: 75, aiWinProbability: 68, aiWinReason: 'Multiple stakeholder buy-in, proposal under review — typical long sales cycle', expectedCloseDays: 21 },
  { name: `${DEMO_TAG} Tan & Partners Trust Restructuring`, stageName: 'Prospecting', value: 250000, probability: 10, aiWinProbability: 32, aiWinReason: 'Cold call initial contact, interest expressed but no formal engagement', expectedCloseDays: 120 },
  { name: `${DEMO_TAG} Azman & Lee Probate Referral`, stageName: 'Qualification', value: 95000, probability: 25, aiWinProbability: 55, aiWinReason: 'Partner referral typically converts above 50%, moderate estate value', expectedCloseDays: 60 },
  // A Closed Won opportunity
  { name: `${DEMO_TAG} Syed Corp Key-Man Insurance Trust`, stageName: 'Closed Won', value: 250000, probability: 100, aiWinProbability: 100, aiWinReason: 'Deal closed — key-man insurance trust signed 2 months ago', expectedCloseDays: 0, isWon: true },
  // A Closed Lost opportunity
  { name: `${DEMO_TAG} Azman & Lee Cross-Border Estate`, stageName: 'Closed Lost', value: 80000, probability: 0, aiWinProbability: 0, aiWinReason: 'Client decided to handle internally', expectedCloseDays: 0, isLost: true, lostReason: 'Client opted for in-house legal team' },
];

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────
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
  { type: 'NOTE' as CrmActivityType, subject: `${DEMO_TAG} Internal note — compliance review`, description: 'KYC/AML review complete for Kwok Wei Ming. PEP check negative. All documentation verified and filed.' },
  { type: 'EMAIL' as CrmActivityType, subject: `${DEMO_TAG} Contract sent — Syed Corp Key-Man Trust`, description: 'Sent final contract for key-man insurance trust. Both parties signed — deal closed.' },
];

// ─── NOTES ─────────────────────────────────────────────────────────────────────
const NOTES = [
  { content: `${DEMO_TAG} **Kwok Family Trust — Key Decisions**\n\n- Settlor: Kwok Wei Ming (62M)\n- Trustees: Kwok Mei Ling + Citadel Trustee Bhd\n- Beneficiaries: 3 children + 2 grandchildren\n- Asset classes: Property (RM80M), Equities (RM40M), PE (RM30M), Digital (RM2.3M)\n- Priority: Shariah-compliant structure for portion of portfolio`, isPinned: true },
  { content: `${DEMO_TAG} **Mahani Estate Review — Scope Confirmed**\n\n- 50 HNW clients to review\n- 60% require Shariah-compliant options\n- Target completion: Q3 2026\n- Fee structure: RM6,400/client for standard, RM12,000 for complex estates\n- Key contact: Nurul Ain (Head of Private Wealth)`, isPinned: true },
  { content: `${DEMO_TAG} **Syed Corp — Succession Planning Notes**\n\n- 3 holding companies need restructuring\n- Family shareholders want to avoid probate delays\n- Estimated estate value: RM350M across companies\n- Datuk Syed Hamid wants board presentation next week`, isPinned: true },
  { content: `${DEMO_TAG} **General Pipeline Notes**\n\n- Q2 pipeline looking strong at RM1.3M estimated value\n- All deals are trust/estate focused (core competency)\n- Average deal size: RM259K\n- Conversion rate from qualified to closed won: ~40%`, isPinned: false },
  { content: `${DEMO_TAG} **Compliance Reminder**\n\n- All trust setups require KYC/AML checks before deed execution\n- Updated BNM guidelines effective Jan 2026 require enhanced due diligence for PEP clients\n- PEP flag on Datin Seri Rosnah — need compliance clearance`, isPinned: false },
];

// ─── CUSTOM FIELD DEFINITIONS ─────────────────────────────────────────────────
const CUSTOM_FIELD_DEFS = [
  { entity: 'LEAD', fieldKey: 'trust_type_required', label: 'Trust Type Required', fieldType: 'DROPDOWN', group: 'Trust Details', options: JSON.stringify([{ label: 'Family Trust', value: 'FAMILY_TRUST' }, { label: 'Corporate Trust', value: 'CORPORATE_TRUST' }, { label: 'Unit Trust', value: 'UNIT_TRUST' }, { label: 'Insurance Trust', value: 'INSURANCE_TRUST' }, { label: 'Digital Trust', value: 'DIGITAL_TRUST' }]), displayOrder: 1, isSearchable: true },
  { entity: 'LEAD', fieldKey: 'referral_source_detail', label: 'Referral Source Detail', fieldType: 'TEXT', group: 'Source', validation: JSON.stringify({ required: false }), displayOrder: 2, isSearchable: false },
  { entity: 'OPPORTUNITY', fieldKey: 'trust_deed_number', label: 'Trust Deed Reference', fieldType: 'TEXT', group: 'Trust Details', validation: JSON.stringify({ pattern: '^[A-Z]{2}-[A-Z]{3}-\\d{4}-\\d{3}$' }), displayOrder: 1, isSearchable: true },
  { entity: 'OPPORTUNITY', fieldKey: 'mandate_letter_signed', label: 'Mandate Letter Signed', fieldType: 'CHECKBOX', group: 'Documents', displayOrder: 2, isSearchable: true },
  { entity: 'ACCOUNT', fieldKey: 'company_domicile', label: 'Company Domicile', fieldType: 'DROPDOWN', group: 'Legal', options: JSON.stringify([{ label: 'Malaysia', value: 'MY' }, { label: 'Singapore', value: 'SG' }, { label: 'BVI', value: 'BVI' }, { label: 'Cayman Islands', value: 'KY' }]), displayOrder: 1, isSearchable: true },
  { entity: 'ACCOUNT', fieldKey: 'client_tier', label: 'Client Tier', fieldType: 'DROPDOWN', group: 'Classification', options: JSON.stringify([{ label: 'Platinum', value: 'PLATINUM' }, { label: 'Gold', value: 'GOLD' }, { label: 'Silver', value: 'SILVER' }, { label: 'Bronze', value: 'BRONZE' }]), displayOrder: 2, isSearchable: true },
  { entity: 'CONTACT', fieldKey: 'preferred_meeting_time', label: 'Preferred Meeting Time', fieldType: 'DROPDOWN', group: 'Preferences', options: JSON.stringify([{ label: 'Morning (8-12)', value: 'MORNING' }, { label: 'Afternoon (12-5)', value: 'AFTERNOON' }, { label: 'Evening (5-8)', value: 'EVENING' }]), displayOrder: 1, isSearchable: false },
];

// ─── ANOMALY CONFIGS ───────────────────────────────────────────────────────────
const ANOMALY_CONFIGS = [
  { entityType: 'OPPORTUNITY', anomalyType: 'DEAL_STUCK', threshold: 14, severity: 'MODERATE' },
  { entityType: 'OPPORTUNITY', anomalyType: 'PROBABILITY_DROP', threshold: 20, severity: 'CRITICAL' },
  { entityType: 'OPPORTUNITY', anomalyType: 'VELOCITY_ANOMALY', threshold: 2, severity: 'LOW' },
  { entityType: 'LEAD', anomalyType: 'STALE_LEAD', threshold: 30, severity: 'MODERATE' },
];

// ─── WORKFLOW AUTOMATIONS ──────────────────────────────────────────────────────
const WORKFLOWS = [
  {
    name: `${DEMO_TAG} Auto-qualify referral leads`,
    description: 'When a lead is created with source REFERRAL, automatically set status to QUALIFIED and assign to pipeline',
    trigger: JSON.stringify({ entity: 'LEAD', event: 'lead.created', conditions: [{ field: 'source', operator: 'equals', value: 'REFERRAL' }] }),
    actions: JSON.stringify([{ type: 'UPDATE_FIELD', entity: 'LEAD', field: 'status', value: 'QUALIFIED' }, { type: 'CREATE_ACTIVITY', activityType: 'NOTE', subject: 'Auto-qualified: Referral lead' }]),
    executionOrder: 1,
    isActive: true,
  },
  {
    name: `${DEMO_TAG} Flag high-value opportunities`,
    description: 'When an opportunity value exceeds RM200K, create a follow-up task and pin a note',
    trigger: JSON.stringify({ entity: 'OPPORTUNITY', event: 'opportunity.created', conditions: [{ field: 'value', operator: 'greater_than', value: 200000 }] }),
    actions: JSON.stringify([{ type: 'CREATE_ACTIVITY', activityType: 'TASK', subject: 'Review high-value opportunity', description: 'Opportunity exceeds RM200K threshold — requires senior review' }, { type: 'UPDATE_FIELD', entity: 'OPPORTUNITY', field: 'customFields.mandate_letter_signed', value: false }]),
    executionOrder: 2,
    isActive: true,
  },
  {
    name: `${DEMO_TAG} KYC reminder for PEP contacts`,
    description: 'When a contact is created with riskProfile HIGH, create a follow-up activity for KYC review',
    trigger: JSON.stringify({ entity: 'CONTACT', event: 'contact.created', conditions: [{ field: 'riskProfile', operator: 'equals', value: 'HIGH' }] }),
    actions: JSON.stringify([{ type: 'CREATE_ACTIVITY', activityType: 'TASK', subject: 'KYC review required — PEP contact', description: 'Enhanced due diligence required for politically exposed person' }]),
    executionOrder: 3,
    isActive: true,
  },
];

// ─── DASHBOARD LAYOUTS ──────────────────────────────────────────────────────────
const DEFAULT_DASHBOARD_LAYOUT = JSON.stringify([
  { id: 'w1', type: 'pipeline_summary', title: 'Pipeline Overview', col: 0, row: 0, w: 6, h: 4 },
  { id: 'w2', type: 'revenue_forecast', title: 'Revenue Forecast', col: 6, row: 0, w: 6, h: 4 },
  { id: 'w3', type: 'recent_activities', title: 'Recent Activities', col: 0, row: 4, w: 4, h: 4 },
  { id: 'w4', type: 'top_leads', title: 'Top Leads by AI Score', col: 4, row: 4, w: 4, h: 4 },
  { id: 'w5', type: 'upcoming_followups', title: 'Upcoming Follow-ups', col: 8, row: 4, w: 4, h: 4 },
]);

async function main() {
  console.log(`🌱 Starting CRM ${DEMO_TAG} demo V2 seed (owner: ${DEMO_OWNER_EMAIL})...`);

  // ── 0. Find owner user ──
  const owner = await prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL } });
  if (!owner) {
    console.error(`❌ User ${DEMO_OWNER_EMAIL} not found. Run main seed or seed-admin-config first.`);
    process.exit(1);
  }
  console.log(`👤 Owner: ${owner.firstName} ${owner.lastName} (${owner.email})`);

  // Also find other users for territory assignments
  const salesManager = await prisma.user.findUnique({ where: { email: 'salesmanager@test.local' } });
  const salesRep = await prisma.user.findUnique({ where: { email: 'salesrep@test.local' } });

  // ── 1. Create Custom Field Definitions ──
  console.log('\n📋 Creating CRM Custom Field Definitions...');
  let fieldsCreated = 0;
  for (const fd of CUSTOM_FIELD_DEFS) {
    await prisma.crmCustomFieldDefinition.upsert({
      where: { entity_fieldKey: { entity: fd.entity, fieldKey: fd.fieldKey } },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        entity: fd.entity,
        fieldKey: fd.fieldKey,
        label: fd.label,
        fieldType: fd.fieldType,
        group: fd.group || null,
        options: fd.options ? JSON.parse(fd.options as string) : undefined,
        validation: fd.validation ? JSON.parse(fd.validation as string) : undefined,
        displayOrder: fd.displayOrder,
        isSearchable: fd.isSearchable,
      },
    });
    fieldsCreated++;
  }
  console.log(`   ✓ ${fieldsCreated} custom field definitions created`);

  // ── 2. Create Anomaly Configs ──
  console.log('\n⚠️ Creating CRM Anomaly Configs...');
  let anomaliesCreated = 0;
  for (const ac of ANOMALY_CONFIGS) {
    await prisma.crmAnomalyConfig.upsert({
      where: { entityType_anomalyType: { entityType: ac.entityType, anomalyType: ac.anomalyType } },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        entityType: ac.entityType,
        anomalyType: ac.anomalyType,
        threshold: ac.threshold,
        severity: ac.severity,
        isActive: true,
      },
    });
    anomaliesCreated++;
  }
  console.log(`   ✓ ${anomaliesCreated} anomaly configs created`);

  // ── 3. Create Dashboard Layout ──
  console.log('\n📊 Creating CRM Dashboard Layout...');
  await prisma.crmDashboardLayout.upsert({
    where: { userId: owner.id },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      userId: owner.id,
      layout: DEFAULT_DASHBOARD_LAYOUT,
    },
  });
  console.log('   ✓ Dashboard layout created');

  // ── 4. Create Territories & Quotas ──
  console.log('\n🗺️ Creating CRM Territories...');
  const territoryKlangValley = await prisma.crmTerritory.upsert({
    where: { name: `${DEMO_TAG} Klang Valley` },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      name: `${DEMO_TAG} Klang Valley`,
      description: 'Greater Kuala Lumpur, Selangor, and Putrajaya region',
      regions: { states: ['Wilayah Persekutuan', 'Selangor', 'Putrajaya'], countries: ['MY'] },
      isActive: true,
      createdBy: owner.id,
    },
  });
  const territoryNorth = await prisma.crmTerritory.upsert({
    where: { name: `${DEMO_TAG} Northern Region` },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      name: `${DEMO_TAG} Northern Region`,
      description: 'Penang, Kedah, Perak, and northern Malaysia',
      regions: { states: ['Pulau Pinang', 'Kedah', 'Perak'], countries: ['MY'] },
      isActive: true,
      createdBy: owner.id,
    },
  });
  console.log(`   ✓ 2 territories created`);

  // Territory members
  console.log('\n👥 Creating Territory Members...');
  let membersCreated = 0;
  if (salesManager) {
    await prisma.crmTerritoryMember.upsert({
      where: { territoryId_userId: { territoryId: territoryKlangValley.id, userId: salesManager.id } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryKlangValley.id, userId: salesManager.id, role: 'MANAGER' },
    });
    membersCreated++;
  }
  if (salesRep) {
    await prisma.crmTerritoryMember.upsert({
      where: { territoryId_userId: { territoryId: territoryKlangValley.id, userId: salesRep.id } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryKlangValley.id, userId: salesRep.id, role: 'MEMBER' },
    });
    membersCreated++;
    await prisma.crmTerritoryMember.upsert({
      where: { territoryId_userId: { territoryId: territoryNorth.id, userId: salesRep.id } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryNorth.id, userId: salesRep.id, role: 'MEMBER' },
    });
    membersCreated++;
  }
  await prisma.crmTerritoryMember.upsert({
    where: { territoryId_userId: { territoryId: territoryKlangValley.id, userId: owner.id } },
    update: {},
    create: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryKlangValley.id, userId: owner.id, role: 'MEMBER' },
  });
  membersCreated++;
  console.log(`   ✓ ${membersCreated} territory members created`);

  // Quotas
  console.log('\n📈 Creating CRM Quotas...');
  const now = new Date();
  const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Individual quota for owner
  await prisma.crmQuota.create({
    data: { tenantId: DEFAULT_TENANT_ID, userId: owner.id, period: currentQuarter, periodType: 'QUARTERLY', targetAmount: 500000, currency: 'MYR' },
  });
  await prisma.crmQuota.create({
    data: { tenantId: DEFAULT_TENANT_ID, userId: owner.id, period: currentMonth, periodType: 'MONTHLY', targetAmount: 170000, currency: 'MYR' },
  });
  // Territory-level quotas
  await prisma.crmQuota.create({
    data: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryKlangValley.id, period: currentQuarter, periodType: 'QUARTERLY', targetAmount: 800000, currency: 'MYR' },
  });
  await prisma.crmQuota.create({
    data: { tenantId: DEFAULT_TENANT_ID, territoryId: territoryNorth.id, period: currentQuarter, periodType: 'QUARTERLY', targetAmount: 300000, currency: 'MYR' },
  });
  console.log('   ✓ 4 quotas created');

  // ── 5. Create Workflow Automations ──
  console.log('\n⚡ Creating CRM Workflow Automations...');
  let workflowsCreated = 0;
  for (const wf of WORKFLOWS) {
    await prisma.crmWorkflow.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        name: wf.name,
        description: wf.description,
        trigger: wf.trigger,
        actions: wf.actions,
        executionOrder: wf.executionOrder,
        isActive: wf.isActive,
        createdBy: owner.id,
      },
    });
    workflowsCreated++;
  }
  console.log(`   ✓ ${workflowsCreated} workflow automations created`);

  // ── 6. Create Accounts ──
  console.log('\n📦 Creating Demo Accounts...');
  const accounts: Record<string, { id: string }> = {};
  for (const acc of ACCOUNTS) {
    const created = await prisma.crmAccount.create({
      data: {
        ...acc,
        tenantId: DEFAULT_TENANT_ID,
        ownerId: owner.id,
        customFields: acc.accountType === 'CORPORATE'
          ? { client_tier: 'Gold', company_domicile: 'MY' }
          : { client_tier: 'Platinum', company_domicile: 'MY' },
      },
    });
    accounts[acc.name] = created;
    console.log(`   ✓ ${acc.name}`);
  }

  // ── 7. Create Contacts ──
  console.log('\n👥 Creating Demo Contacts...');
  const allContactIds: string[] = [];
  const contactByEmail: Record<string, string> = {};

  for (const [accountName, contactList] of Object.entries(CONTACTS)) {
    const accountId = accounts[accountName]?.id;
    if (!accountId) continue;

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
          nricPassport: contact.nricPassport || null,
          preferredLanguage: contact.preferredLanguage || 'en',
          pdpaConsent: contact.isPrimary,
          pdpaConsentDate: contact.isPrimary ? new Date() : null,
          mobile: contact.mobile || null,
          department: contact.department || null,
          description: contact.description || null,
          riskProfile: contact.riskProfile || null,
          marketingOptIn: contact.marketingOptIn ?? false,
          customFields: contact.isPrimary ? { preferred_meeting_time: 'MORNING' } : {},
        },
      });
      allContactIds.push(created.id);
      contactByEmail[contact.email] = created.id;
      console.log(`   ✓ ${contact.firstName} ${contact.lastName} — ${contact.jobTitle}`);
    }
  }

  // ── 8. Create KYC Records for primary contacts ──
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
          tenantId: DEFAULT_TENANT_ID,
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
          nextScreeningDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          approvedBy: owner.id,
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          notes: `${DEMO_TAG} Demo KYC — verified for trust setup`,
        },
      });
      kycCreated++;
    }
  }
  console.log(`   ✓ ${kycCreated} KYC records created`);

  // ── 9. Create Sales Pipeline ──
  console.log('\n🔀 Creating Demo Pipeline...');
  const existingPipeline = await prisma.crmPipeline.findFirst({ where: { name: `${DEMO_TAG} Sales Pipeline` } });
  let pipeline;
  if (existingPipeline) {
    pipeline = await prisma.crmPipeline.findUnique({ where: { id: existingPipeline.id }, include: { stages: true } });
    console.log(`   Pipeline already exists, reusing: ${pipeline!.name}`);
  } else {
    pipeline = await prisma.crmPipeline.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
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

  // ── 10. Create Leads ──
  console.log('\n🎯 Creating Demo Leads...');
  const accountNames = Object.keys(accounts);
  let leadsCreated = 0;
  const leadScores = [82, 58, 74, 35, 61, 43, 12, 55, 20, 95];
  const leadScoreReasons = [
    'High-value referral with strong contact info. Multiple touchpoints.',
    'LinkedIn inbound — warm lead with verified email. Needs meeting.',
    'Website inquiry for 50+ clients. High estimated value, strong buyer signals.',
    'Cold call — interest expressed but no formal engagement yet.',
    'Partner referral — probate cases convert well. Moderate value.',
    'Trade show lead — large corporate. Initial interest only.',
    'Low conversion probability — budget below threshold and client chose alternative.',
    'Website inquiry for new digital asset trust product. Growing market.',
    'Unqualified — prospect not ready, budget below minimum.',
    'Converted from referral — already moved to opportunity pipeline.',
  ];

  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    const randomAccountName = accountNames[i % accountNames.length] || accountNames[0];
    await prisma.crmLead.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        title: lead.title,
        status: lead.status as LeadStatus,
        source: lead.source as LeadSource,
        ownerId: owner.id,
        accountId: accounts[randomAccountName]?.id || null,
        contactId: contactByEmail[lead.contactEmail] || null,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        companyName: lead.companyName,
        estimatedValue: lead.estimatedValue,
        description: lead.description,
        lostReason: (lead as any).lostReason || null,
        followUpDate: i < 5 ? new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000) : null,
        followUpNote: i < 5 ? `${DEMO_TAG} Follow up on ${lead.title}` : null,
        // Pre-populate AI scores
        aiScore: leadScores[i],
        aiScoreReason: leadScoreReasons[i],
        aiScoredAt: new Date(),
        territoryId: lead.companyName?.includes('Syed') ? territoryNorth.id : (lead.companyName?.includes('Mahani') ? territoryKlangValley.id : null),
        // Custom fields
        customFields: lead.source === 'REFERRAL' ? { trust_type_required: 'FAMILY_TRUST', referral_source_detail: 'Existing client referral via RHB Private Banking' } : {},
      },
    });
    leadsCreated++;
  }
  console.log(`   ✓ ${leadsCreated} leads created (with AI scores, territories, custom fields)`);

  // ── 11. Create Opportunities ──
  console.log('\n💰 Creating Demo Opportunities...');
  let oppsCreated = 0;
  const opportunityIds: string[] = [];

  for (const opp of OPPORTUNITIES) {
    const aName = accountNames[oppsCreated % accountNames.length] || accountNames[0];
    const accountId = accounts[aName].id;
    const stageId = stageMap[opp.stageName];
    if (!stageId) {
      console.warn(`   ⚠ Stage "${opp.stageName}" not found, skipping opportunity: ${opp.name}`);
      continue;
    }

    const accountContacts = CONTACTS[Object.keys(CONTACTS)[oppsCreated % Object.keys(CONTACTS).length]] || Object.values(CONTACTS)[0];
    const primaryContact = accountContacts?.find(c => c.isPrimary);
    const contactId = primaryContact ? contactByEmail[primaryContact.email] : null;

    const createdOpp = await prisma.crmOpportunity.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        name: opp.name,
        accountId,
        contactId,
        pipelineId: pipeline!.id,
        stageId,
        ownerId: owner.id,
        value: opp.value,
        currency: 'MYR',
        probability: opp.probability,
        expectedCloseDate: opp.isWon ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) : (opp.isLost ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + opp.expectedCloseDays * 24 * 60 * 60 * 1000)),
        description: `${DEMO_TAG} Trust & estate planning opportunity`,
        wonAt: opp.isWon ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) : null,
        lostAt: opp.isLost ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        lostReason: opp.lostReason || null,
        // AI win probability
        aiWinProbability: opp.aiWinProbability,
        aiWinReason: opp.aiWinReason,
        aiScoredAt: new Date(),
        // Custom fields
        customFields: { trust_deed_number: opp.isWon ? 'CT-SYD-2024-011' : null, mandate_letter_signed: opp.isWon || opp.stageName === 'Negotiation' },
      },
    });
    opportunityIds.push(createdOpp.id);
    oppsCreated++;
  }
  console.log(`   ✓ ${oppsCreated} opportunities created (with AI win probability, custom fields)`);

  // ── 12. Create Opportunity Stage History ──
  console.log('\n📜 Creating Opportunity Stage History...');
  let historyCreated = 0;
  const stageNames = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'];

  // For the "Mahani Estate Planning Review" opportunity (Negotiation stage), add progression history
  const negotiationOppId = opportunityIds[2]; // 3rd opportunity = Mahani Estate Review
  if (negotiationOppId) {
    for (let i = 0; i < stageNames.length - 1; i++) {
      if (i === 3) break; // Stop at Negotiation (current stage)
      await prisma.crmOpportunityStageHistory.create({
        data: {
          opportunityId: negotiationOppId,
          fromStageName: i === 0 ? null : stageNames[i - 1],
          toStageName: stageNames[i],
          movedByUserId: owner.id,
          movedAt: new Date(Date.now() - (30 - i * 7) * 24 * 60 * 60 * 1000),
        },
      });
      historyCreated++;
    }
  }

  // For the "Kwok Family Trust" opportunity (Proposal stage), add history
  const proposalOppId = opportunityIds[0];
  if (proposalOppId) {
    const proposalStages = ['Prospecting', 'Qualification', 'Proposal'];
    for (let i = 0; i < proposalStages.length; i++) {
      await prisma.crmOpportunityStageHistory.create({
        data: {
          opportunityId: proposalOppId,
          fromStageName: i === 0 ? null : proposalStages[i - 1],
          toStageName: proposalStages[i],
          movedByUserId: owner.id,
          movedAt: new Date(Date.now() - (21 - i * 7) * 24 * 60 * 60 * 1000),
        },
      });
      historyCreated++;
    }
  }

  // For the "Closed Won" opportunity, add full progression
  const wonOppId = opportunityIds[5]; // Syed Corp Key-Man Trust
  if (wonOppId) {
    for (let i = 0; i < stageNames.length; i++) {
      await prisma.crmOpportunityStageHistory.create({
        data: {
          opportunityId: wonOppId,
          fromStageName: i === 0 ? null : stageNames[i - 1],
          toStageName: stageNames[i],
          movedByUserId: owner.id,
          movedAt: new Date(Date.now() - (90 - i * 15) * 24 * 60 * 60 * 1000),
        },
      });
      historyCreated++;
    }
  }
  console.log(`   ✓ ${historyCreated} stage history records created`);

  // ── 13. Create Activities ──
  console.log('\n📅 Creating Demo Activities...');
  let activitiesCreated = 0;

  for (let i = 0; i < ACTIVITIES.length; i++) {
    const act = ACTIVITIES[i];
    const accountName = accountNames[i % accountNames.length] || accountNames[0];
    const accountId = accounts[accountName].id;
    const contactId = allContactIds[i % allContactIds.length] || null;

    // Link some activities to opportunities
    const opportunityId = i < opportunityIds.length ? opportunityIds[i] : null;

    await prisma.crmActivity.create({
      data: {
        activityType: act.type,
        subject: act.subject,
        description: act.description,
        userId: owner.id,
        accountId,
        contactId,
        opportunityId: opportunityId,
        scheduledAt: new Date(Date.now() + (i - 5) * 24 * 60 * 60 * 1000),
        completedAt: i < 8 ? new Date(Date.now() - i * 24 * 60 * 60 * 1000) : null,
        durationMinutes: 30 + (i % 4) * 15,
      },
    });
    activitiesCreated++;
  }
  console.log(`   ✓ ${activitiesCreated} activities created`);

  // ── 14. Create Notes ──
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

  // ── 15. Create Beneficiaries ──
  console.log('\n👨‍👩‍👧‍👦 Creating Demo Beneficiaries...');
  let beneficiariesCreated = 0;

  // Kwok family
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
          guardianName: (b as any).guardianName || null,
          notes: b.notes || null,
        },
      });
      beneficiariesCreated++;
    }
  }

  // Syed Corp
  const syedHamidContactId = contactByEmail['syed.hamid@syedcorp.example.my'];
  if (syedHamidContactId) {
    const syedBeneficiaries = [
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
          notes: b.notes || null,
        },
      });
      beneficiariesCreated++;
    }
  }
  console.log(`   ✓ ${beneficiariesCreated} beneficiaries created`);

  // ── 16. Create Trust Products ──
  console.log('\n🏦 Creating Demo Trust Products...');
  let trustProductsCreated = 0;

  // Kwok family Trust Products
  const kwokAccountName = `${DEMO_TAG} Kwok Family Office`;
  const kwokAccountId = accounts[kwokAccountName]?.id;
  const kwokWeiMingId = contactByEmail['weiming@kwokfamily.example.my'];
  if (kwokAccountId) {
    const kwokTrustProducts = [
      { trustType: 'FAMILY_TRUST', deedRefNumber: 'TD-KWK-2024-001', status: 'ACTIVE', assetValue: 80000000, assetDescription: 'Combined property and equity portfolio — 3 commercial properties (KL Sentral, Bukit Damansara, Penang) + Bursa Malaysia blue chips', trusteeName: 'Citadel Trustee Bhd', trusteeContact: '+60 3-2780 9900', settlementDate: null, maturityDate: null, nextReviewDate: new Date('2026-07-01') },
      { trustType: 'UNIT_TRUST', deedRefNumber: 'UT-KWK-2025-002', status: 'ACTIVE', assetValue: 40000000, assetDescription: 'Unit trust portfolio — diversified across Shariah-compliant equity funds and bond funds', trusteeName: 'Citadel Trustee Bhd', trusteeContact: '+60 3-2780 9900', settlementDate: new Date('2024-01-15'), maturityDate: new Date('2034-01-15'), nextReviewDate: new Date('2026-04-01') },
      { trustType: 'DIGITAL_TRUST', deedRefNumber: 'DT-KWK-2026-003', status: 'PENDING', assetValue: 2300000, assetDescription: 'Digital assets — Bitcoin (15 BTC), Ethereum (80 ETH), and NFT portfolio', trusteeName: 'Citadel Digital Custody Sdn Bhd', trusteeContact: '+60 3-2780 9950', settlementDate: null, maturityDate: null, nextReviewDate: new Date('2026-06-01') },
    ];
    for (const tp of kwokTrustProducts) {
      // Link the first (active family trust) to the "Closed Won" opportunity
      const oppId = tp.status === 'ACTIVE' && tp.trustType === 'FAMILY_TRUST' ? null : null;
      await prisma.crmTrustProduct.create({
        data: {
          accountId: kwokAccountId,
          contactId: kwokWeiMingId || null,
          opportunityId: oppId,
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

  // Syed Corp Trust Products
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

  // Mahani Trust Product
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

  // Tan & Partners Trust Product
  const tanAccountName = `${DEMO_TAG} Tan & Partners Trust Advisory`;
  const tanAccountId = accounts[tanAccountName]?.id;
  if (tanAccountId) {
    await prisma.crmTrustProduct.create({
      data: {
        accountId: tanAccountId,
        contactId: contactByEmail['rosnah@tanpartners.example.my'] || null,
        trustType: 'FAMILY_TRUST',
        deedRefNumber: 'FT-TNP-2025-007',
        status: 'ACTIVE',
        assetValue: 12000000,
        currency: 'MYR',
        assetDescription: '3 existing family trust restructuring — Datin Seri Rosnah family portfolio',
        trusteeName: 'Citadel Trustee Bhd',
        trusteeContact: '+60 3-2780 9900',
        settlementDate: new Date('2023-06-15'),
        maturityDate: new Date('2043-06-15'),
        nextReviewDate: new Date('2026-06-15'),
        ownerId: owner.id,
      },
    });
    trustProductsCreated++;
  }
  console.log(`   ✓ ${trustProductsCreated} trust products created`);

  // ── 17. Create BorrowerProfiles (CRM → Credit bridge) ──
  console.log('\n🏦 Creating Demo BorrowerProfiles (CRM → Credit bridge)...');
  let borrowerProfilesCreated = 0;

  // Kwok Family Office → INDIVIDUAL BorrowerProfile
  if (kwokAccountId) {
    await prisma.borrowerProfile.create({
      data: {
        accountId: kwokAccountId,
        borrowerType: 'INDIVIDUAL',
        name: 'Kwok Wei Ming',
        creditRiskRating: 'A',
        amlRiskTier: 'MEDIUM',
        exposureLimit: 80000000,
        totalExposure: 45000000,
        isSanctionedEntity: false,
        sourceOfWealth: 'Family business inheritance and investment portfolio',
        purposeOfAccount: 'Trust setup and wealth management',
        occupation: 'Business Owner',
        employer: 'Kwok Family Office',
        annualIncome: 5000000,
        netWorth: 150000000,
        isActive: true,
      },
    });
    borrowerProfilesCreated++;
  }

  // Syed Corporation → CORPORATE BorrowerProfile
  if (syedAccountId) {
    await prisma.borrowerProfile.create({
      data: {
        accountId: syedAccountId,
        borrowerType: 'CORPORATE',
        name: 'Syed Corporation Bhd',
        creditRiskRating: 'AA',
        amlRiskTier: 'HIGH',
        exposureLimit: 150000000,
        totalExposure: 95000000,
        isSanctionedEntity: false,
        sourceOfWealth: 'Diversified conglomerate operations',
        purposeOfAccount: 'Corporate trust and succession planning',
        annualIncome: 350000000,
        netWorth: 500000000,
        isActive: true,
      },
    });
    borrowerProfilesCreated++;
  }

  // Mahani Wealth → CORPORATE BorrowerProfile
  if (mahaniAccountId) {
    await prisma.borrowerProfile.create({
      data: {
        accountId: mahaniAccountId,
        borrowerType: 'CORPORATE',
        name: 'Mahani Wealth Management',
        creditRiskRating: 'A',
        amlRiskTier: 'MEDIUM',
        exposureLimit: 32000000,
        totalExposure: 12000000,
        isSanctionedEntity: false,
        sourceOfWealth: 'Asset management fees and advisory services',
        purposeOfAccount: 'Unit trust distribution management',
        annualIncome: 80000000,
        netWorth: 200000000,
        isActive: true,
      },
    });
    borrowerProfilesCreated++;
  }
  console.log(`   ✓ ${borrowerProfilesCreated} borrower profiles created`);

  // ── 18. Create Directors & Shareholders (for corporate borrowers) ──
  console.log('\n👔 Creating Demo Directors & Shareholders...');
  let directorsCreated = 0;
  let shareholdersCreated = 0;

  // Syed Corp Directors
  const syedBorrowerProfile = await prisma.borrowerProfile.findFirst({ where: { accountId: syedAccountId } });
  if (syedBorrowerProfile) {
    const syedDirectors = [
      { name: 'Datuk Syed Hamid', position: 'Group CEO', isExecutive: true, isKeyManagement: true, appointmentDate: new Date('2005-03-15'), dateOfBirth: new Date('1968-07-12'), nationality: 'Malaysian', experienceQualification: 'MBA from Harvard Business School, 30+ years in corporate leadership', contactId: syedHamidContactId },
      { name: 'Farah Alzahra', position: 'Group Legal Counsel', isExecutive: true, isKeyManagement: true, appointmentDate: new Date('2015-08-01'), dateOfBirth: new Date('1980-04-22'), nationality: 'Malaysian', experienceQualification: 'LLB from University of Malaya, specialist in corporate succession law' },
      { name: 'Syed Aiman', position: 'Group COO', isExecutive: true, isKeyManagement: true, appointmentDate: new Date('2020-01-10'), dateOfBirth: new Date('1992-07-10'), nationality: 'Malaysian', experienceQualification: 'BSc from LSE, operations management experience in manufacturing' },
    ];
    for (const d of syedDirectors) {
      await prisma.director.create({
        data: {
          borrowerProfileId: syedBorrowerProfile.id,
          name: d.name,
          position: d.position,
          isExecutive: d.isExecutive,
          isKeyManagement: d.isKeyManagement,
          appointmentDate: d.appointmentDate,
          dateOfBirth: d.dateOfBirth,
          nationality: d.nationality,
          experienceQualification: d.experienceQualification,
          contactId: d.contactId || null,
        },
      });
      directorsCreated++;
    }

    const syedShareholders = [
      { name: 'Datuk Syed Hamid', shareholdingPct: 45, shareClass: 'Ordinary', numberOfShares: 4500000, dateOfBirthOrIncorporation: new Date('1968-07-12'), nationality: 'Malaysian', contactId: syedHamidContactId },
      { name: 'Syed Zara', shareholdingPct: 15, shareClass: 'Ordinary', numberOfShares: 1500000, dateOfBirthOrIncorporation: new Date('1970-09-02'), nationality: 'Malaysian' },
      { name: 'Syed Corp Holdings Sdn Bhd', shareholdingPct: 25, shareClass: 'Ordinary', numberOfShares: 2500000, dateOfBirthOrIncorporation: new Date('1995-01-01'), nationality: 'Malaysian', businessRegNo: '199501010077' },
      { name: 'Amanah Raya Berhad (Trustee)', shareholdingPct: 15, shareClass: 'Preference', numberOfShares: 1500000, dateOfBirthOrIncorporation: new Date('1960-05-01'), nationality: 'Malaysian', businessRegNo: '196001000321' },
    ];
    for (const s of syedShareholders) {
      await prisma.shareholder.create({
        data: {
          borrowerProfileId: syedBorrowerProfile.id,
          name: s.name,
          shareholdingPct: s.shareholdingPct,
          shareClass: s.shareClass,
          numberOfShares: s.numberOfShares,
          dateOfBirthOrIncorporation: s.dateOfBirthOrIncorporation,
          nationality: s.nationality,
          businessRegNo: (s as any).businessRegNo || null,
          contactId: s.contactId || null,
        },
      });
      shareholdersCreated++;
    }
  }

  // Mahani Wealth Directors
  const mahaniBorrowerProfile = await prisma.borrowerProfile.findFirst({ where: { accountId: mahaniAccountId } });
  if (mahaniBorrowerProfile) {
    const mahaniDirectors = [
      { name: 'Nurul Ain Binti Abdullah', position: 'Head of Private Wealth / Director', isExecutive: true, isKeyManagement: true, appointmentDate: new Date('2018-06-01'), dateOfBirth: new Date('1985-05-15'), nationality: 'Malaysian', experienceQualification: 'CFA, MBA from INSEAD, 15 years in wealth management', contactId: contactByEmail['nurul.ain@mahaniwealth.example.my'] },
      { name: 'Ahmad Farouk', position: 'CEO', isExecutive: true, isKeyManagement: true, appointmentDate: new Date('2015-01-01'), dateOfBirth: new Date('1975-11-20'), nationality: 'Malaysian', experienceQualification: 'BSc in Finance from UM, 20+ years in banking' },
    ];
    for (const d of mahaniDirectors) {
      await prisma.director.create({
        data: {
          borrowerProfileId: mahaniBorrowerProfile.id,
          name: d.name,
          position: d.position,
          isExecutive: d.isExecutive,
          isKeyManagement: d.isKeyManagement,
          appointmentDate: d.appointmentDate,
          dateOfBirth: d.dateOfBirth,
          nationality: d.nationality,
          experienceQualification: d.experienceQualification,
          contactId: d.contactId || null,
        },
      });
      directorsCreated++;
    }
  }

  console.log(`   ✓ ${directorsCreated} directors created`);
  console.log(`   ✓ ${shareholdersCreated} shareholders created`);

  // ── 19. Create CrmAccountRequest links (CRM ↔ Service Desk) ──
  console.log('\n🔗 Creating Demo CRM Account-Request Links...');
  let linksCreated = 0;
  // Find some existing requests to link
  const existingRequests = await prisma.request.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (existingRequests.length > 0) {
    for (let i = 0; i < Math.min(existingRequests.length, accountNames.length); i++) {
      const accountId = accounts[accountNames[i]]?.id;
      if (accountId) {
        await prisma.crmAccountRequest.create({
          data: {
            accountId,
            requestId: existingRequests[i].id,
          },
        }).catch(() => { /* skip if duplicate */ });
        linksCreated++;
      }
    }
  }
  console.log(`   ✓ ${linksCreated} account-request links created`);

  // ── Summary ──
  console.log(`\n✅ CRM ${DEMO_TAG} demo V2 seed completed!`);
  console.log('\n📊 Summary:');
  console.log(`   • Owner:          ${owner.firstName} ${owner.lastName} (${DEMO_OWNER_EMAIL})`);
  console.log(`   • Accounts:       ${ACCOUNTS.length}`);
  console.log(`   • Contacts:       ${Object.values(CONTACTS).flat().length}`);
  console.log(`   • KYC:            ${kycCreated}`);
  console.log(`   • Beneficiaries:  ${beneficiariesCreated}`);
  console.log(`   • Trust Products: ${trustProductsCreated}`);
  console.log(`   • Pipeline:       1 (${pipeline!.stages.length} stages)`);
  console.log(`   • Leads:          ${leadsCreated} (AI scores + territories + custom fields)`);
  console.log(`   • Opportunities:  ${oppsCreated} (AI win prob + stage history + custom fields)`);
  console.log(`   • Stage History:  ${historyCreated}`);
  console.log(`   • Activities:     ${activitiesCreated} (incl. lead/opportunity links)`);
  console.log(`   • Notes:          ${notesCreated}`);
  console.log(`   • Borrower Prof:  ${borrowerProfilesCreated}`);
  console.log(`   • Directors:      ${directorsCreated}`);
  console.log(`   • Shareholders:   ${shareholdersCreated}`);
  console.log(`   • Territories:    2 + ${membersCreated} members`);
  console.log(`   • Quotas:         4`);
  console.log(`   • Custom Fields:  ${fieldsCreated}`);
  console.log(`   • Anomaly Config: ${anomaliesCreated}`);
  console.log(`   • Dashboard:      1 layout`);
  console.log(`   • Workflows:      ${workflowsCreated}`);
  console.log(`   • Acct-Req Links: ${linksCreated}`);
  console.log('\n🔑 Login as emily.chow@citadelgroup.com.my to experience:');
  console.log('   • Dashboard → Auto-loaded daily briefing + widgets');
  console.log('   • Leads → Priority sort by AI score + custom fields');
  console.log('   • Opportunities → AI win probability badges + stage history');
  console.log('   • Pipeline → AI badges on kanban cards');
  console.log('   • Contact Detail → Auto-loaded KYC gaps & risk profile');
  console.log('   • Accounts → Custom fields (client tier, domicile)');
  console.log('   • Territories → Klang Valley & Northern Region with quotas');
  console.log('   • Workflows → Auto-qualify referral leads, flag high-value opps');
  console.log('   • Anomaly Detection → Configured for deal stuck & stale leads');
  console.log('   • Borrower Profiles → Linked to Credit module');
  console.log('\n🗑️ To remove all demo data, run:');
  console.log('   npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/seed-crm-demo-remove.ts');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });