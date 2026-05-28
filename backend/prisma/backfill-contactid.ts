/**
 * Production Backfill Script: Link Leads & Opportunities to Contacts
 *
 * Run ONCE after deploying Sprint 2 changes to production.
 * Idempotent — safe to run multiple times.
 *
 * What it does:
 *   1. Matches crm_leads.contact_email → crm_contacts.email, sets crm_leads.contact_id
 *   2. For converted leads with converted_to_opp_id, copies contact_id to crm_opportunities
 *
 * Usage:
 *   npx ts-node prisma/backfill-contactid.ts
 *   # or with tsx:
 *   npx tsx prisma/backfill-contactid.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillContactIds() {
  console.log('🔄 Backfill: Linking leads to contacts by email...\n');

  // Step 1: Build email → contactId lookup
  const contacts = await prisma.crmContact.findMany({
    select: { id: true, email: true },
  });
  const emailToContactId = new Map<string, string>();
  for (const c of contacts) {
    if (c.email) {
      emailToContactId.set(c.email.toLowerCase(), c.id);
    }
  }
  console.log(`   Found ${contacts.length} contacts with emails`);

  // Step 2: Update leads where contactId is null and contactEmail matches a contact
  const leads = await prisma.crmLead.findMany({
    select: { id: true, contactEmail: true, contactId: true },
  });
  let leadsUpdated = 0;
  for (const lead of leads) {
    if (lead.contactId) continue; // already linked
    if (!lead.contactEmail) continue; // no email to match

    const matchId = emailToContactId.get(lead.contactEmail.toLowerCase());
    if (!matchId) continue; // no matching contact

    await prisma.crmLead.update({
      where: { id: lead.id },
      data: { contactId: matchId },
    });
    leadsUpdated++;
  }
  console.log(`   ✓ ${leadsUpdated} leads linked to contacts`);

  // Step 3: For converted leads, propagate contactId to their opportunities
  const convertedLeads = await prisma.crmLead.findMany({
    where: {
      status: 'CONVERTED',
      contactId: { not: null },
      convertedToOppId: { not: null },
    },
    select: { id: true, contactId: true, convertedToOppId: true },
  });
  let oppsUpdated = 0;
  for (const lead of convertedLeads) {
    if (!lead.convertedToOppId || !lead.contactId) continue;

    // Only update if opportunity contactId is null
    const opp = await prisma.crmOpportunity.findUnique({
      where: { id: lead.convertedToOppId },
      select: { id: true, contactId: true },
    });
    if (!opp || opp.contactId) continue; // already linked or missing

    await prisma.crmOpportunity.update({
      where: { id: opp.id },
      data: { contactId: lead.contactId },
    });
    oppsUpdated++;
  }
  console.log(`   ✓ ${oppsUpdated} opportunities linked to contacts via converted leads`);

  // Step 4: Summary
  console.log('\n--- Backfill Summary ---');
  console.log(`   Leads updated:      ${leadsUpdated}`);
  console.log(`   Opportunities updated: ${oppsUpdated}`);

  // Verify
  const unlinkedLeads = await prisma.crmLead.count({
    where: { contactId: null, contactEmail: { not: null } },
  });
  const unlinkedOpps = await prisma.crmOpportunity.count({
    where: { contactId: null },
  });
  console.log(`   Remaining unlinked leads (no email match): ${unlinkedLeads}`);
  console.log(`   Remaining unlinked opps: ${unlinkedOpps}`);

  if (unlinkedLeads > 0) {
    console.log('\n   ℹ Some leads have contactEmail values that don\'t match any CrmContact.email.');
    console.log('   This is expected if the contact was not created for that lead source.');
  }
}

backfillContactIds()
  .then(() => {
    console.log('\n✅ Backfill complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());